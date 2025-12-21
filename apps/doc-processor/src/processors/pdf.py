"""PDF text extraction using PyMuPDF."""

from io import BytesIO
from typing import Tuple

import fitz  # PyMuPDF


def extract_pdf_text(file_bytes: bytes) -> Tuple[str, int]:
    """
    Extract text from a PDF file using native text extraction.

    Args:
        file_bytes: Raw PDF file bytes

    Returns:
        Tuple of (extracted_text, page_count)
    """
    doc = fitz.open(stream=BytesIO(file_bytes), filetype="pdf")
    text_parts: list[str] = []
    page_count = doc.page_count

    for page in doc:
        page_text = page.get_text()
        if page_text.strip():
            text_parts.append(page_text)

    doc.close()
    return "\n\n".join(text_parts), page_count


def pdf_to_images(file_bytes: bytes, dpi: int = 200) -> list[bytes]:
    """
    Convert PDF pages to images for OCR processing.

    Args:
        file_bytes: Raw PDF file bytes
        dpi: Resolution for rendering (default 200)

    Returns:
        List of PNG image bytes for each page
    """
    doc = fitz.open(stream=BytesIO(file_bytes), filetype="pdf")
    images: list[bytes] = []

    zoom = dpi / 72  # 72 is the default PDF DPI
    matrix = fitz.Matrix(zoom, zoom)

    for page in doc:
        pix = page.get_pixmap(matrix=matrix)
        images.append(pix.tobytes("png"))

    doc.close()
    return images
