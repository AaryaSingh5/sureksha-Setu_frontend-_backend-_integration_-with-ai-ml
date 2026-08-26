import { Router } from 'express';
import { all, get, run, insertAuditLogSecure } from '../db';

const router = Router();

// GET /api/v1/clusters - Anomaly Risk Clusters
router.get('/clusters', async (req, res) => {
  try {
    const clusters = await all('SELECT * FROM anomaly_clusters ORDER BY risk_score DESC');
    const formatted = clusters.map((c: any) => ({
      id: c.id,
      regionName: c.region_name,
      riskScore: c.risk_score,
      touristDensity: c.tourist_density,
      anomalyType: c.anomaly_type,
      confidenceScore: c.confidence_score,
      descriptionEn: c.description_en,
      descriptionHi: c.description_hi,
      recommendedActionEn: c.recommended_action_en,
      recommendedActionHi: c.recommended_action_hi,
      coordinates: { lat: c.lat, lng: c.lng },
      timestamp: c.timestamp
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/ai-logs - AI Model Threat Logs
router.get('/ai-logs', async (req, res) => {
  try {
    const logs = await all('SELECT * FROM ai_logs ORDER BY id DESC');
    const formatted = logs.map((l: any) => ({
      id: l.id,
      timestamp: l.timestamp,
      severity: l.severity,
      messageEn: l.message_en,
      messageHi: l.message_hi,
      modelConfidence: l.model_confidence,
      region: l.region
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/broadcasts - Emergency Broadcast History
router.get('/broadcasts', async (req, res) => {
  try {
    const broadcasts = await all('SELECT * FROM broadcast_alerts ORDER BY timestamp DESC');
    const formatted = broadcasts.map((b: any) => ({
      id: b.id,
      senderBadge: b.sender_badge,
      region: b.region,
      radiusKm: b.radius_km,
      titleEn: b.title_en,
      titleHi: b.title_hi,
      bodyEn: b.body_en,
      bodyHi: b.body_hi,
      severity: b.severity,
      timestamp: b.timestamp,
      recipientCount: b.recipient_count,
      deliveredCount: b.delivered_count,
      status: b.status
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/broadcasts - Send new Geofenced Broadcast Alert
router.post('/broadcasts', async (req, res) => {
  try {
    const {
      senderBadge,
      region,
      radiusKm,
      titleEn,
      titleHi,
      bodyEn,
      bodyHi,
      severity,
      recipientCount
    } = req.body;

    const id = `BC-${Math.floor(500 + Math.random() * 499)}`;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const recCount = recipientCount || 1000;
    const delCount = Math.round(recCount * 0.98);

    await run(
      `INSERT INTO broadcast_alerts (
        id, sender_badge, region, radius_km, title_en, title_hi, body_en, body_hi, severity, timestamp, recipient_count, delivered_count, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        senderBadge || 'IPS-7742 (Rajesh Kumar)',
        region || 'Geofenced Tourist Region',
        radiusKm || 5,
        titleEn || 'Emergency Safety Advisory',
        titleHi || 'आपातकालीन सुरक्षा सलाह',
        bodyEn || 'Safety warning issued for your current area.',
        bodyHi || 'आपके वर्तमान क्षेत्र के लिए सुरक्षा चेतावनी जारी की गई।',
        severity || 'Critical',
        timestamp,
        recCount,
        delCount,
        'Completed'
      ]
    );

    // Auto audit log entry via cryptographic hash chaining
    await insertAuditLogSecure({
      timestamp,
      officerName: 'Rajesh Kumar, IPS',
      officerBadge: 'IPS-7742',
      actionType: 'BROADCAST_SENT',
      targetId: `Geofence ${region}`,
      reason: 'Emergency Hazard Alert',
      details: `Pushed ${severity} alert to ~${recCount} active tourist devices.`,
      ipAddress: req.ip || '10.142.0.88'
    });

    const created = await get('SELECT * FROM broadcast_alerts WHERE id = ?', [id]);
    res.status(201).json({
      id: created.id,
      senderBadge: created.sender_badge,
      region: created.region,
      radiusKm: created.radius_km,
      titleEn: created.title_en,
      titleHi: created.title_hi,
      bodyEn: created.body_en,
      bodyHi: created.body_hi,
      severity: created.severity,
      timestamp: created.timestamp,
      recipientCount: created.recipient_count,
      deliveredCount: created.delivered_count,
      status: created.status
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/audit-logs/verify - Cryptographic Tamper-Evidence Chain Verification
router.get('/audit-logs/verify', async (req, res) => {
  try {
    const logs = await all<any>('SELECT * FROM audit_logs ORDER BY rowid ASC');
    let expectedPrevHash: string | null = null;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // 1. Check prev_hash continuity
      if (i === 0) {
        if (log.prev_hash !== null && log.prev_hash !== '' && log.prev_hash !== undefined) {
          return res.json({
            valid: false,
            brokenAtLogId: log.id,
            message: `Chain integrity broken at genesis entry ${log.id}: expected null prev_hash, got ${log.prev_hash}`
          });
        }
      } else {
        if (log.prev_hash !== expectedPrevHash) {
          return res.json({
            valid: false,
            brokenAtLogId: log.id,
            message: `Chain integrity broken at entry ${log.id}: prev_hash does not match predecessor hash`
          });
        }
      }

      // 2. Recompute SHA-256 hash for this entry
      const calculatedHash = computeAuditHash(
        log.prev_hash,
        log.officer_badge || '',
        log.action_type || '',
        log.target_id || '',
        log.timestamp || '',
        log.reason || ''
      );

      if (calculatedHash !== log.entry_hash) {
        return res.json({
          valid: false,
          brokenAtLogId: log.id,
          message: `Chain integrity broken at entry ${log.id}: hash mismatch (stored: ${log.entry_hash}, computed: ${calculatedHash})`
        });
      }

      expectedPrevHash = log.entry_hash;
    }

    res.json({
      valid: true,
      totalEntries: logs.length,
      latestHash: expectedPrevHash
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/audit-logs - Security Audit Vault
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await all('SELECT * FROM audit_logs ORDER BY timestamp DESC');
    const formatted = logs.map((l: any) => ({
      id: l.id,
      timestamp: l.timestamp,
      officerName: l.officer_name,
      officerBadge: l.officer_badge,
      actionType: l.action_type,
      targetId: l.target_id,
      reason: l.reason,
      details: l.details,
      ipAddress: l.ip_address,
      prevHash: l.prev_hash,
      entryHash: l.entry_hash
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/audit-logs - Insert manual audit log with tamper-evident hash chaining
router.post('/audit-logs', async (req, res) => {
  try {
    const { actionType, targetId, reason, details, officerName, officerBadge } = req.body;

    const created = await insertAuditLogSecure({
      officerName: officerName || 'Rajesh Kumar, IPS',
      officerBadge: officerBadge || 'IPS-7742',
      actionType: actionType || 'TOURIST_LOOKUP',
      targetId: targetId || 'N/A',
      reason: reason || 'Standard Security Procedure',
      details: details || 'Command Center Action logged',
      ipAddress: req.ip || '10.142.0.88'
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
