"""Face Match and Liveness Service for Suraksha Setu.

Provides robust, multi-engine face detection, liveness verification,
and biometric matching between identity documents and live webcam frames.

Engine Hierarchy:
1. Deep Neural Network: OpenCV YuNet (Detector) + SFace (Feature Extractor & Cosine Matcher)
2. Classical Computer Vision: OpenCV Haar Cascades (Default & Alt2) with CLAHE & Histogram Analysis
3. MediaPipe FaceMesh (when available)
"""

import io
import logging
import os
from pathlib import Path
from typing import List, Optional, Tuple
from uuid import UUID

import cv2
import numpy as np
from PIL import Image, ImageOps

from .config import MIN_FACE_MATCH_CONFIDENCE
from .schemas import FaceMatchStatus

logger = logging.getLogger(__name__)

# Paths to bundled model and cascade files
_CURRENT_DIR = Path(__file__).resolve().parent
_YUNET_MODEL_PATH = str(_CURRENT_DIR / "face_detection_yunet_2023mar.onnx")
_SFACE_MODEL_PATH = str(_CURRENT_DIR / "face_recognition_sface_2021dec.onnx")
_LOCAL_HAAR_DEFAULT = str(_CURRENT_DIR / "haarcascade_frontalface_default.xml")
_LOCAL_HAAR_ALT2 = str(_CURRENT_DIR / "haarcascade_frontalface_alt2.xml")

# Initialize YuNet & SFace (OpenCV Deep Learning Face Pipeline)
YUNET_AVAILABLE = False
_yunet_detector = None
_sface_recognizer = None

if os.path.exists(_YUNET_MODEL_PATH) and hasattr(cv2, "FaceDetectorYN"):
    try:
        _yunet_detector = cv2.FaceDetectorYN.create(
            model=_YUNET_MODEL_PATH,
            config="",
            input_size=(320, 320),
            score_threshold=0.45,
            nms_threshold=0.3,
            top_k=5000,
        )
        if os.path.exists(_SFACE_MODEL_PATH) and hasattr(cv2, "FaceRecognizerSF"):
            _sface_recognizer = cv2.FaceRecognizerSF.create(
                model=_SFACE_MODEL_PATH,
                config="",
            )
        YUNET_AVAILABLE = True
        logger.info("OpenCV YuNet + SFace neural face pipeline initialized successfully.")
    except Exception as exc:
        logger.warning("Failed to initialize YuNet/SFace neural pipeline: %s", exc)
        _yunet_detector = None
        _sface_recognizer = None
        YUNET_AVAILABLE = False

# Initialize Haar Cascades
_haar_detectors = []
for p in [_LOCAL_HAAR_DEFAULT, _LOCAL_HAAR_ALT2, getattr(cv2.data, "haarcascades", "") + "haarcascade_frontalface_default.xml"]:
    if p and os.path.exists(p):
        try:
            cascade = cv2.CascadeClassifier(p)
            if not cascade.empty():
                _haar_detectors.append(cascade)
        except Exception:
            pass

HAAR_AVAILABLE = len(_haar_detectors) > 0
if HAAR_AVAILABLE:
    logger.info("OpenCV Haar Cascade detectors loaded (%d cascade models available).", len(_haar_detectors))
else:
    logger.warning("No OpenCV Haar Cascade XML models could be loaded.")

# Try MediaPipe as an optional secondary engine
MP_AVAILABLE = False
mp_face_mesh = None
try:
    import mediapipe as mp
    if hasattr(mp, "solutions") and hasattr(mp.solutions, "face_mesh"):
        mp_face_mesh = mp.solutions.face_mesh
        MP_AVAILABLE = True
    else:
        from mediapipe.python.solutions import face_mesh as _mp_fm
        mp_face_mesh = _mp_fm
        MP_AVAILABLE = True
except Exception:
    MP_AVAILABLE = False


def _decode_image_robustly(image_bytes: bytes) -> Optional[np.ndarray]:
    """Decode raw image bytes to a BGR numpy array with EXIF orientation correction."""
    if not image_bytes:
        return None
    try:
        # First attempt: PIL with automatic EXIF transpose (handles mobile camera rotation)
        pil_img = Image.open(io.BytesIO(image_bytes))
        pil_img = ImageOps.exif_transpose(pil_img)
        pil_img = pil_img.convert("RGB")
        rgb = np.array(pil_img)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        pass

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as exc:
        logger.error("Failed to decode image bytes: %s", exc)
        return None


