from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import database
import risk_combiner
import anomaly_detection
import false_alarm_reducer
import regional_context
from document_verification.router import router as verification_router
from document_verification.face_match_router import router as face_match_router
from document_verification.config import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    MAX_UPLOAD_SIZE_BYTES,
    MIN_CONFIDENCE_FOR_AUTO_VERIFY,
    MIN_CONFIDENCE_FOR_REVIEW,
    OCR_MODE,
)

app = FastAPI(
    title="Suraksha Setu Context-Aware Risk Scoring & Document Verification Engine",
    description="FastAPI service computing real-time risk scores, detecting anomalies, and performing AI/OCR Document & Biometric Face Verification for tourist safety.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Document & Face Verification routers
app.include_router(verification_router, prefix="/api/v1/verifications")
app.include_router(face_match_router, prefix="/api/v1/verifications")


class LocationPing(BaseModel):
    tourist_id: str
    latitude: float
    longitude: float
    speed: float = 0.0
    battery_level: int = 100
    connectivity_status: str = "Connected"
    timestamp: Optional[str] = None
    sos_triggered_override: bool = False
    dwell_time: float = 0.0

class FeedbackRequest(BaseModel):
    feedback_type: str  # 'false_positive' or 'confirmed'

class SOSRequest(BaseModel):
    tourist_id: str
    latitude: float
    longitude: float
    description: str
    severity: str = "Critical"

# Pluggable SMS Gateway Stub
class SMSGateway:
    @staticmethod
    def send_sos_alert(phone: str, msg: str) -> bool:
        print("==============================================================")
        print(f"[SMS GATEWAY] [FALLBACK TRANSMISSION]")
        print(f"Recipient: {phone}")
        print(f"Payload: {msg}")
        print("==============================================================")
        return True

@app.on_event("startup")
def startup_event():
    database.init_db()
    # Preload the ML model and metadata into memory on startup
    try:
        import anomaly_detection
        anomaly_detection.load_model_and_metadata()
        print("[RISK ENGINE] ML Anomaly Detection Model preloaded successfully.")
    except Exception as e:
        print(f"[RISK ENGINE] Warning preloading model: {e}")

@app.post("/tourist/location")
def ingest_location(ping: LocationPing):
    try:
        res = risk_combiner.run_risk_evaluation(
            tourist_id=ping.tourist_id,
            lat=ping.latitude,
            lon=ping.longitude,
            speed=ping.speed,
            battery_level=ping.battery_level,
            connectivity_status=ping.connectivity_status,
            timestamp=ping.timestamp,
            sos_triggered_override=ping.sos_triggered_override,
            dwell_time=ping.dwell_time
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tourist/location/batch")
def ingest_location_batch(pings: List[LocationPing]):
    results = []
    # Sort chronologically to maintain consistency in speed/dwell calculations
    sorted_pings = sorted(pings, key=lambda x: x.timestamp or "")
    for ping in sorted_pings:
        try:
            res = risk_combiner.run_risk_evaluation(
                tourist_id=ping.tourist_id,
                lat=ping.latitude,
                lon=ping.longitude,
                speed=ping.speed,
                battery_level=ping.battery_level,
                connectivity_status=ping.connectivity_status,
                timestamp=ping.timestamp,
                sos_triggered_override=ping.sos_triggered_override,
                dwell_time=ping.dwell_time
            )
            results.append(res)
        except Exception as e:
            results.append({"error": str(e), "tourist_id": ping.tourist_id})
    return {"status": "batch_processed", "count": len(results), "results": results}

@app.get("/alerts")
def list_alerts(
    status: Optional[str] = Query(None, description="Filter by status (NEW, PENDING_REVIEW, ESCALATED, DISMISSED)"),
    priority: Optional[str] = Query(None, description="Filter by response priority (P1, P2, P3)"),
    band: Optional[str] = Query(None, description="Filter by risk band (LOW, MEDIUM, HIGH, CRITICAL)")
):
    try:
        all_alerts = database.get_alerts()
        filtered = []
        for a in all_alerts:
            if status and a["status"] != status:
                continue
            if priority and a["priority"] != priority:
                continue
            if band and a["band"] != band:
                continue
            filtered.append(a)
        return filtered
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/alerts/{id}/feedback")
def submit_feedback(id: str, req: FeedbackRequest, background_tasks: BackgroundTasks):
    if req.feedback_type not in ["false_positive", "confirmed"]:
        raise HTTPException(status_code=400, detail="Invalid feedback type. Must be 'false_positive' or 'confirmed'")
        
    alert = database.get_alert_by_id(id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    try:
        feedback_id = f"FB-{datetime.now().strftime('%M%S%f')[:4]}"
        database.log_feedback(feedback_id, id, req.feedback_type)
        
        # Update alert status based on review
        new_status = "DISMISSED" if req.feedback_type == "false_positive" else "ESCALATED"
        database.update_alert_status(id, new_status)
        
        # Execute feedback recalculation of rules in background
        background_tasks.add_task(false_alarm_reducer.run_feedback_loop_weight_adjustment)
        
        return {
            "status": "feedback_logged",
            "alert_status_updated_to": new_status,
            "recalculation_triggered": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model/metadata")
def model_metadata():
    try:
        meta = anomaly_detection.get_model_metadata()
        return meta
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sos")
def manual_sos(req: SOSRequest):
    try:
        # Retrieve emergency phone from database tourist profile
        profile = database.get_tourist_profile(req.tourist_id)
        phone = profile["phone"] if profile else "+91 99999 00000"
        name = profile["name"] if profile else "Tourist (Unknown)"
        
        message = f"[EMERGENCY BEACON] Tourist {name} has requested assistance. Coord: ({req.latitude}, {req.longitude}). Notes: {req.description}."
        SMSGateway.send_sos_alert(phone, message)
        
        # Force critical evaluation state
        res = risk_combiner.run_risk_evaluation(
            tourist_id=req.tourist_id,
            lat=req.latitude,
            lon=req.longitude,
            speed=0.0,
            battery_level=100,
            connectivity_status="Connected",
            timestamp=datetime.utcnow().isoformat(),
            sos_triggered_override=True,
            dwell_time=0.0
        )
        return {
            "status": "sos_broadcast_initiated",
            "sms_sent": True,
            "risk_evaluation": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/offline/geofences")
def get_offline_geofences():
    """Retrieve HP Geofences for offline storage on device."""
    return {
        "restricted_zones": regional_context.RESTRICTED_ZONES,
        "caution_zones": regional_context.CAUTION_ZONES,
        "safe_zones": regional_context.SAFE_ZONES
    }


class DigitalIDIssueRequest(BaseModel):
    tourist_id: str
    kyc_hash: str
    valid_until: datetime

@app.post("/identity/issue")
def issue_digital_identity(req: DigitalIDIssueRequest):
    try:
        from identity.did_service import issue_id
        res = issue_id(req.tourist_id, req.kyc_hash, req.valid_until)
        return {
            "data": {
                "tourist_id": res["tourist_id"],
                "did": res["did"],
                "kyc_hash": res["kyc_hash"],
                "issued_at": res["issued_at"],
                "valid_until": res["valid_until"],
                "is_active": bool(res["is_active"])
            },
            "message": "Tourist digital identity successfully generated and anchored to audit ledger"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/identity/verify/{tourist_id}")
def verify_tourist_identity(tourist_id: str):
    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tourist_digital_ids WHERE tourist_id = ?", (tourist_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail=f"No digital identity (DID) registered for tourist '{tourist_id}'")
        res = dict(row)
        return {
            "data": {
                "tourist_id": res["tourist_id"],
                "did": res["did"],
                "kyc_hash": res["kyc_hash"],
                "issued_at": res["issued_at"],
                "valid_until": res["valid_until"],
                "is_active": bool(res["is_active"])
            },
            "message": "Tourist digital identity status verified"
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/identity/chain")
def get_audit_trail_chain():
    try:
        import json
        from identity.did_service import verify_chain
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chain_blocks ORDER BY block_index ASC")
        rows = cursor.fetchall()
        conn.close()

        blocks = []
        for r in rows:
            b = dict(r)
            try:
                data_parsed = json.loads(b["data"])
            except Exception:
                data_parsed = {"raw_data": b["data"]}
            blocks.append({
                "block_index": b["block_index"],
                "timestamp": b["timestamp"],
                "data": data_parsed,
                "previous_hash": b["previous_hash"],
                "hash": b["hash"]
            })

        is_valid, count, status_message = verify_chain()
        return {
            "data": blocks,
            "message": f"Blockchain validation status: {status_message}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/identity/chain/verify")
def verify_audit_blockchain():
    try:
        from identity.did_service import verify_chain
        is_valid, count, status_message = verify_chain()
        return {
            "data": {
                "is_valid": is_valid,
                "blocks_count": count,
                "verification_message": status_message
            },
            "message": "Audit blockchain verification check completed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
