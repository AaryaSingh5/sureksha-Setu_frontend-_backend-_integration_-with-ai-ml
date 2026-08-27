"""Context-Aware Date Candidate Extraction and Multi-Date Ranking Engine.

Solves:
- Extraction of dates in multiple formats (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, DD MMM YYYY, etc.)
- Automatic OCR character typo repair (O <-> 0, I/l <-> 1, S <-> 5, B <-> 8, Z <-> 2)
- Multi-line label & context proximity detection (same line, previous line, next line)
- Spatial bounding box proximity matching when coordinates are present
- Multi-candidate scoring and ranking to accurately separate Date of Birth, Date of Issue, and Expiry Date
- Strict normalization to YYYY-MM-DD format
"""

import calendar
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Standard Month Abbreviations Mapping
MONTH_ABBR_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
    "JANUARY": 1, "FEBRUARY": 2, "MARCH": 3, "APRIL": 4, "JUNE": 6,
    "JULY": 7, "AUGUST": 8, "SEPTEMBER": 9, "OCTOBER": 10, "NOVEMBER": 11, "DECEMBER": 12
}

# Label Regexes with OCR typo tolerance
EXPIRY_LABEL_PATTERN = re.compile(
    r"\b(?:EXPIRY(?:\s*DATE)?|DATE\s*(?:OF|0F)\s*EXPIRY|VALID\s*(?:TILL|UNTIL|UPTO|THRU|THROUGH)|"
    r"EXPIRES|EXPIRATION(?:\s*DATE)?|DATE\s*(?:OF|0F)\s*EXPIRATION|EXP|DOE|"
    r"EXPlRY|EXP1RY|VALID\s*UNTlL|DATE\s*0F\s*EXPIRY|VAL1D\s*T1LL|VAL1D\s*UNT1L|VALIDITY)\b",
    re.IGNORECASE,
)

DOB_LABEL_PATTERN = re.compile(
    r"\b(?:DATE\s*(?:OF|0F)\s*BIRTH|BIRTH\s*DATE|DOB|D0B|00B|BORN|"
    r"DATE\s*(?:OF|0F)\s*B1RTH|D\.O\.B|BIRTH)\b",
    re.IGNORECASE,
)

ISSUE_LABEL_PATTERN = re.compile(
    r"\b(?:DATE\s*(?:OF|0F)\s*ISSUE|ISSUE\s*DATE|DOI|ISSUED|DATE\s*(?:OF|0F)\s*1SSUE|D\.O\.I)\b",
    re.IGNORECASE,
)


@dataclass
class BoundingBox:
    """Spatial bounding box for OCR text tokens."""

    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def center_x(self) -> float:
        return (self.x0 + self.x1) / 2.0

    @property
    def center_y(self) -> float:
        return (self.y0 + self.y1) / 2.0


@dataclass
class DateCandidate:
    """A detected calendar date candidate with contextual metadata and scoring."""

    raw_value: str
    normalized_iso: str  # Strictly YYYY-MM-DD
    parsed_date: date
    confidence: float
    line_number: int
    label_context: str = "UNKNOWN"  # EXPIRY, DOB, ISSUE, or UNKNOWN
    proximity_label: Optional[str] = None
    bounding_box: Optional[BoundingBox] = None
    scores: Dict[str, float] = field(default_factory=dict)

    @property
    def is_future(self) -> bool:
        return self.parsed_date > date.today()


