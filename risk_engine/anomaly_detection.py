import os
import math
import joblib
import json

MODEL_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(MODEL_DIR, "model_v1.pkl")
METADATA_PATH = os.path.join(MODEL_DIR, "metadata.json")

_model = None
_metadata = None

def load_model_and_metadata():
    global _model, _metadata
    if _model is None:
        if os.path.exists(MODEL_PATH):
            _model = joblib.load(MODEL_PATH)
        else:
            raise FileNotFoundError("Trained model file (model_v1.pkl) not found. Run train_model.py first.")
            
    if _metadata is None:
        if os.path.exists(METADATA_PATH):
            with open(METADATA_PATH, "r") as f:
                _metadata = json.load(f)
        else:
            _metadata = {"model_version": "unknown", "warning": "No metadata found"}
            
    return _model, _metadata

def get_anomaly_score(feature_vector):
    """
    Computes a normalized anomaly score in [0, 1] from the Isolation Forest model.
    Higher score indicates a higher degree of anomaly.
    """
    model, _ = load_model_and_metadata()
    
    # decision_function outputs values in roughly [-0.5, 0.5]
    # lower/negative values are anomalies, positive values are normal.
    raw_score = float(model.decision_function([feature_vector])[0])
    
    # Sigmoid normalization mapping raw_score to [0, 1]
    # Centered such that a boundary score of 0.0 maps to 0.5 anomaly score.
    # Sigmoid: 1 / (1 + exp(raw_score * scale))
    # We use scale = 12.0 to stretch it nicely over [-0.2, 0.2] range.
    scale = 12.0
    normalized_score = 1.0 / (1.0 + math.exp(raw_score * scale))
    
    return normalized_score, raw_score

def get_model_metadata():
    """Retrieve details of the trained Isolation Forest model."""
    _, metadata = load_model_and_metadata()
    return metadata
