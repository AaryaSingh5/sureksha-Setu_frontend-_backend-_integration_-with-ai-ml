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

app = FastAPI(
    title="Suraksha Setu Context-Aware Risk Scoring Engine",
    description="FastAPI service computing real-time risk scores and detecting anomalies for tourist safety.",
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
