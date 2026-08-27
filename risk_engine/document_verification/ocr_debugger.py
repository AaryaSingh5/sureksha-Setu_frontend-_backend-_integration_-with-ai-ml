"""Development-Only OCR Diagnostic Debugger for Suraksha Setu.

Provides structured logging and diagnostics for OCR text, detected date
candidates, bounding boxes, and final field classifications.

SECURITY NOTE:
Diagnostic logging is active only when DEBUG_OCR=True or in non-production
environments. Sensitive PII is redacted in production logs.
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger("suraksha_setu.ocr_debugger")

# Enable debugging via environment variable (default: True in dev)
DEBUG_OCR: bool = os.getenv("DEBUG_OCR", "true").strip().lower() in ("1", "true", "yes")
ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").strip().lower()


class OCRDebugger:
    """Safe development diagnostic logger for OCR extraction pipelines."""

    @staticmethod
    def is_enabled() -> bool:
        """Check if detailed OCR debugging is permitted."""
        return DEBUG_OCR and ENVIRONMENT != "production"

    @classmethod
    def log_raw_ocr(cls, raw_text: str, provider: str, confidence: float) -> None:
        """Log raw OCR text output in development mode."""
        if not cls.is_enabled():
            return

        separator = "=" * 60
        logger.info(
            "\n%s\n[OCR DEBUG] RAW OCR TEXT (Provider: %s, Confidence: %.2f)\n%s\n%s\n%s",
            separator,
            provider,
            confidence,
            separator,
            raw_text.strip() if raw_text else "(EMPTY RAW TEXT)",
            separator,
        )

    @classmethod
    def log_date_candidates(cls, candidates: List[Dict[str, Any]]) -> None:
        """Log detected date candidates with normalized values, confidence, and label context."""
        if not cls.is_enabled():
            return

        formatted = json.dumps(candidates, indent=2, default=str)
        logger.info(
            "\n[OCR DEBUG] DETECTED DATE CANDIDATES:\n%s",
            formatted,
        )

    @classmethod
    def log_final_classification(
        cls,
        date_of_birth: Optional[str],
        expiry_date: Optional[str],
        issue_date: Optional[str] = None,
        extra_fields: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log final resolved field classifications."""
        if not cls.is_enabled():
            return

        summary = [
            f"date_of_birth = {date_of_birth or 'None'}",
            f"expiry_date   = {expiry_date or 'None'}",
        ]
        if issue_date:
            summary.append(f"issue_date    = {issue_date}")
        if extra_fields:
            for k, v in extra_fields.items():
                summary.append(f"{k} = {v}")

        logger.info(
            "\n[OCR DEBUG] FINAL CLASSIFICATION:\n%s\n",
            "\n".join(summary),
        )
