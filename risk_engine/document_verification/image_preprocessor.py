"""Image Preprocessing Strategy for OCR Document Verification in Suraksha Setu.

Provides:
- Automatic EXIF orientation correction
- Resolution checking and high-fidelity Lanczos upscaling for small text/dates
- Adaptive contrast and sharpness enhancement
- Grayscale conversion with autocontrast
- Otsu's binarization for low-contrast / unevenly lit photographed documents
- Perspective deskew via OpenCV contour detection (straightens tilted phone captures)
- Glare/overexposure detection on laminated ID cards
- Multi-candidate image generation for controlled fallback OCR
"""

import io
import logging
from enum import Enum
from typing import Dict, Optional, Tuple

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)

# Minimum target dimension for clear OCR text and date detection
MIN_OCR_DIMENSION_PX = 1200
MAX_OCR_DIMENSION_PX = 3000


class PreprocessingVariant(str, Enum):
    """Available controlled image preprocessing variants for OCR."""

    ORIGINAL = "ORIGINAL"
    ENHANCED = "ENHANCED"
    CONTRAST_BOOSTED = "CONTRAST_BOOSTED"
    UPSCALED = "UPSCALED"
    GRAYSCALE_SHARPENED = "GRAYSCALE_SHARPENED"
    BINARIZED = "BINARIZED"


class GlareResult:
    """Result of glare/overexposure analysis on an identity document image."""

    def __init__(self, detected: bool, severity: float, message: str = ""):
        self.detected = detected
        # severity: 0.0 (none) to 1.0 (severe — text likely obscured)
        self.severity = severity
        self.message = message

    def __repr__(self) -> str:
        return f"GlareResult(detected={self.detected}, severity={self.severity:.2f})"


