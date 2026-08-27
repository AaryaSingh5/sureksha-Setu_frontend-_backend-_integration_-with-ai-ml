"""Pydantic v2 schemas for the Suraksha Setu Document Verification Module.

IMPORTANT SECURITY NOTICE:
- Raw OCR text is deliberately excluded from all external schemas.
- Document numbers must be masked before leaving the server.
- document_number and document_type are deliberately excluded from
  ConfirmedDocumentFields to prevent user spoofing post-OCR.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DocumentType(str, Enum):
    """Supported document types for identity verification."""

    PASSPORT = "PASSPORT"
    DRIVING_LICENCE = "DRIVING_LICENCE"
    VOTER_ID = "VOTER_ID"
    AADHAAR = "AADHAAR"
    OTHER_GOVERNMENT_ID = "OTHER_GOVERNMENT_ID"


class VerificationStatus(str, Enum):
    """Lifecycle states of an identity document verification."""

    PENDING = "PENDING"
    EXTRACTED = "EXTRACTED"
    VERIFIED = "VERIFIED"
    PENDING_REVIEW = "PENDING_REVIEW"
    REUPLOAD_REQUIRED = "REUPLOAD_REQUIRED"
    REJECTED = "REJECTED"


class FieldStatus(str, Enum):
    """Status of an individual extracted field from OCR processing."""

    FOUND = "FOUND"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    NOT_FOUND = "NOT_FOUND"


class FaceMatchStatus(str, Enum):
    """Status of the face matching / liveness verification step.

    PROTOTYPE NOTE: Liveness detection uses mediapipe landmark-variation heuristics
    across 3 frames, not a commercial anti-spoofing SDK. Suitable for demo/prototype;
    production deployments should integrate a certified liveness provider.
    """

    PENDING = "PENDING"            # Face match not yet attempted
    MATCHED = "MATCHED"            # Face in ID matches live capture + liveness passed
    MISMATCH = "MISMATCH"          # Live face does not match ID photo face
    NO_FACE_DETECTED = "NO_FACE_DETECTED"   # No face found in ID or live frame
    LIVENESS_FAILED = "LIVENESS_FAILED"     # Static image / photo-of-photo detected
    MULTIPLE_FACES = "MULTIPLE_FACES"        # More than one face found; ambiguous
    SKIPPED = "SKIPPED"            # Face step was not initiated (optional mode)



class ExtractedField(BaseModel):
    """An individual field extracted via OCR with confidence/review status."""

    value: Optional[str] = Field(
        default=None,
        description="Extracted value or masked representation if sensitive.",
    )
    status: FieldStatus = Field(
        default=FieldStatus.NOT_FOUND,
        description="Extraction status indicating reliability.",
    )
    confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Field-level OCR extraction confidence score (0.0 to 1.0).",
    )
    is_invalid: Optional[bool] = Field(
        default=False,
        description="Whether this extracted field violates standard document format rules.",
    )
    warning: Optional[str] = Field(
        default=None,
        description="Human-readable warning explaining format violation or anomaly.",
    )

    model_config = ConfigDict(use_enum_values=True)


class ExtractedDocumentData(BaseModel):
    """Structured extraction of identity fields from an uploaded document.

    Note: Raw OCR dump is never included in this schema.
    """

    full_name: ExtractedField = Field(default_factory=ExtractedField)
    document_number: ExtractedField = Field(default_factory=ExtractedField)
    nationality: ExtractedField = Field(default_factory=ExtractedField)
    date_of_birth: ExtractedField = Field(default_factory=ExtractedField)
    expiry_date: ExtractedField = Field(default_factory=ExtractedField)
    fields_found: List[str] = Field(
        default_factory=list,
        description="Names of fields that were successfully extracted.",
    )
    fields_missing: List[str] = Field(
        default_factory=list,
        description="Names of required/expected fields that could not be detected.",
    )
    
    # MRZ Checksum Fields
    mrz_checksum_valid: Optional[bool] = Field(
        default=None,
        description="True if all ICAO MRZ checksums passed, False if any failed. Null if not MRZ.",
    )
    mrz_checksum_errors: List[str] = Field(
        default_factory=list,
        description="List of specific MRZ checksum validation errors, if any.",
    )

    # Face Match / Liveness Fields
    face_match_status: FaceMatchStatus = Field(
        default=FaceMatchStatus.PENDING,
        description="Status of face matching against the document photo.",
    )
    face_match_score: Optional[float] = Field(
        default=None,
        description="Similarity score (0.0 to 1.0) of the face match, if completed.",
    )

    model_config = ConfigDict(use_enum_values=True)


class DocumentUploadResponse(BaseModel):
    """Response returned upon initial document upload and OCR processing."""

    verification_id: UUID = Field(
        description="Unique verification transaction identifier."
    )
    document_type: DocumentType = Field(
        description="Document type provided by the tourist."
    )
    status: VerificationStatus = Field(
        description="Initial extraction status."
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Aggregate OCR extraction confidence score (0.0 to 1.0).",
    )
    extracted: ExtractedDocumentData = Field(
        description="Structured per-field results with masked document number.",
    )
    mock_mode: bool = Field(
        default=False,
        description="Flag indicating if extraction was executed using the mock engine.",
    )
    message: str = Field(
        description="User-facing status explanation or instruction.",
    )

    model_config = ConfigDict(use_enum_values=True)


class ConfirmedDocumentFields(BaseModel):
    """User-editable fields confirmed by tourist post-OCR extraction.

    ANTI-SPOOFING CONSTRAINT:
    `document_number` and `document_type` are deliberately EXCLUDED from this
    schema to prevent post-OCR tampering or document impersonation.
    """

    full_name: Optional[str] = Field(
        default=None,
        description="Tourist's full legal name as confirmed by the tourist.",
    )
    nationality: Optional[str] = Field(
        default=None,
        description="Tourist's nationality (e.g., 'Indian', 'American').",
    )
    date_of_birth: Optional[str] = Field(
        default=None,
        description="Date of birth in YYYY-MM-DD format.",
    )
    expiry_date: Optional[str] = Field(
        default=None,
        description="Document expiry date in YYYY-MM-DD format (if applicable).",
    )


class DocumentConfirmRequest(BaseModel):
    """Request payload to finalize document verification."""

    verification_id: UUID = Field(
        description="Verification session identifier returned during upload."
    )
    confirmed_fields: ConfirmedDocumentFields = Field(
        description="User-confirmed details."
    )


class DocumentConfirmResponse(BaseModel):
    """Response returned after running verification validation rules."""

    verification_id: UUID = Field(
        description="Unique verification transaction identifier."
    )
    status: VerificationStatus = Field(
        description="Final verification decision (e.g. VERIFIED or REJECTED)."
    )
    reasons: List[str] = Field(
        default_factory=list,
        description="Decision rationale, validation failures, or success notes.",
    )
    tourist_id: Optional[UUID] = Field(
        default=None,
        description="Suraksha Setu tourist identifier, populated only when VERIFIED.",
    )

    model_config = ConfigDict(use_enum_values=True)


class VerificationStatusResponse(BaseModel):
    """Read-only verification status lookup response."""

    verification_id: UUID = Field(
        description="Unique verification transaction identifier."
    )
    document_type: DocumentType = Field(
        description="Document type being verified."
    )
    status: VerificationStatus = Field(
        description="Current verification status."
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence score."
    )
    created_at: datetime = Field(
        description="Timestamp when the verification session was created."
    )
    verified_at: Optional[datetime] = Field(
        default=None,
        description="Timestamp when verification succeeded, if completed."
    )

    model_config = ConfigDict(use_enum_values=True)
