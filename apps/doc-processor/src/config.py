import os

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("HOME_DOC_PROCESSOR_PORT", os.getenv("PORT", "8000")))

# Logging configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Version from build-time commit SHA
VERSION = os.getenv("COMMIT_SHA") or "dev"

# Processing limits
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Image OCR optimization settings (Tesseract uses system-installed languages)
# MAX_IMAGES_TO_OCR: Increased from 2 to 3 to improve text coverage for documents
# with multiple embedded images. Tesseract is fast enough (~0.5s/image) that the
# slight increase in processing time is worth the better extraction coverage.
MAX_IMAGES_TO_OCR = 3
MIN_IMAGE_SIZE_FOR_OCR = 10000  # Minimum image size in bytes to consider for OCR
OCR_IMAGE_MAX_DIMENSION = 1500  # Resize images to this max width/height before OCR
NATIVE_TEXT_THRESHOLD = 500  # Skip image OCR if native text has more chars than this
