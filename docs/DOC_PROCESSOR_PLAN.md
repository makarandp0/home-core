# Plan: Python Document Processing Service

## Overview

Add a new Python microservice to the monorepo for processing PDFs and images to extract text. This service will use FastAPI and integrate with the existing Fastify API.

## Architecture Decision

**Approach: Sidecar Python Service**

The Python service will run alongside the Node.js API:
- In **development**: Run as separate process via pnpm scripts
- In **production**: Deploy as separate Railway service (or docker-compose locally)
- Communication via HTTP between Fastify API and Python service

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Web App   │────▶│   Fastify API    │────▶│   Doc Processor     │
│  (React)    │     │   (Node.js)      │     │  (Python/FastAPI)   │
└─────────────┘     └──────────────────┘     └─────────────────────┘
     :5173               :3001                      :8000
```

---

## Implementation Steps

### Phase 1: Python Service Setup

#### 1.1 Create service directory structure
```
apps/doc-processor/
├── Dockerfile
├── pyproject.toml          # uv/pip dependencies
├── package.json            # For Turborepo integration
├── .python-version         # Python 3.12
├── src/
│   ├── __init__.py
│   ├── main.py             # FastAPI app entry
│   ├── config.py           # Environment config
│   ├── processors/
│   │   ├── __init__.py
│   │   ├── pdf.py          # PDF text extraction (PyMuPDF)
│   │   └── ocr.py          # Image OCR (EasyOCR)
│   └── models/
│       ├── __init__.py
│       └── schemas.py      # Pydantic request/response models
└── tests/
    ├── __init__.py
    └── test_processors.py
```

#### 1.2 Dependencies (pyproject.toml)
```toml
[project]
name = "doc-processor"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "python-multipart>=0.0.12",  # File uploads
    "pymupdf>=1.24.0",           # PDF processing
    "easyocr>=1.7.0",            # OCR
    "pillow>=10.0.0",            # Image handling
    "pydantic>=2.0.0",           # Validation
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "httpx>=0.27.0",             # Async test client
    "ruff>=0.6.0",               # Linting
]
```

#### 1.3 Turborepo integration (package.json)
```json
{
  "name": "@home/doc-processor",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000",
    "build": "echo 'Python service - interpreted'",
    "start": "uv run uvicorn src.main:app --host 0.0.0.0 --port 8000",
    "lint": "uv run ruff check src/",
    "typecheck": "uv run pyright src/",
    "test": "uv run pytest tests/"
  }
}
```

---

### Phase 2: Core Processing Implementation

#### 2.1 PDF Text Extraction (src/processors/pdf.py)
- Use PyMuPDF (fitz) for digital PDFs with selectable text
- Fast extraction without OCR when text layer exists
- Fallback to OCR for scanned pages

#### 2.2 OCR Processing (src/processors/ocr.py)
- Use EasyOCR for image-based text extraction
- Support formats: PNG, JPEG, TIFF, BMP
- PDF pages converted to images when needed (pdf2image or PyMuPDF rendering)

#### 2.3 Processing Pipeline
```python
async def process_document(file: UploadFile) -> ProcessingResult:
    if is_pdf(file):
        text = extract_pdf_text(file)      # Try native extraction
        if not text.strip():
            text = ocr_pdf_pages(file)     # Fallback to OCR
    else:
        text = ocr_image(file)             # Direct OCR for images

    return ProcessingResult(
        text=text,
        page_count=page_count,
        method="native" | "ocr"
    )
```

---

### Phase 3: FastAPI Service

#### 3.1 API Endpoints (src/main.py)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/process` | POST | Process document (file upload, max 10MB) |
| `/process/base64` | POST | Process document (base64 input, max 10MB) |

#### 3.2 Request/Response Models (src/models/schemas.py)
```python
class ProcessRequest(BaseModel):
    """Base64 input for API-to-API calls"""
    file_data: str          # base64-encoded file
    filename: str           # original filename for type detection

class ProcessingResult(BaseModel):
    ok: bool
    data: Optional[DocumentData] = None
    error: Optional[str] = None

class DocumentData(BaseModel):
    text: str
    page_count: int
    method: Literal["native", "ocr"]
    confidence: Optional[float] = None  # OCR confidence
```

#### 3.3 Error Handling
- Match existing API pattern: `{ ok: bool, data?: T, error?: str }`
- Catch processor-specific errors
- Return appropriate HTTP status codes

