"""Suraksha Setu - OCR Document Verification Module.

Provides standalone and embeddable identity document verification for the
Suraksha Setu Smart Tourist Safety platform.
"""

from .config import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    DOCUMENT_NUMBER_PATTERNS,
    DOCUMENT_TYPES_WITH_EXPIRY,
    MAX_UPLOAD_SIZE_BYTES,
    MIN_CONFIDENCE_FOR_AUTO_VERIFY,
    MIN_CONFIDENCE_FOR_REVIEW,
    OCR_CREDENTIALS_PATH,
    OCR_MODE,
    REQUIRED_FIELDS,
    UPLOAD_STORAGE_DIR,
)
from .document_verification_service import DocumentVerificationService, verification_service
from .ocr_service import (
    CloudVisionOCRProvider,
    MockOCRProvider,
    OCRService,
    RawOCRResult,
    get_ocr_service,
)
from .router import router
from .schemas import (
    ConfirmedDocumentFields,
    DocumentConfirmRequest,
    DocumentConfirmResponse,
    DocumentType,
    DocumentUploadResponse,
    ExtractedDocumentData,
    ExtractedField,
    FieldStatus,
    VerificationStatus,
    VerificationStatusResponse,
)
from .storage import (
    FileTooLargeError,
    StorageSecurityError,
    UnsupportedFileError,
    delete_upload,
    mask_document_number,
    save_upload,
    validate_upload,
)

__all__ = [
    # Schemas
    "DocumentType",
    "VerificationStatus",
    "FieldStatus",
    "ExtractedField",
    "ExtractedDocumentData",
    "DocumentUploadResponse",
    "ConfirmedDocumentFields",
    "DocumentConfirmRequest",
    "DocumentConfirmResponse",
    "VerificationStatusResponse",
    # Config
    "OCR_MODE",
    "OCR_CREDENTIALS_PATH",
    "MIN_CONFIDENCE_FOR_AUTO_VERIFY",
    "MIN_CONFIDENCE_FOR_REVIEW",
    "REQUIRED_FIELDS",
    "DOCUMENT_TYPES_WITH_EXPIRY",
    "MAX_UPLOAD_SIZE_BYTES",
    "ALLOWED_MIME_TYPES",
    "ALLOWED_EXTENSIONS",
    "UPLOAD_STORAGE_DIR",
    "DOCUMENT_NUMBER_PATTERNS",
    # Storage
    "UnsupportedFileError",
    "FileTooLargeError",
    "StorageSecurityError",
    "validate_upload",
    "save_upload",
    "delete_upload",
    "mask_document_number",
    # OCR
    "RawOCRResult",
    "OCRService",
    "MockOCRProvider",
    "CloudVisionOCRProvider",
    "get_ocr_service",
    # Service
    "DocumentVerificationService",
    "verification_service",
    # Router
    "router",
]
