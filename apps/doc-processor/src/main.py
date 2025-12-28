"""FastAPI document processing service."""

import base64

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .config import MAX_FILE_SIZE, VERSION
from .models import (
    DocumentData,
    FaceCacheClearResult,
    FaceCacheInfo,
    FaceCompareBody,
    FaceCompareResult,
    FaceEmbedResult,
    FaceImageBody,
    FaceLoadModelBody,
    FaceLoadModelResult,
    HealthResponse,
    ProcessingResult,
    ProcessRequest,
    ThumbnailData,
    ThumbnailRequest,
    ThumbnailResult,
)
from .processors import (
    extract_pdf_text,
    face_clear_cache,
    face_compare,
    face_embed,
    face_get_cache_info,
    face_get_model_info,
    face_load_model,
    ocr_image,
    ocr_pdf_pages,
    pdf_first_page_thumbnail,
)

app = FastAPI(
    title="Document Processor",
    description="PDF and image text extraction service with face recognition",
    version="0.1.0",
)


@app.on_event("startup")
def startup_event() -> None:
    """Initialize service - face models are loaded on-demand."""
    print("[doc-processor] Started - face models will be loaded on-demand via /face/load-model")


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
    model_info = face_get_model_info()
    return HealthResponse(
        ok=True,
        version=VERSION,
        face_model_loaded=model_info["loaded"],
        face_model=model_info["model"],
    )


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


@app.post("/thumbnail/base64", response_model=ThumbnailResult)
async def generate_pdf_thumbnail(request: ThumbnailRequest) -> ThumbnailResult:
    """
    Generate a thumbnail from the first page of a PDF.

    Used for showing document previews in the document list.
    """
    try:
        file_bytes = base64.b64decode(request.file_data)
    except Exception:
        return ThumbnailResult(ok=False, error="Invalid base64 encoding")

    try:
        image_bytes, width, height = pdf_first_page_thumbnail(file_bytes, request.size)
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        return ThumbnailResult(
            ok=True,
            data=ThumbnailData(
                image=image_base64,
                width=width,
                height=height,
            ),
        )
    except ValueError as e:
        return ThumbnailResult(ok=False, error=str(e))
    except Exception as e:
        return ThumbnailResult(ok=False, error=f"Failed to generate thumbnail: {e}")


# Face recognition endpoints


def _strip_data_url(b64: str) -> str:
    """Strip data URL prefix if present."""
    if b64.startswith("data:"):
        parts = b64.split(",", 1)
        return parts[1] if len(parts) > 1 else ""
    return b64


@app.post("/face/embed", response_model=FaceEmbedResult)
async def face_embed_endpoint(body: FaceImageBody) -> FaceEmbedResult:
    """
    Generate face embedding from image.

    Returns the embedding vector for the largest detected face.
    """
    b64 = _strip_data_url(body.image_b64)
    if not b64:
        return FaceEmbedResult(ok=False, error="Invalid image payload")

    try:
        vec, meta = face_embed(b64)
        if vec is None:
            return FaceEmbedResult(ok=False, error="No face found", meta=meta)
        return FaceEmbedResult(ok=True, vector=vec.tolist(), meta=meta)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/face/compare", response_model=FaceCompareResult)
async def face_compare_endpoint(body: FaceCompareBody) -> FaceCompareResult:
    """
    Compare two face images and return similarity.

    Returns distance (0=identical, 2=opposite) and match boolean based on threshold.
    """
    a = _strip_data_url(body.a_b64)
    b = _strip_data_url(body.b_b64)

    if not a:
        return FaceCompareResult(ok=False, error="Invalid image payload for a")
    if not b:
        return FaceCompareResult(ok=False, error="Invalid image payload for b")

    try:
        dist, meta = face_compare(a, b)
        if dist is None:
            return FaceCompareResult(ok=False, error=meta.get("error", "No face found"), meta=meta)

        th = body.threshold
        match = dist <= th
        return FaceCompareResult(
            ok=True,
            distance=float(dist),
            threshold=th,
            match=match,
            meta=meta,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/face/model")
async def face_model_info() -> dict:
    """Get face model loading status."""
    return {"ok": True, **face_get_model_info()}


@app.post("/face/load-model", response_model=FaceLoadModelResult)
async def face_load_model_endpoint(body: FaceLoadModelBody) -> FaceLoadModelResult:
    """
    Load a face recognition model on demand.

    Models are downloaded on first use. Supports:
    - buffalo_l (large, ~1.5GB, more accurate) - default
    - buffalo_s (small, ~500MB, faster)
    """
    try:
        face_load_model(body.model)
        return FaceLoadModelResult(
            ok=True,
            message=f"Model '{body.model}' loaded successfully",
            model=body.model,
        )
    except ValueError as e:
        return FaceLoadModelResult(ok=False, error=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load model: {e}")


@app.get("/face/cache/info", response_model=FaceCacheInfo)
async def face_cache_info() -> FaceCacheInfo:
    """Get face embedding cache statistics."""
    info = face_get_cache_info()
    return FaceCacheInfo(ok=True, **info)


@app.post("/face/cache/clear", response_model=FaceCacheClearResult)
async def face_cache_clear() -> FaceCacheClearResult:
    """Clear all cached face embeddings."""
    result = face_clear_cache()
    return FaceCacheClearResult(ok=True, message="Cache cleared", **result)


@app.exception_handler(Exception)
async def global_exception_handler(_request, exc: Exception) -> JSONResponse:
    """Global exception handler for consistent error responses."""
    return JSONResponse(
        status_code=500,
        content={"ok": False, "error": str(exc)},
    )
