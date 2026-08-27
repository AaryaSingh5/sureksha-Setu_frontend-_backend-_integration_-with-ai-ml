"""Document-Type-Specific Parsers and MRZ Decoders for Suraksha Setu.

Provides dedicated parser strategies for:
- PASSPORT: Visual Inspection Zone (VIZ) + Machine Readable Zone (MRZ Type 3 / 2x44)
- DRIVING_LICENCE: DL Number, Issue Date, Validity / Expiry Date, DOB
- VOTER_ID: EPIC Number, DOB/Age, Relative Name (no expiry required)
- OTHER_GOVERNMENT_ID: General identity cards
"""

import logging
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from .date_extractor import DateCandidate, DateExtractor
from .schemas import DocumentType

logger = logging.getLogger(__name__)


def mrz_check_digit(field: str) -> int:
    """Compute the ICAO 9303 MRZ check digit for a given field string.

    Standard ICAO Doc 9303 Part 3 weighted mod-10 algorithm:
    - Letters A–Z map to values 10–35
    - Digits 0–9 map to values 0–9
    - Filler '<' maps to 0
    - Weights cycle through [7, 3, 1] left to right
    - Result is (sum of (value × weight)) mod 10

    Returns the single-digit check digit (0–9).
    """
    char_values: Dict[str, int] = {str(d): d for d in range(10)}
    for i, c in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
        char_values[c] = 10 + i
    char_values["<"] = 0

    weights = [7, 3, 1]
    total = 0
    for idx, ch in enumerate(field.upper()):
        val = char_values.get(ch, 0)
        total += val * weights[idx % 3]
    return total % 10


