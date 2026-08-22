import yaml
import os

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

def calculate_rule_based_score(event_state):
    """
    Calculates a weighted rule-based risk score from the event state.
    
    event_state is a dictionary containing boolean flags for the following rules:
      - 'sos_triggered': bool
      - 'critical_geofence': bool
      - 'high_risk_zone': bool
      - 'unusual_movement': bool
      - 'late_night_context': bool
      - 'prolonged_inactivity': bool
      - 'signal_loss': bool
      - 'route_deviation': bool
    """
    config = load_config()
    rules_config = config.get("rules", {})
    
    total_score = 0
    contributing_factors = []
    
    for rule_key, rule_data in rules_config.items():
        if rule_data.get("enabled", True):
            # Check if this rule fired
            if event_state.get(rule_key, False):
                weight = rule_data.get("weight", 0)
                total_score += weight
                contributing_factors.append({
                    "factor": rule_key,
                    "points": weight,
                    "description": rule_data.get("description", "")
                })
                
    # Score bands:
    # 0–29 = LOW/Advisory
    # 30–59 = MEDIUM/Warning
    # 60–84 = HIGH
    # 85–100 = CRITICAL
    if total_score < 30:
        band = "LOW"
    elif total_score < 60:
        band = "MEDIUM"
    elif total_score < 85:
        band = "HIGH"
    else:
        band = "CRITICAL"
        
    return {
        "total_score": total_score,
        "band": band,
        "contributing_factors": contributing_factors
    }
