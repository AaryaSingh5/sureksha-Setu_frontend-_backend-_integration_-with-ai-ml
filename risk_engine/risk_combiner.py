from datetime import datetime
import json

import database
import rules_engine
import regional_context
import anomaly_detection
import feature_engineering
import false_alarm_reducer

def run_risk_evaluation(tourist_id, lat, lon, speed, battery_level, connectivity_status, timestamp=None, sos_triggered_override=False, dwell_time=0.0):
    """
    Ingests a GPS ping, runs the full risk monitoring pipeline, and logs alerts.
    """
    if not timestamp:
        timestamp = datetime.utcnow().isoformat()

    # 1. Fetch tourist profile and history
    profile = database.get_tourist_profile(tourist_id)
    profile_type = "trekker"  # default
    if profile and profile.get("kyc_document_type") == "Aadhaar Card":
        # Domestic tourist baseline
        profile_type = "city_tourist"
    elif profile and "Group" in str(profile.get("hotel", "")):
        profile_type = "group"
    elif profile and ("Solo" in str(profile.get("hotel", "")) or "Trek" in str(profile.get("hotel", ""))):
        profile_type = "solo"
        
    # Get profile settings from config
    profile_tolerances = false_alarm_reducer.adjust_tolerances_by_profile(profile_type)
    
    # Get history from DB
    history = database.get_location_history(tourist_id, limit=20)
    
    # Log current location to history
    database.log_location(tourist_id, lat, lon, speed, battery_level, connectivity_status, timestamp)
    
    # Prepend current location point to history list to include in current evaluation
    current_ping = {
        "tourist_id": tourist_id,
        "latitude": lat,
        "longitude": lon,
        "speed": speed,
        "timestamp": timestamp,
        "battery_level": battery_level,
        "connectivity_status": connectivity_status,
        "geofence_status": 0  # will be updated below
    }
    history.insert(0, current_ping)
    
    # 2. Regional Context calculations
    reg_risk = regional_context.get_regional_context_risk(lat, lon, timestamp, tourist_id)
    current_ping["geofence_status"] = reg_risk["geofence_status"]
    
    # 3. ML Anomaly calculation
    # Format recent history for feature frequency engineering
    history_pings = []
    for h in history[1:]: # exclude current ping
        history_pings.append({
            "latitude": h["latitude"],
            "longitude": h["longitude"],
            "speed": h["speed"],
            "timestamp": h["timestamp"],
            "dwell_time": h.get("dwell_time", 0.0)
        })
        
    feature_vector = feature_engineering.extract_feature_vector(
        {
            "tourist_id": tourist_id,
            "latitude": lat,
            "longitude": lon,
            "speed": speed,
            "dwell_time": dwell_time,
            "timestamp": timestamp
        },
        history_pings
    )
    
    # Get anomaly score in [0, 1]
    ml_anomaly_score, raw_decision = anomaly_detection.get_anomaly_score(feature_vector)
    
    # 4. Check Persistence and Fired Signals
    # Inactivity persistence tolerance
    inact_tol = profile_tolerances["inactivity_tolerance_minutes"]
    dev_tol = profile_tolerances["route_deviation_tolerance_meters"]
    
    is_inactive = speed <= 0.1 or dwell_time > 0.0
    prolonged_inactivity = False
    if is_inactive:
        prolonged_inactivity = false_alarm_reducer.check_signal_persistence(history, "inactivity", inact_tol)
        
    signal_loss = False
    if connectivity_status == "Lost":
        signal_loss = false_alarm_reducer.check_signal_persistence(history, "signal_loss", 5) # 5 minutes default for connectivity
        
    # Route deviation check
    route_dist = regional_context.get_distance_from_route(lat, lon, tourist_id)
    route_deviation = route_dist > dev_tol
    
    # Unusual movement check (ML flagged anomaly or speed > 4m/s which is too fast for foot trek)
    unusual_movement = (ml_anomaly_score >= 0.65) or (speed > 4.0)
    
    # Late night context
    dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    late_night = dt.hour >= 22 or dt.hour < 5
    late_night_context = late_night and (reg_risk["score"] > 0)
    
    # Construct event state for rules engine
    event_state = {
        "sos_triggered": sos_triggered_override or (profile.get("safety_status") == "SOS Active" if profile else False),
        "critical_geofence": reg_risk["geofence_status"] == 2,
        "high_risk_zone": reg_risk["geofence_status"] == 1,
        "unusual_movement": unusual_movement,
        "late_night_context": late_night_context,
        "prolonged_inactivity": prolonged_inactivity,
        "signal_loss": signal_loss,
        "route_deviation": route_deviation
    }
    
    # 5. Evaluate deterministic rules
    rule_results = rules_engine.calculate_rule_based_score(event_state)
    
    # Load ML weight configuration
    config = rules_engine.load_config()
    ml_weight = config.get("ml_parameters", {}).get("weight", 10)
    
    # 6. Combined Risk Calculation
    # final_risk_score = rule_based_score + (ml_anomaly_score * ML_WEIGHT) + regional_context_risk
    ml_contrib = ml_anomaly_score * ml_weight
    
    final_score = rule_results["total_score"] + ml_contrib + reg_risk["score"]
    
    # Apply profile threshold offset (e.g. solo gets +10 risk shift, trekker gets -5 tolerance shift)
    final_score += profile_tolerances.get("risk_threshold_offset", 0)
    
    # Clip final score to 0–100
    final_score = int(max(0, min(100, final_score)))
    
    # 7. Map to Bands and Priorities using corroboration rules
    fired_signals = [k for k, v in event_state.items() if v]
    corrob_band, priority = false_alarm_reducer.evaluate_corroboration(fired_signals)
    
    # We combine score-based band mapping with corroboration guidelines
    # Final band is the maximum of the score band and the corroboration band
    if final_score < 30:
        score_band = "LOW"
    elif final_score < 60:
        score_band = "MEDIUM"
    elif final_score < 85:
        score_band = "HIGH"
    else:
        score_band = "CRITICAL"
        
    band_order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    final_band = score_band if band_order[score_band] > band_order[corrob_band] else corrob_band
    
    # Map priority P3 / P2 / P1 based on final band if not already P1
    if final_band == "CRITICAL":
        priority = "P1"
    elif final_band == "HIGH" and priority == "P3":
        priority = "P2"
        
    # 8. Compile Explainability Output Object
    explainability_object = {
        "final_score": final_score,
        "band": final_band,
        "priority": priority,
        "breakdown": {
            "rule_based": {
                "score": rule_results["total_score"],
                "factors": rule_results["contributing_factors"]
            },
            "regional_context": {
                "score": reg_risk["score"],
                "reason": reg_risk["reason"]
            },
            "ml_anomaly": {
                "score": round(ml_contrib, 2),
                "raw_anomaly_score": round(ml_anomaly_score, 4),
                "raw_decision_value": round(raw_decision, 4)
            }
        },
        "metadata": {
            "tourist_profile_type": profile_type,
            "fired_flags": fired_signals,
            "timestamp": timestamp
        }
    }
    
    # 9. Save Alert to Database (if it's not a normal low status, or if we want to log everything)
    alert_id = f"ALT-{tourist_id[-5:]}-{datetime.now().strftime('%M%S%f')[:4]}"
    # Save all warnings (medium and above)
    if final_band in ["MEDIUM", "HIGH", "CRITICAL"]:
        database.save_alert(
            alert_id=alert_id,
            tourist_id=tourist_id,
            total_score=final_score,
            band=final_band,
            priority=priority,
            details=explainability_object
        )
        
        # Human in the Loop: If alert is Critical or SOS Active, auto escalate, otherwise keep as NEW (pending review)
        if final_band == "CRITICAL" or "sos_triggered" in fired_signals:
            database.update_alert_status(alert_id, "ESCALATED")
        else:
            database.update_alert_status(alert_id, "NEW")
            
        # Update tourist safety status in db so it displays in frontend
        if final_band == "CRITICAL":
            database.update_tourist_safety_status(tourist_id, "SOS Active")
        elif final_band == "HIGH":
            database.update_tourist_safety_status(tourist_id, "Watch")

        # TODO: Hook for blockchain-style audit logging:
        # if final_band in ["HIGH", "CRITICAL"]:
        #     from identity.audit_service import log_incident
        #     log_incident(tourist_id, explainability_object)
    print(f"[DEBUG BACKEND] Final Safety Band: {final_band}, Score: {final_score}")
    return explainability_object