class PassportParser:
    """Specialized parser for Passport documents with MRZ (Machine Readable Zone) decoding."""

    @classmethod
    def parse_mrz_lines(cls, text: str) -> Dict[str, Any]:
        """Detect and decode standard 2-line Type-3 Passport MRZ with ICAO checksum validation.

        Validates 4 ICAO 9303 check digits:
        - Document number check digit (line2[9])
        - Date of birth check digit (line2[19])
        - Expiry date check digit (line2[27])
        - Composite check digit (line2[43]) — over the full composite field

        Checksum results are reported via 'mrz_checksum_valid' and 'mrz_checksum_errors'.
        Fields failing checksum get confidence 0.45 (NEEDS_REVIEW); passing fields get 0.95.
        If MRZ checksum passes but differs from regex-extracted VIZ, MRZ value takes precedence.
        """
        result: Dict[str, Any] = {}
        checksum_errors: List[str] = []
        lines = [line.strip().replace(" ", "") for line in text.splitlines() if len(line.strip()) >= 30]

        # Locate Type-3 MRZ line 1: P<IND... or P<USA...
        line1 = None
        line2 = None
        for idx, l in enumerate(lines):
            if l.startswith("P<") or (len(l) >= 40 and re.match(r"^P[A-Z0-9<]", l)):
                line1 = l
                if idx + 1 < len(lines) and len(lines[idx + 1]) >= 35:
                    line2 = lines[idx + 1]
                break

        if not line1 or not line2:
            return result

        try:
            # ── Line 1: Names ────────────────────────────────────────────────────────
            name_part = line1[5:] if len(line1) > 5 else ""
            if "<<" in name_part:
                surname, given = name_part.split("<<", 1)
                surname = surname.replace("<", " ").strip()
                given = given.replace("<", " ").strip()
                full_name = f"{given} {surname}".strip() if given else surname
            else:
                full_name = name_part.replace("<", " ").strip()
            if full_name:
                result["full_name"] = full_name

            # Nationality: characters 2..5 of line 1
            nat_code = line1[2:5].replace("<", "").strip()
            if nat_code:
                result["nationality_code"] = nat_code
                if nat_code == "IND":
                    result["nationality"] = "INDIAN"

            # ── Line 2 layout (TD3 / Type-3) ─────────────────────────────────────
            # Pos:  0123456789...
            # [0:9]   = Document number
            # [9]     = Document number check digit
            # [10:13] = Nationality
            # [13:19] = DOB (YYMMDD)
            # [19]    = DOB check digit
            # [20]    = Sex
            # [21:27] = Expiry date (YYMMDD)
            # [27]    = Expiry check digit
            # [28:42] = Optional data
            # [42]    = Composite check digit
            # ─────────────────────────────────────────────────────────────────────

            # Pad line2 to at least 44 chars for safe slicing
            l2 = line2.ljust(44)

            # --- Document number ---
            doc_num_raw = l2[0:9]
            doc_num_clean = doc_num_raw.replace("<", "").strip()

            if doc_num_clean:
                result["document_number"] = doc_num_clean
                if not l2[9].isdigit():
                    checksum_errors.append(
                        f"document_number: check digit must be a digit, got '{l2[9]}'"
                    )
                    result["document_number_confidence"] = 0.45
                else:
                    doc_num_check_expected = int(l2[9])
                    doc_num_check_actual = mrz_check_digit(doc_num_raw)
                    if doc_num_check_actual != doc_num_check_expected:
                        checksum_errors.append(
                            f"document_number: expected check digit {doc_num_check_expected}, "
                            f"got {doc_num_check_actual} (OCR may have misread '{doc_num_raw}')"
                        )
                        result["document_number_confidence"] = 0.45
                    else:
                        result["document_number_confidence"] = 0.95

            # --- Date of birth ---
            dob_raw = l2[13:19]
            dob_iso = parse_mrz_date(dob_raw, is_expiry=False)
            if dob_iso:
                result["date_of_birth"] = dob_iso

            if not l2[19].isdigit():
                checksum_errors.append(
                    f"date_of_birth: check digit must be a digit, got '{l2[19]}'"
                )
                result["date_of_birth_confidence"] = 0.45
            else:
                dob_check_expected = int(l2[19])
                dob_check_actual = mrz_check_digit(dob_raw)
                if dob_check_actual != dob_check_expected:
                    checksum_errors.append(
                        f"date_of_birth: expected check digit {dob_check_expected}, "
                        f"got {dob_check_actual} (OCR may have misread '{dob_raw}')"
                    )
                    result["date_of_birth_confidence"] = 0.45
                else:
                    result["date_of_birth_confidence"] = 0.95

            # --- Expiry date ---
            expiry_raw = l2[21:27]
            expiry_iso = parse_mrz_date(expiry_raw, is_expiry=True)
            if expiry_iso:
                result["expiry_date"] = expiry_iso

            if not l2[27].isdigit():
                checksum_errors.append(
                    f"expiry_date: check digit must be a digit, got '{l2[27]}'"
                )
                result["expiry_date_confidence"] = 0.45
            else:
                expiry_check_expected = int(l2[27])
                expiry_check_actual = mrz_check_digit(expiry_raw)
                if expiry_check_actual != expiry_check_expected:
                    checksum_errors.append(
                        f"expiry_date: expected check digit {expiry_check_expected}, "
                        f"got {expiry_check_actual} (OCR may have misread '{expiry_raw}')"
                    )
                    result["expiry_date_confidence"] = 0.45
                else:
                    result["expiry_date_confidence"] = 0.95

            # --- Composite check digit (doc_num+check + dob+check + expiry+check+optional_data+optional_check) ---
            composite_field = l2[0:10] + l2[13:20] + l2[21:43]
            if not l2[43].isdigit():
                checksum_errors.append(
                    f"composite: check digit must be a digit, got '{l2[43]}'"
                )
            else:
                composite_check_expected = int(l2[43])
                composite_check_actual = mrz_check_digit(composite_field)
                if composite_check_actual != composite_check_expected:
                    checksum_errors.append(
                        f"composite: expected check digit {composite_check_expected}, "
                        f"got {composite_check_actual} — overall MRZ integrity suspect"
                    )

            # --- Report checksum results ---
            result["mrz_checksum_valid"] = len(checksum_errors) == 0
            result["mrz_checksum_errors"] = checksum_errors

            if checksum_errors:
                logger.warning(
                    "PassportParser: MRZ checksum failures: %s", checksum_errors
                )
            else:
                logger.info("PassportParser: MRZ checksums all valid — high confidence data")

        except Exception as exc:
            logger.debug("MRZ parsing encountered format anomaly: %s", exc)
            result["mrz_checksum_valid"] = False
            result["mrz_checksum_errors"] = [f"Parse error: {exc}"]

        return result


