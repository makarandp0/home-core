import os

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("HOME_DOC_PROCESSOR_PORT", os.getenv("PORT", "8000")))

# Version from build-time commit SHA
VERSION = os.getenv("COMMIT_SHA") or "dev"

# Processing limits
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Image OCR optimization settings (Tesseract uses system-installed languages)
MAX_IMAGES_TO_OCR = 2  # Maximum number of embedded images to OCR
MIN_IMAGE_SIZE_FOR_OCR = 10000  # Minimum image size in bytes to consider for OCR
OCR_IMAGE_MAX_DIMENSION = 1500  # Resize images to this max width/height before OCR
NATIVE_TEXT_THRESHOLD = 500  # Skip image OCR if native text has more chars than this
