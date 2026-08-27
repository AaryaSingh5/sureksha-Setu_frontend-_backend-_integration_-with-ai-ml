import math
from datetime import datetime

# Earth radius in meters
R_EARTH = 6371000

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

# PILOT REGION DATA LAYER: Himachal Pradesh (Kullu/Manali)
# Danger Zones defined as closed polygons of (lat, lon)
RESTRICTED_ZONES = [
    {
        "id": "zone-solang-restricted",
        "name": "Solang Riverbank & Avalanche Slope",
        "tier": "restricted",
        "description": "High risk of flash floods and steep avalanche slopes. No night entry.",
        "polygon": [
            (32.2410, 77.1850),
            (32.2460, 77.1850),
            (32.2460, 77.1930),
            (32.2410, 77.1930)
        ]
    },
    {
        "id": "zone-rohtang-slide",
        "name": "Rohtang Pass Slide Zone",
        "tier": "restricted",
        "description": "Frequent active rockfall and land slip area.",
        "polygon": [
            (32.3680, 77.2350),
            (32.3720, 77.2350),
            (32.3720, 77.2450),
            (32.3680, 77.2450)
        ]
    }
]

CAUTION_ZONES = [
    {
        "id": "zone-hadimba-caution",
        "name": "Hadimba Pine Forest Trek",
        "tier": "caution",
        "description": "Dense tree cover, potential wildlife activity, low cellular reception.",
        "polygon": [
            (32.2450, 77.1800),
            (32.2500, 77.1800),
            (32.2500, 77.1900),
            (32.2450, 77.1900)
        ]
    },
    {
        "id": "zone-jogini-cliff",
        "name": "Jogini Falls Cliff Walk",
        "tier": "caution",
        "description": "Narrow pathways along steep drop-offs. Slippery conditions.",
        "polygon": [
            (32.2580, 77.1880),
            (32.2620, 77.1880),
            (32.2620, 77.1940),
            (32.2580, 77.1940)
        ]
    }
]

SAFE_ZONES = [
    {
        "id": "zone-mallroad-safe",
        "name": "Manali Mall Road Safe Corridor",
        "tier": "safe",
        "description": "Highly active urban tourist center. Well lit with direct police presence.",
        "polygon": [
            (32.2350, 77.1850),
            (32.2410, 77.1850),
            (32.2410, 77.1910),
            (32.2350, 77.1910)
        ]
    }
]

EXPECTED_ROUTES = [
    {
        "id": "route-mall-to-solang",
        "name": "Mall Road to Solang Valley Main Trek",
        "points": [
            (32.2396, 77.1887),
            (32.2415, 77.1865),
            (32.2432, 77.1892),
            (32.2480, 77.1850),
            (32.2550, 77.1860),
            (32.2600, 77.1900)
        ]
    }
]

POLICE_FACILITIES = [
    {"name": "Manali Central Tourist Police Station", "lat": 32.2400, "lon": 77.1850, "phone": "01902-252326"},
    {"name": "Solang Checkpost", "lat": 32.2390, "lon": 77.1820, "phone": "+91 94180 12345"}
]

EMERGENCY_FACILITIES = [
    {"name": "Manali Civil District Hospital & Trauma Center", "lat": 32.2380, "lon": 77.1890, "phone": "+91 1902 252222"},
    {"name": "Kullu Regional Emergency Care Center", "lat": 31.9580, "lon": 77.1090, "phone": "+91 1902 222340"}
]

HISTORICAL_HOTSPOTS = [
    {"id": "hotspot-solang-gorge", "name": "Solang Gorge Slip Danger Area", "lat": 32.2450, "lon": 77.1920, "weight": 15, "is_synthetic": True},
    {"id": "hotspot-jogini-steps", "name": "Jogini Slippery Falls Walkway", "lat": 32.2620, "lon": 77.1910, "weight": 10, "is_synthetic": True},
    {"id": "hotspot-rohtang-curve", "name": "Rohtang Slide Curve 3", "lat": 32.3720, "lon": 77.2380, "weight": 20, "is_synthetic": True}
]

def get_distance_from_route(lat, lon):
    """Calculate the minimum distance in meters from a tourist coordinate to the expected route."""
    min_dist = float('inf')
    for route in EXPECTED_ROUTES:
        for pt in route["points"]:
            dist = haversine_distance(lat, lon, pt[0], pt[1])
            if dist < min_dist:
                min_dist = dist
    return min_dist

def get_distance_from_nearest_safe_zone(lat, lon):
    """Calculate the minimum distance in meters from a tourist coordinate to the nearest safe zone boundary (centroid proxy)."""
    min_dist = float('inf')
    for zone in SAFE_ZONES:
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

def get_regional_context_risk(lat, lon, timestamp):
    """
    Computes regional risk contribution based on zone tier, hotspot proximity, and curfew rules.
    Returns:
       dict: { "score": float, "reason": str, "geofence_status": int }
             geofence_status: 0 = safe, 1 = caution, 2 = restricted
    """
    print(f"[DEBUG BACKEND] Received coordinates: lat={lat}, lon={lon}")

    score = 0
    reason_parts = []
    geofence_status = 0 # default safe

    # 1. Evaluate polygon zones
    in_restricted = False
    in_caution = False
    in_safe = False
    matched_zone = None

    for zone in RESTRICTED_ZONES:
        if is_inside_polygon(lat, lon, zone["polygon"]):
            in_restricted = True
            geofence_status = 2
            score += 30
            matched_zone = zone
            reason_parts.append(f"Inside restricted geofence: {zone['name']}")
            break

    if not in_restricted:
        for zone in CAUTION_ZONES:
            if is_inside_polygon(lat, lon, zone["polygon"]):
                in_caution = True
                geofence_status = 1
                score += 15
                matched_zone = zone
                reason_parts.append(f"Inside caution geofence: {zone['name']}")
                break

    if not in_restricted and not in_caution:
        for zone in SAFE_ZONES:
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
        for z in RESTRICTED_ZONES + CAUTION_ZONES + SAFE_ZONES:
            d = get_distance_to_zone_center(lat, lon, z)
            if d < min_dist:
                min_dist = d
                nearest_zone = z
        if nearest_zone:
            print(f"[DEBUG BACKEND] Matched geofence zone: None (Outside all zones). Nearest zone is {nearest_zone['name']} at {min_dist:.1f}m")

    # If in open/unmapped areas, give a small warning if far from expected routes
    if not in_restricted and not in_caution and not in_safe:
        route_dist = get_distance_from_route(lat, lon)
        if route_dist > 500:
            score += 10
            reason_parts.append(f"Off expected trekking route by {route_dist:.0f}m")

    # 2. Check proximity to hotspots
    nearest_hotspot = None
    min_hotspot_dist = float('inf')
    for hs in HISTORICAL_HOTSPOTS:
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
    # Curfew: 22:00 to 05:00
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
    is_late_night = hour >= 22 or hour < 5

    if is_late_night:
        # If in a non-safe context, increase risk score
        if score > 0 or in_restricted or in_caution:
            score += 10
            score *= 1.5
            reason_parts.append("Late-night high-risk context (after-hours multiplier applied)")

    reason = "; ".join(reason_parts) if reason_parts else "Normal regional risk metrics"
    
    # Clip contribution to maximum 40 points
    score = min(score, 40.0)

    return {
        "score": float(score),
        "reason": reason,
        "geofence_status": geofence_status
    }