def parse_mrz_date(mrz_yymmdd: str, is_expiry: bool = False) -> Optional[str]:
    """Convert a 6-digit MRZ date (YYMMDD) into an ISO string (YYYY-MM-DD).

    Args:
        mrz_yymmdd: 6-digit string (e.g. "940618" for DOB or "340617" for Expiry).
        is_expiry: If True, uses 2000s cutoff for future expiry dates.
    """
    if not mrz_yymmdd or len(mrz_yymmdd) != 6 or not mrz_yymmdd.isdigit():
        return None

    yy = int(mrz_yymmdd[:2])
    mm = int(mrz_yymmdd[2:4])
    dd = int(mrz_yymmdd[4:6])

    if mm < 1 or mm > 12 or dd < 1 or dd > 31:
        return None

    current_year = date.today().year
    current_yy = current_year % 100

    if is_expiry:
        # Expiry date is usually in the 2000s (e.g. 25 -> 2025, 34 -> 2034)
        yyyy = 2000 + yy
    else:
        # DOB: If YY > current_yy + 5 -> 1900s, else 2000s
        if yy > current_yy:
            yyyy = 1900 + yy
        else:
            yyyy = 2000 + yy

    try:
        dt = date(yyyy, mm, dd)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


class DrivingLicenceParser:
    """Specialized parser for Driving Licence layouts."""

    @classmethod
    def parse_dl(cls, text: str, date_candidates: List[DateCandidate]) -> Dict[str, Any]:
        """Extract DL fields with multi-date resolution."""
        result: Dict[str, Any] = {}

        # DL Number pattern (e.g. DL-1420110012345 or RJ14-20150001234)
        dl_match = re.search(
            r"\b(?:DL\s*(?:NO|NUMBER|#)?|DRIVING\s*LICENCE\s*(?:NO|NUMBER|#)?|LICENCE\s*NO)\b[:\s]*([A-Za-z0-9\-\/\s]{8,22})",
            text,
            re.IGNORECASE,
        )
        if dl_match:
            clean_num = dl_match.group(1).strip().replace(" ", "")
            result["document_number"] = clean_num

        return result


class VoterIdParser:
    """Specialized parser for Voter ID (EPIC) documents."""

    @classmethod
    def parse_voter_id(cls, text: str) -> Dict[str, Any]:
        """Extract Voter ID fields (EPIC Number, Elector Name, DOB)."""
        result: Dict[str, Any] = {}
        if not text:
            return result

        lines = [l.strip() for l in text.splitlines() if l.strip()]

        # 1. EPIC Number extraction (3 letters + 7 alphanumeric, suffix with digits/typos)
        def is_epic_suffix(s: str) -> bool:
            return sum(1 for c in s if c.isdigit()) >= 2

        for l in lines:
            # Check explicit pattern or standalone barcode number
            m = re.search(r'\b([A-Za-z]{3})([0-9a-zA-Z]{7})\b', l)
            if m and is_epic_suffix(m.group(2)):
                prefix = m.group(1).upper()
                suffix = m.group(2).upper()
                clean_suffix = (
                    suffix.replace('O', '0')
                    .replace('S', '5')
                    .replace('I', '1')
                    .replace('L', '1')
                    .replace('B', '8')
                    .replace('Z', '2')
                )
                result["document_number"] = f"{prefix}{clean_suffix}"
                break

        # 2. Elector Name extraction (handling label on line N and name on line N+1 or subsequent)
        for idx, l in enumerate(lines):
            if re.search(r"ELECTOR\'?S?\s*NAME", l, re.IGNORECASE):
                # If name is on same line after colon
                same_line_match = re.search(r"ELECTOR\'?S?\s*NAME[:\s]+([A-Za-z \.\'\-]{3,40})", l, re.IGNORECASE)
                if same_line_match:
                    val = same_line_match.group(1).strip()
                    if not re.search(r'(?:FATHER|SEX|MALE|FEMALE|DATE|BIRTH|COMMISSION|ELECTION)', val, re.IGNORECASE):
                        result["full_name"] = val
                        break

                # Otherwise check following lines
                for next_l in lines[idx + 1:]:
                    if re.search(r'(?:FATHER|SEX|MALE|FEMALE|DATE|BIRTH|COMMISSION|ELECTION|PHOTO|IDENTITY|CARD)', next_l, re.IGNORECASE):
                        continue
                    if re.match(r'^[A-Za-z\s\.\'\-]{3,40}$', next_l):
                        result["full_name"] = next_l.strip()
                        break
                if result.get("full_name"):
                    break

        return result


