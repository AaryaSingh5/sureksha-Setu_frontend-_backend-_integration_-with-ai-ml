"""Business logic service for document verification in Suraksha Setu.

Coordinates:
- Secure file storage
- OCR extraction & normalization
- PII masking
- Multi-step validation (required fields, expiration, DOB sanity, pattern checks)
- Anti-spoofing constraints (document_number immutable post-OCR)
"""

import copy
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from .config import (
    DOCUMENT_NUMBER_PATTERNS,
    DOCUMENT_TYPES_WITH_EXPIRY,
    MIN_CONFIDENCE_FOR_AUTO_VERIFY,
    MIN_CONFIDENCE_FOR_REVIEW,
    REQUIRED_FIELDS,
)
from .ocr_service import OCRService, get_ocr_service
from .schemas import (
    ConfirmedDocumentFields,
    DocumentConfirmResponse,
    DocumentType,
    DocumentUploadResponse,
    ExtractedDocumentData,
    ExtractedField,
    FaceMatchStatus,
    FieldStatus,
    VerificationStatus,
    VerificationStatusResponse,
)
from .storage import (
    delete_upload,
    mask_document_number,
    save_upload,
)

logger = logging.getLogger(__name__)


@dataclass
class VerificationRecord:
    """Internal entity representing an active or completed verification transaction."""

    verification_id: UUID
    tourist_id: Optional[UUID]
    document_type: DocumentType
    status: VerificationStatus
    confidence: float
    storage_key: str
    raw_document_number: Optional[str]  # Kept internally for validation; never exposed
    extracted_data: ExtractedDocumentData
    confirmed_fields: Optional[ConfirmedDocumentFields]
    reasons: List[str]
    is_mock: bool
    created_at: datetime
    verified_at: Optional[datetime] = None
    face_match_required: bool = False


