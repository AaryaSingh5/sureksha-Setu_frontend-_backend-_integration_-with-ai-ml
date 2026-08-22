import { Router } from 'express';
import { all, get, run } from '../db';

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

    // Auto audit log entry
    await run(
      `INSERT INTO audit_logs (id, timestamp, officer_name, officer_badge, action_type, target_id, reason, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp,
        'Rajesh Kumar, IPS',
        'IPS-7742',
        'BROADCAST_SENT',
        `Geofence ${region}`,
        'Emergency Hazard Alert',
        `Pushed ${severity} alert to ~${recCount} active tourist devices.`,
        req.ip || '10.142.0.88'
      ]
    );

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
      ipAddress: l.ip_address
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/audit-logs - Insert manual audit log
router.post('/audit-logs', async (req, res) => {
  try {
    const { actionType, targetId, reason, details } = req.body;
    const id = `AUD-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    await run(
      `INSERT INTO audit_logs (id, timestamp, officer_name, officer_badge, action_type, target_id, reason, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        timestamp,
        'Rajesh Kumar, IPS',
        'IPS-7742',
        actionType || 'TOURIST_LOOKUP',
        targetId || 'N/A',
        reason || 'Standard Security Procedure',
        details || 'Command Center Action logged',
        req.ip || '10.142.0.88'
      ]
    );

    const created = await get('SELECT * FROM audit_logs WHERE id = ?', [id]);
    res.status(201).json({
      id: created.id,
      timestamp: created.timestamp,
      officerName: created.officer_name,
      officerBadge: created.officer_badge,
      actionType: created.action_type,
      targetId: created.target_id,
      reason: created.reason,
      details: created.details,
      ipAddress: created.ip_address
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
