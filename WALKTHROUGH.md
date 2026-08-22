# Walkthrough: Tourist Safety Scoring & Anomaly Detection Engine

This document provides a detailed walkthrough of the **Tourist Safety Scoring & Anomaly Detection Engine** in Suraksha Setu. It covers the hybrid design architecture, the components, the telemetry ingestion process, and how the system simulates and validates safety alerts.

---

## 1. System Architecture Overview

To ensure high transparency, compliance, and explainability for command centers, the risk engine uses a **hybrid design** that separates deterministic rule-based safety alerts from unsupervised machine learning anomalies.

```
                      +-----------------------------+
                      |  Telemetry Ping Ingestion   |
                      |  (Lat, Lon, Speed, Dwell)   |
                      +--------------+--------------+
                                     |
             +-----------------------+-----------------------+
             |                                               |
             v                                               v
+-------------------------+                     +-------------------------+
|  Deterministic Rules    |                     |  ML Anomaly Detector    |
|  - Config yaml rules    |                     |  - Isolation Forest     |
|  - Geofences & Hotspots |                     |  - Feature Engineering  |
|  - Inactivity/Battery   |                     |  - Outlier scoring      |
+------------+------------+                     +------------+------------+
             |                                               |
             |  (Rule-based Score [0-90])                     |  (ML Anomaly Score [0-10])
             +-----------------------+-----------------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Combined Risk Combiner    |
                      |   (Final Safety Score 0-100)|
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |     False Alarm Reducer     |
                      |  (Operator Feedback Loop)   |
                      +-----------------------------+
```

### Deterministic Rules & Regional Context (Non-ML)
* **Configuration:** Rule thresholds, triggers, and weights are loaded via `config.yaml`.
* **Proximity Calculation:** Monitors geographical buffers around expected safe corridors, restricted/danger zones, and historical hotspots in the pilot region of **Kullu/Manali (Himachal Pradesh)**.
* **Explainability:** Lists each firing rule and its explicit points breakdown so operators know *exactly* why a tourist's safety score escalated.

### Machine Learning Anomaly Detection (Isolation Forest)
* **Unsupervised Model:** Uses a scikit-learn `IsolationForest` model trained on normal walking trajectories.
* **Feature Engineering:** Translates raw telemetry into a 10-dimensional feature vector, capturing speed changes, geofence tiers, safe zone distances, and routing deviations.
* **Weighted Output:** The ML model contributes at most **10 points** (`ML_WEIGHT`) to the overall safety score to prevent unsupervised "black-box" false positives from triggering critical emergency alerts.

---

## 2. Core Python Components (`risk_engine`)

The risk engine consists of the following modular scripts under the `risk_engine/` directory:

