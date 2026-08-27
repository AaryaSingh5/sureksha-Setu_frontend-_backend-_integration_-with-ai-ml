"""Configuration and thresholds for the Suraksha Setu Document Verification Module.

All thresholds, limits, and patterns are centralized here and can be overridden
via environment variables. No magic numbers or hardcoded secrets are scattered
in business logic.
"""

import os
import tempfile
from pathlib import Path
from typing import Dict, Optional, Set, Tuple

# OCR Engine Mode: 'auto' (default: uses native Windows OCR if available), 'cloud_vision', or 'mock'
OCR_MODE: str = os.getenv("OCR_MODE", "auto").strip().lower()

# Path to Google Cloud Service Account JSON credentials (used when OCR_MODE='cloud_vision')
OCR_CREDENTIALS_PATH: Optional[str] = os.getenv("OCR_CREDENTIALS_PATH", None)


# Minimum aggregate OCR confidence score to allow auto-confirmation flow (0.75 default)
MIN_CONFIDENCE_FOR_AUTO_VERIFY: float = float(
    os.getenv("MIN_CONFIDENCE_FOR_AUTO_VERIFY", "0.75")
)

# Minimum OCR confidence threshold to attempt field review (0.50 default).
# Scores below this indicate the OCR failed to extract meaningful text, requiring re-upload.
MIN_CONFIDENCE_FOR_REVIEW: float = float(
    os.getenv("MIN_CONFIDENCE_FOR_REVIEW", "0.50")
)

# Multi-variant OCR fallback: if ENHANCED pass confidence is below this, try other variants
MULTI_VARIANT_FALLBACK_THRESHOLD: float = float(
    os.getenv("MULTI_VARIANT_FALLBACK_THRESHOLD", "0.70")
)

# Glare detection: pixel value threshold (out of 255) to be considered overexposed
GLARE_PIXEL_THRESHOLD: int = int(os.getenv("GLARE_PIXEL_THRESHOLD", "240"))

# Whether to enable OpenCV contour-based perspective deskew in preprocessing
OCR_DESKEW_ENABLED: bool = os.getenv("OCR_DESKEW_ENABLED", "True").lower() in ("true", "1", "yes")

# Minimum face similarity score (0.0 to 1.0) to pass liveness face-match
MIN_FACE_MATCH_CONFIDENCE: float = float(os.getenv("MIN_FACE_MATCH_CONFIDENCE", "0.60"))

# Mandatory fields required for any document verification to succeed
REQUIRED_FIELDS: Tuple[str, ...] = ("full_name", "document_number", "date_of_birth")

# Document types that strictly require an unexpired expiry_date
DOCUMENT_TYPES_WITH_EXPIRY: Tuple[str, ...] = ("PASSPORT", "DRIVING_LICENCE")

# Maximum upload payload size (8 MB default)
MAX_UPLOAD_SIZE_BYTES: int = int(
    os.getenv("MAX_UPLOAD_SIZE_BYTES", str(8 * 1024 * 1024))
)

# Allowed file MIME types
ALLOWED_MIME_TYPES: Set[str] = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
}

# Allowed file extensions (including dot)
ALLOWED_EXTENSIONS: Set[str] = {
    ".jpg",
    ".jpeg",
    ".png",
    ".pdf",
}

# Directory where uploaded documents are temporarily/permanently staged
DEFAULT_STORAGE_DIR = str(Path(tempfile.gettempdir()) / "suraksha_setu_uploads")
UPLOAD_STORAGE_DIR: str = os.getenv("UPLOAD_STORAGE_DIR", DEFAULT_STORAGE_DIR)

# Document number format sanity patterns (basic sanity check, not authoritative validation)
DOCUMENT_NUMBER_PATTERNS: Dict[str, str] = {
    "PASSPORT": r"^[A-PR-WYa-pr-wy0-9][0-9A-Za-z]{6,9}$",
    "DRIVING_LICENCE": r"^[A-Za-z0-9\-\s]{6,20}$",
    "VOTER_ID": r"^[A-Za-z0-9\-\/]{6,20}$",
    "AADHAAR": r"^\d{4}\s\d{4}\s\d{4}$|^\d{12}$|^[Xx\*]{4}\s[Xx\*]{4}\s\d{4}$",
    "OTHER_GOVERNMENT_ID": r"^[A-Za-z0-9\-\s]{4,25}$",
}
