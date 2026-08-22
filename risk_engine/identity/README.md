# Smart Tourist Safety - Identity & Audit Trail Module

This module provides a lightweight, tamper-proof simulated permissioned ledger and a digital identity (DID) management system using the Python standard library.

## Components

1. **`chain.py`**: Manages the cryptographically hash-linked ledger. Computes block hashes using SHA-256 and appends blocks to the `chain_blocks` table. Automatically creates a genesis block (index `0`) if the chain is empty.
2. **`did_service.py`**: Manages the lifecycle of tourist Digital IDs (DIDs). Issues/updates digital identities in the `tourist_digital_ids` table and registers the issuance events on-chain. Provides blockchain validation via `verify_chain()`.
3. **`audit_service.py`**: Exposes `log_incident(tourist_id, event)` to serialize safety alerts and anchor their hashes onto the blockchain ledger.

## Integration Hooks

To preserve performance and ensure proper consensus configuration, the audit logging hook is **not yet wired into the live alerts flow**. 

A `TODO` comment is placed in `risk_engine/risk_combiner.py` indicating where the hook should be added once integration is confirmed:

```python
# TODO: Hook for blockchain-style audit logging:
# if final_band in ["HIGH", "CRITICAL"]:
#     from identity.audit_service import log_incident
#     log_incident(tourist_id, explainability_object)
```

## API Endpoints

The following routes are registered in the FastAPI risk engine:
* `POST /identity/issue`: Issues a digital identity (DID) for a tourist, updates the local records, and records the block on-chain.
* `GET /identity/verify/{tourist_id}`: Resolves and returns the verification status of a tourist's DID.
* `GET /identity/chain`: Returns all blocks currently on the blockchain ledger after verifying its integrity.
* `GET /identity/chain/verify`: Cryptographically traverses the chain to verify that no block headers or data payloads have been modified.