class ImagePreprocessor:
    """Handles image normalization, orientation correction, deskew, and enhancement for OCR."""

    @staticmethod
    def is_image_format(content_type: str, filename: str) -> bool:
        """Check if upload is an image format supported by PIL."""
        ct = (content_type or "").lower()
        fn = (filename or "").lower()
        if any(ct.startswith(p) for p in ("image/jpeg", "image/jpg", "image/png", "image/webp")):
            return True
        return any(fn.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp"))

    @classmethod
    def load_and_orient(cls, file_bytes: bytes) -> Optional[Image.Image]:
        """Load image bytes and apply EXIF orientation correction.

        Returns None if file_bytes is not a decodable image (e.g. PDF).
        """
        try:
            img = Image.open(io.BytesIO(file_bytes))
            # Automatically rotate based on EXIF metadata (crucial for phone uploads)
            img = ImageOps.exif_transpose(img)

            # Convert RGBA/Palette/CMYK to standard RGB
            if img.mode in ("RGBA", "LA", "P"):
                background = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "RGBA":
                    background.paste(img, mask=img.split()[3])
                else:
                    background.paste(img.convert("RGBA"))
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")

            return img
        except Exception as exc:
            logger.debug("ImagePreprocessor could not decode image with PIL: %s", exc)
            return None

    @classmethod
    def upscale_if_small(
        cls, img: Image.Image, min_dim: int = MIN_OCR_DIMENSION_PX
    ) -> Tuple[Image.Image, float]:
        """Upscale image if smaller than min_dim to preserve small date and MRZ characters.

        Returns:
            Tuple of (upscaled_image, scale_factor)
        """
        w, h = img.size
        min_current = min(w, h)
        if min_current < min_dim:
            scale = min_dim / float(min_current)
            new_w = int(w * scale)
            new_h = int(h * scale)
            upscaled = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            logger.info(
                "ImagePreprocessor: upscaled image from (%d, %d) to (%d, %d) (scale=%.2f)",
                w, h, new_w, new_h, scale,
            )
            return upscaled, scale
        return img, 1.0

    @classmethod
    def enhance_for_ocr(cls, img: Image.Image) -> Image.Image:
        """Apply balanced contrast, brightness, and sharpness enhancement for OCR readability."""
        sharpened = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=130, threshold=3))
        contrast = ImageEnhance.Contrast(sharpened)
        enhanced = contrast.enhance(1.25)
        sharpness = ImageEnhance.Sharpness(enhanced)
        enhanced = sharpness.enhance(1.2)
        return enhanced

    @classmethod
    def binarize_otsu(cls, img: Image.Image) -> Image.Image:
        """Apply Otsu's adaptive binarization via OpenCV.

        Converts the image to a clean black-on-white binary image, which is highly
        effective for photographed documents with uneven lighting or shadows across
        the surface. Falls back to PIL autocontrast + threshold if OpenCV unavailable.
        """
        try:
            import cv2  # type: ignore

            gray_img = img.convert("L")
            arr = np.array(gray_img, dtype=np.uint8)
            # Apply Gaussian blur to reduce noise before thresholding
            blurred = cv2.GaussianBlur(arr, (5, 5), 0)
            # Otsu's binarization (automatically selects optimal threshold)
            _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            # Slight dilation to reconnect broken character strokes
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
            cleaned = cv2.dilate(binary, kernel, iterations=1)
            result_img = Image.fromarray(cleaned).convert("RGB")
            logger.debug("ImagePreprocessor: Otsu binarization applied successfully")
            return result_img
        except ImportError:
            logger.warning("OpenCV not available; falling back to PIL autocontrast for binarization")
            gray = ImageOps.grayscale(img)
            auto = ImageOps.autocontrast(gray, cutoff=5)
            return auto.convert("RGB")

    @classmethod
    def deskew(cls, img: Image.Image) -> Image.Image:
        """Detect document boundary and apply perspective correction (deskew).

        Uses OpenCV edge detection + contour finding to locate the largest rectangular
        region (the document), then applies a perspective transform to straighten it.
        Falls back silently to the original image if deskew cannot find a clear boundary.

        NOTE (prototype): Works well for documents on a contrasting background (e.g.
        white card on dark table). On uniformly bright or patterned backgrounds, contour
        detection may fail to isolate the document — in that case the original image is
        returned unchanged.
        """
        try:
            import cv2  # type: ignore

            arr = np.array(img, dtype=np.uint8)
            # Convert to grayscale for edge detection
            gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
            # Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            # Canny edge detection
            edges = cv2.Canny(blurred, 50, 150)
            # Dilate edges to close small gaps
            kernel = np.ones((3, 3), np.uint8)
            dilated = cv2.dilate(edges, kernel, iterations=2)

            # Find contours
            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return img

            # Sort by area and pick largest
            contours = sorted(contours, key=cv2.contourArea, reverse=True)
            doc_contour = None
            for cnt in contours[:5]:
                peri = cv2.arcLength(cnt, True)
                approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
                if len(approx) == 4:
                    doc_contour = approx
                    break

            if doc_contour is None:
                logger.debug("ImagePreprocessor: deskew found no 4-corner document boundary")
                return img

            # Verify the contour is large enough to be the document, not just a QR code or photo box
            img_area = img.width * img.height
            contour_area = cv2.contourArea(doc_contour)
            if contour_area < 0.15 * img_area:
                logger.debug("ImagePreprocessor: deskew found a 4-corner boundary but it was too small (false positive)")
                return img

            # Order points: top-left, top-right, bottom-right, bottom-left
            pts = doc_contour.reshape(4, 2).astype(np.float32)
            s = pts.sum(axis=1)
            diff = np.diff(pts, axis=1)
            ordered = np.array([
                pts[np.argmin(s)],    # top-left
                pts[np.argmin(diff)], # top-right
                pts[np.argmax(s)],    # bottom-right
                pts[np.argmax(diff)], # bottom-left
            ], dtype=np.float32)

            # Compute output dimensions
            width_top = np.linalg.norm(ordered[1] - ordered[0])
            width_bottom = np.linalg.norm(ordered[2] - ordered[3])
            height_left = np.linalg.norm(ordered[3] - ordered[0])
            height_right = np.linalg.norm(ordered[2] - ordered[1])
            out_w = int(max(width_top, width_bottom))
            out_h = int(max(height_left, height_right))

            if out_w < 100 or out_h < 100:
                return img

            dst = np.array([
                [0, 0],
                [out_w - 1, 0],
                [out_w - 1, out_h - 1],
                [0, out_h - 1],
            ], dtype=np.float32)

            M = cv2.getPerspectiveTransform(ordered, dst)
            warped = cv2.warpPerspective(arr, M, (out_w, out_h))
            logger.info("ImagePreprocessor: deskew applied perspective correction (%dx%d)", out_w, out_h)
            return Image.fromarray(warped)

        except Exception as exc:
            logger.debug("ImagePreprocessor: deskew skipped (%s)", exc)
            return img

    @classmethod
    def detect_glare(cls, img: Image.Image, threshold: int = 240) -> GlareResult:
        """Detect overexposed glare regions on laminated ID cards.

        Checks the proportion of pixels that are near-white (overexposed).
        Laminated cards with strong reflections can blank out text regions.

        Returns GlareResult with:
        - detected: True if >5% of pixels are overexposed
        - severity: 0.0–1.0 (proportion of overexposed pixels)
        """
        try:
            gray = np.array(img.convert("L"), dtype=np.uint8)
            overexposed = np.sum(gray > threshold)
            total = gray.size
            severity = float(overexposed) / total

            if severity > 0.05:
                msg = (
                    f"Glare detected: {severity*100:.1f}% of pixels are overexposed. "
                    "Please retake the photo without direct flash or bright light on the document."
                )
                logger.warning("ImagePreprocessor: %s", msg)
                return GlareResult(detected=True, severity=severity, message=msg)

            return GlareResult(detected=False, severity=severity)
        except Exception as exc:
            logger.debug("ImagePreprocessor: glare detection failed (%s)", exc)
            return GlareResult(detected=False, severity=0.0)

    @classmethod
    def generate_variants(cls, file_bytes: bytes) -> Dict[PreprocessingVariant, bytes]:
        """Generate controlled preprocessing variants for primary and fallback OCR passes.

        Variants:
        1. ORIGINAL: Untouched original bytes
        2. ENHANCED: Oriented, upscaled, balanced contrast/sharpness
        3. CONTRAST_BOOSTED: Higher contrast for faint/washed-out text
        4. GRAYSCALE_SHARPENED: Grayscale with edge sharpening and autocontrast
        5. BINARIZED: Otsu binarization — best for uneven lighting and shadow gradients

        Also applies deskew (perspective correction) to ENHANCED before boosting/binarizing,
        since a correctly-oriented straight image improves all downstream variant quality.
        """
        variants: Dict[PreprocessingVariant, bytes] = {
            PreprocessingVariant.ORIGINAL: file_bytes
        }

        img = cls.load_and_orient(file_bytes)
        if img is None:
            return variants

        # 1. Upscale first (shared base for all variants)
        upscaled, _ = cls.upscale_if_small(img)

        # 2. Deskew (perspective correction) — applied before enhancement to maximize benefit
        deskewed = cls.deskew(upscaled)

        # 3. ENHANCED variant
        enhanced = cls.enhance_for_ocr(deskewed)
        buf_enhanced = io.BytesIO()
        enhanced.save(buf_enhanced, format="JPEG", quality=95)
        variants[PreprocessingVariant.ENHANCED] = buf_enhanced.getvalue()

        # 4. CONTRAST_BOOSTED variant (for low-contrast or faded documents)
        contrast_booster = ImageEnhance.Contrast(deskewed)
        contrast_boosted = contrast_booster.enhance(1.6)
        buf_contrast = io.BytesIO()
        contrast_boosted.save(buf_contrast, format="JPEG", quality=95)
        variants[PreprocessingVariant.CONTRAST_BOOSTED] = buf_contrast.getvalue()

        # 5. GRAYSCALE_SHARPENED variant (for coloured security backgrounds that confuse OCR)
        gray = ImageOps.grayscale(deskewed)
        gray_enhanced = ImageOps.autocontrast(gray, cutoff=2)
        buf_gray = io.BytesIO()
        gray_enhanced.save(buf_gray, format="JPEG", quality=95)
        variants[PreprocessingVariant.GRAYSCALE_SHARPENED] = buf_gray.getvalue()

        # 6. BINARIZED variant (Otsu — best for photographed docs with shadow/lighting gradients)
        binarized = cls.binarize_otsu(deskewed)
        buf_bin = io.BytesIO()
        binarized.save(buf_bin, format="JPEG", quality=95)
        variants[PreprocessingVariant.BINARIZED] = buf_bin.getvalue()

        return variants
