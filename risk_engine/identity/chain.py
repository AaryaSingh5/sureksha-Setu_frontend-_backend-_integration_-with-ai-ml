"""Simulated permissioned blockchain ledger core."""

import hashlib
import json
import os
import sys
from datetime import datetime, timezone

try:
    import database
except ImportError:
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import database


def format_timestamp(dt: datetime) -> str:
    """Format a datetime deterministically to naive UTC isoformat."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.isoformat()


def compute_block_hash(index: int, timestamp_str: str, data_str: str, previous_hash: str) -> str:
    """Compute the SHA-256 hash of block contents deterministically."""
    block_string = f"{index}:{timestamp_str}:{data_str}:{previous_hash}"
    return hashlib.sha256(block_string.encode("utf-8")).hexdigest()


def append_block(data: dict) -> dict:
    """
    Append a new block containing a data payload to the ledger.
    Creates a genesis block if the chain is empty.
    """
    conn = database.get_db_connection()
    cursor = conn.cursor()

    # 1. Fetch latest block
    cursor.execute("SELECT * FROM chain_blocks ORDER BY block_index DESC LIMIT 1")
    latest_row = cursor.fetchone()

    # 2. If no latest block exists, create a Genesis block first
    if not latest_row:
        genesis_data = {"message": "Genesis Block - Smart Tourist Safety Audit Trail"}
        genesis_data_str = json.dumps(genesis_data, sort_keys=True)
        genesis_time = datetime.now(timezone.utc)
        genesis_time_str = format_timestamp(genesis_time)
        genesis_hash = compute_block_hash(0, genesis_time_str, genesis_data_str, "0")

        cursor.execute("""
            INSERT INTO chain_blocks (block_index, timestamp, data, previous_hash, hash)
            VALUES (?, ?, ?, ?, ?)
        """, (0, genesis_time_str, genesis_data_str, "0", genesis_hash))
        conn.commit()

        # Refetch latest block
        cursor.execute("SELECT * FROM chain_blocks ORDER BY block_index DESC LIMIT 1")
        latest_row = cursor.fetchone()

    latest_block = dict(latest_row)

    # 3. Create new block
    new_index = latest_block["block_index"] + 1
    new_time = datetime.now(timezone.utc)
    new_time_str = format_timestamp(new_time)
    data_str = json.dumps(data, sort_keys=True)
    new_hash = compute_block_hash(new_index, new_time_str, data_str, latest_block["hash"])

    cursor.execute("""
        INSERT INTO chain_blocks (block_index, timestamp, data, previous_hash, hash)
        VALUES (?, ?, ?, ?, ?)
    """, (new_index, new_time_str, data_str, latest_block["hash"], new_hash))
    conn.commit()

    cursor.execute("SELECT * FROM chain_blocks WHERE block_index = ?", (new_index,))
    new_row = cursor.fetchone()
    conn.close()

    return dict(new_row) if new_row else {}