---

### Phase 4: Fastify API Integration

#### 4.1 New route: apps/api/src/routes/documents.ts
```typescript
// POST /api/documents/process
// Accepts file upload, forwards to Python service, returns result
```

#### 4.2 New schema: packages/types/src/schemas/documents.ts
```typescript
export const DocumentProcessRequestSchema = z.object({
  file: z.string(),        // base64-encoded
  filename: z.string(),
});

export const DocumentProcessResultSchema = z.object({
  text: z.string(),
  pageCount: z.number(),
  method: z.enum(['native', 'ocr']),
  confidence: z.number().optional(),
});
```

#### 4.3 Environment variable
```
DOC_PROCESSOR_URL=http://localhost:8000  # Local dev
# or http://doc-processor:8000 in Docker network
```

---

### Phase 5: Docker & Deployment

#### 5.1 Python Dockerfile (apps/doc-processor/Dockerfile)
```dockerfile
FROM python:3.12-slim

# Install system deps for EasyOCR
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv for fast package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml .
RUN uv sync --frozen

COPY src/ src/

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### 5.2 Docker Compose for local dev (docker-compose.yml at root)
```yaml
services:
  api:
    build: ./apps/api
    ports:
      - "3001:3001"
    environment:
      - DOC_PROCESSOR_URL=http://doc-processor:8000
    depends_on:
      - doc-processor

  doc-processor:
    build: ./apps/doc-processor
    ports:
      - "8000:8000"
```

#### 5.3 Railway deployment
- Deploy as separate Railway service
- Set `DOC_PROCESSOR_URL` env var in API service pointing to Python service URL

---

### Phase 6: Monorepo Integration

#### 6.1 Update pnpm-workspace.yaml
No changes needed - `apps/*` already includes new directory.

#### 6.2 Update root package.json scripts
```json
{
  "scripts": {
    "dev:doc-processor": "pnpm --filter @home/doc-processor dev",
    "build:doc-processor": "pnpm --filter @home/doc-processor build"
  }
}
```

#### 6.3 Update CI workflow (.github/workflows/ci.yml)
Add Python setup and linting step for the doc-processor service.

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `apps/doc-processor/package.json` | Turborepo integration |
| `apps/doc-processor/pyproject.toml` | Python dependencies |
| `apps/doc-processor/.python-version` | Python version (3.12) |
| `apps/doc-processor/Dockerfile` | Container image |
| `apps/doc-processor/src/main.py` | FastAPI app |
| `apps/doc-processor/src/config.py` | Environment config |
| `apps/doc-processor/src/processors/pdf.py` | PDF processing |
| `apps/doc-processor/src/processors/ocr.py` | OCR processing |
| `apps/doc-processor/src/models/schemas.py` | Pydantic models |
| `packages/types/src/schemas/documents.ts` | Shared TypeScript types |
| `apps/api/src/routes/documents.ts` | API route for doc processing |
| `docker-compose.yml` | Local multi-service dev |

### Modified Files
| File | Change |
|------|--------|
| `apps/api/src/index.ts` | Register documents route |
| `apps/api/.env.example` | Add DOC_PROCESSOR_URL |
| `packages/types/src/index.ts` | Export document schemas |
| `package.json` | Add doc-processor scripts |
| `.github/workflows/ci.yml` | Add Python CI steps |

---

## Implementation Order

1. **Create Python service structure** - Directory, package.json, pyproject.toml
2. **Implement core processors** - PDF extraction and OCR
3. **Build FastAPI endpoints** - /health, /process
4. **Add TypeScript types** - Document schemas in @home/types
5. **Create Fastify route** - /api/documents/process
6. **Add Docker configuration** - Dockerfile + docker-compose.yml
7. **Update CI** - Python linting/testing in GitHub Actions
8. **Test end-to-end** - Upload flow from web to API to Python service

---

## Configuration Decisions

| Setting | Value | Rationale |
|---------|-------|-----------|
| Max file size | **10MB** | Keeps processing fast, lower memory usage |
| OCR languages | **English only** | Smallest model (~100MB), fastest inference |
| GPU support | **CPU only** | Simpler deployment, works everywhere |

---

## Notes

- EasyOCR English-only model will be downloaded on first run (~100MB)
- 10MB limit means most scanned documents and images will work, but very large PDFs may need splitting
- CPU inference is sufficient for moderate volume; can add GPU later if needed