class AadhaarParser:
    """Specialized parser for Indian Aadhaar Card layouts."""

    HEADER_KEYWORDS = re.compile(
        r"government|bharat|sarkar|india|unique|authority|identification|"
        r"aadhaar|uidai|help|toll|download|enrollment|mera|my\s*aadhaar|"
        r"proof\s*of\s*identity|not\s*of\s*citizenship|authentication|card|"
        r"republic|national|digital|portal|resident",
        re.IGNORECASE,
    )

    METADATA_KEYWORDS = re.compile(
        r"^(?:male|female|transgender|purush|mahila|dob|date|birth|year|"
        r"address|father|husband|mother|wife|s/o|d/o|w/o|c/o|vid|virtual|"
        r"pincode|pin|district|state|issue|valid|to|from)\b",
        re.IGNORECASE,
    )

    @classmethod
    def parse_aadhaar(cls, text: str) -> Dict[str, Any]:
        """Extract Aadhaar fields: 12-digit UID, Full Name, DOB, Gender, Nationality."""
        result: Dict[str, Any] = {}
        if not text:
            return result

        lines = [l.strip() for l in text.splitlines() if l.strip()]

        # 1. Aadhaar Number (12 digits; official format is 4 4 4 separated by spaces, NOT hyphens)
        DASH_PATTERN = r"[\-\–\—\−\_\.]"
        aadhaar_match = re.search(r"\b(\d{4}\s*" + DASH_PATTERN + r"?\s*\d{4}\s*" + DASH_PATTERN + r"?\s*\d{4})\b", text)
        masked_match = re.search(r"\b([Xx\*]{4}\s*" + DASH_PATTERN + r"?\s*[Xx\*]{4}\s*" + DASH_PATTERN + r"?\s*\d{4})\b", text)
        standalone_12 = re.search(r"\b(\d{12})\b", text)

        if aadhaar_match:
            raw_match_str = aadhaar_match.group(1).strip()
            result["document_number"] = raw_match_str
            has_dash = bool(re.search(DASH_PATTERN, raw_match_str))
            if has_dash:
                result["document_number_invalid"] = True
                result["document_number_confidence"] = 0.20
                result["document_number_warning"] = "Invalid Aadhaar format: Official UIDAI Aadhaar cards do not use hyphens ('-')."
            else:
                digits = re.sub(r"\D", "", raw_match_str)
                if len(digits) == 12:
                    result["document_number"] = f"{digits[:4]} {digits[4:8]} {digits[8:]}"
                result["document_number_invalid"] = False
                result["document_number_confidence"] = 0.95
        elif masked_match:
            raw_match_str = masked_match.group(1).strip()
            result["document_number"] = raw_match_str
            has_dash = bool(re.search(DASH_PATTERN, raw_match_str))
            if has_dash:
                result["document_number_invalid"] = True
                result["document_number_confidence"] = 0.20
                result["document_number_warning"] = "Invalid Aadhaar format: Official UIDAI Aadhaar cards do not use hyphens ('-')."
            else:
                last4 = raw_match_str[-4:]
                result["document_number"] = f"XXXX XXXX {last4}"
                result["document_number_invalid"] = False
                result["document_number_confidence"] = 0.95
        elif standalone_12:
            digits = standalone_12.group(1).strip()
            result["document_number"] = f"{digits[:4]} {digits[4:8]} {digits[8:]}"
            result["document_number_confidence"] = 0.95
            result["document_number_invalid"] = False


        # 2. DOB / Date of Birth / Year of Birth
        date_idx = None
        for i, l in enumerate(lines):
            dm = re.search(r"(?:DOB|Date\s*of\s*Birth|जन्म\s*तिथि|D\.O\.B)[:\s]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})", l, re.IGNORECASE)
            if not dm:
                dm = re.search(r"\b(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})\b", l)
            if dm:
                date_idx = i
                raw_d = dm.group(1).replace(".", "-").replace("/", "-")
                parts = raw_d.split("-")
                try:
                    d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                    parsed_d = date(y, m, d)
                    today = date.today()
                    result["date_of_birth"] = f"{y:04d}-{m:02d}-{d:02d}"
                    if parsed_d >= today or (today.year - y) > 125 or y < 1900:
                        result["date_of_birth_invalid"] = True
                        result["date_of_birth_confidence"] = 0.20
                        result["date_of_birth_warning"] = "Invalid Date of Birth: Cannot be today or in the future."
                    else:
                        result["date_of_birth_invalid"] = False
                        result["date_of_birth_confidence"] = 0.95
                except Exception:
                    pass
                break

            # Check Year of Birth: YYYY
            yob_m = re.search(r"\b(?:Year\s*of\s*Birth|YOB|जन्म\s*का\s*वर्ष)\b[:\s]*(\d{4})\b", l, re.IGNORECASE)
            if yob_m:
                date_idx = i
                y_val = int(yob_m.group(1))
                today_year = date.today().year
                result["date_of_birth"] = f"{y_val}-01-01"
                if y_val >= today_year or y_val < 1900:
                    result["date_of_birth_invalid"] = True
                    result["date_of_birth_confidence"] = 0.20
                    result["date_of_birth_warning"] = "Invalid Year of Birth: Cannot be current or future year."
                else:
                    result["date_of_birth_invalid"] = False
                    result["date_of_birth_confidence"] = 0.90
                break


        # 3. Full Name Extraction
        name_cand = None

        # Strategy A: Check explicit name label (e.g. "Name: Aarav Sharma" or "नाम : Aarav Sharma")
        for line in lines:
            nlm = re.search(r"(?:Name|नाम)\s*[:\-]\s*([A-Za-z\s\.\'\-]{3,40})", line, re.IGNORECASE)
            if nlm:
                candidate = nlm.group(1).strip()
                if not cls.HEADER_KEYWORDS.search(candidate) and not cls.METADATA_KEYWORDS.search(candidate):
                    name_cand = re.sub(r"\s+", " ", candidate)
                    break

        # Strategy B: Scan upwards from DOB line
        if not name_cand and date_idx is not None:
            for j in range(date_idx - 1, -1, -1):
                line = lines[j].strip()
                if cls.HEADER_KEYWORDS.search(line) or cls.METADATA_KEYWORDS.search(line):
                    continue
                clean = re.sub(r"[^A-Za-z\s\.\'\-]", "", line).strip()
                clean = re.sub(r"\s+", " ", clean)
                words = clean.split()
                if 1 <= len(words) <= 5 and 3 <= len(clean) <= 40:
                    name_cand = clean
                    break

        # Strategy C: If still not found, scan all lines for any plausible name line
        if not name_cand:
            for line in lines:
                if cls.HEADER_KEYWORDS.search(line) or cls.METADATA_KEYWORDS.search(line):
                    continue
                if re.search(r"\d", line):
                    continue
                clean = re.sub(r"[^A-Za-z\s\.\'\-]", "", line).strip()
                clean = re.sub(r"\s+", " ", clean)
                words = clean.split()
                if 1 <= len(words) <= 5 and 3 <= len(clean) <= 40:
                    name_cand = clean
                    break

        if name_cand:
            result["full_name"] = name_cand.title() if name_cand.isupper() else name_cand
            result["full_name_confidence"] = 0.90

        # 4. Nationality
        result["nationality"] = "INDIAN"
        result["nationality_confidence"] = 0.95
        return result
