import { Router } from 'express';
import { all, get, run } from '../db';

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

// POST /api/v1/sos - Create or Sync SOS alert
router.post('/', async (req, res) => {
  try {
    const {
      tourist_id,
      tourist_name,
      tourist_phone,
      latitude,
      longitude,
      address,
      description,
      severity,
      trigger_source,
      hazard_type
    } = req.body;

    const sos_id = `SOS-${Math.floor(9000 + Math.random() * 999)}`;
    const incident_id = `INC-${Date.now()}`;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Retrieve tourist info if tourist_id is provided
    let name = tourist_name || 'Anonymous Tourist';
    let phone = tourist_phone || '+91 99999 00000';
    if (tourist_id) {
      const tourist = await get('SELECT * FROM tourists WHERE id = ? OR tourist_id = ?', [tourist_id, tourist_id]);
      if (tourist) {
        name = tourist.name || name;
        phone = tourist.phone || phone;

        // Update tourist safety status to SOS Active
        await run("UPDATE tourists SET safety_status = 'SOS Active' WHERE id = ? OR tourist_id = ?", [tourist_id, tourist_id]);
      }
    }

    const lat = latitude !== undefined && latitude !== null ? latitude : 32.2432;
    const lng = longitude !== undefined && longitude !== null ? longitude : 77.1892;
    const addr = address || `Lat: ${lat}, Lng: ${lng}`;
    const hazType = hazard_type || 'Emergency Panic Beacon';
    const notes = description || 'Emergency SOS trigger transmitted to command center.';

    await run(
      `INSERT INTO sos_incidents (
        id, tourist_id, tourist_name, tourist_phone, lat, lng, address, timestamp, status, severity, hazard_type, notes, trigger_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sos_id, tourist_id || 'TR-88219', name, phone, lat, lng, addr, timestamp, 'New', severity || 'Critical', hazType, notes, trigger_source || 'APP']
    );

    // Auto-create audit log
    const auditId = `AUD-${Math.floor(1000 + Math.random() * 9000)}`;
    await run(
      `INSERT INTO audit_logs (id, timestamp, officer_name, officer_badge, action_type, target_id, reason, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auditId,
        timestamp,
        'System Gateway',
        'SYS-BEACON',
        'TICKET_STATUS_CHANGE',
        sos_id,
        'Active SOS Response',
        `New panic signal received from ${name} at ${addr}`,
        req.ip || '127.0.0.1'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'SOS Alert received and registered in Command System.',
      sos_id,
      incident_id,
      status: 'New',
      timestamp
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
    await run(
      `INSERT INTO audit_logs (id, timestamp, officer_name, officer_badge, action_type, target_id, reason, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp,
        'Rajesh Kumar, IPS',
        'IPS-7742',
        'DISPATCH_UNIT',
        unitId,
        'Active SOS Response',
        `Dispatched unit ${unit.unit_name} to SOS Incident ${incidentId}`,
        req.ip || '10.142.0.88'
      ]
    );

    res.json({ success: true, message: `Unit ${unit.unit_name} dispatched to incident ${incidentId}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
