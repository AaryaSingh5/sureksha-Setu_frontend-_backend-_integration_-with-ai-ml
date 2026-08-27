import math
import time
import json
import sqlite3
from datetime import datetime
import database

# Earth radius in meters
R_EARTH = 6371000

# Cache structure
_cache = {
    "data": None,
    "last_updated": 0
}
CACHE_TTL_SECONDS = 10  # 10 seconds TTL is perfect for quick reactivity in live tracking

def _get_live_context_data():
    """Queries live context tables from DB, parses JSON columns, and caches them."""
    now = time.time()
    if _cache["data"] is not None and (now - _cache["last_updated"]) < CACHE_TTL_SECONDS:
        return _cache["data"]
        
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch geofences
    cursor.execute("SELECT id, name, tier, description, polygon_json FROM geofence_zones")
    zones_rows = cursor.fetchall()
    restricted_zones = []
    caution_zones = []
    safe_zones = []
    for r in zones_rows:
        zone = {
            "id": r["id"],
            "name": r["name"],
            "tier": r["tier"],
            "description": r["description"],
            "polygon": json.loads(r["polygon_json"])
        }
        if r["tier"] == "restricted":
            restricted_zones.append(zone)
        elif r["tier"] == "caution":
            caution_zones.append(zone)
        elif r["tier"] == "safe":
            safe_zones.append(zone)
            
    # 2. Fetch expected_routes
    cursor.execute("SELECT id, name, points_json, tourist_id FROM expected_routes")
    routes_rows = cursor.fetchall()
    expected_routes = []
    for r in routes_rows:
        expected_routes.append({
            "id": r["id"],
            "name": r["name"],
            "points": json.loads(r["points_json"]),
            "tourist_id": r["tourist_id"]
        })
        
    # 3. Fetch emergency_facilities
    cursor.execute("SELECT name, lat, lon, phone, type FROM emergency_facilities")
    fac_rows = cursor.fetchall()
    police_facilities = []
    emergency_facilities = []
    for r in fac_rows:
        fac = {"name": r["name"], "lat": r["lat"], "lon": r["lon"], "phone": r["phone"]}
        if r["type"] == "police":
            police_facilities.append(fac)
        elif r["type"] == "hospital":
            emergency_facilities.append(fac)
            
    # 4. Fetch incident_reports (Historical incident hotspots)
    # Sourced from incident_reports table. If empty, returns zero hotspots.
    cursor.execute("SELECT id, name, lat, lon, weight FROM incident_reports")
    hotspots_rows = cursor.fetchall()
    historical_hotspots = []
    for r in hotspots_rows:
        historical_hotspots.append({
            "id": r["id"],
            "name": r["name"],
            "lat": r["lat"],
            "lon": r["lon"],
            "weight": r["weight"]
        })
        
    # 5. Fetch time_risk_patterns
    cursor.execute("SELECT hour, multiplier FROM time_risk_patterns")
    mult_rows = cursor.fetchall()
    time_risk_patterns = {}
    for r in mult_rows:
        time_risk_patterns[r["hour"]] = r["multiplier"]
        
    conn.close()
    
    data = {
        "restricted_zones": restricted_zones,
        "caution_zones": caution_zones,
        "safe_zones": safe_zones,
        "expected_routes": expected_routes,
        "police_facilities": police_facilities,
        "emergency_facilities": emergency_facilities,
        "historical_hotspots": historical_hotspots,
        "time_risk_patterns": time_risk_patterns
    }
    
    _cache["data"] = data
    _cache["last_updated"] = now
    return data

