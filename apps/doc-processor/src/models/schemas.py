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
    face_model_loaded: bool = False
    face_model: str | None = None


# Face recognition schemas


class FaceLoadModelBody(BaseModel):
    """Request body for loading a face model."""

    model: str = Field(
        default="buffalo_l",
        description="Model: 'buffalo_l' (large, accurate) or 'buffalo_s' (small, faster)",
    )


class FaceLoadModelResult(BaseModel):
    """Response for face model loading."""

    ok: bool
    message: str | None = None
    model: str | None = None
    error: str | None = None


class FaceImageBody(BaseModel):
    """Request body for face embedding."""

    image_b64: str = Field(description="Base64-encoded image (no data URL prefix)")


class FaceCompareBody(BaseModel):
    """Request body for face comparison."""

    a_b64: str = Field(description="Base64-encoded first image")
    b_b64: str = Field(description="Base64-encoded second image")
    threshold: float = Field(default=0.4, description="Cosine distance threshold (0.4-0.5 typical)")


class FaceEmbedResult(BaseModel):
    """Response for face embedding."""

    ok: bool
    vector: list[float] | None = None
    meta: dict | None = None
    error: str | None = None


class FaceCompareResult(BaseModel):
    """Response for face comparison."""

    ok: bool
    distance: float | None = None
    threshold: float | None = None
    match: bool | None = None
    meta: dict | None = None
    error: str | None = None


class FaceCacheInfo(BaseModel):
    """Response for cache info."""

    ok: bool
    enabled: bool
    cache_dir: str
    cached_embeddings: int
    cache_size_bytes: int
    cache_size_mb: float
    stats: dict


class FaceCacheClearResult(BaseModel):
    """Response for cache clear."""

    ok: bool
    message: str
    deleted: int


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
