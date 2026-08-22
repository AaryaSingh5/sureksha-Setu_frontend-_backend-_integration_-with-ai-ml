"""Incident auditing and logging onto the simulated ledger."""

from datetime import datetime, timezone
from identity.chain import append_block, format_timestamp


def log_incident(tourist_id: str, event: dict) -> None:
    """
    Serialize a critical safety event and append its cryptographic
    representation onto the blockchain ledger.
    """
    timestamp_str = event.get("metadata", {}).get("timestamp") or format_timestamp(datetime.now(timezone.utc))

    incident_data = {
        "event_type": "CRITICAL_SAFETY_ALERT" if event.get("band") == "CRITICAL" else "HIGH_RISK_ALERT",
        "tourist_id": tourist_id,
        "final_score": event.get("final_score"),
        "band": event.get("band"),
        "priority": event.get("priority"),
        "details": event.get("breakdown"),
        "timestamp": timestamp_str
    }

    append_block(incident_data)