def __getattr__(name):
    """Dynamic resolution of module globals to enable seamless import compatibility with live DB data."""
    if name in ["RESTRICTED_ZONES", "CAUTION_ZONES", "SAFE_ZONES", "EXPECTED_ROUTES", "POLICE_FACILITIES", "EMERGENCY_FACILITIES", "HISTORICAL_HOTSPOTS"]:
        data = _get_live_context_data()
        if name == "RESTRICTED_ZONES":
            return data["restricted_zones"]
        elif name == "CAUTION_ZONES":
            return data["caution_zones"]
        elif name == "SAFE_ZONES":
            return data["safe_zones"]
        elif name == "EXPECTED_ROUTES":
            return data["expected_routes"]
        elif name == "POLICE_FACILITIES":
            return data["police_facilities"]
        elif name == "EMERGENCY_FACILITIES":
            return data["emergency_facilities"]
        elif name == "HISTORICAL_HOTSPOTS":
            return data["historical_hotspots"]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

# Ray-casting algorithm to determine if a point is inside a polygon
def is_inside_polygon(lat, lon, polygon):
    n = len(polygon)
    inside = False
    p1lat, p1lon = polygon[0]
    for i in range(n + 1):
        p2lat, p2lon = polygon[i % n]
        if lat > min(p1lat, p2lat):
            if lat <= max(p1lat, p2lat):
                if lon <= max(p1lon, p2lon):
                    if p1lat != p2lat:
                        xints = (lat - p1lat) * (p2lon - p1lon) / (p2lat - p1lat) + p1lon
                    if p1lon == p2lon or lon <= xints:
                        inside = not inside
        p1lat, p1lon = p2lat, p2lon
    return inside

def haversine_distance(lat1, lon1, lat2, lon2):
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R_EARTH * c

def get_distance_from_route(lat, lon, tourist_id=None):
    """
    Calculate the minimum distance in meters from a tourist coordinate to the expected route.
    If tourist_id is provided and there are personal routes assigned to this tourist, 
    deviation checks will be performed ONLY against their registered personal routes/itineraries.
    Otherwise, falls back to checking against all general region routes.
    """
    min_dist = float('inf')
    routes = _get_live_context_data()["expected_routes"]
    
    # Filter routes assigned to this specific tourist
    personal_routes = [r for r in routes if r.get("tourist_id") == tourist_id]
    target_routes = personal_routes if personal_routes else routes
    
    for route in target_routes:
        for pt in route["points"]:
            dist = haversine_distance(lat, lon, pt[0], pt[1])
            if dist < min_dist:
                min_dist = dist
    return min_dist

def get_distance_from_nearest_safe_zone(lat, lon):
    """Calculate the minimum distance in meters from a tourist coordinate to the nearest safe zone boundary (centroid proxy)."""
    min_dist = float('inf')
    zones = _get_live_context_data()["safe_zones"]
    for zone in zones:
        # Calculate distance to zone center approximation
        center_lat = sum(p[0] for p in zone["polygon"]) / len(zone["polygon"])
        center_lon = sum(p[1] for p in zone["polygon"]) / len(zone["polygon"])
        dist = haversine_distance(lat, lon, center_lat, center_lon)
        if dist < min_dist:
            min_dist = dist
    return min_dist

def get_distance_to_zone_center(lat, lon, zone):
    polygon = zone["polygon"]
    center_lat = sum(p[0] for p in polygon) / len(polygon)
    center_lon = sum(p[1] for p in polygon) / len(polygon)
    return haversine_distance(lat, lon, center_lat, center_lon)

