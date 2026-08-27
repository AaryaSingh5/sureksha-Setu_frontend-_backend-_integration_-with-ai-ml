import { Router } from 'express';
import { all, get, run, insertAuditLogSecure } from '../db';

const router = Router();

// Helper to format DB tourist row to frontend TouristProfile structure
function formatTourist(t: any) {
  let history = [];
  try {
    history = t.past_sos_history ? JSON.parse(t.past_sos_history) : [];
  } catch (e) {
    history = [];
  }

  return {
    id: t.id,
    name: t.name,
    nationality: t.nationality,
    passportHash: t.passport_hash,
    photoUrl: t.photo_url,
    phone: t.phone,
    emergencyContact: t.emergency_contact,
    emergencyRelation: t.emergency_relation,
    hotel: t.hotel,
    currentLocation: {
      lat: t.lat,
      lng: t.lng,
      address: t.address
    },
    batteryLevel: t.battery_level,
    safetyStatus: t.safety_status,
    lastSeenTime: t.last_seen_time,
    digitalBandId: t.digital_band_id,
    pastSOSHistory: history,
    tourist_id: t.tourist_id,
    digital_id: t.digital_id,
    full_name: t.full_name || t.name,
    kyc_document_type: t.kyc_document_type,
    kyc_verified: Boolean(t.kyc_verified),
    email: t.email,
    preferred_language: t.preferred_language,
    created_at: t.created_at
  };
}

