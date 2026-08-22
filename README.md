# Suraksha Setu (Tourist Safety Ecosystem)

Suraksha Setu is a real-time, context-aware tourist safety monitoring platform designed for command centers and travelers in Himachal Pradesh, India. Built as an editorial-travel meets public-safety system, it coordinates a React-Vite web client, an Express command server, a local SQLite state database, and a Python FastAPI context-aware risk scoring and anomaly detection machine learning engine.

---

## 🗺️ System Architecture Overview

The Suraksha Setu platform consists of four primary components working in harmony:

```
                                +-----------------------------+
                                |    Gateway Landing Page     |
                                |  (Minimal Editorial Theme)  |
                                +--------------+--------------+
                                               |
                       +-----------------------+-----------------------+
                       |                                               |
                       v                                               v
        +-----------------------------+                 +-----------------------------+
        |    Tourist Safety Portal    |                 |  Authority Command Center   |
        |  - e-KYC DigiLocker Pass    |                 |  - AI Anomaly & Threat Hub  |
        |  - Location Consent & GPS   |                 |  - Live GIS SOS Alert Map   |
        |  - Offline IndexedDB Outbox |                 |  - Profile Detail Tracking  |
        |  - Auto Sync on Reconnect   |                 |  - Geofenced Broadcast      |
        +-----------------------------+                 +--------------+--------------+
                                                                       |
                                                                       v
                                                        +-----------------------------+
                                                        |  Context-Aware Risk Engine  |
                                                        |  - FastAPI Web Service      |
                                                        |  - Isolation Forest Model   |
                                                        |  - Rule-Based Context Risk  |
                                                        +-----------------------------+
```

---

## 🌟 Core Ecosystem Features

### 1. Gateway Landing Page
* **Editorial Design:** Minimalist layout featuring a drifting Himalayan sunset background, humanistic serif titles, and off-white styling.
* **Dual-Path Selection:** Travelers (primary path, prominent warm styling) and Authorities (secondary path, secured cool-toned styling).
* **Local Language Switcher:** Clean top-bar toggles for English and Hindi translation.

### 2. Tourist Safety Portal (Offline-First Mobile App)
* **Onboarding & e-KYC:** Trip activation with Goverment Pass registration and digital pass downloads.
* **Consent Management:** Secure and prompt verification for live GPS coordination tracking.
* **Offline-First SOS Panic Button:** 
  * Presses save location data locally to **IndexedDB** (`smart_tourist_safety_sos`) if offline.
  * Tries live GPS coordinates first, falling back to cached coordinates if cellular signal drops.
  * Listens for browser `online` reconnect events and automatically pushes queued SOS alerts to the dispatch server.
* **Emergency Hotlines:** Direct access links to protection services (112 / 100).

### 3. Authority Command Center Dashboard
* **AI Anomaly & Prediction Hub:** Visualizes predictive anomaly feeds, regional high-risk zones, model confidence metrics, and alert triggers.
* **Tourist Detail Tracking:** Justified searches detailing a traveler's KYC profiles, registered emergency contacts, real-time location metrics, and safety band status.
* **SOS Alert & Command Map:** Live GIS map plotting patrol units, active panic beacons, hospitals, and police stations, with drag-and-drop PCR unit dispatching.
* **Broadcast & Geofenced Alerts:** Center to push immediate emergency advisory SMS messages to travelers situated inside defined radiuses of hazard zones.
* **Audit Logs & Analytics:** Immutable logging of officer access justifications, response metrics, and delivery telemetry.

### 4. Machine Learning & Context-Aware Risk Engine
* **Deterministic Rules (Non-ML):** Configures geofence thresholds (curfews, danger zones) and telemetry drop tolerances (signal loss) via `config.yaml`.
* **ML Anomaly Detection:** Extracts a 10-dimensional feature vector and uses a scikit-learn `IsolationForest` model to detect unusual movement patterns.
* **Preloaded Startup:** Loads the ML model `model_v1.pkl` directly at FastAPI startup to guarantee sub-millisecond response latency.

---

## 📂 Project Structure

```
suraksha-setu (2)/
├── public/                       # Frontend static assets (Vite)
│   └── himalayan_dawn.jpg        # Background hero asset
├── risk_engine/                  # Context-Aware Anomaly Engine (Python)
│   ├── config.yaml               # Deterministic scoring thresholds
│   ├── anomaly_detection.py      # ML telemetry feature extractor & Isolation Forest inference
│   ├── synthetic_data.py         # Programmatic normal walk trajectory generator
│   ├── train_model.py            # Generates training samples and fits the model pkl
│   ├── test_scenarios.py         # Script simulating 5 distinct danger scenarios
│   └── main.py                   # FastAPI service endpoints
├── server/                       # Command Control Server (NodeJS)
│   ├── db.ts                     # SQLite database schema, seeding, and controllers
│   └── index.ts                  # Express server listener
├── src/                          # Frontend Application (React)
│   ├── components/               # UI Modules (AI Anomaly Hub, Tracking, SOS Map, etc.)
│   │   ├── Gateway.tsx           # Minimalist landing page
│   │   └── TouristPortal.tsx     # Mobile safety client
│   └── lib/                      # Core APIs (IndexedDB, Server syncing, Map layers)
├── suraksha_setu.db              # SQLite Database file
└── package.json                  # Dependencies & start scripts
```

---

## 🚀 Setup & Execution Guide

### Prerequisites
* **Node.js** (v18 or higher)
* **Python** (v3.11 or higher)

### 1. Install Workspace Dependencies
In the root directory, install all Node.js dependencies:
```bash
npm install
```

### 2. Set Up the Python Virtual Environment
Navigate to the `risk_engine` folder and set up dependencies:
```bash
cd risk_engine
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Train the Isolation Forest Model
Inside the activated virtual environment, run the training pipeline to generate the synthetic training dataset and serialize the model:
```bash
python train_model.py
```
This saves `model_v1.pkl` and `metadata.json` directly into the `risk_engine` folder.

### 4. Run Automated Scenario Verifications
To validate the engine against simulated real-world threats:
```bash
python test_scenarios.py
```
This prints the results of the 5 test scenarios (Normal Trek, Restricted Zone Entry, Dwell Fall, Signal Loss, and Benign Deviation) and writes them to `test_report.txt`.

### 5. Launch the Unified Development Environment
Deactivate or return to the root folder, and start the concurrent servers:
```bash
cd ..
npm run dev
```
This concurrently boots:
* **Vite React Client:** `http://localhost:3000`
* **Express Command Server:** `http://localhost:8000/api/v1`
* **FastAPI Risk Engine:** `http://127.0.0.1:8001`

---

## 📄 Reference Guides
For deep dives into specific subsystems:
* **Offline-First SOS Specifications:** Refer to [`SOS_IMPLEMENTATION.md`](file:///c:/Users/Intel/Downloads/Full%20working%20copy/Full%20working%20copy/Suraksha-Setu-main/suraksha-setu%20(2)/SOS_IMPLEMENTATION.md)
* **FastAPI & Risk Engine walkthrough:** Refer to [`WALKTHROUGH.md`](file:///c:/Users/Intel/Downloads/Full%20working%20copy/Full%20working%20copy/Suraksha-Setu-main/suraksha-setu%20(2)/WALKTHROUGH.md)
