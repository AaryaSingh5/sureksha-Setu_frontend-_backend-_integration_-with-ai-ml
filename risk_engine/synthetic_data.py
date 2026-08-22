import pandas as pd
import numpy as np
import random
import os
from datetime import datetime, timedelta
from regional_context import EXPECTED_ROUTES, SAFE_ZONES, get_distance_from_route, get_distance_from_nearest_safe_zone, get_regional_context_risk

print("==============================================================")
print("[WARNING] DISCLOSURE: Generating SYNTHETIC normal tourist trajectories.")
print("This data is generated algorithmically for pilot testing and prototyping.")
print("==============================================================")

def generate_normal_trajectories(num_tourists=50, points_per_tourist=20):
    data = []
    
    # Base route points
    route_points = EXPECTED_ROUTES[0]["points"]
    
    for t_idx in range(num_tourists):
        tourist_id = f"TR-SIM-{10000 + t_idx}"
        profile = random.choice(["trekker", "city_tourist", "group", "solo"])
        
        # Start time (usually morning/afternoon)
        start_hour = random.randint(8, 16)
        current_time = datetime.now().replace(hour=start_hour, minute=0, second=0, microsecond=0)
        
        # We simulate the tourist walking along the route with slight perturbations
        lat, lon = route_points[0]
        dwell_time = 0.0
        
        for pt_idx in range(points_per_tourist):
            # Select target route node
            target_node_idx = min(int((pt_idx / points_per_tourist) * len(route_points)), len(route_points) - 1)
            target_lat, target_lon = route_points[target_node_idx]
            
            # Interpolate coordinates with small Gaussian noise (normal walking perturbation)
            jitter_scale = 0.0001  # ~10 meters
            lat = target_lat + np.random.normal(0, jitter_scale)
            lon = target_lon + np.random.normal(0, jitter_scale)
            
            # Speed: 0.5 to 1.8 m/s (normal human walk)
            speed = float(np.random.uniform(0.5, 1.8))
            if random.random() < 0.15:
                # 15% chance they stop at a scenic viewpoint (speed = 0)
                speed = 0.0
                dwell_time = float(random.randint(5, 20))  # 5-20 mins
            else:
                dwell_time = float(random.randint(1, 4))   # 1-4 mins
                
            current_time += timedelta(minutes=int(dwell_time) if dwell_time > 0 else 2)
            
            # Calculate distance metrics
            dist_from_route = get_distance_from_route(lat, lon)
            dist_from_safe = get_distance_from_nearest_safe_zone(lat, lon)
            
            # Geofence status
            ctx = get_regional_context_risk(lat, lon, current_time.isoformat())
            geofence_status = ctx["geofence_status"]
            
            # Unusual movement flag (normal here)
            unusual_movement = 0
            
            # Calculate battery level (normal depletion)
            battery = max(100 - pt_idx * random.randint(1, 2), 10)
            
            data.append({
                "tourist_id": tourist_id,
                "profile": profile,
                "timestamp": current_time.isoformat(),
                "latitude": lat,
                "longitude": lon,
                "speed": speed,
                "dwell_time": dwell_time,
                "distance_from_expected_route": dist_from_route,
                "distance_from_nearest_safe": dist_from_safe,
                "geofence_status": geofence_status,
                "battery_level": battery,
                "unusual_movement": unusual_movement,
                "connectivity_status": "Connected"
            })
            
    df = pd.DataFrame(data)
    return df

if __name__ == "__main__":
    df = generate_normal_trajectories()
    output_path = os.path.join(os.path.dirname(__file__), "synthetic_normal_trajectories.csv")
    df.to_csv(output_path, index=False)
    print(f"Generated {len(df)} points of normal trajectories and saved to {output_path}")
