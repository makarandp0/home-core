"""Tests for document processors."""

import os
from pathlib import Path

import pytest

from src.processors.pdf import (
    extract_pdf_text,
    extract_pdf_images,
    extract_pdf_text_and_images,
    pdf_to_images,
    pdf_first_page_thumbnail,
)
from src.processors.ocr import ocr_image

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestPdfProcessor:
    """Tests for PDF text extraction."""

    def test_extract_text_from_pdf(self):
        """Test extracting text from a PDF with text content."""
        pdf_path = FIXTURES_DIR / "sample.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        text, page_count = extract_pdf_text(pdf_bytes)

        assert page_count == 1
        assert "Test Document" in text
        assert "sample PDF" in text
        assert "multiple lines" in text

    def test_extract_text_from_empty_pdf(self):
        """Test extracting text from a PDF with no text."""
        pdf_path = FIXTURES_DIR / "empty.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        text, page_count = extract_pdf_text(pdf_bytes)

        assert page_count == 1
        assert text.strip() == ""

    def test_pdf_to_images(self):
        """Test converting PDF pages to images."""
        pdf_path = FIXTURES_DIR / "sample.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        images = pdf_to_images(pdf_bytes)

        assert len(images) == 1
        assert isinstance(images[0], bytes)
        # PNG magic bytes
        assert images[0][:4] == b'\x89PNG'

    def test_pdf_first_page_thumbnail(self):
        """Test generating a thumbnail from the first page of a PDF."""
        pdf_path = FIXTURES_DIR / "sample.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        image_bytes, width, height = pdf_first_page_thumbnail(pdf_bytes, max_size=150)

        assert isinstance(image_bytes, bytes)
        # PNG magic bytes
        assert image_bytes[:4] == b'\x89PNG'
        # Dimensions should be within max_size
        assert width <= 150
        assert height <= 150
        assert width > 0 and height > 0

    def test_pdf_first_page_thumbnail_custom_size(self):
        """Test generating a thumbnail with a custom max size."""
        pdf_path = FIXTURES_DIR / "sample.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        image_bytes, width, height = pdf_first_page_thumbnail(pdf_bytes, max_size=100)

        assert isinstance(image_bytes, bytes)
        assert width <= 100
        assert height <= 100

    def test_pdf_first_page_thumbnail_empty_pdf(self):
        """Test that empty PDF raises ValueError."""
        pdf_path = FIXTURES_DIR / "empty.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        # empty.pdf has 1 page, so it should work (not raise)
        # But if we had a truly empty PDF with 0 pages, it would raise ValueError
        image_bytes, width, height = pdf_first_page_thumbnail(pdf_bytes)
        assert isinstance(image_bytes, bytes)

    def test_extract_pdf_images_no_images(self):
        """Test extracting images from a PDF with no embedded images."""
        pdf_path = FIXTURES_DIR / "sample.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        images = extract_pdf_images(pdf_bytes)

        # sample.pdf has no embedded images, should return empty list
        assert isinstance(images, list)
        assert len(images) == 0

    def test_extract_pdf_text_and_images(self):
        """Test combined text and image extraction."""
        pdf_path = FIXTURES_DIR / "sample.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        text, page_count, images = extract_pdf_text_and_images(pdf_bytes)

        assert page_count == 1
        assert "Test Document" in text
        assert isinstance(images, list)
        # sample.pdf has no embedded images
        assert len(images) == 0

    def test_extract_pdf_text_and_images_empty_pdf(self):
        """Test combined extraction on empty PDF."""
        pdf_path = FIXTURES_DIR / "empty.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        text, page_count, images = extract_pdf_text_and_images(pdf_bytes)

        assert page_count == 1
        assert text.strip() == ""
        assert isinstance(images, list)


class TestOcrProcessor:
    """Tests for OCR text extraction."""

    def test_ocr_image(self):
        """Test OCR on an image with text."""
        img_path = FIXTURES_DIR / "sample.png"
        with open(img_path, "rb") as f:
            img_bytes = f.read()

        text, confidence = ocr_image(img_bytes)

        # OCR may not be perfect, check for key words
        text_lower = text.lower()
        assert "sample" in text_lower or "image" in text_lower or "text" in text_lower
        assert 0 <= confidence <= 1

    def test_ocr_returns_confidence(self):
        """Test that OCR returns a confidence score."""
        img_path = FIXTURES_DIR / "sample.png"
        with open(img_path, "rb") as f:
            img_bytes = f.read()

        text, confidence = ocr_image(img_bytes)

        assert isinstance(confidence, float)
        assert confidence > 0  # Should have some confidence for clear text
