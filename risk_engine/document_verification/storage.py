"""Secure file handling and document storage for Suraksha Setu.

Enforces:
- File extension and MIME type allow-lists
- File payload size limits
- Server-generated UUID4 storage filenames (never trusting client-supplied paths)
- Path traversal attack defense through canonical path resolution
- Best-effort cleanup
- Sensitive PII document number masking
"""

import logging
from pathlib import Path
from typing import Optional, Tuple
from uuid import uuid4

from .config import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    MAX_UPLOAD_SIZE_BYTES,
    UPLOAD_STORAGE_DIR,
)

logger = logging.getLogger(__name__)


class UnsupportedFileError(ValueError):
    """Raised when an uploaded file violates extension or MIME type restrictions."""

    pass


class FileTooLargeError(ValueError):
    """Raised when an uploaded file exceeds the maximum allowed payload size."""

    pass


class StorageSecurityError(ValueError):
    """Raised when an attempted storage operation violates security boundaries."""

    pass


def validate_upload(filename: str, content_type: str, size_bytes: int) -> None:
    """Validate file extension, MIME content type, and size.

    Args:
        filename: Original file name submitted by client.
        content_type: MIME type reported in upload headers.
        size_bytes: Size of the upload in bytes.

    Raises:
        UnsupportedFileError: If extension or MIME type is not allowed.
        FileTooLargeError: If size exceeds MAX_UPLOAD_SIZE_BYTES.
    """
    if size_bytes > MAX_UPLOAD_SIZE_BYTES:
        raise FileTooLargeError(
            f"File size ({size_bytes} bytes) exceeds maximum limit of "
            f"{MAX_UPLOAD_SIZE_BYTES} bytes ({MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB)."
        )

    # Normalize extension check
    ext = Path(filename).suffix.lower() if filename else ""
    if not ext or ext not in ALLOWED_EXTENSIONS:
        raise UnsupportedFileError(
            f"File extension '{ext}' is not permitted. "
            f"Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
        )

    # Normalize MIME check
    norm_content_type = (content_type or "").split(";")[0].strip().lower()
    if norm_content_type not in ALLOWED_MIME_TYPES:
        raise UnsupportedFileError(
            f"MIME type '{content_type}' is not supported. "
            f"Allowed types: {', '.join(sorted(ALLOWED_MIME_TYPES))}."
        )


def save_upload(
    file_bytes: bytes,
    original_filename: str,
    content_type: str,
    storage_dir: Optional[str] = None,
) -> Tuple[str, Path]:
    """Validate and write uploaded bytes to disk under a server-generated UUID4 key.

    Secures against path traversal attacks by validating that the resolved
    destination path is strictly inside the target storage directory.

    Args:
        file_bytes: Raw file content in bytes.
        original_filename: Client-supplied filename (used only for extension extraction).
        content_type: Uploaded MIME content-type.
        storage_dir: Optional override for the root storage directory.

    Returns:
        Tuple of (storage_key, absolute_resolved_path)

    Raises:
        UnsupportedFileError: If file validation fails.
        FileTooLargeError: If file exceeds size limits.
        StorageSecurityError: If path resolution violates directory boundaries.
    """
    validate_upload(original_filename, content_type, len(file_bytes))

    base_dir = Path(storage_dir or UPLOAD_STORAGE_DIR).resolve()
    base_dir.mkdir(parents=True, exist_ok=True)

    # Extract extension safely
    ext = Path(original_filename).suffix.lower()
    if not ext:
        ext = ".jpg"

    # Server-generated UUID4 filename to prevent any client-controlled path manipulation
    storage_key = f"{uuid4().hex}{ext}"
    target_path = (base_dir / storage_key).resolve()

    # Path traversal validation
    try:
        # Check if target_path is relative to base_dir
        target_path.relative_to(base_dir)
    except ValueError as e:
        raise StorageSecurityError(
            f"Security violation: Resolved path {target_path} escapes storage root {base_dir}"
        ) from e

    # Persist file
    with open(target_path, "wb") as f:
        f.write(file_bytes)

    logger.info("Saved upload securely to %s with key %s", target_path, storage_key)
    return storage_key, target_path


def delete_upload(storage_key: str, storage_dir: Optional[str] = None) -> bool:
    """Best-effort cleanup of stored document. Never raises exceptions.

    Args:
        storage_key: Server-generated storage filename.
        storage_dir: Storage directory.

    Returns:
        True if file was deleted, False otherwise.
    """
    try:
        if not storage_key:
            return False

        base_dir = Path(storage_dir or UPLOAD_STORAGE_DIR).resolve()
        target_path = (base_dir / storage_key).resolve()

        # Defend against path traversal during deletion
        target_path.relative_to(base_dir)

        if target_path.is_file():
            target_path.unlink(missing_ok=True)
            logger.info("Deleted upload %s", target_path)
            return True
        return False
    except Exception as exc:
        logger.warning("Error during best-effort delete of %s: %s", storage_key, exc)
        return False

def load_upload(storage_key: str, storage_dir: Optional[str] = None) -> bytes:
    """Load uploaded file bytes from disk using the storage key."""
    if not storage_key:
        raise FileNotFoundError("Storage key is empty.")

    base_dir = Path(storage_dir or UPLOAD_STORAGE_DIR).resolve()
    target_path = (base_dir / storage_key).resolve()

    # Path traversal validation
    try:
        target_path.relative_to(base_dir)
    except ValueError as e:
        raise StorageSecurityError(
            f"Security violation: Resolved path {target_path} escapes storage root {base_dir}"
        ) from e

    if not target_path.is_file():
        raise FileNotFoundError(f"File {storage_key} not found on server.")

    with open(target_path, "rb") as f:
        return f.read()



def mask_document_number(value: Optional[str]) -> Optional[str]:
    """Mask all but the last 4 alphanumeric characters for privacy protection,
    preserving delimiters like hyphens and spaces.

    Examples:
        "P1234567" -> "****4567"
        "1234-5678-9012" -> "****-****-9012"
        "1234 5678 9012" -> "**** **** 9012"
        "DL-1420110012345" -> "**-*********2345"
        "ABC" -> "***"
        None -> None

    Args:
        value: Raw document number string.

    Returns:
        Masked document number string or None.
    """
    if value is None:
        return None

    cleaned = value.strip()
    if not cleaned:
        return ""

    alnum_indices = [i for i, c in enumerate(cleaned) if c.isalnum()]
    if len(alnum_indices) <= 4:
        return "".join("*" if c.isalnum() else c for c in cleaned)

    unmasked_indices = set(alnum_indices[-4:])
    return "".join(
        c if i in unmasked_indices or not c.isalnum() else "*"
        for i, c in enumerate(cleaned)
    )
