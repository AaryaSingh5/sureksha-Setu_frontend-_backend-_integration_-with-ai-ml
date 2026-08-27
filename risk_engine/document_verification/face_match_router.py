"""FastAPI router endpoints for Face Match and Liveness."""

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel

from .document_verification_service import verification_service
from .face_match_service import face_match_service
from .schemas import FaceMatchStatus
from .storage import load_upload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/{verification_id}", tags=["Face Match"])


class FaceExtractResponse(BaseModel):
    status: FaceMatchStatus
    message: str


class FaceMatchResponse(BaseModel):
    status: FaceMatchStatus
    similarity: Optional[float] = None
    message: str



@router.post(
    "/face-extract",
    response_model=FaceExtractResponse,
    summary="Extract face from previously uploaded ID document",
)
async def extract_face(verification_id: UUID) -> FaceExtractResponse:
    """Extract face embedding from the ID document stored during upload."""
    record = verification_service._get_record(verification_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification session not found.",
        )
    
    # Mark that face match is required for this session
    record.face_match_required = True

    try:
        file_bytes = load_upload(record.storage_key)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on server.",
        )

    match_status = face_match_service.process_id_face(verification_id, file_bytes)
    
    # Update record
    record.extracted_data.face_match_status = match_status
    
    msg = (
        "Face successfully extracted from ID."
        if match_status == FaceMatchStatus.PENDING
        else "No face detected in the ID document."
    )
    return FaceExtractResponse(status=match_status, message=msg)


@router.post(
    "/face-match",
    response_model=FaceMatchResponse,
    summary="Submit live frames for liveness and face match",
)
async def match_face(
    verification_id: UUID,
    frames: List[UploadFile] = File(..., description="1 to 3 live webcam frames"),
) -> FaceMatchResponse:
    """Check liveness across multiple frames and match against ID face."""
    record = verification_service._get_record(verification_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification session not found.",
        )

    if record.extracted_data.face_match_status == FaceMatchStatus.NO_FACE_DETECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot perform match; no face was detected in the original ID.",
        )

    frame_bytes_list = []
    for frame in frames:
        frame_bytes_list.append(await frame.read())

    if not frame_bytes_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No frames provided.",
        )

    match_status, similarity = face_match_service.process_live_face(verification_id, frame_bytes_list)
    
    # Update record
    record.extracted_data.face_match_status = match_status
    record.extracted_data.face_match_score = similarity

    if match_status == FaceMatchStatus.MATCHED:
        msg = "Face match successful."
    elif match_status == FaceMatchStatus.MISMATCH:
        msg = "Face does not match the ID document."
    elif match_status == FaceMatchStatus.LIVENESS_FAILED:
        msg = "Liveness check failed. Please ensure you are a live person and follow instructions."
    else:
        msg = "Face match could not be completed."

    return FaceMatchResponse(status=match_status, similarity=similarity, message=msg)
