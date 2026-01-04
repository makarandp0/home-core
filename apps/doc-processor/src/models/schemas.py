from typing import Literal

from pydantic import BaseModel, Field


class DocumentData(BaseModel):
    """Extracted document data."""

    text: str = Field(description="Extracted text content")
    page_count: int = Field(description="Number of pages processed")
    method: Literal["native", "ocr", "native+ocr"] = Field(description="Extraction method used")
    confidence: float | None = Field(
        default=None, description="OCR confidence score (0-1), for 'ocr' and 'native+ocr' methods"
    )


class ProcessingResult(BaseModel):
    """API response for document processing."""

    ok: bool
    data: DocumentData | None = None
    error: str | None = None


class ProcessRequest(BaseModel):
    """Request body for base64 document processing."""

    file_data: str = Field(description="Base64-encoded file content")
    filename: str = Field(description="Original filename for type detection")


class HealthResponse(BaseModel):
    """Health check response."""

    ok: bool
    service: str = "doc-processor"
    version: str  # Set dynamically from config


# Thumbnail schemas


class ThumbnailData(BaseModel):
    """Generated thumbnail data."""

    image: str = Field(description="Base64-encoded PNG image of first page")
    width: int = Field(description="Thumbnail width in pixels")
    height: int = Field(description="Thumbnail height in pixels")


class ThumbnailResult(BaseModel):
    """API response for thumbnail generation."""

    ok: bool
    data: ThumbnailData | None = None
    error: str | None = None


class ThumbnailRequest(BaseModel):
    """Request body for PDF thumbnail generation."""

    file_data: str = Field(description="Base64-encoded PDF content")
    size: int = Field(default=150, description="Max thumbnail size in pixels")
