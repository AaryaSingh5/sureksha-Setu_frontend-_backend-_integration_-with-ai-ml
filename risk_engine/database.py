import sqlite3
import json
import os
from datetime import datetime, timedelta

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

    # Create geofence_zones table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS geofence_zones (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tier TEXT NOT NULL,
            description TEXT,
            polygon_json TEXT NOT NULL
        )
    """)

    # Create expected_routes table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expected_routes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            points_json TEXT NOT NULL,
            tourist_id TEXT DEFAULT NULL
        )
    """)

    # Create emergency_facilities table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emergency_facilities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            phone TEXT
        )
    """)

    # Create incident_reports table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS incident_reports (
            id TEXT PRIMARY KEY,
            name TEXT,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            weight REAL DEFAULT 10.0,
            timestamp TEXT
        )
    """)

    # Create time_risk_patterns table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS time_risk_patterns (
            hour INTEGER PRIMARY KEY,
            multiplier REAL NOT NULL
        )
    """)

    # Create location_pings table (mirroring location_history)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS location_pings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tourist_id TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            speed REAL,
            timestamp TEXT NOT NULL,
            battery_level INTEGER,
            connectivity_status TEXT DEFAULT 'Connected',
            dwell_time REAL DEFAULT 0.0
        )
    """)

    # Run schema migration for expected_routes if tourist_id column is missing
    cursor.execute("PRAGMA table_info(expected_routes)")
    columns = [row[1] for row in cursor.fetchall()]
    if "tourist_id" not in columns:
        cursor.execute("ALTER TABLE expected_routes ADD COLUMN tourist_id TEXT DEFAULT NULL")

    conn.commit()
    conn.close()

    # Seed regional context data
    seed_regional_context()

