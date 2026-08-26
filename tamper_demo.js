#!/usr/bin/env node

/**
 * ==============================================================================
 * 🧪 SURAKSHA SETU - TAMPER DEMONSTRATION & RESTORE SCRIPT
 * ==============================================================================
 * This script simulates unauthorized database manipulation (or restores it)
 * to demonstrate how the cryptographic hash chain immediately flags tampering.
 * 
 * Commands:
 *   node tamper_demo.js tamper   -> Maliciously alters a log's reason in SQLite
 *   node tamper_demo.js restore  -> Restores the original authentic chain
 * ==============================================================================
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import crypto from 'crypto';

const DB_PATH = path.resolve(process.cwd(), 'suraksha_setu.db');
const db = new sqlite3.Database(DB_PATH);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

function computeAuditHash(prevHash, officerBadge, actionType, targetId, timestamp, reason) {
  const payload = `${prevHash || ''}${officerBadge || ''}${actionType || ''}${targetId || ''}${timestamp || ''}${reason || ''}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function main() {
  const action = process.argv[2] || 'tamper';

  try {
    const logs = await all('SELECT rowid, * FROM audit_logs ORDER BY rowid ASC');
    if (!logs || logs.length === 0) {
      console.log('No logs found to demo.');
      return;
    }

    if (action === 'tamper') {
      const targetLog = logs[Math.min(1, logs.length - 1)];
      console.log(`\n😈 Simulating unauthorized database tampering on Log #${targetLog.id}...`);
      console.log(`Original Reason: "${targetLog.reason}"`);

      const tamperedReason = '[MALICIOUSLY ALTERED] Bypassed security authorization';
      await run('UPDATE audit_logs SET reason = ? WHERE id = ?', [tamperedReason, targetLog.id]);

      console.log(`Tampered Reason: "${tamperedReason}"`);
      console.log('\n⚠️ Database record has been altered WITHOUT updating the cryptographic SHA-256 hash.');
      console.log('Now run:');
      console.log('  node verify_chain.js\n');
    } else if (action === 'restore') {
      console.log('\n🔄 Restoring & re-signing cryptographic hash chain from genesis...');
      let prevHash = null;
      for (const log of logs) {
        const authenticReason = log.reason.replace('[MALICIOUSLY ALTERED] Bypassed security authorization', 'Standard Security Procedure');
        const hash = computeAuditHash(
          prevHash,
          log.officer_badge || '',
          log.action_type || '',
          log.target_id || '',
          log.timestamp || '',
          authenticReason
        );
        await run('UPDATE audit_logs SET reason = ?, prev_hash = ?, entry_hash = ? WHERE id = ?', [authenticReason, prevHash, hash, log.id]);
        prevHash = hash;
      }
      console.log('✅ Audit chain restored to 100% valid cryptographic state.');
      console.log('Now run:');
      console.log('  node verify_chain.js\n');
    } else {
      console.log('Usage: node tamper_demo.js [tamper | restore]');
    }
  } catch (err) {
    console.error('Demo error:', err);
  } finally {
    db.close();
  }
}

main();
