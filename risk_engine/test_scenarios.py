import sqlite3
import json
import os
from datetime import datetime, timedelta

# Import the risk combiner
import database
import risk_combiner
import false_alarm_reducer
import rules_engine

TEST_REPORT_PATH = os.path.join(os.path.dirname(__file__), "test_report.txt")

def setup_test_data():
    """Seeds the database with test tourists matching each scenario."""
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # Clean previous test entries
    cursor.execute("DELETE FROM tourists WHERE id LIKE 'TR-TEST-%'")
    cursor.execute("DELETE FROM location_history WHERE tourist_id LIKE 'TR-TEST-%'")
    cursor.execute("DELETE FROM alerts WHERE tourist_id LIKE 'TR-TEST-%'")
    cursor.execute("DELETE FROM sos_incidents WHERE tourist_id LIKE 'TR-TEST-%'")
    
    # 1. TR-TEST-NORMAL: Trekker profile doing a normal trek
    cursor.execute("""
        INSERT INTO tourists (id, name, nationality, hotel, lat, lng, safety_status, battery_level, kyc_document_type)
        VALUES ('TR-TEST-NORMAL', 'Normal Trekker', 'Germany', 'Highland Hostels', 32.2360, 77.1860, 'Safe', 95, 'Passport')
    """)
    
    # 2. TR-TEST-RESTRICTED: Trekker entering Restricted Zone
    cursor.execute("""
        INSERT INTO tourists (id, name, nationality, hotel, lat, lng, safety_status, battery_level, kyc_document_type)
        VALUES ('TR-TEST-RESTRICTED', 'Danger Explorer', 'USA', 'Himalayan Lodge', 32.2360, 77.1860, 'Safe', 90, 'Passport')
    """)
    
    # 3. TR-TEST-FALL: Solo traveler who has a prolonged inactivity (fall simulation)
    # We use Solo profile to trigger lower inactivity tolerance (10 mins)
    cursor.execute("""
        INSERT INTO tourists (id, name, nationality, hotel, lat, lng, safety_status, battery_level, kyc_document_type)
        VALUES ('TR-TEST-FALL', 'Solo Backpacker', 'UK', 'Solo Campsites', 32.2360, 77.1860, 'Safe', 85, 'Passport')
    """)
    
    # 4. TR-TEST-SIGNAL: Group traveler experiencing connectivity drop-out and reconnecting
    cursor.execute("""
        INSERT INTO tourists (id, name, nationality, hotel, lat, lng, safety_status, battery_level, kyc_document_type)
        VALUES ('TR-TEST-SIGNAL', 'Group Hiker', 'India', 'Grand Group Resort', 32.2360, 77.1860, 'Safe', 88, 'Aadhaar Card')
    """)
    
    # 5. TR-TEST-SHOPPING: City tourist deviating from route in a benign shopping area
    # We use KYC Aadhaar Card to map to city_tourist baseline (higher route tolerance)
    cursor.execute("""
        INSERT INTO tourists (id, name, nationality, hotel, lat, lng, safety_status, battery_level, kyc_document_type)
        VALUES ('TR-TEST-SHOPPING', 'Urban Shopper', 'India', 'Mall Road Plaza', 32.2360, 77.1860, 'Safe', 100, 'Aadhaar Card')
    """)
    
    conn.commit()
    conn.close()
    print("Test profiles successfully seeded in database.")

