import sqlite3
import json
import os
from datetime import datetime

# Path to the shared SQLite database
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "suraksha_setu.db"))

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize extra tables required for the risk engine and machine learning subsystem."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create location history table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS location_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tourist_id TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            speed REAL,
            timestamp TEXT NOT NULL,
            battery_level INTEGER,
            connectivity_status TEXT DEFAULT 'Connected'
        )
    """)

    # Create alerts table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            tourist_id TEXT NOT NULL,
            total_score INTEGER NOT NULL,
            band TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'NEW',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            details TEXT NOT NULL
        )
    """)

    # Create alert feedback table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alert_feedback (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL,
            feedback_type TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            processed INTEGER DEFAULT 0
        )
    """)

    # Create tourist_digital_ids table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tourist_digital_ids (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tourist_id TEXT UNIQUE NOT NULL,
            did TEXT UNIQUE NOT NULL,
            kyc_hash TEXT NOT NULL,
            issued_at TEXT NOT NULL,
            valid_until TEXT NOT NULL,
            is_active INTEGER DEFAULT 1
        )
    """)

    # Create chain_blocks table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chain_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            block_index INTEGER UNIQUE NOT NULL,
            timestamp TEXT NOT NULL,
            data TEXT NOT NULL,
            previous_hash TEXT NOT NULL,
            hash TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()

def log_location(tourist_id, lat, lon, speed, battery_level, connectivity_status, timestamp=None):
    """Log a location ping to location_history and update the tourist's current location in the master table."""
    if not timestamp:
        timestamp = datetime.utcnow().isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()

    # Insert into location_history
    cursor.execute("""
        INSERT INTO location_history (tourist_id, latitude, longitude, speed, timestamp, battery_level, connectivity_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (tourist_id, lat, lon, speed, timestamp, battery_level, connectivity_status))

    # Update tourists master record (lat, lng, last_seen_time, battery_level)
    cursor.execute("""
        UPDATE tourists
        SET lat = ?, lng = ?, last_seen_time = ?, battery_level = ?
        WHERE id = ? OR tourist_id = ?
    """, (lat, lon, "Just now", battery_level, tourist_id, tourist_id))

    conn.commit()
    conn.close()

def get_location_history(tourist_id, limit=20):
    """Retrieve recent location points for a tourist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM location_history
        WHERE tourist_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (tourist_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_tourist_profile(tourist_id):
    """Retrieve tourist profile from tourists table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM tourists
        WHERE id = ? OR tourist_id = ?
    """, (tourist_id, tourist_id))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_tourist_safety_status(tourist_id, safety_status):
    """Update safety status in tourists table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE tourists
        SET safety_status = ?
        WHERE id = ? OR tourist_id = ?
    """, (safety_status, tourist_id, tourist_id))
    conn.commit()
    conn.close()

def save_alert(alert_id, tourist_id, total_score, band, priority, details, status="NEW"):
    """Insert or update a risk alert."""
    now = datetime.utcnow().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO alerts (id, tourist_id, total_score, band, priority, status, created_at, updated_at, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            total_score = excluded.total_score,
            band = excluded.band,
            priority = excluded.priority,
            updated_at = excluded.updated_at,
            details = excluded.details
    """, (alert_id, tourist_id, total_score, band, priority, status, now, now, json.dumps(details)))

    # Also log to ai_logs table so the Express server / React dashboard automatically picks up the alert!
    message_en = f"Alert {priority} ({band}) flagged for Tourist {tourist_id}. Final risk score: {total_score}/100."
    message_hi = f"पर्यटक {tourist_id} के लिए अलर्ट {priority} ({band}) चिह्नित। अंतिम जोखिम स्कोर: {total_score}/100।"
    
    log_id = f"LOG-{alert_id}"
    cursor.execute("""
        INSERT INTO ai_logs (id, timestamp, severity, message_en, message_hi, model_confidence, region)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            timestamp = excluded.timestamp,
            severity = excluded.severity,
            message_en = excluded.message_en,
            message_hi = excluded.message_hi
    """, (log_id, datetime.now().strftime("%H:%M:%S"), band.lower(), message_en, message_hi, float(total_score), "Himachal Pradesh"))

    conn.commit()
    conn.close()

def get_alerts(status_filter=None, priority_filter=None):
    """Retrieve alerts with optional filters."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM alerts WHERE 1=1"
    params = []
    if status_filter:
        query += " AND status = ?"
        params.push(status_filter)
    if priority_filter:
        query += " AND priority = ?"
        params.push(priority_filter)
    query += " ORDER BY created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    alerts = []
    for r in rows:
        alert = dict(r)
        alert["details"] = json.loads(alert["details"])
        alerts.append(alert)
    return alerts

def get_alert_by_id(alert_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        alert = dict(row)
        alert["details"] = json.loads(alert["details"])
        return alert
    return None

def update_alert_status(alert_id, status):
    """Update alert status (NEW -> PENDING_REVIEW -> ESCALATED/DISMISSED)."""
    now = datetime.utcnow().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE alerts
        SET status = ?, updated_at = ?
        WHERE id = ?
    """, (status, now, alert_id))
    
    # Sync with Express database state: if escalated, we could trigger a matching SOS incident!
    if status == "ESCALATED":
        alert = get_alert_by_id(alert_id)
        if alert:
            tourist = get_tourist_profile(alert["tourist_id"])
            tourist_name = tourist["name"] if tourist else "Elena Rostova"
            tourist_phone = tourist["phone"] if tourist else "+34 612 884 902"
            lat = tourist["lat"] if tourist else 32.2432
            lng = tourist["lng"] if tourist else 77.1892
            
            sos_id = f"SOS-A{alert_id[-3:]}"
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("""
                INSERT INTO sos_incidents (id, tourist_id, tourist_name, tourist_phone, lat, lng, address, timestamp, status, severity, hazard_type, notes, trigger_source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Critical', ?, ?, 'SYSTEM')
                ON CONFLICT(id) DO NOTHING
            """, (sos_id, alert["tourist_id"], tourist_name, tourist_phone, lat, lng, f"Risk Alert Escalation ({alert['band']})", timestamp, "AI Anomaly Trigger", f"System risk alert: {alert['total_score']}/100. Factors: {json.dumps(alert['details']['breakdown']['rule_based']['factors'])}"))

            # Update tourist safety status
            cursor.execute("UPDATE tourists SET safety_status = 'SOS Active' WHERE id = ? OR tourist_id = ?", (alert["tourist_id"], alert["tourist_id"]))
            
    conn.commit()
    conn.close()

def log_feedback(feedback_id, alert_id, feedback_type):
    """Log user feedback (false_positive or confirmed)."""
    now = datetime.utcnow().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO alert_feedback (id, alert_id, feedback_type, timestamp, processed)
        VALUES (?, ?, ?, ?, 0)
    """, (feedback_id, alert_id, feedback_type, now))
    conn.commit()
    conn.close()

# Initialize tables immediately on module import
init_db()
