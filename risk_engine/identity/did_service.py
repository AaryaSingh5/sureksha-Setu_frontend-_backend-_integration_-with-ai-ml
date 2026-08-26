"""Business logic for Digital ID issuance and verification."""

import os
import sys
from datetime import datetime, timezone

try:
    import database
except ImportError:
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import database

from identity.chain import append_block, compute_block_hash, format_timestamp


def issue_id(tourist_id: str, kyc_hash: str, valid_until: datetime) -> dict:
    """
    Issue a new digital ID for a tourist, deactivate any existing ID,
    and anchor the registration event to the blockchain ledger.
    """
    conn = database.get_db_connection()
    cursor = conn.cursor()

    # 1. Check for existing ID
    cursor.execute("SELECT * FROM tourist_digital_ids WHERE tourist_id = ?", (tourist_id,))
    existing_row = cursor.fetchone()

    did_uri = f"did:sih:tourist:{tourist_id}"
    now_str = format_timestamp(datetime.now(timezone.utc))
    valid_until_str = format_timestamp(valid_until) if isinstance(valid_until, datetime) else str(valid_until)

    if existing_row:
        cursor.execute("""
            UPDATE tourist_digital_ids
            SET kyc_hash = ?, valid_until = ?, is_active = 1, issued_at = ?
            WHERE tourist_id = ?
        """, (kyc_hash, valid_until_str, now_str, tourist_id))
    else:
        cursor.execute("""
            INSERT INTO tourist_digital_ids (tourist_id, did, kyc_hash, issued_at, valid_until, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (tourist_id, did_uri, kyc_hash, now_str, valid_until_str))
    
    conn.commit()

    # 2. Anchor registration on-chain
    anchor_data = {
        "event_type": "DID_ISSUED",
        "tourist_id": tourist_id,
        "did": did_uri,
        "kyc_hash": kyc_hash,
        "valid_until": valid_until_str
    }
    append_block(anchor_data)

    cursor.execute("SELECT * FROM tourist_digital_ids WHERE tourist_id = ?", (tourist_id,))
    updated_row = cursor.fetchone()
    conn.close()

    # 3. Sync back to the main `tourists` table if the tourist profile exists.
    if updated_row:
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE tourists
            SET digital_id = ?, kyc_verified = 1
            WHERE id = ? OR tourist_id = ?
        """, (did_uri, tourist_id, tourist_id))
        conn.commit()
        conn.close()

    return dict(updated_row) if updated_row else {}


def verify_chain() -> tuple[bool, int, str]:
    """
    Verify the cryptographic integrity of the blockchain ledger.
    Returns: (is_valid, blocks_count, status_message)
    """
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chain_blocks ORDER BY block_index ASC")
    rows = cursor.fetchall()
    conn.close()

    blocks = [dict(row) for row in rows]

    if not blocks:
        return True, 0, "Blockchain ledger is empty (valid)."

    # Verify Genesis block
    genesis = blocks[0]
    if genesis["block_index"] != 0:
        return False, len(blocks), f"Integrity failed: block at index 0 is not Genesis (has index {genesis['block_index']})."

    # Recompute Genesis hash
    expected_genesis_hash = compute_block_hash(
        0, genesis["timestamp"], genesis["data"], genesis["previous_hash"]
    )
    if genesis["hash"] != expected_genesis_hash:
        return False, len(blocks), f"Integrity failed: Genesis block hash is corrupted or tampered."

    # Verify subsequent blocks
    for i in range(1, len(blocks)):
        prev = blocks[i - 1]
        curr = blocks[i]

        # 1. Index sequence check
        if curr["block_index"] != prev["block_index"] + 1:
            return False, len(blocks), f"Integrity failed: sequence gap between index {prev['block_index']} and {curr['block_index']}."

        # 2. Previous hash link check
        if curr["previous_hash"] != prev["hash"]:
            return False, len(blocks), f"Integrity failed: block {curr['block_index']} previous_hash does not match parent hash."

        # 3. Hash verification
        expected_hash = compute_block_hash(
            curr["block_index"], curr["timestamp"], curr["data"], curr["previous_hash"]
        )
        if curr["hash"] != expected_hash:
            return False, len(blocks), f"Integrity failed: block {curr['block_index']} hash value is tampered."

    return True, len(blocks), f"Blockchain validation successful. Integrity verified for all {len(blocks)} blocks."