def get_regional_context_risk(lat, lon, timestamp, tourist_id=None):
    """
    Computes regional risk contribution based on zone tier, hotspot proximity, and curfew rules.
    Returns:
       dict: { "score": float, "reason": str, "geofence_status": int }
             geofence_status: 0 = safe, 1 = caution, 2 = restricted
    """
    print(f"[DEBUG BACKEND] Received coordinates: lat={lat}, lon={lon}, tourist_id={tourist_id}")

    score = 0
    reason_parts = []
    geofence_status = 0 # default safe

    # Fetch live zones and hotspots
    data = _get_live_context_data()
    restricted_zones = data["restricted_zones"]
    caution_zones = data["caution_zones"]
    safe_zones = data["safe_zones"]
    historical_hotspots = data["historical_hotspots"]
    time_risk_patterns = data["time_risk_patterns"]

    # 1. Evaluate polygon zones
    in_restricted = False
    in_caution = False
    in_safe = False
    matched_zone = None

    for zone in restricted_zones:
        if is_inside_polygon(lat, lon, zone["polygon"]):
            in_restricted = True
            geofence_status = 2
            score += 30
            matched_zone = zone
            reason_parts.append(f"Inside restricted geofence: {zone['name']}")
            break

    if not in_restricted:
        for zone in caution_zones:
            if is_inside_polygon(lat, lon, zone["polygon"]):
                in_caution = True
                geofence_status = 1
                score += 15
                matched_zone = zone
                reason_parts.append(f"Inside caution geofence: {zone['name']}")
                break

    if not in_restricted and not in_caution:
        for zone in safe_zones:
            if is_inside_polygon(lat, lon, zone["polygon"]):
                in_safe = True
                geofence_status = 0
                matched_zone = zone
                reason_parts.append(f"Inside safe zone: {zone['name']}")
                break

    if matched_zone:
        dist = get_distance_to_zone_center(lat, lon, matched_zone)
        print(f"[DEBUG BACKEND] Matched geofence zone: {matched_zone['name']} (Tier: {matched_zone['tier']}), Calculated distance to center: {dist:.1f}m")
    else:
        # Find nearest zone
        nearest_zone = None
        min_dist = float('inf')
        for z in restricted_zones + caution_zones + safe_zones:
            d = get_distance_to_zone_center(lat, lon, z)
            if d < min_dist:
                min_dist = d
                nearest_zone = z
        if nearest_zone:
            print(f"[DEBUG BACKEND] Matched geofence zone: None (Outside all zones). Nearest zone is {nearest_zone['name']} at {min_dist:.1f}m")

    # If in open/unmapped areas, give a small warning if far from expected routes
    if not in_restricted and not in_caution and not in_safe:
        route_dist = get_distance_from_route(lat, lon, tourist_id)
        if route_dist > 500:
            score += 10
            reason_parts.append(f"Off expected trekking route by {route_dist:.0f}m")

    # 2. Check proximity to hotspots
    nearest_hotspot = None
    min_hotspot_dist = float('inf')
    for hs in historical_hotspots:
        dist = haversine_distance(lat, lon, hs["lat"], hs["lon"])
        if dist < min_hotspot_dist:
            min_hotspot_dist = dist
            nearest_hotspot = hs

    if nearest_hotspot:
        if min_hotspot_dist <= 100:
            hotspot_score = nearest_hotspot["weight"]
            score += hotspot_score
            reason_parts.append(f"Direct proximity to historical hotspot: {nearest_hotspot['name']} ({min_hotspot_dist:.0f}m)")
        elif min_hotspot_dist <= 300:
            hotspot_score = nearest_hotspot["weight"] / 2
            score += hotspot_score
            reason_parts.append(f"Near historical hotspot buffer: {nearest_hotspot['name']} ({min_hotspot_dist:.0f}m)")

    # 3. Time-based multiplier / late-night high-risk context
    try:
        if isinstance(timestamp, str):
            # Parse ISO timestamp
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        elif isinstance(timestamp, datetime):
            dt = timestamp
        else:
            dt = datetime.utcnow()
    except Exception:
        dt = datetime.utcnow()

    hour = dt.hour
    multiplier = time_risk_patterns.get(hour, 1.0)

    if multiplier > 1.0:
        # If in a non-safe context, increase risk score
        if score > 0 or in_restricted or in_caution:
            score += 10
            score *= multiplier
            reason_parts.append(f"Late-night high-risk context (after-hours multiplier of {multiplier}x applied)")

    reason = "; ".join(reason_parts) if reason_parts else "Normal regional risk metrics"
    
    # Clip contribution to maximum 40 points
    score = min(score, 40.0)

    return {
        "score": float(score),
        "reason": reason,
        "geofence_status": geofence_status
    }
