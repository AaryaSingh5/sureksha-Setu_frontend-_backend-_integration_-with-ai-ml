import { Router } from 'express';
import { all, get, run } from '../db';

const router = Router();

// GET /api/v1/units - List all patrolling units
router.get('/units', async (req, res) => {
  try {
    const units = await all('SELECT * FROM patrolling_units');
    const formatted = units.map((u: any) => ({
      id: u.id,
      unitName: u.unit_name,
      type: u.type,
      unitLeader: u.unit_leader,
      location: {
        lat: u.lat,
        lng: u.lng,
        address: u.address
      },
      status: u.status,
      contactPhone: u.contact_phone,
      assignedIncidentId: u.assigned_incident_id
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/units/:id - Update unit status or assigned incident
router.patch('/units/:id', async (req, res) => {
  try {
    const { status, assignedIncidentId, lat, lng } = req.body;
    const unitId = req.params.id;

    let query = 'UPDATE patrolling_units SET id = id';
    const params: any[] = [];

    if (status) {
      query += ', status = ?';
      params.push(status);
    }
    if (assignedIncidentId !== undefined) {
      query += ', assigned_incident_id = ?';
      params.push(assignedIncidentId);
    }
    if (lat !== undefined) {
      query += ', lat = ?';
      params.push(lat);
    }
    if (lng !== undefined) {
      query += ', lng = ?';
      params.push(lng);
    }

    query += ' WHERE id = ?';
    params.push(unitId);

    await run(query, params);
    const updated = await get('SELECT * FROM patrolling_units WHERE id = ?', [unitId]);
    if (!updated) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.json({
      id: updated.id,
      unitName: updated.unit_name,
      type: updated.type,
      unitLeader: updated.unit_leader,
      location: { lat: updated.lat, lng: updated.lng, address: updated.address },
      status: updated.status,
      contactPhone: updated.contact_phone,
      assignedIncidentId: updated.assigned_incident_id
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/stations - List police stations
router.get('/stations', async (req, res) => {
  try {
    const stations = await all('SELECT * FROM police_stations');
    const formatted = stations.map((s: any) => ({
      id: s.id,
      name: s.name,
      jurisdiction: s.jurisdiction,
      location: {
        lat: s.lat,
        lng: s.lng,
        address: s.address
      },
      contactPhone: s.contact_phone,
      activeOfficers: s.active_officers,
      availableVehicles: s.available_vehicles
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/hospitals - List hospitals
router.get('/hospitals', async (req, res) => {
  try {
    const hospitals = await all('SELECT * FROM hospitals');
    const formatted = hospitals.map((h: any) => ({
      id: h.id,
      name: h.name,
      jurisdiction: h.jurisdiction,
      location: {
        lat: h.lat,
        lng: h.lng,
        address: h.address
      },
      contactPhone: h.contact_phone,
      icuBedsAvailable: h.icu_beds_available,
      ambulancesReady: h.ambulances_ready
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
