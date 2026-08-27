import math
from datetime import datetime

FEATURE_NAMES = [
    "latitude",
    "longitude",
    "speed",
    "distance_from_expected_route",
    "time_of_day_sin",
    "time_of_day_cos",
    "dwell_time",
    "frequency_of_location_changes",
    "distance_from_nearest_safe",
    "geofence_status"
]

def encode_cyclic_time(timestamp_str):
    """Convert an ISO timestamp string into cyclical sin/cos hour components."""
    try:
        dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
    except Exception:
        dt = datetime.utcnow()
    
    fractional_hour = dt.hour + dt.minute / 60.0 + dt.second / 3600.0
    angle = 2 * math.pi * fractional_hour / 24.0
    return math.sin(angle), math.cos(angle)

def extract_feature_vector(ping, history_pings=None):
    """
    Processes a single ping location dict into a 10-feature vector for Isolation Forest.
    
    ping: {
       "latitude": float,
       "longitude": float,
       "speed": float,
       "dwell_time": float,
       "timestamp": str (ISO)
    }
    history_pings: List of recent historical pings for frequency calculation.
    """
    lat = ping["latitude"]
    lon = ping["longitude"]
    speed = ping.get("speed", 0.0)
    dwell_time = ping.get("dwell_time", 0.0)
    timestamp = ping["timestamp"]
    
    # Import regional_context inside function to avoid circular imports
    from regional_context import (
        get_distance_from_route,
        get_distance_from_nearest_safe_zone,
        get_regional_context_risk
    )
    
    tourist_id = ping.get("tourist_id")
    dist_route = get_distance_from_route(lat, lon, tourist_id)
    dist_safe = get_distance_from_nearest_safe_zone(lat, lon)
    
    # Geofence status (0=safe, 1=caution, 2=restricted)
    ctx = get_regional_context_risk(lat, lon, timestamp, tourist_id)
    geofence_status = ctx["geofence_status"]
    
    # Cyclic time representation
    time_sin, time_cos = encode_cyclic_time(timestamp)
    
    # Calculate frequency of location changes (pings in the last 15 minutes)
    freq = 1.0
    if history_pings:
        try:
            ping_dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            recent_count = 0
            for hp in history_pings:
                hp_dt = datetime.fromisoformat(hp["timestamp"].replace("Z", "+00:00"))
                delta_sec = abs((ping_dt - hp_dt).total_seconds())
                if delta_sec <= 900:  # 15 minutes window
                    recent_count += 1
            freq = float(max(recent_count, 1))
        except Exception:
            freq = float(len(history_pings))
            
    return [
        float(lat),
        float(lon),
        float(speed),
        float(dist_route),
        float(time_sin),
        float(time_cos),
        float(dwell_time),
        float(freq),
        float(dist_safe),
        float(geofence_status)
    ]
