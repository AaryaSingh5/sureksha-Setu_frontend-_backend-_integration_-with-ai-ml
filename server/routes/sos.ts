import { Router } from 'express';
import { all, get, run, insertAuditLogSecure } from '../db';

const router = Router();

// GET /api/v1/sos - List all SOS incidents
router.get('/', async (req, res) => {
  try {
    const incidents = await all('SELECT * FROM sos_incidents ORDER BY timestamp DESC');
    const formatted = incidents.map((i: any) => ({
      id: i.id,
      touristId: i.tourist_id,
      touristName: i.tourist_name,
      touristPhone: i.tourist_phone,
      location: {
        lat: i.lat,
        lng: i.lng,
        address: i.address
      },
      timestamp: i.timestamp,
      status: i.status,
      severity: i.severity,
      unitAssigned: i.unit_assigned,
      hazardType: i.hazard_type,
      notes: i.notes,
      audioRecordingUrl: i.audio_recording_url,
      triggerSource: i.trigger_source
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/sos/:id - Get specific SOS incident
router.get('/:id', async (req, res) => {
  try {
    const incident = await get('SELECT * FROM sos_incidents WHERE id = ?', [req.params.id]);
    if (!incident) {
      return res.status(404).json({ error: 'SOS Incident not found' });
    }
    res.json({
      id: incident.id,
      touristId: incident.tourist_id,
      touristName: incident.tourist_name,
      touristPhone: incident.tourist_phone,
      location: {
        lat: incident.lat,
        lng: incident.lng,
        address: incident.address
      },
      timestamp: incident.timestamp,
      status: incident.status,
      severity: incident.severity,
      unitAssigned: incident.unit_assigned,
      hazardType: incident.hazard_type,
      notes: incident.notes,
      audioRecordingUrl: incident.audio_recording_url
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/sos - Ingest emergency SOS alert (with Bluetooth hop support & deduplication)
router.post('/', async (req, res) => {
  try {
    const {
      tourist_id,
      touristName,
      tourist_name,
      touristPhone,
      tourist_phone,
      latitude,
      longitude,
      address,
      description,
      severity,
      hazard_type,
      trigger_source,
      client_generated_id,
      hop_count,
      hop_path,
      origin_device_id
    } = req.body;

    const sos_id = client_generated_id || `SOS-${Math.floor(1000 + Math.random() * 9000)}`;
    const incident_id = sos_id;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Server-side deduplication check: If this SOS ID was already ingested, return existing record
    const existing = await get('SELECT * FROM sos_incidents WHERE id = ?', [sos_id]);
    if (existing) {
      console.log(`[SOS API] Duplicate SOS ${sos_id} detected. Returning existing record without re-inserting.`);
      return res.status(200).json({
        success: true,
        message: 'SOS Alert already registered in Command System.',
        sos_id: existing.id,
        incident_id: existing.id,
        status: existing.status,
        timestamp: existing.timestamp
      });
    }

    // Look up tourist name/phone if not provided in body
    let name = tourist_name || touristName;
    let phone = tourist_phone || touristPhone;
    if ((!name || !phone) && tourist_id) {
      const tourist = await get(
        'SELECT name, full_name, phone FROM tourists WHERE id = ? OR tourist_id = ? OR digital_id = ?',
        [tourist_id, tourist_id, tourist_id]
      );
      if (tourist) {
        name = name || tourist.full_name || tourist.name;
        phone = phone || tourist.phone;
      }
    }

    name = name || (tourist_id ? `Tourist (${tourist_id})` : 'Elena Rostova');
    phone = phone || '+91 98765 43210';

    // Update tourist safety status in SQLite
    if (tourist_id) {
      await run(
        "UPDATE tourists SET safety_status = 'Caution', last_seen_time = ? WHERE id = ? OR tourist_id = ? OR digital_id = ?",
        ['Just now', tourist_id, tourist_id, tourist_id]
      );
    }

    const lat = latitude !== undefined && latitude !== null ? latitude : 32.2432;
    const lng = longitude !== undefined && longitude !== null ? longitude : 77.1892;
    const addr = address || `Lat: ${lat}, Lng: ${lng}`;
    const hazType = hazard_type || (hop_count && hop_count > 0 ? 'BLE Relayed Panic Beacon' : 'Emergency Panic Beacon');
    
    // Deduplicate consecutive hops in hop_path
    const cleanedHopPath = Array.isArray(hop_path)
      ? hop_path.filter((node: string, idx: number, arr: string[]) => idx === 0 || node !== arr[idx - 1])
      : [];

    let notes = description || 'Emergency SOS trigger transmitted to command center.';
    if (hop_count && hop_count > 0) {
      notes += ` [Relayed via ${hop_count} Bluetooth Hop(s) - Path: ${cleanedHopPath.join(' ➔ ') || origin_device_id || 'BLE Mesh'}]`;
    }

    await run(
      `INSERT INTO sos_incidents (
        id, tourist_id, tourist_name, tourist_phone, lat, lng, address, timestamp, status, severity, hazard_type, notes, trigger_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sos_id, tourist_id || 'TR-88219', name, phone, lat, lng, addr, timestamp, 'New', severity || 'Critical', hazType, notes, trigger_source || 'APP']
    );

    // Auto-create audit log with cryptographic hash chain
    await insertAuditLogSecure({
      timestamp,
      officerName: 'System Gateway',
      officerBadge: 'SYS-BEACON',
      actionType: 'TICKET_STATUS_CHANGE',
      targetId: sos_id,
      reason: 'Active SOS Response',
      details: `New panic signal received from ${name} at ${addr} (${trigger_source || 'APP'}${hop_count ? `, ${hop_count} hops` : ''})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(201).json({
      success: true,
      message: 'SOS Alert received and registered in Command System.',
      sos_id,
      incident_id,
      status: 'New',
      timestamp,
      hop_count: hop_count || 0
    });
  } catch (err: any) {
    console.error('Error handling SOS POST:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/sos/:id/status - Update incident status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, unitAssigned } = req.body;
    const incidentId = req.params.id;

    const existing = await get('SELECT * FROM sos_incidents WHERE id = ?', [incidentId]);
    if (!existing) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    let query = 'UPDATE sos_incidents SET status = ?';
    const params: any[] = [status];

    if (unitAssigned) {
      query += ', unit_assigned = ?';
      params.push(unitAssigned);
    }
    query += ' WHERE id = ?';
    params.push(incidentId);

    await run(query, params);

    // If resolved, update tourist status back to Safe
    if (status === 'Resolved' && existing.tourist_id) {
      await run("UPDATE tourists SET safety_status = 'Safe' WHERE id = ? OR tourist_id = ?", [existing.tourist_id, existing.tourist_id]);
    }

    res.json({ success: true, message: `Incident ${incidentId} updated to ${status}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/sos/:id/dispatch - Assign unit to incident
router.post('/:id/dispatch', async (req, res) => {
  try {
    const { unitId } = req.body;
    const incidentId = req.params.id;

    const unit = await get('SELECT * FROM patrolling_units WHERE id = ?', [unitId]);
    if (!unit) {
      return res.status(404).json({ error: 'Patrolling unit not found' });
    }

    await run("UPDATE sos_incidents SET status = 'Units Dispatched', unit_assigned = ? WHERE id = ?", [unit.unit_name, incidentId]);
    await run("UPDATE patrolling_units SET status = 'Dispatched', assigned_incident_id = ? WHERE id = ?", [incidentId, unitId]);

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await insertAuditLogSecure({
      timestamp,
      officerName: 'Rajesh Kumar, IPS',
      officerBadge: 'IPS-7742',
      actionType: 'DISPATCH_UNIT',
      targetId: unitId,
      reason: 'Active SOS Response',
      details: `Dispatched unit ${unit.unit_name} to SOS Incident ${incidentId}`,
      ipAddress: req.ip || '10.142.0.88'
    });

    res.json({ success: true, message: `Unit ${unit.unit_name} dispatched to incident ${incidentId}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
