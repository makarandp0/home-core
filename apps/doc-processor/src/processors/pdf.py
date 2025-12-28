"""PDF text extraction using PyMuPDF."""

from io import BytesIO

import fitz  # PyMuPDF


def extract_pdf_text(file_bytes: bytes) -> tuple[str, int]:
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


def pdf_first_page_thumbnail(file_bytes: bytes, max_size: int = 150) -> tuple[bytes, int, int]:
    """
    Generate a thumbnail from the first page of a PDF.

    Args:
        file_bytes: Raw PDF file bytes
        max_size: Maximum width/height in pixels (default 150)

    Returns:
        Tuple of (PNG image bytes, width, height)
    """
    doc = fitz.open(stream=BytesIO(file_bytes), filetype="pdf")

    if doc.page_count == 0:
        doc.close()
        raise ValueError("PDF has no pages")

    page = doc[0]
    page_rect = page.rect

    # Calculate scale to fit within max_size while maintaining aspect ratio
    scale = min(max_size / page_rect.width, max_size / page_rect.height)
    matrix = fitz.Matrix(scale, scale)

    pix = page.get_pixmap(matrix=matrix)
    width = pix.width
    height = pix.height
    image_bytes = pix.tobytes("png")

    doc.close()
    return image_bytes, width, height