class DocumentVerificationService:
    """Core domain service managing the verification lifecycle."""

    def __init__(self, ocr_service: Optional[OCRService] = None):
        self.ocr_service = ocr_service or get_ocr_service()
        # In-memory store for standalone execution / dev mode
        self._store: Dict[UUID, VerificationRecord] = {}

    async def process_upload(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        document_type: DocumentType,
        tourist_id: Optional[UUID] = None,
    ) -> DocumentUploadResponse:
        """Handle document upload, secure storage, OCR extraction, and PII masking.

        Args:
            file_bytes: Uploaded binary content.
            filename: Client-provided filename.
            content_type: MIME type string.
            document_type: Document type enum.
            tourist_id: Optional associated tourist UUID.

        Returns:
            DocumentUploadResponse with masked document number and extraction status.
        """
        # 1. Secure storage
        storage_key, _ = save_upload(file_bytes, filename, content_type)

        # 2. Run OCR Extraction
        raw_ocr = await self.ocr_service.extract_document_data(
            file_bytes, filename, document_type
        )

        # 3. Normalize structured fields
        extracted = self.ocr_service.normalize(raw_ocr, document_type)
        raw_doc_number = (
            extracted.document_number.value
            if extracted.document_number
            else None
        )

        # 4. Assess initial verification state
        confidence = raw_ocr.confidence
        has_required = all(
            f in extracted.fields_found for f in REQUIRED_FIELDS
        )

        is_dob_future = False
        if extracted.date_of_birth.value:
            try:
                dob_dt = datetime.strptime(extracted.date_of_birth.value, "%Y-%m-%d").date()
                if dob_dt >= date.today():
                    is_dob_future = True
                    extracted.date_of_birth.status = FieldStatus.NEEDS_REVIEW
            except Exception:
                pass

        is_doc_num_invalid = False
        doc_type_str = document_type.value if hasattr(document_type, "value") else str(document_type)
        if raw_doc_number:
            if doc_type_str == "AADHAAR" and "-" in raw_doc_number:
                is_doc_num_invalid = True
                extracted.document_number.status = FieldStatus.NEEDS_REVIEW

        if confidence < MIN_CONFIDENCE_FOR_REVIEW:
            status = VerificationStatus.REUPLOAD_REQUIRED
            message = (
                "Document image quality is too low or unreadable. "
                "Please upload a clear, well-lit photograph of the document."
            )
        elif confidence < MIN_CONFIDENCE_FOR_AUTO_VERIFY or not has_required or is_dob_future or is_doc_num_invalid:
            status = VerificationStatus.PENDING_REVIEW
            if is_dob_future and is_doc_num_invalid:
                message = (
                    f"Warning: Extracted date of birth ({extracted.date_of_birth.value}) is in the future, "
                    f"and Aadhaar number '{raw_doc_number}' has an invalid format containing hyphens ('-')."
                )
            elif is_dob_future:
                message = (
                    f"Warning: Extracted date of birth ({extracted.date_of_birth.value}) is in the future. "
                    "Please review and correct your date of birth."
                )
            elif is_doc_num_invalid:
                message = (
                    f"Warning: Aadhaar number '{raw_doc_number}' has an invalid format containing hyphens ('-'). "
                    "Official UIDAI cards format numbers as 'XXXX XXXX XXXX' without hyphens."
                )
            elif extracted.fields_missing:
                missing_names = ", ".join(extracted.fields_missing)
                message = (
                    f"Document scanned with warnings. Missing expected fields: ({missing_names}). "
                    "Please review and enter required details."
                )
            else:
                review_fields = [
                    f
                    for f in ("full_name", "document_number", "date_of_birth", "expiry_date")
                    if getattr(extracted, f).status == FieldStatus.NEEDS_REVIEW
                ]
                review_names = ", ".join(review_fields) if review_fields else "some fields"
                message = (
                    f"Document extracted with moderate confidence. "
                    f"Please review detected fields ({review_names}) and confirm your details."
                )
        else:
            status = VerificationStatus.EXTRACTED
            message = (
                "Document scanned successfully. Please review your details and confirm."
            )

        verification_id = uuid4()
        now = datetime.now(timezone.utc)

        # 5. Persist record in store (with unmasked document number stored internally)
        record = VerificationRecord(
            verification_id=verification_id,
            tourist_id=tourist_id,
            document_type=document_type,
            status=status,
            confidence=confidence,
            storage_key=storage_key,
            raw_document_number=raw_doc_number,
            extracted_data=extracted,
            confirmed_fields=None,
            reasons=[],
            is_mock=raw_ocr.is_mock,
            created_at=now,
            verified_at=None,
        )
        self._store[verification_id] = record

        # 6. Prepare public response with masked document number
        public_extracted = copy.deepcopy(extracted)
        if public_extracted.document_number.value:
            public_extracted.document_number.value = mask_document_number(
                public_extracted.document_number.value
            )

        return DocumentUploadResponse(
            verification_id=verification_id,
            document_type=document_type,
            status=status,
            confidence=confidence,
            extracted=public_extracted,
            mock_mode=raw_ocr.is_mock,
            message=message,
        )

    async def confirm_verification(
        self,
        verification_id: UUID,
        confirmed_fields: ConfirmedDocumentFields,
        tourist_id: Optional[UUID] = None,
    ) -> DocumentConfirmResponse:
        """Validate confirmed fields against security rules and make final verification decision.

        ANTI-SPOOFING ENFORCEMENT:
        - `document_number` and `document_type` are taken strictly from the server-side
          record and cannot be modified by user submission.

        Args:
            verification_id: Unique verification session identifier.
            confirmed_fields: User-confirmed fields.
            tourist_id: Optional tourist UUID.

        Returns:
            DocumentConfirmResponse with status and reasons.

        Raises:
            KeyError: If verification session is not found.
        """
        record = self._store.get(verification_id)
        if not record:
            raise KeyError(f"Verification session '{verification_id}' not found.")

        # Update record with submitted fields
        record.confirmed_fields = confirmed_fields
        reasons: List[str] = []

        # Effective values (user-confirmed overrides OCR when provided)
        effective_name = (
            confirmed_fields.full_name
            if (confirmed_fields and confirmed_fields.full_name is not None)
            else (record.extracted_data.full_name.value if record.extracted_data.full_name else None)
        )
        effective_nationality = (
            confirmed_fields.nationality
            if (confirmed_fields and confirmed_fields.nationality is not None)
            else (record.extracted_data.nationality.value if record.extracted_data.nationality else None)
        )
        effective_dob = (
            confirmed_fields.date_of_birth
            if (confirmed_fields and confirmed_fields.date_of_birth is not None)
            else (record.extracted_data.date_of_birth.value if record.extracted_data.date_of_birth else None)
        )
        effective_expiry = (
            confirmed_fields.expiry_date
            if (confirmed_fields and confirmed_fields.expiry_date is not None)
            else (record.extracted_data.expiry_date.value if record.extracted_data.expiry_date else None)
        )

        # IMMUTABLE: document number and document type are locked from server record (Rule 7: Data Integrity Validation)
        effective_doc_number = record.raw_document_number
        doc_type_str = record.document_type.value if hasattr(record.document_type, "value") else str(record.document_type)

        # ─── RULE 1: Required Field Validation ──────────────────────────────────
        if not effective_name or not effective_name.strip():
            reasons.append("Full Name is missing or empty.")

        if not effective_doc_number or not effective_doc_number.strip():
            reasons.append("Document Number could not be read from the document image.")

        if not effective_dob or not effective_dob.strip():
            reasons.append("Date of Birth is missing or empty.")

        # ─── RULE 2: OCR Confidence Validation ──────────────────────────────────
        if record.confidence < MIN_CONFIDENCE_FOR_REVIEW:
            reasons.append(
                f"OCR confidence score ({record.confidence:.2f}) is below minimum acceptable threshold ({MIN_CONFIDENCE_FOR_REVIEW:.2f}). Please upload a clearer document image."
            )

        # ─── RULE 3: Document Number Format Validation ──────────────────────────
        if effective_doc_number and effective_doc_number.strip():
            if doc_type_str == "AADHAAR" and "-" in effective_doc_number:
                reasons.append(
                    f"Aadhaar number '{effective_doc_number}' has an invalid format: Hyphens ('-') are not permitted in official UIDAI Aadhaar cards. Expected format is 'XXXX XXXX XXXX'."
                )
            else:
                pattern = DOCUMENT_NUMBER_PATTERNS.get(doc_type_str)
                if pattern:
                    if not re.match(pattern, effective_doc_number.strip(), re.IGNORECASE):
                        reasons.append(
                            f"Document number '{effective_doc_number}' does not match expected format for {doc_type_str}."
                        )

        # ─── RULE 4: Date of Birth Validation ───────────────────────────────────
        if effective_dob and effective_dob.strip():
            try:
                dob_date = datetime.strptime(effective_dob.strip(), "%Y-%m-%d").date()
                today = date.today()
                if dob_date >= today:
                    reasons.append("Date of birth must be a past date, not in the future.")
                elif (today.year - dob_date.year) > 125 or dob_date.year < 1900:
                    reasons.append(f"Date of birth '{effective_dob}' is unrealistic (must be within valid human lifespan).")
            except ValueError:
                reasons.append(
                    f"Date of birth '{effective_dob}' is not in valid YYYY-MM-DD format."
                )

        # ─── RULE 5: Document Expiry Validation ─────────────────────────────────
        if doc_type_str in DOCUMENT_TYPES_WITH_EXPIRY:
            if not effective_expiry or not effective_expiry.strip():
                reasons.append(
                    f"Document type '{doc_type_str}' requires a valid unexpired expiry date."
                )
            else:
                try:
                    exp_date = datetime.strptime(effective_expiry.strip(), "%Y-%m-%d").date()
                    if exp_date <= date.today():
                        reasons.append(
                            f"Document has expired on {effective_expiry}. An unexpired document is required for verification."
                        )
                except ValueError:
                    reasons.append(
                        f"Expiry date '{effective_expiry}' is not in valid YYYY-MM-DD format."
                    )

        # ─── RULE 6: Document Type Consistency Check ────────────────────────────
        # Cross-verify document content characteristics against selected document type
        extracted_data = record.extracted_data
        if doc_type_str == "PASSPORT":
            # If Passport selected, check if user accidentally uploaded Aadhaar or Voter ID
            if (
                effective_doc_number
                and re.match(r"^\d{12}$", effective_doc_number.replace(" ", ""))
                and not extracted_data.mrz_checksum_valid
            ):
                reasons.append("Document type consistency mismatch: uploaded document appears to be an Aadhaar card, but Passport was selected.")
        elif doc_type_str == "AADHAAR":
            # If Aadhaar selected, check if user uploaded a passport with MRZ
            if extracted_data.mrz_checksum_valid is not None and extracted_data.mrz_checksum_valid is True:
                reasons.append("Document type consistency mismatch: uploaded document contains Passport MRZ, but Aadhaar Card was selected.")
        elif doc_type_str == "VOTER_ID":
            if (
                effective_doc_number
                and re.match(r"^\d{12}$", effective_doc_number.replace(" ", ""))
            ):
                reasons.append("Document type consistency mismatch: uploaded document appears to be an Aadhaar card, but Voter ID was selected.")

        # ─── RULE 7: Data Integrity Validation ──────────────────────────────────
        # Verified above: document_number, document_type, and verification_id are immutably derived from server record.

        # ─── RULE 8: Passport MRZ Validation (Optional / Conditional) ───────────
        if doc_type_str == "PASSPORT" and extracted_data.mrz_checksum_valid is not None:
            if extracted_data.mrz_checksum_valid is False and extracted_data.mrz_checksum_errors:
                err_summary = "; ".join(extracted_data.mrz_checksum_errors[:2])
                reasons.append(
                    f"Passport MRZ checksum verification failed ({err_summary}). Document integrity cannot be validated."
                )

        # ─── Face Match Check ───────────────────────────────────────────────────
        fm_status = record.extracted_data.face_match_status
        if fm_status != FaceMatchStatus.MATCHED:
            if fm_status == FaceMatchStatus.PENDING:
                reasons.append("Face match step is required but has not been completed.")
            elif fm_status == FaceMatchStatus.MISMATCH:
                reasons.append("Live face capture does not match the document photo.")
            elif fm_status == FaceMatchStatus.LIVENESS_FAILED:
                reasons.append("Live face capture failed liveness detection.")
            elif fm_status == FaceMatchStatus.NO_FACE_DETECTED:
                reasons.append("Could not detect a clear face for matching.")
            elif fm_status == FaceMatchStatus.MULTIPLE_FACES:
                reasons.append("Multiple faces detected; please ensure only one person is in frame.")
            else:
                reasons.append("Face match verification is incomplete or failed.")
        
        # --- Decision Evaluation ---
        if reasons:
            record.status = VerificationStatus.REJECTED
            record.reasons = reasons
            record.verified_at = None
            assigned_tourist_id = None
            logger.info("Verification %s REJECTED: %s", verification_id, reasons)
        else:
            record.status = VerificationStatus.VERIFIED
            record.verified_at = datetime.now(timezone.utc)
            assigned_tourist_id = tourist_id or record.tourist_id or uuid4()
            record.tourist_id = assigned_tourist_id
            record.reasons = [
                "Document identity successfully verified against Suraksha Setu safety standards."
            ]

        logger.info(
            "Verification %s finalized with status %s (reasons count=%d)",
            verification_id,
            record.status,
            len(record.reasons),
        )

        return DocumentConfirmResponse(
            verification_id=verification_id,
            status=record.status,
            reasons=record.reasons,
            tourist_id=assigned_tourist_id,
        )

    def get_verification_status(
        self, verification_id: UUID
    ) -> VerificationStatusResponse:
        """Fetch read-only status of a verification transaction.

        Args:
            verification_id: Session identifier.

        Returns:
            VerificationStatusResponse.

        Raises:
            KeyError: If session is not found.
        """
        record = self._store.get(verification_id)
        if not record:
            raise KeyError(f"Verification session '{verification_id}' not found.")

        return VerificationStatusResponse(
            verification_id=record.verification_id,
            document_type=record.document_type,
            status=record.status,
            confidence=record.confidence,
            created_at=record.created_at,
            verified_at=record.verified_at,
        )

    def _get_record(self, verification_id: UUID) -> Optional["VerificationRecord"]:
        """Return the VerificationRecord for a session UUID, or None if not found."""
        return self._store.get(verification_id)

    def cleanup_session(self, verification_id: UUID) -> bool:
        """Delete stored file and verification session record.

        Args:
            verification_id: Session UUID.

        Returns:
            True if removed, False otherwise.
        """
        record = self._store.pop(verification_id, None)
        if record and record.storage_key:
            return delete_upload(record.storage_key)
        return False


# Global singleton instance for standalone runner and shared imports
verification_service = DocumentVerificationService()
