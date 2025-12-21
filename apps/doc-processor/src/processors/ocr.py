"""OCR processing using EasyOCR."""

from typing import Optional, Tuple

import easyocr

from ..config import OCR_LANGUAGES
from .pdf import pdf_to_images

# Lazy-loaded OCR reader (downloads model on first use)
_reader: Optional[easyocr.Reader] = None


def _get_reader() -> easyocr.Reader:
    """Get or create the OCR reader instance."""
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(OCR_LANGUAGES, gpu=False)
    return _reader


def ocr_image(image_bytes: bytes) -> Tuple[str, float]:
    """
    Extract text from an image using OCR.

    Args:
        image_bytes: Raw image file bytes (PNG, JPEG, etc.)

    Returns:
        Tuple of (extracted_text, average_confidence)
    """
    reader = _get_reader()

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


def ocr_pdf_pages(file_bytes: bytes) -> Tuple[str, int, float]:
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