def seed_regional_context():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Seed geofence_zones
    cursor.execute("SELECT COUNT(*) FROM geofence_zones")
    if cursor.fetchone()[0] == 0:
        zones = [
            ("zone-solang-restricted", "Solang Riverbank & Avalanche Slope", "restricted", "High risk of flash floods and steep avalanche slopes. No night entry.", "[[32.2410, 77.1850], [32.2460, 77.1850], [32.2460, 77.1930], [32.2410, 77.1930]]"),
            ("zone-rohtang-slide", "Rohtang Pass Slide Zone", "restricted", "Frequent active rockfall and land slip area.", "[[32.3680, 77.2350], [32.3720, 77.2350], [32.3720, 77.2450], [32.3680, 77.2450]]"),
            ("zone-hadimba-caution", "Hadimba Pine Forest Trek", "caution", "Dense tree cover, potential wildlife activity, low cellular reception.", "[[32.2450, 77.1800], [32.2500, 77.1800], [32.2500, 77.1900], [32.2450, 77.1900]]"),
            ("zone-jogini-cliff", "Jogini Falls Cliff Walk", "caution", "Narrow pathways along steep drop-offs. Slippery conditions.", "[[32.2580, 77.1880], [32.2620, 77.1880], [32.2620, 77.1940], [32.2580, 77.1940]]"),
            ("zone-mallroad-safe", "Manali Mall Road Safe Corridor", "safe", "Highly active urban tourist center. Well lit with direct police presence.", "[[32.2350, 77.1850], [32.2410, 77.1850], [32.2410, 77.1910], [32.2350, 77.1910]]")
        ]
        cursor.executemany("INSERT INTO geofence_zones (id, name, tier, description, polygon_json) VALUES (?, ?, ?, ?, ?)", zones)
        
    # 2. Seed expected_routes
    cursor.execute("SELECT COUNT(*) FROM expected_routes")
    if cursor.fetchone()[0] == 0:
        routes = [
            ("route-mall-to-solang", "Mall Road to Solang Valley Main Trek", "[[32.2396, 77.1887], [32.2415, 77.1865], [32.2432, 77.1892], [32.2480, 77.1850], [32.2550, 77.1860], [32.2600, 77.1900]]")
        ]
        cursor.executemany("INSERT INTO expected_routes (id, name, points_json) VALUES (?, ?, ?)", routes)
        
    # 3. Seed emergency_facilities
    cursor.execute("SELECT COUNT(*) FROM emergency_facilities")
    if cursor.fetchone()[0] == 0:
        facilities = [
            ("facility-police-manali", "Manali Central Tourist Police Station", "police", 32.2400, 77.1850, "01902-252326"),
            ("facility-police-solang", "Solang Checkpost", "police", 32.2390, 77.1820, "+91 94180 12345"),
            ("facility-hosp-manali", "Manali Civil District Hospital & Trauma Center", "hospital", 32.2380, 77.1890, "+91 1902 252222"),
            ("facility-hosp-kullu", "Kullu Regional Emergency Care Center", "hospital", 31.9580, 77.1090, "+91 1902 222340")
        ]
        cursor.executemany("INSERT INTO emergency_facilities (id, name, type, lat, lon, phone) VALUES (?, ?, ?, ?, ?, ?)", facilities)
        
    # 4. Seed incident_reports (Historical incident hotspots)
    cursor.execute("SELECT COUNT(*) FROM incident_reports")
    if cursor.fetchone()[0] == 0:
        hotspots = [
            ("hotspot-solang-gorge", "Solang Gorge Slip Danger Area", 32.2450, 77.1920, 15.0, datetime.now().isoformat()),
            ("hotspot-jogini-steps", "Jogini Slippery Falls Walkway", 32.2620, 77.1910, 10.0, datetime.now().isoformat()),
            ("hotspot-rohtang-curve", "Rohtang Slide Curve 3", 32.3720, 77.2380, 20.0, datetime.now().isoformat())
        ]
        cursor.executemany("INSERT INTO incident_reports (id, name, lat, lon, weight, timestamp) VALUES (?, ?, ?, ?, ?, ?)", hotspots)
        
    # 5. Seed time_risk_patterns
    cursor.execute("SELECT COUNT(*) FROM time_risk_patterns")
    if cursor.fetchone()[0] == 0:
        # Default multipliers
        multipliers = [(h, 1.5 if (h >= 22 or h < 5) else 1.0) for h in range(24)]
        cursor.executemany("INSERT INTO time_risk_patterns (hour, multiplier) VALUES (?, ?)", multipliers)

    # 6. Seed location_pings table with real normal tourist trajectories if empty
    cursor.execute("SELECT COUNT(*) FROM location_pings")
    if cursor.fetchone()[0] < 50:
        import random
        route_points = [(32.2396, 77.1887), (32.2415, 77.1865), (32.2432, 77.1892), (32.2480, 77.1850), (32.2550, 77.1860), (32.2600, 77.1900)]
        seed_pings = []
        for t_idx in range(15):  # 15 simulated tourists
            tourist_id = f"TR-HIST-{10000 + t_idx}"
            start_time = datetime.now() - timedelta(days=random.randint(1, 60))
            lat, lon = route_points[0]
            for pt_idx in range(40):
                target_node_idx = min(int((pt_idx / 40) * len(route_points)), len(route_points) - 1)
                target_lat, target_lon = route_points[target_node_idx]
                lat = target_lat + random.gauss(0, 0.0001)
                lon = target_lon + random.gauss(0, 0.0001)
                speed = random.uniform(0.5, 1.8)
                dwell_time = random.choice([0.0, 0.0, 0.0, 5.0, 10.0])
                ping_time = start_time + timedelta(minutes=pt_idx * 5)
                seed_pings.append((
                    tourist_id, lat, lon, speed, ping_time.isoformat(), 90, "Connected", dwell_time
                ))
        cursor.executemany("""
            INSERT INTO location_pings (tourist_id, latitude, longitude, speed, timestamp, battery_level, connectivity_status, dwell_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, seed_pings)
        
        # Also copy to location_history to keep sync
        cursor.executemany("""
            INSERT INTO location_history (tourist_id, latitude, longitude, speed, timestamp, battery_level, connectivity_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [(p[0], p[1], p[2], p[3], p[4], p[5], p[6]) for p in seed_pings])

    conn.commit()
    conn.close()

def log_location(tourist_id, lat, lon, speed, battery_level, connectivity_status, timestamp=None, dwell_time=0.0):
    """Log a location ping to location_history and location_pings, and update the tourist's current location in the master table."""
    if not timestamp:
        timestamp = datetime.utcnow().isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()

    # Insert into location_history
    cursor.execute("""
        INSERT INTO location_history (tourist_id, latitude, longitude, speed, timestamp, battery_level, connectivity_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (tourist_id, lat, lon, speed, timestamp, battery_level, connectivity_status))

    # Insert into location_pings
    cursor.execute("""
        INSERT INTO location_pings (tourist_id, latitude, longitude, speed, timestamp, battery_level, connectivity_status, dwell_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (tourist_id, lat, lon, speed, timestamp, battery_level, connectivity_status, dwell_time))

    # Update tourists master record (lat, lng, last_seen_time, battery_level)
    cursor.execute("""
        UPDATE tourists
        SET lat = ?, lng = ?, last_seen_time = ?, battery_level = ?
        WHERE id = ? OR tourist_id = ?
    """, (lat, lon, "Just now", battery_level, tourist_id, tourist_id))

    conn.commit()
    conn.close()

def get_location_history(tourist_id, limit=20):
    """Retrieve recent location points for a tourist from location_pings."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM location_pings
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
        params.append(status_filter)
    if priority_filter:
        query += " AND priority = ?"
        params.append(priority_filter)
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
