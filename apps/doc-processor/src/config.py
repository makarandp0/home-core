import os

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("HOME_DOC_PROCESSOR_PORT", os.getenv("PORT", "8000")))

# Version from build-time commit SHA
VERSION = os.getenv("COMMIT_SHA") or "dev"

# Processing limits
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# OCR configuration
OCR_LANGUAGES = ["en"]  # English only for now
