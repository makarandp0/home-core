"""FastAPI document processing service."""

import base64

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .config import MAX_FILE_SIZE, VERSION
from .models import DocumentData, HealthResponse, ProcessingResult, ProcessRequest
from .processors import extract_pdf_text, ocr_image, ocr_pdf_pages

app = FastAPI(
    title="Document Processor",
    description="PDF and image text extraction service",
    version="0.1.0",
)


def is_pdf(filename: str) -> bool:
    """Check if file is a PDF based on extension."""
    return filename.lower().endswith(".pdf")


def is_image(filename: str) -> bool:
    """Check if file is a supported image format."""
    extensions = (".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp")
    return filename.lower().endswith(extensions)


async def process_document_bytes(
    file_bytes: bytes, filename: str
) -> DocumentData | dict[str, str]:
    """
    Process document bytes and extract text.

    Returns DocumentData on success, or dict with error on failure.
    """
    if len(file_bytes) > MAX_FILE_SIZE:
        return {"error": f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB"}

    if is_pdf(filename):
        # Try native PDF text extraction first
        text, page_count = extract_pdf_text(file_bytes)

        if text.strip():
            return DocumentData(
                text=text,
                page_count=page_count,
                method="native",
                confidence=None,
            )

        # Fall back to OCR for scanned PDFs
        text, page_count, confidence = ocr_pdf_pages(file_bytes)
        return DocumentData(
            text=text,
            page_count=page_count,
            method="ocr",
            confidence=confidence,
        )

    elif is_image(filename):
        text, confidence = ocr_image(file_bytes)
        return DocumentData(
            text=text,
            page_count=1,
            method="ocr",
            confidence=confidence,
        )

    else:
        return {"error": f"Unsupported file type: {filename}"}


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(ok=True, version=VERSION)


@app.post("/process", response_model=ProcessingResult)
async def process_upload(file: UploadFile = File(...)) -> ProcessingResult:
    """
    Process an uploaded document file.

    Accepts PDF or image files up to 10MB.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    file_bytes = await file.read()
    result = await process_document_bytes(file_bytes, file.filename)

    if isinstance(result, dict) and "error" in result:
        return ProcessingResult(ok=False, error=result["error"])

    return ProcessingResult(ok=True, data=result)


@app.post("/process/base64", response_model=ProcessingResult)
async def process_base64(request: ProcessRequest) -> ProcessingResult:
    """
    Process a base64-encoded document.

    Used for API-to-API communication from the Fastify backend.
    """
    try:
        file_bytes = base64.b64decode(request.file_data)
    except Exception:
        return ProcessingResult(ok=False, error="Invalid base64 encoding")

    result = await process_document_bytes(file_bytes, request.filename)

    if isinstance(result, dict) and "error" in result:
        return ProcessingResult(ok=False, error=result["error"])

    return ProcessingResult(ok=True, data=result)


@app.exception_handler(Exception)
async def global_exception_handler(_request, exc: Exception) -> JSONResponse:
    """Global exception handler for consistent error responses."""
    return JSONResponse(
        status_code=500,
        content={"ok": False, "error": str(exc)},
    )
