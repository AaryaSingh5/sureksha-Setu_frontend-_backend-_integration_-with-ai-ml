import sqlite3
import pandas as pd
import os
from datetime import datetime, timedelta
import database

def extract_training_data(training_window_days=90):
    """
    Pulls clean historical GPS trajectories from the production location_pings table.
    Filters out any telemetry associated with:
      - Active SOS events or incidents (any tourist_id in sos_incidents)
      - Tourists with active alerts or status other than 'Safe'
      - Alerts marked as false_positive (dismissed-anomalous) or confirmed in alert_feedback
    """
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch tourist IDs with logged incidents
    cursor.execute("SELECT DISTINCT tourist_id FROM sos_incidents")
    incident_tourist_ids = [row["tourist_id"] for row in cursor.fetchall()]
    
    # 2. Fetch tourist IDs associated with alert feedback
    cursor.execute("""
        SELECT DISTINCT tourist_id FROM alerts
        WHERE id IN (SELECT DISTINCT alert_id FROM alert_feedback)
    """)
    feedback_tourist_ids = [row["tourist_id"] for row in cursor.fetchall()]
    
    # 3. Fetch tourists currently flagged as unsafe
    cursor.execute("SELECT id FROM tourists WHERE safety_status != 'Safe'")
    unsafe_tourist_ids = [row["id"] for row in cursor.fetchall()]
    
    # Combine exclusion set
    exclude_tourist_ids = set(incident_tourist_ids + feedback_tourist_ids + unsafe_tourist_ids)
    print(f"[DATA EXTRACTION] Excluding {len(exclude_tourist_ids)} tourists from the training dataset to ensure a clean 'normal' baseline.")
    
    # 4. Fetch location history from location_pings
    query = "SELECT * FROM location_pings"
    df_all = pd.read_sql_query(query, conn)
    conn.close()
    
    if df_all.empty:
        print("[DATA EXTRACTION] Warning: location_pings table is empty.")
        return df_all
        
    # Filter by date window (e.g. trailing 90 days)
    cutoff_date = datetime.now() - timedelta(days=training_window_days)
    df_all["timestamp_dt"] = pd.to_datetime(df_all["timestamp"], errors="coerce")
    
    # Filter out excluded tourists and apply date window
    df_clean = df_all[
        (~df_all["tourist_id"].isin(exclude_tourist_ids)) &
        (df_all["timestamp_dt"] >= cutoff_date)
    ].copy()
    
    # Drop temp datetime column
    df_clean = df_clean.drop(columns=["timestamp_dt"])
    
    print(f"[DATA EXTRACTION] Extracted {len(df_clean)} telemetry points for training (from {df_all['tourist_id'].nunique()} clean tourists).")
    return df_clean

if __name__ == "__main__":
    df = extract_training_data()
    print(df.head())
