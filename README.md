<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Suraksha Setu (Tourist Safety Monitoring App)

Suraksha Setu is a real-time tourist safety monitoring application for command centers. It integrates a Node.js Express server, a React dashboard, and a Python FastAPI **"context-aware risk scoring and anomaly detection engine"** that computes safety risk scores (0–100) per tourist using rules, geography context, and machine learning.

---

## System Architecture: Rule-Based vs. Machine Learning

To maintain safety transparency and explainability, the engine separates deterministic risk signals from unsupervised ML anomalies:

1. **Deterministic Rules & Regional Context (Non-ML)**
   - Configured via `risk_engine/config.yaml`.
   - Tracks factors like manual SOS triggers, critical/danger geofences, curfew times, inactivity, and signal loss.
   - Evaluates proximity to historical hotspots and computes a regional risk contribution.
   - Output lists every firing factor and its points breakdown for full transparency (explainable risk).

2. **ML Anomaly Detection (Isolation Forest)**
   - Only the anomaly detection component is machine learning.
   - Employs a scikit-learn `IsolationForest` model trained on normal walking trajectories.
   - Preprocesses telemetry into a 10-dimensional feature vector (cyclic time encoding, derived speeds, expected route deviation, safe zone distance, geofence tier, etc.).
   - Computes a normalized anomaly score $[0, 1]$ where higher means more anomalous.
   - Contributes at most 10 points (`ML_WEIGHT`) to the final score to avoid "black-box" false alarms.

---

## Data Disclosures (Real vs. Synthetic)

- **Geofence and Hotspot Geography:** Hand-modeled mock coordinates for the pilot region of **Himachal Pradesh (Kullu/Manali/Solang)**. Coordinates represent actual tourist routes, police checkposts, civil hospitals, and simulated hazard locations (e.g., Solang Riverbank slip hotspots).
- **ML Training Data:** Trained entirely on **synthetic normal trajectories** generated in `risk_engine/synthetic_data.py`. Warning notices are compiled directly into the model's `metadata.json`.

---

## Setup & Running the Engine

### Prerequisites
- Node.js (v18+)
- Python (v3.11+)

### 1. Install Project Dependencies
Run in the root folder to install React and Express dependencies:
```bash
npm install
```

### 2. Set Up the Python Virtual Environment
Navigate to the `risk_engine` directory to initialize Python dependencies:
```bash
cd risk_engine
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Generate Data and Train the ML Model
Inside the activated virtual environment, train the Isolation Forest model:
```bash
python train_model.py
```
This writes `model_v1.pkl` and its metadata properties to disk.

### 4. Run Automated Test Scenarios
Validate the false-alarm reduction logic against the 5 check scenarios:
```bash
python test_scenarios.py
```
This runs the simulations and dumps a detailed trace to `test_report.txt`.

### 5. Launch the Complete Dev Environment
Return to the project root folder and start the unified server:
```bash
cd ..
npm run dev
```
This concurrently starts:
- React Frontend (Vite) on port `3000`
- Express Command Server on port `8000`
- FastAPI Risk Scoring Engine on port `8001`

---

## Prototype Limitations & Roadmap

- **Prototype Stage:** This engine is a prototype designed for regional pilot testing in Himachal Pradesh.
- **Model Recalibration Required:** The Isolation Forest is trained on simulated data. It must be retrained on real telemetry to calibrate contamination rates and feature distributions.
- **SMS Fallback Integration:** The SMS beacon is currently stubbed (logs fallback payload to the console). A production SMS gateway provider (e.g., Twilio) should be integrated.
- **Geofence Resolution:** Geographic calculations are done via standard Haversine approximation. High-fidelity terrain variations should be added for mountain ranges.
