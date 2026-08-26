#!/usr/bin/env node

/**
 * ==============================================================================
 * 🛡️ SURAKSHA SETU - CRYPTOGRAPHIC AUDIT LOG CHAIN VERIFIER
 * ==============================================================================
 * This standalone script connects directly to `suraksha_setu.db` and verifies
 * the tamper-evident cryptographic hash chain across all audit log records.
 * 
 * Formula:
 *   entry_hash = SHA256(prev_hash + officer_badge + action_type + target_id + timestamp + reason)
 * 
 * Usage:
 *   node verify_chain.js
 * ==============================================================================
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import crypto from 'crypto';

const DB_PATH = path.resolve(process.cwd(), 'suraksha_setu.db');

function computeAuditHash(prevHash, officerBadge, actionType, targetId, timestamp, reason) {
  const payload = `${prevHash || ''}${officerBadge || ''}${actionType || ''}${targetId || ''}${timestamp || ''}${reason || ''}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function verifyAuditChain() {
  console.log('\n===============================================================================');
  console.log('🔗 SURAKSHA SETU: CRYPTOGRAPHIC AUDIT CHAIN INTEGRITY VERIFIER');
  console.log('===============================================================================');
  console.log(`Database Target: ${DB_PATH}\n`);

  const db = new sqlite3.Database(DB_PATH);

  const all = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

  try {
    const logs = await all('SELECT rowid, * FROM audit_logs ORDER BY rowid ASC');

    if (!logs || logs.length === 0) {
      console.log('ℹ️  No audit log entries found in database. Chain is empty.');
      return;
    }

    console.log(`Found ${logs.length} audit log blocks in database. Beginning cryptographic walk...\n`);
    console.log('----------------------------------------------------------------------------------------------------------------');
    console.log('| BLK # | LOG ID   | ACTION TYPE       | PREV HASH (PREFIX) | COMPUTED HASH      | STORED HASH        | STATUS   |');
    console.log('----------------------------------------------------------------------------------------------------------------');

    let expectedPrevHash = null;
    let chainBroken = false;
    let brokenIndex = -1;
    let brokenReason = '';

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const prevHashTrunc = log.prev_hash ? log.prev_hash.substring(0, 14) + '..' : 'GENESIS (null)';
      const storedHashTrunc = log.entry_hash ? log.entry_hash.substring(0, 14) + '..' : 'MISSING';

      // 1. Validate previous hash link
      let linkValid = true;
      if (i === 0) {
        if (log.prev_hash !== null && log.prev_hash !== '' && log.prev_hash !== undefined) {
          linkValid = false;
          chainBroken = true;
          brokenIndex = i;
          brokenReason = `Genesis block contains non-null prev_hash: "${log.prev_hash}"`;
        }
      } else {
        if (log.prev_hash !== expectedPrevHash) {
          linkValid = false;
          chainBroken = true;
          brokenIndex = i;
          brokenReason = `Previous hash pointer mismatch at block #${i + 1} (${log.id}). Expected: "${expectedPrevHash}", Got: "${log.prev_hash}"`;
        }
      }

      // 2. Compute expected hash for current block
      const computedHash = computeAuditHash(
        log.prev_hash,
        log.officer_badge || '',
        log.action_type || '',
        log.target_id || '',
        log.timestamp || '',
        log.reason || ''
      );
      const computedHashTrunc = computedHash.substring(0, 14) + '..';

      // 3. Verify computed hash matches stored hash
      const hashValid = computedHash === log.entry_hash;
      if (!hashValid && !chainBroken) {
        chainBroken = true;
        brokenIndex = i;
        brokenReason = `Hash mismatch at block #${i + 1} (${log.id}). Content was altered without valid hash regeneration.`;
      }

      const statusStr = linkValid && hashValid ? '✅ VALID ' : '❌ TAMPER';
      const blkNum = String(i + 1).padStart(5, ' ');
      const logId = (log.id || '').padEnd(8, ' ');
      const actionType = (log.action_type || '').padEnd(17, ' ');

      console.log(
        `| ${blkNum} | ${logId} | ${actionType} | ${prevHashTrunc.padEnd(18, ' ')} | ${computedHashTrunc.padEnd(18, ' ')} | ${storedHashTrunc.padEnd(18, ' ')} | ${statusStr} |`
      );

      if (chainBroken) {
        break;
      }

      expectedPrevHash = log.entry_hash;
    }

    console.log('----------------------------------------------------------------------------------------------------------------\n');

    if (!chainBroken) {
      console.log('===============================================================================');
      console.log('✅ PASS: AUDIT CHAIN INTEGRITY 100% VERIFIED!');
      console.log(`- Verified ${logs.length} sequential cryptographic blocks.`);
      console.log(`- All SHA-256 hashes and previous-hash pointers match perfectly.`);
      console.log(`- Latest Root Hash: ${expectedPrevHash}`);
      console.log('===============================================================================\n');
    } else {
      console.log('===============================================================================');
      console.log(`🚨 FAIL: TAMPERING DETECTED AT BLOCK #${brokenIndex + 1} (${logs[brokenIndex].id})`);
      console.log(`Reason: ${brokenReason}`);
      console.log('The cryptographic hash chain is broken. Database record modification detected!');
      console.log('===============================================================================\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error executing audit chain verification:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

verifyAuditChain();