// GET /api/v1/tourists - Search / list all tourists
router.get('/', async (req, res) => {
  try {
    const { query, status } = req.query;
    let sql = 'SELECT * FROM tourists WHERE 1=1';
    const params: any[] = [];

    if (query) {
      sql += ' AND (id LIKE ? OR name LIKE ? OR phone LIKE ? OR digital_band_id LIKE ? OR passport_hash LIKE ?)';
      const q = `%${query}%`;
      params.push(q, q, q, q, q);
    }

    if (status) {
      sql += ' AND safety_status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';
    const tourists = await all(sql, params);
    res.json(tourists.map(formatTourist));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/tourists/:id - Get tourist profile
router.get('/:id', async (req, res) => {
  try {
    const tourist = await get('SELECT * FROM tourists WHERE id = ? OR tourist_id = ? OR digital_band_id = ?', [req.params.id, req.params.id, req.params.id]);
    if (!tourist) {
      return res.status(404).json({ error: 'Tourist profile not found' });
    }

    // Log lookup audit entry if requested
    if (req.query.audit === 'true') {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      await insertAuditLogSecure({
        timestamp,
        officerName: 'Rajesh Kumar, IPS',
        officerBadge: 'IPS-7742',
        actionType: 'TOURIST_LOOKUP',
        targetId: `${tourist.id} (${tourist.name})`,
        reason: 'Safety Verification',
        details: `Searched profile and GPS telemetry for ${tourist.name}`,
        ipAddress: req.ip || '10.142.0.88'
      });
    }

    res.json(formatTourist(tourist));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/tourists - Register new tourist
router.post('/', async (req, res) => {
  try {
    const t = req.body;
    const id = t.id || `TR-${Math.floor(10000 + Math.random() * 89999)}`;
    const tourist_id = t.tourist_id || `TR-UUID-${Date.now()}`;
    const created_at = new Date().toISOString();

    await run(
      `INSERT INTO tourists (
        id, name, nationality, passport_hash, photo_url, phone, emergency_contact, emergency_relation,
        hotel, lat, lng, address, battery_level, safety_status, last_seen_time, digital_band_id,
        past_sos_history, tourist_id, digital_id, full_name, kyc_document_type, kyc_verified, email, preferred_language, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        t.name || 'New Tourist',
        t.nationality || 'India',
        t.passportHash || 'IND-XXXX',
        t.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
        t.phone || '',
        t.emergencyContact || '',
        t.emergencyRelation || 'Family',
        t.hotel || 'Local Hotel',
        t.currentLocation?.lat || 32.2432,
        t.currentLocation?.lng || 77.1892,
        t.currentLocation?.address || 'Manali, Himachal Pradesh',
        t.batteryLevel || 100,
        t.safetyStatus || 'Safe',
        'Just now',
        t.digitalBandId || `BAND-${Math.floor(1000 + Math.random() * 8999)}`,
        JSON.stringify(t.pastSOSHistory || []),
        tourist_id,
        id,
        t.full_name || t.name,
        t.kyc_document_type || 'Passport',
        t.kyc_verified ? 1 : 0,
        t.email || '',
        t.preferred_language || 'English',
        created_at
      ]
    );

    const created = await get('SELECT * FROM tourists WHERE id = ?', [id]);
    res.status(201).json(formatTourist(created));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/tourists/:id - Update tourist
router.patch('/:id', async (req, res) => {
  try {
    const { safetyStatus, lat, lng, address, batteryLevel } = req.body;
    const id = req.params.id;

    const existing = await get('SELECT * FROM tourists WHERE id = ? OR tourist_id = ?', [id, id]);
    if (!existing) {
      return res.status(404).json({ error: 'Tourist profile not found' });
    }

    let query = 'UPDATE tourists SET last_seen_time = ?';
    const params: any[] = ['Just now'];

    if (safetyStatus) {
      query += ', safety_status = ?';
      params.push(safetyStatus);
    }
    if (lat !== undefined) {
      query += ', lat = ?';
      params.push(lat);
    }
    if (lng !== undefined) {
      query += ', lng = ?';
      params.push(lng);
    }
    if (address) {
      query += ', address = ?';
      params.push(address);
    }
    if (batteryLevel !== undefined) {
      query += ', battery_level = ?';
      params.push(batteryLevel);
    }

    query += ' WHERE id = ? OR tourist_id = ?';
    params.push(id, id);

    await run(query, params);
    const updated = await get('SELECT * FROM tourists WHERE id = ? OR tourist_id = ?', [id, id]);
    res.json(formatTourist(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/tourists/:id/telemetry-access - Secure audit-logged telemetry access
router.post('/:id/telemetry-access', async (req, res) => {
  try {
    const { mandatoryReason, caseReference, officerName, officerBadge } = req.body;
    const id = req.params.id;

    if (!mandatoryReason) {
      return res.status(400).json({ error: 'Mandatory statutory reason is required.' });
    }

    // 1. Fetch the target tourist profile from database
    const tourist = await get('SELECT * FROM tourists WHERE id = ? OR tourist_id = ? OR digital_band_id = ?', [id, id, id]);
    if (!tourist) {
      return res.status(404).json({ error: 'Tourist profile not found.' });
    }

    // 2. Perform live reverse geocoding via Nominatim
    let resolvedAddress = tourist.address || '';
    if (tourist.lat && tourist.lng) {
      try {
        const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${tourist.lat}&lon=${tourist.lng}`;
        const geoRes = await fetch(geoUrl, {
          headers: { 'User-Agent': 'SurakshaSetuSafetyEngine/1.0' }
        });
        if (geoRes.ok) {
          const geoData: any = await geoRes.json();
          if (geoData && geoData.display_name) {
            resolvedAddress = geoData.display_name;
            // Persist the resolved address to database so it caches and is returned in future normal polls
            await run('UPDATE tourists SET address = ? WHERE id = ?', [resolvedAddress, tourist.id]);
          }
        }
      } catch (geoErr) {
        console.warn('Reverse geocoding failed:', geoErr);
        resolvedAddress = 'Unable to resolve address from current coordinates';
      }
    }

    // 3. Write dynamic details description based on access
    const details = `Accessed profile, emergency contact, and latest GPS telemetry. Case Ref: ${caseReference || 'None'}`;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 4. Create and persist secure audit entry
    const auditEntry = await insertAuditLogSecure({
      timestamp,
      officerName: officerName || 'Rajesh Kumar, IPS',
      officerBadge: officerBadge || 'IPS-7742',
      actionType: 'TOURIST_LOOKUP',
      targetId: `${tourist.id} (${tourist.name})`,
      reason: mandatoryReason,
      details,
      ipAddress: req.ip || '10.142.0.88 (NIC Secure Gateway)'
    });

    // 5. Update returned format
    const updatedTourist = formatTourist({ ...tourist, address: resolvedAddress });

    res.json({
      tourist: updatedTourist,
      auditEntry
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