def run_scenarios():
    report = []
    report.append("==============================================================")
    report.append("          TOURIST SAFETY ENGINE AUTOMATED TEST REPORT")
    report.append(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("==============================================================\n")
    
    # ------------------------------------------------------------------------
    # Scenario 1: Normal Trek -> No alerts, score stays LOW
    # ------------------------------------------------------------------------
    report.append("--- SCENARIO 1: Normal Trek ---")
    tourist_id = "TR-TEST-NORMAL"
    start_time = datetime.now() - timedelta(hours=2)
    
    # Sequence of 4 normal points inside Mall Road safe corridor
    route_points = [
        (32.2360, 77.1860, 1.2),
        (32.2370, 77.1870, 1.1),
        (32.2380, 77.1880, 1.0),
        (32.2390, 77.1890, 0.9)
    ]
    
    last_res = None
    for idx, (lat, lon, speed) in enumerate(route_points):
        ts = (start_time + timedelta(minutes=idx * 5)).isoformat()
        last_res = risk_combiner.run_risk_evaluation(
            tourist_id=tourist_id, lat=lat, lon=lon, speed=speed,
            battery_level=90, connectivity_status="Connected", timestamp=ts
        )
    
    score = last_res["final_score"]
    band = last_res["band"]
    status = "PASS" if band == "LOW" else "FAIL"
    report.append(f"Result: {status} | Final Score: {score} | Band: {band}")
    report.append(f"Trace details: {json.dumps(last_res['breakdown'])}\n")
    
    # ------------------------------------------------------------------------
    # Scenario 2: Restricted-zone entry -> Escalates appropriately
    # ------------------------------------------------------------------------
    report.append("--- SCENARIO 2: Restricted Zone Entry ---")
    tourist_id = "TR-TEST-RESTRICTED"
    start_time = datetime.now() - timedelta(hours=2)
    
    # Point 1: Normal
    risk_combiner.run_risk_evaluation(
        tourist_id=tourist_id, lat=32.2360, lon=77.1860, speed=1.0,
        battery_level=90, connectivity_status="Connected", timestamp=start_time.isoformat()
    )
    # Point 2: Deep inside Solang Riverbank restricted polygon (lat 32.2432, lon 77.1892 is inside)
    res = risk_combiner.run_risk_evaluation(
        tourist_id=tourist_id, lat=32.2435, lon=77.1895, speed=0.5,
        battery_level=88, connectivity_status="Connected", timestamp=(start_time + timedelta(minutes=5)).isoformat()
    )
    
    score = res["final_score"]
    band = res["band"]
    status = "PASS" if band in ["HIGH", "CRITICAL"] else "FAIL"
    report.append(f"Result: {status} | Final Score: {score} | Band: {band}")
    report.append(f"Firing factors: {res['metadata']['fired_flags']}")
    report.append(f"Trace details: {json.dumps(res['breakdown'])}\n")

    # ------------------------------------------------------------------------
    # Scenario 3: Prolonged inactivity (fall simulation) -> Escalates after persistence window
    # ------------------------------------------------------------------------
    report.append("--- SCENARIO 3: Prolonged Inactivity (Fall Simulation) ---")
    tourist_id = "TR-TEST-FALL"
    start_time = datetime.now() - timedelta(hours=2)
    
    # For solo, inactivity tolerance is 10 minutes (from config.yaml)
    # Ping 1: Normal movement
    risk_combiner.run_risk_evaluation(
        tourist_id=tourist_id, lat=32.2360, lon=77.1860, speed=1.2,
        battery_level=85, connectivity_status="Connected", timestamp=start_time.isoformat()
    )
    
    # Ping 2: Stopped (speed = 0) at T+5 mins
    res_t0 = risk_combiner.run_risk_evaluation(
        tourist_id=tourist_id, lat=32.2380, lon=77.1880, speed=0.0,
        battery_level=84, connectivity_status="Connected", timestamp=(start_time + timedelta(minutes=5)).isoformat(),
        dwell_time=5.0
    )
    report.append(f"At T+5m (Dwell 5m) - Score: {res_t0['final_score']} | Band: {res_t0['band']} (Expect LOW/MEDIUM - within tolerance)")
    
    # Ping 3: Still stopped at T+15 mins (exceeds 10 mins solo tolerance)
    res_t15 = risk_combiner.run_risk_evaluation(
        tourist_id=tourist_id, lat=32.2380, lon=77.1880, speed=0.0,
        battery_level=83, connectivity_status="Connected", timestamp=(start_time + timedelta(minutes=20)).isoformat(),
        dwell_time=20.0
    )
    
    score = res_t15["final_score"]
    band = res_t15["band"]
    status = "PASS" if (band in ["MEDIUM", "HIGH"] and "prolonged_inactivity" in res_t15['metadata']['fired_flags']) else "FAIL"
    report.append(f"At T+20m (Dwell 20m) - Result: {status} | Final Score: {score} | Band: {band}")
    report.append(f"Firing factors: {res_t15['metadata']['fired_flags']}\n")

    # ------------------------------------------------------------------------
    # Scenario 4: Signal loss + reconnect -> Correct handling, no false Critical
    # ------------------------------------------------------------------------
    report.append("--- SCENARIO 4: Signal Loss + Reconnect ---")
    tourist_id = "TR-TEST-SIGNAL"
    start_time = datetime.now() - timedelta(hours=2)
    
    # Ping 1: Normal
    risk_combiner.run_risk_evaluation(
        tourist_id=tourist_id, lat=32.2360, lon=77.1860, speed=1.0,
        battery_level=90, connectivity_status="Connected", timestamp=start_time.isoformat()
    )
    # Ping 2: Signal Lost (e.g. tracking band loses connection)
    res_lost = risk_combiner.run_risk_evaluation(
        tourist_id=tourist_id, lat=32.2360, lon=77.1860, speed=0.0,
        battery_level=88, connectivity_status="Lost", timestamp=(start_time + timedelta(minutes=10)).isoformat()
    )
    report.append(f"During Signal Loss: Score: {res_lost['final_score']} | Band: {res_lost['band']} (Expect Warning/P3 Alert, not Critical)")
    
    # Ping 3: Reconnected
    res_recon = risk_combiner.run_risk_evaluation(
        tourist_id=tourist_id, lat=32.2396, lon=77.1887, speed=1.1,
        battery_level=86, connectivity_status="Connected", timestamp=(start_time + timedelta(minutes=15)).isoformat()
    )
    
    score = res_recon["final_score"]
    band = res_recon["band"]
    status = "PASS" if band == "LOW" else "FAIL"
    report.append(f"After Reconnect: Result: {status} | Final Score: {score} | Band: {band}\n")

    # ------------------------------------------------------------------------
    # Scenario 5: Benign deviation (shopping detour) -> Should NOT trigger high alert
    # ------------------------------------------------------------------------
    report.append("--- SCENARIO 5: Benign Deviation (Shopping Detour) ---")
    tourist_id = "TR-TEST-SHOPPING"
    start_time = datetime.now() - timedelta(hours=2)
    
    # Domestic traveler (city_tourist profile) - has lower weight offset, higher route tolerance
    # Walk along Mall Road safe corridor, then deviate slightly to nearby markets
    res_shopping = risk_combiner.run_risk_evaluation(
        tourist_id=tourist_id, lat=32.2355, lon=77.1895, speed=0.8,
        battery_level=98, connectivity_status="Connected", timestamp=start_time.isoformat()
    )
    
    score = res_shopping["final_score"]
    band = res_shopping["band"]
    status = "PASS" if band in ["LOW", "MEDIUM"] else "FAIL"
    report.append(f"Result: {status} | Final Score: {score} | Band: {band}")
    report.append(f"Regional Risk detail: {res_shopping['breakdown']['regional_context']['reason']}")
    report.append("==============================================================\n")
    
    # Write report to file
    with open(TEST_REPORT_PATH, "w") as f:
        f.write("\n".join(report))
    
    print(f"Automated scenarios executed. Report written to {TEST_REPORT_PATH}")
    print("\n".join(report))

if __name__ == "__main__":
    setup_test_data()
    run_scenarios()
