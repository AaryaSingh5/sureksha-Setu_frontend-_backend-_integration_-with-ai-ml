import pandas as pd
import numpy as np
import os
import json
import joblib
from datetime import datetime
from sklearn.ensemble import IsolationForest

from synthetic_data import generate_normal_trajectories
from feature_engineering import extract_feature_vector, FEATURE_NAMES

def train_anomaly_model():
    print("Generating training data...")
    # Generate normal trajectories
    df_raw = generate_normal_trajectories(num_tourists=100, points_per_tourist=30)
    
    print(f"Engineering features for {len(df_raw)} telemetry points...")
    feature_list = []
    
    # We group by tourist to simulate historical tracking logic
    for tourist_id, group in df_raw.groupby("tourist_id"):
        # Sort by timestamp
        group = group.sort_values("timestamp")
        history = []
        for idx, row in group.iterrows():
            ping = {
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "speed": row["speed"],
                "dwell_time": row["dwell_time"],
                "timestamp": row["timestamp"]
            }
            # Extract features with history
            fv = extract_feature_vector(ping, history)
            feature_list.append(fv)
            history.append(ping)
            
    X = np.array(feature_list)
    print(f"Feature matrix shape: {X.shape}")
    
    print("Fitting Isolation Forest model...")
    # Train Isolation Forest on normal trajectories only
    model = IsolationForest(
        n_estimators=100,
        contamination=0.02,  # assume 2% anomaly threshold rate in training data
        random_state=42
    )
    model.fit(X)
    
    # Save the model
    model_dir = os.path.dirname(__file__)
    model_path = os.path.join(model_dir, "model_v1.pkl")
    joblib.dump(model, model_path)
    print(f"Saved trained model to {model_path}")
    
    # Save metadata
    metadata = {
        "model_version": "v1.0.0",
        "training_date": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "model_type": "Isolation Forest (unsupervised)",
        "features": FEATURE_NAMES,
        "training_data_source": "Synthetic Trajectories (Himachal Pradesh pilot region)",
        "is_synthetic_disclosure": True,
        "warning": (
            "This model was trained entirely on synthetic movement trajectories simulating normal tourist hiking "
            "and walking behavior in Kullu/Manali. Anomaly detection thresholds and feature distributions "
            "must be calibrated with real historical field telemetry before production deployment."
        )
    }
    
    metadata_path = os.path.join(model_dir, "metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=4)
    print(f"Saved model metadata to {metadata_path}")
    
if __name__ == "__main__":
    train_anomaly_model()
