"""OCR processing using Tesseract."""

import logging
import time
from io import BytesIO

import pytesseract
from PIL import Image

from ..config import OCR_IMAGE_MAX_DIMENSION
from .pdf import pdf_to_images

logger = logging.getLogger(__name__)


def resize_image_for_ocr(image_bytes: bytes, max_dimension: int | None = None) -> bytes:
    """
    Resize an image if it exceeds max dimensions, to speed up OCR.

    Args:
        image_bytes: Raw image file bytes
        max_dimension: Maximum width or height (uses config default if None)

    Returns:
        Resized image bytes (PNG format), or original if already small enough
    """
    if max_dimension is None:
        max_dimension = OCR_IMAGE_MAX_DIMENSION

    img = Image.open(BytesIO(image_bytes))
    width, height = img.size

    # Check if resizing is needed
    if width <= max_dimension and height <= max_dimension:
        logger.info("[OCR] Image size %dx%d within limit, no resize needed", width, height)
        return image_bytes

    # Calculate new dimensions maintaining aspect ratio
    if width > height:
        new_width = max_dimension
        new_height = int(height * (max_dimension / width))
    else:
        new_height = max_dimension
        new_width = int(width * (max_dimension / height))

    # Resize using high-quality resampling
    resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    logger.info("[OCR] Resized image from %dx%d to %dx%d", width, height, new_width, new_height)

    # Convert to RGB if necessary (for JPEG compatibility)
    if resized.mode in ("RGBA", "P"):
        resized = resized.convert("RGB")

    # Save to bytes
    output = BytesIO()
    resized.save(output, format="PNG")
    return output.getvalue()


def ocr_image(image_bytes: bytes, resize: bool = True) -> tuple[str, float]:
    """
    Extract text from an image using Tesseract OCR.

    Args:
        image_bytes: Raw image file bytes (PNG, JPEG, etc.)
        resize: Whether to resize large images before OCR (improves speed)

    Returns:
        Tuple of (extracted_text, confidence)
        Note: Tesseract confidence is estimated from word-level data
    """
    start_time = time.time()
    original_size = len(image_bytes)
    logger.info("[OCR] Starting OCR on image (%d bytes)", original_size)

    # Resize large images to speed up OCR
    if resize:
        image_bytes = resize_image_for_ocr(image_bytes)

    # Open image for Tesseract
    img = Image.open(BytesIO(image_bytes))
    logger.info("[OCR] Image opened: %dx%d, mode=%s", img.width, img.height, img.mode)

    # Run OCR with data output to get confidence scores
    ocr_start = time.time()
    try:
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    except pytesseract.TesseractNotFoundError as exc:
        logger.error("[OCR] Tesseract executable not found")
        raise RuntimeError(
            "Tesseract OCR not found. Ensure tesseract-ocr is installed."
        ) from exc
    except pytesseract.TesseractError as exc:
        logger.error("[OCR] Tesseract failed: %s", exc)
        raise RuntimeError(f"Tesseract OCR failed: {exc}") from exc
    finally:
        img.close()
    ocr_duration = time.time() - ocr_start
    logger.info("[OCR] Tesseract completed in %.2fs", ocr_duration)

    texts: list[str] = []
    confidences: list[float] = []

    for i, text in enumerate(data["text"]):
        # Filter out empty strings and low-confidence results
        conf = data["conf"][i]
        if text.strip() and conf != -1:  # -1 means no confidence available
            texts.append(text)
            confidences.append(float(conf) / 100.0)  # Convert to 0-1 range

    if not texts:
        total_duration = time.time() - start_time
        logger.info("[OCR] No text found (total time: %.2fs)", total_duration)
        return "", 0.0

    combined_text = " ".join(texts)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    total_duration = time.time() - start_time
    logger.info(
        "[OCR] Extracted %d chars, %d words, confidence=%.2f (total time: %.2fs)",
        len(combined_text),
        len(texts),
        avg_confidence,
        total_duration,
    )

    return combined_text, avg_confidence


def ocr_pdf_pages(file_bytes: bytes) -> tuple[str, int, float]:
    """
    Extract text from a scanned PDF using OCR.

    Converts each PDF page to an image, then runs OCR.

    Args:
        file_bytes: Raw PDF file bytes

    Returns:
        Tuple of (extracted_text, page_count, average_confidence)
    """
    start_time = time.time()
    logger.info("[OCR] Starting full-page OCR on PDF (%d bytes)", len(file_bytes))

    page_images = pdf_to_images(file_bytes)
    logger.info("[OCR] Converted PDF to %d page images", len(page_images))

    all_texts: list[str] = []
    all_confidences: list[float] = []

    for i, page_image in enumerate(page_images):
        logger.info("[OCR] Processing page %d/%d", i + 1, len(page_images))
        text, confidence = ocr_image(page_image)
        if text.strip():
            all_texts.append(text)
            all_confidences.append(confidence)
            logger.info("[OCR] Page %d: extracted %d chars", i + 1, len(text))
        else:
            logger.info("[OCR] Page %d: no text found", i + 1)

    combined_text = "\n\n".join(all_texts)
    avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0

    total_duration = time.time() - start_time
    logger.info(
        "[OCR] Full-page PDF OCR complete: %d pages, %d chars total, confidence=%.2f (%.2fs)",
        len(page_images),
        len(combined_text),
        avg_confidence,
        total_duration,
    )

    return combined_text, len(page_images), avg_confidence