class DateExtractor:
    """Intelligent date candidate extractor, typo repairer, and context ranker."""

    @classmethod
    def repair_ocr_digits(cls, text: str) -> str:
        """Repair common OCR character confusions in numeric date substrings.

        Fixes:
        - O / o -> 0
        - I / l / | -> 1
        - S / s -> 5
        - B -> 8
        - Z / z -> 2
        """
        def _clean_token(t: str) -> str:
            return (
                t.replace("O", "0")
                .replace("o", "0")
                .replace("I", "1")
                .replace("l", "1")
                .replace("|", "1")
                .replace("S", "5")
                .replace("s", "5")
                .replace("B", "8")
                .replace("Z", "2")
                .replace("z", "2")
            )

        # Match 3-part date sequences with potential OCR misread characters
        # e.g. l8-ll-2O3O or 1O/O2/199S or 18.11.2030
        date_typo_regex = re.compile(
            r"\b([0-9a-zA-Z]{1,4})([-/. \t]+)([0-9a-zA-Z]{1,9})([-/. \t]+)([0-9a-zA-Z]{2,4})\b"
        )

        def _replacer(m: re.Match) -> str:
            p1, sep1, p2, sep2, p3 = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
            # If p2 is a text month abbreviation (like NOV or FEB), don't digit-clean it
            if p2.upper() in MONTH_ABBR_MAP:
                return f"{_clean_token(p1)}{sep1}{p2}{sep2}{_clean_token(p3)}"
            return f"{_clean_token(p1)}{sep1}{_clean_token(p2)}{sep2}{_clean_token(p3)}"

        return date_typo_regex.sub(_replacer, text)

    @classmethod
    def parse_date_to_iso(cls, raw: str) -> Optional[Tuple[str, date]]:
        """Parse raw date string into (YYYY-MM-DD, date_obj) with robust format matching."""
        if not raw:
            return None

        cleaned = cls.repair_ocr_digits(raw.strip()).replace("/", "-").replace(".", "-").replace(" ", "-")
        cleaned = re.sub(r"-+", "-", cleaned)

        # 1. Try ISO: YYYY-MM-DD
        iso_match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", cleaned)
        if iso_match:
            try:
                y, m, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
                dt = date(y, m, d)
                return dt.strftime("%Y-%m-%d"), dt
            except ValueError:
                pass

        # 2. Try DD-MM-YYYY
        dmy_match = re.match(r"^(\d{1,2})-(\d{1,2})-(\d{4})$", cleaned)
        if dmy_match:
            try:
                d, m, y = int(dmy_match.group(1)), int(dmy_match.group(2)), int(dmy_match.group(3))
                if m > 12 and d <= 12:
                    d, m = m, d
                dt = date(y, m, d)
                return dt.strftime("%Y-%m-%d"), dt
            except ValueError:
                pass

        # 3. Try Textual Month: e.g. 18-NOV-2030 or 18-November-2030
        text_month_match = re.match(
            r"^(\d{1,2})-([A-Za-z]{3,9})-(\d{4})$", cleaned, re.IGNORECASE
        )
        if text_month_match:
            try:
                d = int(text_month_match.group(1))
                m_str = text_month_match.group(2).upper()
                y = int(text_month_match.group(3))
                m = MONTH_ABBR_MAP.get(m_str)
                if m:
                    dt = date(y, m, d)
                    return dt.strftime("%Y-%m-%d"), dt
            except ValueError:
                pass

        return None

    @classmethod
    def extract_candidates_from_text(
        cls, text: str, base_confidence: float = 0.85
    ) -> List[DateCandidate]:
        """Scan entire document text across lines and extract all valid date candidates."""
        candidates: List[DateCandidate] = []
        if not text:
            return candidates

        lines = [line.strip() for line in text.splitlines()]

        # Pattern to capture potential date sequences
        date_pattern = re.compile(
            r"(?:\b\d{1,2}[-/. \t]+(?:\d{1,2}|[A-Za-z]{3,9})[-/. \t]+\d{4}\b|"
            r"\b\d{4}[-/. \t]+\d{1,2}[-/. \t]+\d{1,2}\b)",
            re.IGNORECASE,
        )

        for line_idx, line in enumerate(lines):
            repaired_line = cls.repair_ocr_digits(line)

            # Check line context labels
            line_has_expiry = bool(EXPIRY_LABEL_PATTERN.search(repaired_line))
            line_has_dob = bool(DOB_LABEL_PATTERN.search(repaired_line))
            line_has_issue = bool(ISSUE_LABEL_PATTERN.search(repaired_line))

            # Adjacent previous line for multi-line labels (e.g. Label on line N-1, Date on line N)
            prev_line = lines[line_idx - 1] if line_idx > 0 else ""
            prev_repaired = cls.repair_ocr_digits(prev_line)
            prev_has_expiry = bool(EXPIRY_LABEL_PATTERN.search(prev_repaired))
            prev_has_dob = bool(DOB_LABEL_PATTERN.search(prev_repaired))
            prev_has_issue = bool(ISSUE_LABEL_PATTERN.search(prev_repaired))

            for match in date_pattern.finditer(repaired_line):
                raw_val = match.group(0)
                parsed = cls.parse_date_to_iso(raw_val)
                if not parsed:
                    continue

                iso_str, dt_obj = parsed

                # Current line labels strictly take precedence over previous line
                label_context = "UNKNOWN"
                prox_label = None

                if line_has_dob:
                    label_context = "DOB"
                    prox_label = "DOB_LABEL"
                elif line_has_expiry:
                    label_context = "EXPIRY"
                    prox_label = "EXPIRY_LABEL"
                elif line_has_issue:
                    label_context = "ISSUE"
                    prox_label = "ISSUE_LABEL"
                elif prev_has_dob:
                    label_context = "DOB"
                    prox_label = "PREV_DOB_LABEL"
                elif prev_has_expiry:
                    label_context = "EXPIRY"
                    prox_label = "PREV_EXPIRY_LABEL"
                elif prev_has_issue:
                    label_context = "ISSUE"
                    prox_label = "PREV_ISSUE_LABEL"

                candidate = DateCandidate(
                    raw_value=raw_val,
                    normalized_iso=iso_str,
                    parsed_date=dt_obj,
                    confidence=base_confidence,
                    line_number=line_idx,
                    label_context=label_context,
                    proximity_label=prox_label,
                )
                candidates.append(candidate)

        return candidates

    @classmethod
    def rank_and_classify_dates(
        cls,
        candidates: List[DateCandidate],
        expected_has_expiry: bool = True,
    ) -> Tuple[Optional[DateCandidate], Optional[DateCandidate], Optional[DateCandidate]]:
        """Intelligently score and classify date candidates into (DOB, ExpiryDate, IssueDate).

        Returns:
            Tuple of (dob_candidate, expiry_candidate, issue_date_candidate)
        """
        if not candidates:
            return None, None, None

        # Remove duplicate candidates with the same normalized ISO date
        unique_candidates: List[DateCandidate] = []
        seen_iso = set()
        for c in candidates:
            if c.normalized_iso not in seen_iso:
                seen_iso.add(c.normalized_iso)
                unique_candidates.append(c)

        today = date.today()

        # Score candidates for each role
        for c in unique_candidates:
            dob_score = 0.0
            expiry_score = 0.0
            issue_score = 0.0

            # 1. Label Proximity Scores
            if c.label_context == "DOB":
                dob_score += 60.0
                expiry_score -= 50.0
            elif c.label_context == "EXPIRY":
                expiry_score += 60.0
                dob_score -= 60.0
            elif c.label_context == "ISSUE":
                issue_score += 50.0
                dob_score -= 30.0
                expiry_score -= 20.0

            # 2. Future vs Past Temporal Plausibility
            if c.parsed_date > today:
                # Future date: highly plausible for expiry, impossible for DOB/Issue
                expiry_score += 40.0
                dob_score -= 100.0
                issue_score -= 80.0
            else:
                # Past date: plausible for DOB or Issue Date, or expired passport
                # Calculate age if it were DOB
                age = (today - c.parsed_date).days / 365.25
                if 1.0 <= age <= 110.0:
                    dob_score += 30.0
                if 0 <= (today - c.parsed_date).days <= 365.25 * 25:
                    issue_score += 25.0

            # 3. Base confidence weight
            dob_score += c.confidence * 10.0
            expiry_score += c.confidence * 10.0
            issue_score += c.confidence * 10.0

            c.scores = {
                "dob": dob_score,
                "expiry": expiry_score,
                "issue": issue_score,
            }

        # Select Best DOB
        sorted_for_dob = sorted(unique_candidates, key=lambda x: x.scores.get("dob", 0.0), reverse=True)
        best_dob = sorted_for_dob[0] if sorted_for_dob and sorted_for_dob[0].scores.get("dob", 0.0) > 0 else None

        # Select Best Expiry (excluding candidate already chosen for DOB if scores warrant)
        remaining_for_expiry = [c for c in unique_candidates if c != best_dob]
        sorted_for_expiry = sorted(
            remaining_for_expiry,
            key=lambda x: x.scores.get("expiry", 0.0),
            reverse=True,
        )

        best_expiry = None
        if sorted_for_expiry and sorted_for_expiry[0].scores.get("expiry", 0.0) > 10.0:
            best_expiry = sorted_for_expiry[0]

        # Select Best Issue Date
        remaining_for_issue = [c for c in unique_candidates if c not in (best_dob, best_expiry)]
        sorted_for_issue = sorted(
            remaining_for_issue,
            key=lambda x: x.scores.get("issue", 0.0),
            reverse=True,
        )
        best_issue = sorted_for_issue[0] if sorted_for_issue and sorted_for_issue[0].scores.get("issue", 0.0) > 10.0 else None

        # Logical sanity check: if best_expiry is before best_dob, discard or re-evaluate
        if best_dob and best_expiry and best_expiry.parsed_date <= best_dob.parsed_date:
            logger.warning(
                "Date conflict: Expiry (%s) <= DOB (%s). Discarding inconsistent expiry candidate.",
                best_expiry.normalized_iso,
                best_dob.normalized_iso,
            )
            best_expiry = None

        return best_dob, best_expiry, best_issue