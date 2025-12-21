from typing import Literal

from pydantic import BaseModel, Field


class DocumentData(BaseModel):
    """Extracted document data."""

    text: str = Field(description="Extracted text content")
    page_count: int = Field(description="Number of pages processed")
    method: Literal["native", "ocr"] = Field(description="Extraction method used")
    confidence: float | None = Field(
        default=None, description="OCR confidence score (0-1), only for OCR method"
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
