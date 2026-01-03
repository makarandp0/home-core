"""Tests for FastAPI endpoints."""

import base64
from pathlib import Path

from fastapi.testclient import TestClient

from src.main import app

FIXTURES_DIR = Path(__file__).parent / "fixtures"

client = TestClient(app)


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_health_check(self):
        """Test health endpoint returns ok."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["service"] == "doc-processor"
        assert "version" in data


class TestProcessBase64Endpoint:
    """Tests for base64 document processing endpoint."""

    def test_process_pdf(self):
        """Test processing a PDF document."""
        pdf_path = FIXTURES_DIR / "sample.pdf"
        with open(pdf_path, "rb") as f:
            pdf_b64 = base64.b64encode(f.read()).decode()

        response = client.post(
            "/process/base64",
            json={"file_data": pdf_b64, "filename": "test.pdf"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["data"] is not None
        assert "Test Document" in data["data"]["text"]
        assert data["data"]["page_count"] == 1
        assert data["data"]["method"] == "native"

    def test_process_image(self):
        """Test processing an image with OCR."""
        img_path = FIXTURES_DIR / "sample.png"
        with open(img_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()

        response = client.post(
            "/process/base64",
            json={"file_data": img_b64, "filename": "test.png"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["data"] is not None
        assert data["data"]["method"] == "ocr"
        assert data["data"]["confidence"] is not None

    def test_reject_unsupported_file_type(self):
        """Test that unsupported file types are rejected."""
        response = client.post(
            "/process/base64",
            json={"file_data": base64.b64encode(b"test").decode(), "filename": "test.txt"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is False
        assert "Unsupported file type" in data["error"]

    def test_reject_invalid_base64(self):
        """Test that invalid base64 is rejected."""
        response = client.post(
            "/process/base64",
            json={"file_data": "not-valid-base64!!!", "filename": "test.pdf"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is False
        assert "base64" in data["error"].lower()


class TestThumbnailBase64Endpoint:
    """Tests for PDF thumbnail generation endpoint."""

    def test_generate_pdf_thumbnail(self):
        """Test generating a thumbnail from a PDF."""
        pdf_path = FIXTURES_DIR / "sample.pdf"
        with open(pdf_path, "rb") as f:
            pdf_b64 = base64.b64encode(f.read()).decode()

        response = client.post(
            "/thumbnail/base64",
            json={"file_data": pdf_b64, "size": 150},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["data"] is not None
        assert "image" in data["data"]
        assert data["data"]["width"] <= 150
        assert data["data"]["height"] <= 150
        assert data["data"]["width"] > 0
        assert data["data"]["height"] > 0
        # Verify it's valid base64
        image_bytes = base64.b64decode(data["data"]["image"])
        # PNG magic bytes
        assert image_bytes[:4] == b'\x89PNG'

    def test_generate_pdf_thumbnail_custom_size(self):
        """Test generating a thumbnail with custom size."""
        pdf_path = FIXTURES_DIR / "sample.pdf"
        with open(pdf_path, "rb") as f:
            pdf_b64 = base64.b64encode(f.read()).decode()

        response = client.post(
            "/thumbnail/base64",
            json={"file_data": pdf_b64, "size": 100},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["data"]["width"] <= 100
        assert data["data"]["height"] <= 100

    def test_thumbnail_invalid_base64(self):
        """Test that invalid base64 is rejected."""
        response = client.post(
            "/thumbnail/base64",
            json={"file_data": "not-valid-base64!!!", "size": 150},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is False
        assert "base64" in data["error"].lower()

    def test_thumbnail_invalid_pdf(self):
        """Test that invalid PDF data is rejected."""
        # Send valid base64 but invalid PDF content
        invalid_pdf_b64 = base64.b64encode(b"not a pdf file").decode()

        response = client.post(
            "/thumbnail/base64",
            json={"file_data": invalid_pdf_b64, "size": 150},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is False
        assert data["error"] is not None
