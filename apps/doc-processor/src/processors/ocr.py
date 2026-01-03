"""OCR processing using EasyOCR."""

from io import BytesIO

import easyocr
from PIL import Image

from ..config import OCR_IMAGE_MAX_DIMENSION, OCR_LANGUAGES
from .pdf import pdf_to_images

# Lazy-loaded OCR reader (downloads model on first use)
_reader: easyocr.Reader | None = None


def _get_reader() -> easyocr.Reader:
    """Get or create the OCR reader instance."""
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(OCR_LANGUAGES, gpu=False)
    return _reader


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

    # Convert to RGB if necessary (for JPEG compatibility)
    if resized.mode in ("RGBA", "P"):
        resized = resized.convert("RGB")

    # Save to bytes
    output = BytesIO()
    resized.save(output, format="PNG")
    return output.getvalue()


def ocr_image(image_bytes: bytes, resize: bool = True) -> tuple[str, float]:
    """
    Extract text from an image using OCR.

    Args:
        image_bytes: Raw image file bytes (PNG, JPEG, etc.)
        resize: Whether to resize large images before OCR (improves speed)

    Returns:
        Tuple of (extracted_text, average_confidence)
    """
    reader = _get_reader()

    # Resize large images to speed up OCR
    if resize:
        image_bytes = resize_image_for_ocr(image_bytes)

    # EasyOCR accepts bytes directly
    # Run OCR - returns list of (bbox, text, confidence)
    results = reader.readtext(image_bytes)

    if not results:
        return "", 0.0

    texts: list[str] = []
    confidences: list[float] = []

    for _bbox, text, confidence in results:
        texts.append(text)
        confidences.append(confidence)

    combined_text = " ".join(texts)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

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
    page_images = pdf_to_images(file_bytes)
    all_texts: list[str] = []
    all_confidences: list[float] = []

    for page_image in page_images:
        text, confidence = ocr_image(page_image)
        if text.strip():
            all_texts.append(text)
            all_confidences.append(confidence)

    combined_text = "\n\n".join(all_texts)
    avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0

    return combined_text, len(page_images), avg_confidence
