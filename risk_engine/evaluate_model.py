import sqlite3
import pandas as pd
import numpy as np
import os
import joblib
from datetime import datetime
import database
from feature_engineering import extract_feature_vector

def evaluate_model():
    print("[EVALUATION] Starting model performance evaluation...")
    
    # Load model
    model_dir = os.path.dirname(__file__)
    model_path = os.path.join(model_dir, "model_v1.pkl")
    if not os.path.exists(model_path):
        print(f"[EVALUATION] Error: Model file not found at {model_path}")
        return
        
    model = joblib.load(model_path)
    
    # Connect to DB
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch alert feedback statistics
    cursor.execute("SELECT feedback_type, COUNT(*) as count FROM alert_feedback GROUP BY feedback_type")
    feedback_stats = cursor.fetchall()
    feedback_counts = {row["feedback_type"]: row["count"] for row in feedback_stats}
    
    false_positives = feedback_counts.get("false_positive", 0)
    confirmed_incidents = feedback_counts.get("confirmed", 0)
    
    print(f"[EVALUATION] Feedback Statistics: False Positives = {false_positives}, Confirmed Incidents = {confirmed_incidents}")
    
    # Fetch recent location pings for basic score profiling
    cursor.execute("SELECT * FROM location_pings ORDER BY timestamp DESC LIMIT 200")
    recent_pings = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    # Profile anomaly scores for recent telemetry
    anomaly_scores = []
    if recent_pings:
        # Sort chronologically to simulate history
        recent_pings = sorted(recent_pings, key=lambda x: x["timestamp"])
        history = []
        for p in recent_pings:
            fv = extract_feature_vector(p, history)
            # Predict anomaly score
            raw_score = -model.score_samples([fv])[0]  # raw anomaly score
            anomaly_scores.append(raw_score)
            history.append(p)
            
    avg_anomaly = np.mean(anomaly_scores) if anomaly_scores else 0.0
    max_anomaly = np.max(anomaly_scores) if anomaly_scores else 0.0
    
    # Output evaluation report
    report = []
    report.append("==============================================================")
    report.append("          TOURIST ANOMALY DETECTOR MODEL EVALUATION REPORT")
    report.append(f"Generated at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    report.append("==============================================================\n")
    
    report.append(f"Model File: {os.path.basename(model_path)}")
    report.append(f"Evaluation dataset size: {len(recent_pings)} location points")
    report.append(f"Mean Anomaly Decision Value: {avg_anomaly:.4f}")
    report.append(f"Maximum Anomaly Decision Value: {max_anomaly:.4f}\n")
    
    report.append("--- FEEDBACK LOOP METRICS & AUDITS ---")
    report.append(f"Authority Feedback Logs: {false_positives + confirmed_incidents} registered events")
    report.append(f"  - Confirmed Incidents: {confirmed_incidents}")
    report.append(f"  - False Positives (Dismissed): {false_positives}\n")
    
    report.append("--- PILOT DATA QUALITY LIMITATIONS ---")
    if confirmed_incidents < 5:
        report.append("WARNING: The confirmed incident volume in the feedback table is too low")
        report.append("to compute a statistically significant validation of precision and recall.")
        report.append("No synthetic ground truth or dummy labels were substituted. Model evaluation")
        report.append("is currently based on unsupervised anomaly distribution thresholds.")
        report.append("Action item: Calibrate thresholds as historical feedback volume increases.")
    else:
        precision = confirmed_incidents / (confirmed_incidents + false_positives)
        report.append(f"Feedback Loop Precision: {precision * 100:.2f}%")
        report.append("Recall rate cannot be computed due to lack of unflagged safety reports.")
        
    report.append("\n==============================================================")
    
    report_content = "\n".join(report)
    print(report_content)
    
    # Save report
    report_path = os.path.join(model_dir, "evaluation_report.txt")
    with open(report_path, "w") as f:
        f.write(report_content)
    print(f"[EVALUATION] Saved model validation report to {report_path}")

if __name__ == "__main__":
    evaluate_model()
