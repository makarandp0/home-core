"""FastAPI document processing service."""

import base64
import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .config import (
    LOG_LEVEL,
    MAX_FILE_SIZE,
    MAX_IMAGES_TO_OCR,
    MIN_IMAGE_SIZE_FOR_OCR,
    NATIVE_TEXT_THRESHOLD,
    VERSION,
)
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
    extract_pdf_text_and_images,
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

# Configure logging (level configurable via LOG_LEVEL env var, default INFO)
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

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
        logger.info("[PDF] Processing file: %s (%d bytes)", filename, len(file_bytes))

        # Extract native PDF text and embedded images in a single pass
        native_text, page_count, embedded_images = extract_pdf_text_and_images(file_bytes)
        native_text_stripped = native_text.strip()

        logger.info(
            "[PDF] Extraction complete: %d pages, %d chars native text, %d embedded images",
            page_count,
            len(native_text_stripped),
            len(embedded_images),
        )

        # Skip image OCR if we have meaningful native text
        if len(native_text_stripped) > NATIVE_TEXT_THRESHOLD:
            logger.info(
                "[PDF] Skipping image OCR: native text (%d chars) exceeds threshold (%d)",
                len(native_text_stripped),
                NATIVE_TEXT_THRESHOLD,
            )
            logger.info("[PDF] Result: method=native, %d chars", len(native_text_stripped))
            return DocumentData(
                text=native_text,
                page_count=page_count,
                method="native",
                confidence=None,
            )

        # Filter images: skip small images (likely decorative)
        images_to_ocr = [
            img for img in embedded_images if len(img) >= MIN_IMAGE_SIZE_FOR_OCR
        ]
        skipped_count = len(embedded_images) - len(images_to_ocr)
        if skipped_count > 0:
            logger.info(
                "[PDF] Filtered out %d small images (< %d bytes)",
                skipped_count,
                MIN_IMAGE_SIZE_FOR_OCR,
            )

        # Limit number of images to OCR for performance
        if len(images_to_ocr) > MAX_IMAGES_TO_OCR:
            logger.info(
                "[PDF] Limiting OCR to %d images (found %d eligible)",
                MAX_IMAGES_TO_OCR,
                len(images_to_ocr),
            )
            images_to_ocr = images_to_ocr[:MAX_IMAGES_TO_OCR]

        logger.info("[PDF] Will OCR %d embedded images", len(images_to_ocr))

        # OCR filtered images
        image_texts: list[str] = []
        image_confidences: list[float] = []

        for i, img_bytes in enumerate(images_to_ocr):
            img_num = i + 1
            img_count = len(images_to_ocr)
            logger.info(
                "[PDF] OCR embedded image %d/%d (%d bytes)", img_num, img_count, len(img_bytes),
            )
            try:
                img_text, confidence = ocr_image(img_bytes)
                if img_text.strip():
                    image_texts.append(img_text)
                    image_confidences.append(confidence)
                    logger.info(
                        "[PDF] Image %d: extracted %d chars, confidence=%.2f",
                        img_num, len(img_text), confidence,
                    )
                else:
                    logger.info("[PDF] Image %d: no text found", img_num)
            except Exception as e:
                logger.warning("[PDF] Failed to OCR embedded image %d: %s", i + 1, e)
                continue

        # Combine native text with OCR'd image text
        if image_texts:
            combined_text = native_text_stripped
            if combined_text:
                combined_text += "\n\n--- Text from embedded images ---\n\n"
            combined_text += "\n\n".join(image_texts)
            avg_confidence = sum(image_confidences) / len(image_confidences)

            ocr_chars = len(combined_text) - len(native_text_stripped)
            logger.info(
                "[PDF] Result: method=native+ocr, %d chars (%d native + %d OCR), conf=%.2f",
                len(combined_text), len(native_text_stripped), ocr_chars, avg_confidence,
            )
            return DocumentData(
                text=combined_text,
                page_count=page_count,
                method="native+ocr",
                confidence=avg_confidence,
            )

        # No embedded images with text - check if we have native text
        if native_text_stripped:
            logger.info(
                "[PDF] Result: method=native (no OCR text), %d chars", len(native_text_stripped),
            )
            return DocumentData(
                text=native_text,
                page_count=page_count,
                method="native",
                confidence=None,
            )

        # Fall back to full page OCR for scanned PDFs
        logger.info("[PDF] No native/image text found, falling back to full-page OCR")
        text, page_count, confidence = ocr_pdf_pages(file_bytes)
        logger.info(
            "[PDF] Result: method=ocr (full-page), %d chars, conf=%.2f", len(text), confidence,
        )
        return DocumentData(
            text=text,
            page_count=page_count,
            method="ocr",
            confidence=confidence,
        )

    elif is_image(filename):
        logger.info("[IMG] Processing image file: %s (%d bytes)", filename, len(file_bytes))
        text, confidence = ocr_image(file_bytes)
        logger.info("[IMG] Result: %d chars, confidence=%.2f", len(text), confidence)
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
