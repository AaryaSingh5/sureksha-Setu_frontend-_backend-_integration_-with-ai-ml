import yaml
import os
from datetime import datetime, timedelta

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

def save_config(config):
    with open(CONFIG_PATH, "w") as f:
        yaml.safe_dump(config, f, default_flow_style=False)

def adjust_tolerances_by_profile(profile_type):
    """
    Returns profile-specific threshold adjustments from config.yaml.
    """
    config = load_config()
    profiles = config.get("profiles", {})
    # Fallback to standard if profile not found
    profile_data = profiles.get(profile_type, profiles.get("group", {
        "inactivity_tolerance_minutes": 20,
        "route_deviation_tolerance_meters": 400,
        "risk_threshold_offset": 0
    }))
    return profile_data

def check_signal_persistence(history, condition_name, threshold_minutes):
    """
    Checks if a specific warning condition (e.g., inactivity or signal loss)
    has persisted continuously for at least threshold_minutes.
    
    history: List of dicts representing recent location history sorted by timestamp DESC.
    """
    if not history or len(history) < 2:
        return False
        
    config = load_config()
    # If no history is provided, we can't verify persistence
    now_str = history[0]["timestamp"]
    try:
        now_dt = datetime.fromisoformat(now_str.replace("Z", "+00:00"))
    except Exception:
        now_dt = datetime.utcnow()
        
    # We find the point in history that is threshold_minutes ago
    target_dt = now_dt - timedelta(minutes=threshold_minutes)
    
    # Check if the condition holds for all points from now back to target_dt
    held_continuously = True
    found_points_in_window = False
    
    for ping in history:
        try:
            ping_dt = datetime.fromisoformat(ping["timestamp"].replace("Z", "+00:00"))
        except Exception:
            continue
            
        if ping_dt < target_dt:
            # We reached beyond the persistence window
            break
            
        found_points_in_window = True
        
        # Check condition
        if condition_name == "inactivity":
            # Inactivity condition: speed is 0 or dwell_time > 0
            if ping.get("speed", 0.0) > 0.1:
                held_continuously = False
                break
        elif condition_name == "signal_loss":
            # Signal loss: connectivity_status is 'Lost'
            if ping.get("connectivity_status") != "Lost":
                held_continuously = False
                break
        elif condition_name == "critical_geofence":
            # Critical geofence: geofence_status is 2 (restricted)
            if ping.get("geofence_status", 0) != 2:
                held_continuously = False
                break
        elif condition_name == "route_deviation":
            # Route deviation: distance from route > threshold
            # Handled directly in combiner based on profile
            pass
            
    return held_continuously and found_points_in_window

def evaluate_corroboration(fired_signals):
    """
    Explicit multi-signal corroboration rules matrix to map active flags to
    overall Alert Band and Response Priority (P1/P2/P3), preventing single-signal false alarms.
    """
    # 1. SOS is always Critical/P1
    if "sos_triggered" in fired_signals:
        return "CRITICAL", "P1"
        
    # 2. Inactivity + restricted zone = Critical/P1
    if "prolonged_inactivity" in fired_signals and "critical_geofence" in fired_signals:
        return "CRITICAL", "P1"
        
    # 3. Inactivity + high risk zone + signal loss = Critical/P1 (due to escalation check)
    if ("prolonged_inactivity" in fired_signals or "signal_loss" in fired_signals) and "critical_geofence" in fired_signals:
        return "HIGH", "P1"
        
    # 4. Inactivity + high-risk zone = High/P2
    if "prolonged_inactivity" in fired_signals and "high_risk_zone" in fired_signals:
        return "HIGH", "P2"
        
    # 5. Route deviation + signal loss = High/P2
    if "route_deviation" in fired_signals and "signal_loss" in fired_signals:
        return "HIGH", "P2"
        
    # 6. Critical geofence alone = High/P2
    if "critical_geofence" in fired_signals:
        return "HIGH", "P2"
        
    # 7. Inactivity alone = Medium/P3 (Advisory/Warning queue only)
    if "prolonged_inactivity" in fired_signals:
        return "MEDIUM", "P3"
        
    # 8. Route deviation alone = Medium/P2
    if "route_deviation" in fired_signals:
        return "MEDIUM", "P2"
        
    # 9. Signal loss alone = Medium/P3
    if "signal_loss" in fired_signals:
        return "MEDIUM", "P3"
        
    # 10. Anything else (e.g. unusual movement or late night)
    if len(fired_signals) > 0:
        if "high_risk_zone" in fired_signals:
            return "MEDIUM", "P2"
        return "LOW", "P3"
        
    return "LOW", "P3"

def run_feedback_loop_weight_adjustment():
    """
    Recalculates rule weights based on authority feedback.
    Analyzes false positives in alert_feedback and slightly reduces weights of contributing factors.
    """
    import database
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # Get unprocessed feedback
    cursor.execute("SELECT * FROM alert_feedback WHERE processed = 0")
    feedback_rows = cursor.fetchall()
    
    if not feedback_rows:
        conn.close()
        return []
        
    config = load_config()
    weight_changes = []
    
    for row in feedback_rows:
        alert_id = row["alert_id"]
        feedback_type = row["feedback_type"]
        
        # Get matching alert details
        alert = database.get_alert_by_id(alert_id)
        if not alert:
            continue
            
        # Extract contributing factors
        factors = alert["details"]["breakdown"]["rule_based"]["factors"]
        
        if feedback_type == "false_positive":
            # For each factor that contributed, reduce its weight slightly (e.g. reduce by 1 point or 5%)
            for f in factors:
                factor_name = f["factor"]
                if factor_name in config["rules"]:
                    old_weight = config["rules"][factor_name]["weight"]
                    # Never drop weight below 5 points
                    new_weight = max(old_weight - 1, 5)
                    if new_weight != old_weight:
                        config["rules"][factor_name]["weight"] = new_weight
                        change_reason = f"Reduced weight due to false positive feedback on Alert {alert_id}"
                        weight_changes.append({
                            "factor": factor_name,
                            "old_weight": old_weight,
                            "new_weight": new_weight,
                            "reason": change_reason
                        })
                        
                        # Log to audit_logs in SQLite
                        audit_id = f"AUD-W{datetime.now().strftime('%M%S%f')[:4]}"
                        cursor.execute("""
                            INSERT INTO audit_logs (id, timestamp, officer_name, officer_badge, action_type, target_id, reason, details, ip_address)
                            VALUES (?, ?, 'System Feedback Engine', 'SYS-FEEDBACK', 'TICKET_STATUS_CHANGE', ?, 'Weight Tuning', ?, '127.0.0.1')
                        """, (audit_id, factor_name, f"Tuned weight from {old_weight} to {new_weight} due to false positive feedback"))
                        
        # Mark feedback as processed
        cursor.execute("UPDATE alert_feedback SET processed = 1 WHERE id = ?", (row["id"],))
        
    # Save config changes if any occurred
    if weight_changes:
        save_config(config)
        
    conn.commit()
    conn.close()
    return weight_changes
