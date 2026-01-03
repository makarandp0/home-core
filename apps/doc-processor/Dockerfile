# Build stage
FROM python:3.11-slim AS builder

# Install system dependencies for PyMuPDF, EasyOCR, and InsightFace
# g++ is required to compile insightface's C++ extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv for fast package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files and lock file
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Pre-download EasyOCR model during build BEFORE copying source (English only, ~100MB)
# This avoids download delay on first request and caches the model separately from source
# Retry logic handles flaky network connections in CI
RUN for i in 1 2 3; do \
      .venv/bin/python -c "import easyocr; easyocr.Reader(['en'], gpu=False)" && break || \
      { echo "Attempt $i failed, retrying in 5s..." && sleep 5; }; \
    done

# Copy source code (changes here won't invalidate dependency cache)
COPY src/ src/

# Runtime stage
FROM python:3.11-slim

# Accept commit SHA from build args (Railway provides RAILWAY_GIT_COMMIT_SHA)
ARG COMMIT_SHA
ARG RAILWAY_GIT_COMMIT_SHA
ENV COMMIT_SHA=${COMMIT_SHA:-${RAILWAY_GIT_COMMIT_SHA}}

# Install runtime dependencies and utility tools for debugging
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    curl \
    procps \
    net-tools \
    lsof \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy uv and virtual environment from builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /app/pyproject.toml /app/pyproject.toml

# Copy pre-downloaded EasyOCR model from builder
COPY --from=builder /root/.EasyOCR /root/.EasyOCR

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV PORT=8000
# Suppress torchvision CUDA warning (we run on CPU intentionally)
ENV PYTHONWARNINGS="ignore:Failed to load image Python extension:UserWarning"

EXPOSE 8000

# Run the application
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
