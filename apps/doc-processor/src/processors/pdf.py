"""PDF text extraction using PyMuPDF."""

import logging
from io import BytesIO

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


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


def extract_pdf_images(file_bytes: bytes) -> list[bytes]:
    """
    Extract embedded images from a PDF file.

    Args:
        file_bytes: Raw PDF file bytes

    Returns:
        List of image bytes for each embedded image (in original format as stored in the PDF)
    """
    doc = fitz.open(stream=BytesIO(file_bytes), filetype="pdf")
    images: list[bytes] = []

    for page in doc:
        image_list = page.get_images(full=True)

        for img_info in image_list:
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
                if base_image:
                    images.append(base_image["image"])
            except (RuntimeError, ValueError, KeyError) as e:
                logger.debug("Failed to extract image xref=%s: %s", xref, e)
                continue

    doc.close()
    return images


def extract_pdf_text_and_images(file_bytes: bytes) -> tuple[str, int, list[bytes]]:
    """
    Extract both native text and embedded images from a PDF in a single pass.

    Args:
        file_bytes: Raw PDF file bytes

    Returns:
        Tuple of (extracted_text, page_count, list of image bytes)
    """
    doc = fitz.open(stream=BytesIO(file_bytes), filetype="pdf")
    text_parts: list[str] = []
    images: list[bytes] = []
    page_count = doc.page_count

    for page in doc:
        # Extract text
        page_text = page.get_text()
        if page_text.strip():
            text_parts.append(page_text)

        # Extract embedded images
        image_list = page.get_images(full=True)
        for img_info in image_list:
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
                if base_image:
                    images.append(base_image["image"])
            except (RuntimeError, ValueError, KeyError) as e:
                logger.debug("Failed to extract image xref=%s: %s", xref, e)
                continue

    doc.close()
    return "\n\n".join(text_parts), page_count, images


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