1. **[`main.py`](file:///c:/Users/Intel/Downloads/Full%20working%20copy/Full%20working%20copy/Suraksha-Setu-main/suraksha-setu%20(2)/risk_engine/main.py):** The FastAPI web service exposing endpoints for real-time location telemetry (`/tourist/location`), batch telemetry ingestion (`/tourist/location/batch`), listing alerts (`/alerts`), submitting operator feedback (`/alerts/{id}/feedback`), and manually triggering emergency SOS beacons (`/sos`).
2. **[`risk_combiner.py`](file:///c:/Users/Intel/Downloads/Full%20working%20copy/Full%20working%20copy/Suraksha-Setu-main/suraksha-setu%20(2)/risk_engine/risk_combiner.py):** Orchestrates the calculations by combining rule scores, regional geofence risks, and ML anomaly outputs into a final safety score $[0, 100]$ and assigning a safety band (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
3. **[`regional_context.py`](file:///c:/Users/Intel/Downloads/Full%20working%20copy/Full%20working%20copy/Suraksha-Setu-main/suraksha-setu%20(2)/risk_engine/regional_context.py):** Resolves geographic positions using a ray-casting algorithm to determine if a tourist has entered restricted polygons or safe corridors, and calculates Haversine distances to historical incident hotspots.
4. **[`anomaly_detection.py`](file:///c:/Users/Intel/Downloads/Full%20working%20copy/Full%20working%20copy/Suraksha-Setu-main/suraksha-setu%20(2)/risk_engine/anomaly_detection.py):** Performs feature engineering on incoming telemetry and runs inference using the saved `IsolationForest` model to output a normalized outlier score.
5. **[`false_alarm_reducer.py`](file:///c:/Users/Intel/Downloads/Full%20working%20copy/Full%20working%20copy/Suraksha-Setu-main/suraksha-setu%20(2)/risk_engine/false_alarm_reducer.py):** Maintains an adaptive feedback loop. When operators dismiss false alarms, weights are dynamically recalibrated in the database to optimize precision over time.
6. **[`synthetic_data.py`](file:///c:/Users/Intel/Downloads/Full%20working%20copy/Full%20working%20copy/Suraksha-Setu-main/suraksha-setu%20(2)/risk_engine/synthetic_data.py):** Generates realistic normal tourist hiking trajectories along pilot routes, adding Gaussian noise to simulate normal walking perturbations.
7. **[`train_model.py`](file:///c:/Users/Intel/Downloads/Full%20working%20copy/Full%20working%20copy/Suraksha-Setu-main/suraksha-setu%20(2)/risk_engine/train_model.py):** Runs the pipeline to generate synthetic data, extract features, fit the `IsolationForest` model, and save `model_v1.pkl` and `metadata.json` to disk.

---

## 3. Telemetry Ingestion and Risk Recalculation Flow

When a device transmits a tourist's location ping:
1. **API Ingestion:** The JSON payload is received via the `/tourist/location` endpoint.
2. **Database Lookup:** The engine fetches the tourist's profile (profile type, emergency contact, preferred language, etc.) and history.
3. **Feature Computation:**
   - Computes distance to expected route.
   - Computes distance to safe zone.
   - Determines geofence tier (`Safe`, `Caution`, `Restricted`).
4. **Rule Evaluation:** Evaluates rules in `config.yaml`, such as battery status, signal age (inactivity), and speed thresholds.
5. **ML Inference:** The 10-dimensional vector is passed to the Isolation Forest model to compute the anomaly score.
6. **Alert Logging:** If the score exceeds the safety threshold (e.g., score $\ge 35$), an alert is pushed to the database and displayed instantly on the Command Center dashboard.

---

## 4. Validation via Automated Test Scenarios

The system runs 5 distinct simulation scenarios inside [`test_scenarios.py`](file:///c:/Users/Intel/Downloads/Full%20working%20copy/Full%20working%20copy/Suraksha-Setu-main/suraksha-setu%20(2)/risk_engine/test_scenarios.py) to validate the safety scoring logic:

### Scenario 1: Normal Trek
* **Path:** Tourist walks along the Mall Road safe corridor in Manali.
* **Scoring Output:** Stays at `0` (Band: `LOW`). No alerts are fired, verifying baseline stability.

### Scenario 2: Restricted Zone Entry
* **Path:** Trekker steps deep inside the *Solang Riverbank & Avalanche Slope* restricted polygon.
* **Scoring Output:** Rises to `67` (Band: `HIGH`). Triggered by the `critical_geofence` flag and regional geofence contributions, demonstrating instant boundary alerts.

### Scenario 3: Prolonged Inactivity (Fall Simulation)
* **Path:** A solo backpacker stops completely (speed = 0) in a remote area.
* **Scoring Output:**
  * At $T+5$ minutes: Score is `15` (Band: `LOW`, within normal dwell tolerance).
  * At $T+20$ minutes: Score rises to `46` (Band: `MEDIUM`). Fired flags include `unusual_movement` and `prolonged_inactivity` since it exceeds the 10-minute threshold configured for solo profiles.

### Scenario 4: Signal Loss + Reconnect
* **Path:** Hiker enters a dead zone (connectivity status becomes `Lost`).
* **Scoring Output:**
  * During signal loss: Score is `35` (Band: `HIGH` Warning alert).
  * After reconnecting: Score resets to `7` (Band: `LOW`), confirming recovery without leaving stale sticky warnings.

### Scenario 5: Benign Deviation (Shopping Detour)
* **Path:** A domestic city tourist steps slightly off-route in a commercial safe zone.
* **Scoring Output:** Remains at `24` (Band: `MEDIUM`), preventing high-severity false alarms since the tourist profile allows higher route deviation tolerances in shopping corridors.
