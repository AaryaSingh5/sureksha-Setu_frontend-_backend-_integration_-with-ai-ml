"""FastAPI router endpoints for Suraksha Setu Document Verification.

Exposes REST endpoints for:
- POST /upload: Uploads document, runs OCR, returns structured extracted data
- POST /confirm: Confirms user-verified fields, validates rules, updates status
- GET /{verification_id}: Returns current verification status
- DELETE /{verification_id}: Cleans up temporary upload file and session record
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)

from .document_verification_service import verification_service
from .schemas import (
    DocumentConfirmRequest,
    DocumentConfirmResponse,
    DocumentType,
    DocumentUploadResponse,
    VerificationStatusResponse,
)
from .storage import (
    FileTooLargeError,
    StorageSecurityError,
    UnsupportedFileError,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Document Verification"])


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload Document & Run OCR",
    description=(
        "Uploads an identity document (JPEG, PNG, or PDF up to 8MB), stores it securely, "
        "and runs OCR extraction. Returns structured per-field statuses with masked document number."
    ),
)
async def upload_document(
    file: UploadFile = File(..., description="Binary document image or PDF file"),
    document_type: DocumentType = Form(
        ..., description="Document type: PASSPORT, DRIVING_LICENCE, VOTER_ID, OTHER_GOVERNMENT_ID"
    ),
    tourist_id: Optional[UUID] = Form(
        None, description="Optional existing tourist identifier"
    ),
) -> DocumentUploadResponse:
    """Handle document upload and OCR extraction."""
    filename = file.filename or "uploaded_document.jpg"
    content_type = file.content_type or "image/jpeg"

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )

        response = await verification_service.process_upload(
            file_bytes=file_bytes,
            filename=filename,
            content_type=content_type,
            document_type=document_type,
            tourist_id=tourist_id,
        )
        return response

    except UnsupportedFileError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except FileTooLargeError as e:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(e),
        ) from e
    except StorageSecurityError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Storage security error: {e}",
        ) from e
    except Exception as e:
        logger.exception("Unexpected error during document upload")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error processing document: {e}",
        ) from e
    finally:
        await file.close()


@router.post(
    "/confirm",
    response_model=DocumentConfirmResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm Extracted Fields & Verify Identity",
    description=(
        "Submits tourist-confirmed fields for verification validation. "
        "Document number and document type cannot be modified post-OCR."
    ),
)
async def confirm_document(
    request: DocumentConfirmRequest,
) -> DocumentConfirmResponse:
    """Submit user-confirmed fields and execute validation rules."""
    try:
        response = await verification_service.confirm_verification(
            verification_id=request.verification_id,
            confirmed_fields=request.confirmed_fields,
        )
        return response
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.exception("Unexpected error during document confirmation")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification validation error: {e}",
        ) from e


@router.get(
    "/{verification_id}",
    response_model=VerificationStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Verification Status",
    description="Retrieve the current status of an identity verification transaction.",
)
def get_verification_status(
    verification_id: UUID,
) -> VerificationStatusResponse:
    """Look up verification status by session UUID."""
    try:
        return verification_service.get_verification_status(verification_id)
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Verification session '{verification_id}' not found.",
        ) from e


@router.delete(
    "/{verification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Verification Session",
    description="Deletes an active verification record and cleans up stored document files.",
)
def delete_verification(
    verification_id: UUID,
) -> Response:
    """Delete a verification session and remove its stored file."""
    verification_service.cleanup_session(verification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