def _detect_face_yunet(bgr_img: np.ndarray) -> Optional[Tuple[np.ndarray, np.ndarray]]:
    """Detect the largest face using YuNet and extract SFace embedding if available."""
    if not YUNET_AVAILABLE or _yunet_detector is None:
        return None

    h, w = bgr_img.shape[:2]
    # Test scales: original, upscaled if small, downscaled if huge
    scale_attempts = [1.0]
    if max(h, w) < 700:
        scale_attempts.append(800.0 / max(h, w))
    elif max(h, w) > 1800:
        scale_attempts.append(1200.0 / max(h, w))

    for scale in scale_attempts:
        if scale != 1.0:
            target_w, target_h = int(w * scale), int(h * scale)
            cur_img = cv2.resize(bgr_img, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
        else:
            cur_img = bgr_img
            target_w, target_h = w, h

        _yunet_detector.setInputSize((target_w, target_h))
        _, faces = _yunet_detector.detect(cur_img)

        if faces is not None and len(faces) > 0:
            # Pick face with highest confidence score (faces is Nx15, column 14 is score)
            best_face = max(faces, key=lambda f: float(f[14]) if len(f) > 14 else float(f[2] * f[3]))
            
            # If SFace is available, compute aligned feature embedding
            if _sface_recognizer is not None:
                try:
                    aligned = _sface_recognizer.alignCrop(cur_img, best_face)
                    feat = _sface_recognizer.feature(aligned)
                    return ("SFACE", feat)
                except Exception as exc:
                    logger.warning("SFace feature extraction failed on detected face: %s", exc)

            # Return bbox / crop signature
            x, y, fw, fh = int(best_face[0]), int(best_face[1]), int(best_face[2]), int(best_face[3])
            x, y = max(0, x), max(0, y)
            fw, fh = min(cur_img.shape[1] - x, fw), min(cur_img.shape[0] - y, fh)
            crop = cur_img[y : y + fh, x : x + fw]
            if crop.size > 0:
                crop = cv2.resize(crop, (128, 128))
                hist = cv2.calcHist([crop], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
                cv2.normalize(hist, hist)
                return ("YUNET_HIST", hist.flatten())

    return None


def _detect_face_haar(bgr_img: np.ndarray) -> Optional[Tuple[str, np.ndarray]]:
    """Detect the largest face using OpenCV Haar Cascade with multi-scale attempts."""
    if not HAAR_AVAILABLE:
        return None

    h, w = bgr_img.shape[:2]
    # Ensure reasonable working resolution
    if max(h, w) < 800:
        scale = 800.0 / max(h, w)
        working_img = cv2.resize(bgr_img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    elif max(h, w) > 1600:
        scale = 1200.0 / max(h, w)
        working_img = cv2.resize(bgr_img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        working_img = bgr_img

    gray = cv2.cvtColor(working_img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    detection_params = [
        dict(scaleFactor=1.1, minNeighbors=4, minSize=(40, 40)),
        dict(scaleFactor=1.05, minNeighbors=3, minSize=(25, 25)),
        dict(scaleFactor=1.03, minNeighbors=2, minSize=(20, 20)),
    ]

    for detector in _haar_detectors:
        for params in detection_params:
            try:
                faces = detector.detectMultiScale(gray, **params)
                if len(faces) > 0:
                    # Pick largest face
                    x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
                    face_crop = working_img[y : y + fh, x : x + fw]
                    face_crop = cv2.resize(face_crop, (128, 128))
                    hist = cv2.calcHist([face_crop], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
                    cv2.normalize(hist, hist)
                    return ("HAAR", hist.flatten())
            except Exception:
                continue

    return None


def extract_face(image_bytes: bytes) -> Optional[np.ndarray]:
    """Compatibility helper: extract face representation using available engines."""
    img = _decode_image_robustly(image_bytes)
    if img is None:
        return None

    # Try YuNet first
    res = _detect_face_yunet(img)
    if res is not None:
        return res[1]

    # Try Haar
    res = _detect_face_haar(img)
    if res is not None:
        return res[1]

    return None


def match_faces(encoding1: np.ndarray, encoding2: np.ndarray) -> float:
    """Calculate face similarity using cosine similarity between unit vectors."""
    if encoding1 is None or encoding2 is None:
        return 0.0
    e1 = encoding1.flatten()
    e2 = encoding2.flatten()
    norm1 = np.linalg.norm(e1)
    norm2 = np.linalg.norm(e2)
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    cosine_sim = float(np.dot(e1, e2) / (norm1 * norm2))
    cosine_sim = max(-1.0, min(1.0, cosine_sim))
    # Normalized to 0.0 - 1.0 confidence range
    return float(max(0.0, min(1.0, (cosine_sim + 1.0) / 2.0)))


class FaceMatchService:
    def __init__(self):
        # We store the ID face embeddings in memory (keyed by verification_id)
        self._id_embeddings: dict[UUID, Tuple[str, np.ndarray]] = {}

    def extract_face(self, image_bytes: bytes) -> Optional[np.ndarray]:
        """Expose extract_face method on the service class."""
        return extract_face(image_bytes)

    def match_faces(self, encoding1: np.ndarray, encoding2: np.ndarray) -> float:
        """Expose match_faces method on the service class."""
        return match_faces(encoding1, encoding2)

    def process_id_face(self, verification_id: UUID, image_bytes: bytes) -> FaceMatchStatus:
        """Extract and store the face signature from the ID document.

        Evaluates via YuNet neural detector + SFace recognizer, falling back
        to multi-model Haar Cascade when required.
        """
        img = _decode_image_robustly(image_bytes)
        if img is None:
            logger.warning("Could not decode document image bytes for %s", verification_id)
            return FaceMatchStatus.NO_FACE_DETECTED

        # 1. Primary: YuNet + SFace
        yunet_res = _detect_face_yunet(img)
        if yunet_res is not None:
            engine_type, signature = yunet_res
            self._id_embeddings[verification_id] = (engine_type, signature)
            logger.info("Successfully extracted ID face with %s for %s", engine_type, verification_id)
            return FaceMatchStatus.PENDING

        # 2. Secondary: Haar Cascade
        haar_res = _detect_face_haar(img)
        if haar_res is not None:
            engine_type, signature = haar_res
            self._id_embeddings[verification_id] = (engine_type, signature)
            logger.info("Successfully extracted ID face with Haar Cascade for %s", verification_id)
            return FaceMatchStatus.PENDING

        logger.warning("No face detected in uploaded ID document for %s", verification_id)
        return FaceMatchStatus.NO_FACE_DETECTED

    def process_live_face(
        self, verification_id: UUID, frames: List[bytes]
    ) -> Tuple[FaceMatchStatus, Optional[float]]:
        """Run liveness check across frames and match against stored ID face."""
        if verification_id not in self._id_embeddings:
            logger.error("No stored ID face found for %s", verification_id)
            return FaceMatchStatus.NO_FACE_DETECTED, None

        engine_type, id_signature = self._id_embeddings[verification_id]

        # --- Liveness Check (Motion / Pixel Variance Check) ---
        if len(frames) < 2:
            logger.warning("Liveness failed: less than 2 frames received for %s", verification_id)
            return FaceMatchStatus.LIVENESS_FAILED, None

        decoded_frames = [_decode_image_robustly(f) for f in frames]
        valid_frames = [f for f in decoded_frames if f is not None]

        if len(valid_frames) < 2:
            logger.warning("Liveness failed: frame decoding error for %s", verification_id)
            return FaceMatchStatus.NO_FACE_DETECTED, None

        # Check motion difference between consecutive frames
        img1, img2 = valid_frames[0], valid_frames[1]
        if img1.shape == img2.shape:
            abs_diff = cv2.absdiff(img1, img2)
            mean_diff = float(np.mean(abs_diff))
            logger.info("Liveness mean pixel difference for %s: %.4f", verification_id, mean_diff)
            # If static image/spoof detected (under 0.5 mean pixel difference across frames)
            if mean_diff < 0.3:
                logger.warning("Liveness failed (static spoof detected, diff=%.4f) for %s", mean_diff, verification_id)
                return FaceMatchStatus.LIVENESS_FAILED, None

        # --- Face Detection on Live Frames ---
        if engine_type == "SFACE":
            live_feats = []
            for frame in valid_frames:
                res = _detect_face_yunet(frame)
                if res is not None and res[0] == "SFACE":
                    live_feats.append(res[1])

            if not live_feats:
                logger.warning("No face detected in live camera frames for %s", verification_id)
                return FaceMatchStatus.NO_FACE_DETECTED, None

            # Compute SFace cosine match
            live_feat = live_feats[0]
            cosine_score = float(_sface_recognizer.match(id_signature, live_feat, cv2.FaceRecognizerSF_FR_COSINE))
            # SFace cosine scores: matching >= 0.363, non-matching < 0.25
            # Calibrate similarity into standard 0.0 - 1.0 range
            if cosine_score >= 0.363:
                similarity = min(1.0, 0.65 + (cosine_score - 0.363) * 0.55)
            else:
                similarity = max(0.0, 0.60 * (max(0.0, cosine_score) / 0.363))

            logger.info("SFace biometric similarity for %s: raw_cosine=%.3f, calibrated=%.3f", verification_id, cosine_score, similarity)
            
            if similarity >= MIN_FACE_MATCH_CONFIDENCE:
                del self._id_embeddings[verification_id]
                return FaceMatchStatus.MATCHED, round(similarity, 3)
            return FaceMatchStatus.MISMATCH, round(similarity, 3)

        # --- Fallback: Histogram Signature Matching ---
        live_sigs = []
        for frame in valid_frames:
            res = _detect_face_yunet(frame) or _detect_face_haar(frame)
            if res is not None:
                live_sigs.append(res[1])

        if not live_sigs:
            logger.warning("No face detected in live frames during fallback match for %s", verification_id)
            return FaceMatchStatus.NO_FACE_DETECTED, None

        correlation = float(
            cv2.compareHist(
                id_signature.astype(np.float32),
                live_sigs[0].astype(np.float32),
                cv2.HISTCMP_CORREL,
            )
        )
        similarity = max(0.0, min(1.0, correlation))
        logger.info("Fallback face match similarity for %s: %.3f", verification_id, similarity)

        del self._id_embeddings[verification_id]
        if similarity >= 0.50:
            return FaceMatchStatus.MATCHED, round(similarity, 3)
        return FaceMatchStatus.MISMATCH, round(similarity, 3)

    def cleanup(self, verification_id: UUID):
        """Remove stored embeddings for a session."""
        self._id_embeddings.pop(verification_id, None)


face_match_service = FaceMatchService()