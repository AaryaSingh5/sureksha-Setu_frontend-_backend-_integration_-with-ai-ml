import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'suraksha_setu.db');

export const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
  }
});

// Helper for running SQL queries returning Promises
export function run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export async function initDatabase() {
  console.log('Initializing SQLite database schema...');

  // 1. Tourists table
  await run(`
    CREATE TABLE IF NOT EXISTS tourists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nationality TEXT,
      passport_hash TEXT,
      photo_url TEXT,
      phone TEXT,
      emergency_contact TEXT,
      emergency_relation TEXT,
      hotel TEXT,
      lat REAL,
      lng REAL,
      address TEXT,
      battery_level INTEGER DEFAULT 100,
      safety_status TEXT DEFAULT 'Safe',
      last_seen_time TEXT,
      digital_band_id TEXT,
      past_sos_history TEXT,
      tourist_id TEXT,
      digital_id TEXT,
      full_name TEXT,
      kyc_document_type TEXT,
      kyc_verified INTEGER DEFAULT 0,
      email TEXT,
      preferred_language TEXT,
      created_at TEXT
    )
  `);

  // 2. SOS Incidents table
  await run(`
    CREATE TABLE IF NOT EXISTS sos_incidents (
      id TEXT PRIMARY KEY,
      tourist_id TEXT,
      tourist_name TEXT,
      tourist_phone TEXT,
      lat REAL,
      lng REAL,
      address TEXT,
      timestamp TEXT,
      status TEXT DEFAULT 'New',
      severity TEXT DEFAULT 'Critical',
      unit_assigned TEXT,
      hazard_type TEXT,
      notes TEXT,
      audio_recording_url TEXT,
      trigger_source TEXT DEFAULT 'APP'
    )
  `);

  // 3. Patrolling Units table
  await run(`
    CREATE TABLE IF NOT EXISTS patrolling_units (
      id TEXT PRIMARY KEY,
      unit_name TEXT NOT NULL,
      type TEXT,
      unit_leader TEXT,
      lat REAL,
      lng REAL,
      address TEXT,
      status TEXT DEFAULT 'Patrolling',
      contact_phone TEXT,
      assigned_incident_id TEXT
    )
  `);

  // 4. Police Stations table
  await run(`
    CREATE TABLE IF NOT EXISTS police_stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      jurisdiction TEXT,
      lat REAL,
      lng REAL,
      address TEXT,
      contact_phone TEXT,
      active_officers INTEGER DEFAULT 0,
      available_vehicles INTEGER DEFAULT 0
    )
  `);

  // 5. Hospitals table
  await run(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      jurisdiction TEXT,
      lat REAL,
      lng REAL,
      address TEXT,
      contact_phone TEXT,
      icu_beds_available INTEGER DEFAULT 0,
      ambulances_ready INTEGER DEFAULT 0
    )
  `);

  // 6. Anomaly Clusters table
  await run(`
    CREATE TABLE IF NOT EXISTS anomaly_clusters (
      id TEXT PRIMARY KEY,
      region_name TEXT NOT NULL,
      risk_score INTEGER DEFAULT 0,
      tourist_density INTEGER DEFAULT 0,
      anomaly_type TEXT,
      confidence_score INTEGER DEFAULT 0,
      description_en TEXT,
      description_hi TEXT,
      recommended_action_en TEXT,
      recommended_action_hi TEXT,
      lat REAL,
      lng REAL,
      timestamp TEXT
    )
  `);

  // 7. Broadcast Alerts table
  await run(`
    CREATE TABLE IF NOT EXISTS broadcast_alerts (
      id TEXT PRIMARY KEY,
      sender_badge TEXT,
      region TEXT,
      radius_km REAL,
      title_en TEXT,
      title_hi TEXT,
      body_en TEXT,
      body_hi TEXT,
      severity TEXT,
      timestamp TEXT,
      recipient_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Active'
    )
  `);

  // 8. Audit Logs table
  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      officer_name TEXT,
      officer_badge TEXT,
      action_type TEXT,
      target_id TEXT,
      reason TEXT,
      details TEXT,
      ip_address TEXT
    )
  `);

  // 9. AI Logs table
  await run(`
    CREATE TABLE IF NOT EXISTS ai_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      severity TEXT,
      message_en TEXT,
      message_hi TEXT,
      model_confidence REAL,
      region TEXT
    )
  `);

  // Seed default data if empty
  await seedInitialData();

  console.log('Database schema & seed initialization complete.');
}

async function seedInitialData() {
  const touristCount = await get<{ count: number }>('SELECT COUNT(*) as count FROM tourists');
  if (touristCount && touristCount.count > 0) {
    console.log('Database already populated. Skipping seed phase.');
    return;
  }

  console.log('Seeding initial dataset into SQLite database...');

  // Seed Tourists
  const initialTourists = [
    {
      id: 'TR-88219',
      name: 'Elena Rostova',
      nationality: 'Spain',
      passportHash: 'ESP-9874****',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
      phone: '+34 612 884 902',
      emergencyContact: '+34 612 001 223',
      emergencyRelation: 'Father',
      hotel: 'The Grand Himalayan Resort, Old Manali',
      lat: 32.2432,
      lng: 77.1892,
      address: 'Solang Valley North Trail, Kullu, HP',
      batteryLevel: 84,
      safetyStatus: 'SOS Active',
      lastSeenTime: '10 mins ago',
      digitalBandId: 'BAND-3301',
      pastSOSHistory: JSON.stringify([{ id: 'SOS-8012', date: '2026-08-01', location: 'Hadimba Temple Trek', reason: 'Network Drop & Altitude Confusion', status: 'Resolved' }]),
      tourist_id: '8f7a9d1b-3c4e-4f52-a1b2-c3d4e5f67890',
      digital_id: 'TR-88219',
      full_name: 'Elena Rostova',
      kyc_document_type: 'Passport',
      kyc_verified: 1,
      email: 'elena.rostova@example.com',
      preferred_language: 'Spanish',
      created_at: '2026-07-15T08:30:00Z'
    },
    {
      id: 'TR-44021',
      name: 'Marcus Vance',
      nationality: 'Australia',
      passportHash: 'AUS-4412****',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300',
      phone: '+61 412 990 123',
      emergencyContact: '+61 412 000 888',
      emergencyRelation: 'Sister',
      hotel: 'Ganga View Heritage Guest House, Varanasi',
      lat: 25.3176,
      lng: 83.0062,
      address: 'Dashashwamedh Ghat Alley #4, Varanasi, UP',
      batteryLevel: 62,
      safetyStatus: 'Watch',
      lastSeenTime: '2 mins ago',
      digitalBandId: 'BAND-1192',
      pastSOSHistory: JSON.stringify([]),
      tourist_id: '3b2a1c0d-9e8f-4765-b4a3-102938475610',
      digital_id: 'TR-44021',
      full_name: 'Marcus Vance',
      kyc_document_type: 'Passport',
      kyc_verified: 1,
      email: 'marcus.vance@example.au',
      preferred_language: 'English',
      created_at: '2026-07-20T11:15:00Z'
    },
    {
      id: 'TR-90423',
      name: 'Amina Al-Mansoor',
      nationality: 'UAE',
      passportHash: 'ARE-7712****',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300',
      phone: '+971 50 123 4567',
      emergencyContact: '+971 50 999 8877',
      emergencyRelation: 'Spouse',
      hotel: 'Taj Palace, New Delhi',
      lat: 28.6315,
      lng: 77.2167,
      address: 'Connaught Place Inner Circle, New Delhi',
      batteryLevel: 91,
      safetyStatus: 'Safe',
      lastSeenTime: 'Just now',
      digitalBandId: 'BAND-9081',
      pastSOSHistory: JSON.stringify([]),
      tourist_id: '6c5b4a3f-2e1d-4890-a5b6-7c8d9e0f1a2b',
      digital_id: 'TR-90423',
      full_name: 'Amina Al-Mansoor',
      kyc_document_type: 'National ID',
      kyc_verified: 1,
      email: 'amina.almansoor@example.ae',
      preferred_language: 'Arabic',
      created_at: '2026-08-01T14:45:00Z'
    },
    {
      id: 'TR-12890',
      name: 'Kenji Takahashi',
      nationality: 'Japan',
      passportHash: 'JPN-3301****',
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=300',
      phone: '+81 90 4432 1100',
      emergencyContact: '+81 90 0011 2233',
      emergencyRelation: 'Mother',
      hotel: 'Palolem Beach Shack Inn, Goa',
      lat: 15.0102,
      lng: 74.0231,
      address: 'South Palolem Cliff Point, Canacona, Goa',
      batteryLevel: 45,
      safetyStatus: 'SOS Active',
      lastSeenTime: '5 mins ago',
      digitalBandId: 'BAND-5512',
      pastSOSHistory: JSON.stringify([{ id: 'SOS-7110', date: '2026-07-28', location: 'Agonda Beach Cliff', reason: 'Water Tide Isolation Warning', status: 'Resolved' }]),
      tourist_id: '9d8c7b6a-5f4e-3d2c-1b0a-fe9d8c7b6a5f',
      digital_id: 'TR-12890',
      full_name: 'Kenji Takahashi',
      kyc_document_type: 'Passport',
      kyc_verified: 1,
      email: 'kenji.takahashi@example.jp',
      preferred_language: 'Japanese',
      created_at: '2026-07-25T09:20:00Z'
    },
    {
      id: 'TR-55310',
      name: 'Priya Sharma',
      nationality: 'India (Domestic Traveler)',
      passportHash: 'IND-8821****',
      photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=300',
      phone: '+91 98765 43210',
      emergencyContact: '+91 98123 45678',
      emergencyRelation: 'Brother',
      hotel: 'Zostel Rishikesh, Tapovan',
      lat: 30.1231,
      lng: 78.3211,
      address: 'Laxman Jhula North Bank, Rishikesh, Uttarakhand',
      batteryLevel: 78,
      safetyStatus: 'Safe',
      lastSeenTime: '15 mins ago',
      digitalBandId: 'BAND-8840',
      pastSOSHistory: JSON.stringify([]),
      tourist_id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
      digital_id: 'TR-55310',
      full_name: 'Priya Sharma',
      kyc_document_type: 'Aadhaar Card',
      kyc_verified: 1,
      email: 'priya.sharma@example.in',
      preferred_language: 'Hindi',
      created_at: '2026-08-05T16:10:00Z'
    }
  ];

  for (const t of initialTourists) {
    await run(
      `INSERT INTO tourists (
        id, name, nationality, passport_hash, photo_url, phone, emergency_contact, emergency_relation,
        hotel, lat, lng, address, battery_level, safety_status, last_seen_time, digital_band_id,
        past_sos_history, tourist_id, digital_id, full_name, kyc_document_type, kyc_verified, email, preferred_language, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id, t.name, t.nationality, t.passportHash, t.photoUrl, t.phone, t.emergencyContact, t.emergencyRelation,
        t.hotel, t.lat, t.lng, t.address, t.batteryLevel, t.safetyStatus, t.lastSeenTime, t.digitalBandId,
        t.pastSOSHistory, t.tourist_id, t.digital_id, t.full_name, t.kyc_document_type, t.kyc_verified, t.email, t.preferred_language, t.created_at
      ]
    );
  }

  // Seed SOS Incidents
  const initialIncidents = [
    {
      id: 'SOS-9021',
      tourist_id: 'TR-88219',
      tourist_name: 'Elena Rostova',
      tourist_phone: '+34 612 884 902',
      lat: 32.2432,
      lng: 77.1892,
      address: 'Solang Valley North Trail (Off-route 2.4 km)',
      timestamp: '2026-08-12 08:10:12',
      status: 'New',
      severity: 'Critical',
      hazard_type: 'Panic Beacon / Off-Route Isolation',
      notes: 'Panic button pressed continuously for 5s. Rapid heart-rate spike recorded by digital band.',
      unit_assigned: null,
      trigger_source: 'APP'
    },
    {
      id: 'SOS-9022',
      tourist_id: 'TR-12890',
      tourist_name: 'Kenji Takahashi',
      tourist_phone: '+81 90 4432 1100',
      lat: 15.0102,
      lng: 74.0231,
      address: 'South Palolem Cliff Point, Goa',
      timestamp: '2026-08-12 07:55:00',
      status: 'Units Dispatched',
      severity: 'Critical',
      hazard_type: 'High Tide Cliff Isolation',
      notes: 'Coastal Patrol boat dispatched with life jackets.',
      unit_assigned: 'PCR-GOA-08',
      trigger_source: 'APP'
    },
    {
      id: 'SOS-9018',
      tourist_id: 'TR-44021',
      tourist_name: 'Marcus Vance',
      tourist_phone: '+61 412 990 123',
      lat: 25.3176,
      lng: 83.0062,
      address: 'Manikarnika Ghat Lane, Varanasi',
      timestamp: '2026-08-12 06:30:15',
      status: 'Resolved',
      severity: 'Warning',
      hazard_type: 'Crowd Disorientation',
      notes: 'Tourist safely escorted back to hotel by Ghat Tourist Squad.',
      unit_assigned: 'PCR-VAR-02',
      trigger_source: 'APP'
    }
  ];

  for (const i of initialIncidents) {
    await run(
      `INSERT INTO sos_incidents (
        id, tourist_id, tourist_name, tourist_phone, lat, lng, address, timestamp, status, severity, hazard_type, notes, unit_assigned, trigger_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        i.id, i.tourist_id, i.tourist_name, i.tourist_phone, i.lat, i.lng, i.address, i.timestamp, i.status, i.severity, i.hazard_type, i.notes, i.unit_assigned, i.trigger_source
      ]
    );
  }

  // Seed Patrolling Units
  const initialUnits = [
    {
      id: 'PCR-KULLU-04',
      unit_name: 'PCR Van - Himachal High Sector 04',
      type: 'PCR Van',
      unit_leader: 'SI Inspector Vikram Singh',
      lat: 32.2390,
      lng: 77.1820,
      address: 'Solang Valley Checkpost',
      status: 'Patrolling',
      contact_phone: '+91 94180 12345',
      assigned_incident_id: null
    },
    {
      id: 'PCR-GOA-08',
      unit_name: 'Coastal Rescue Speedboat - Unit 8',
      type: 'Quick Response Motorcycle',
      unit_leader: 'Coast Guard Sub-Officer Rahul Naik',
      lat: 15.0080,
      lng: 74.0210,
      address: 'Palolem Beach Patrol Bay',
      status: 'Dispatched',
      contact_phone: '+91 98221 88990',
      assigned_incident_id: 'SOS-9022'
    },
    {
      id: 'WSS-DELHI-01',
      unit_name: 'Pink Panther Women Safety Squad - CP',
      type: 'Women Safety Squad',
      unit_leader: 'Inspector Sunita Rani',
      lat: 28.6320,
      lng: 77.2180,
      address: 'Connaught Place Outer Ring',
      status: 'Patrolling',
      contact_phone: '+91 98100 55443',
      assigned_incident_id: null
    },
    {
      id: 'PCR-VAR-02',
      unit_name: 'Ghat Quick Response Bike Team 2',
      type: 'Quick Response Motorcycle',
      unit_leader: 'Head Constable Ramesh Yadav',
      lat: 25.3120,
      lng: 83.0080,
      address: 'Godowlia Crossing, Varanasi',
      status: 'Standby',
      contact_phone: '+91 94500 11223',
      assigned_incident_id: null
    }
  ];

  for (const u of initialUnits) {
    await run(
      `INSERT INTO patrolling_units (
        id, unit_name, type, unit_leader, lat, lng, address, status, contact_phone, assigned_incident_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.unit_name, u.type, u.unit_leader, u.lat, u.lng, u.address, u.status, u.contact_phone, u.assigned_incident_id]
    );
  }

  // Seed Police Stations
  const initialStations = [
    {
      id: 'PS-MANALI-01',
      name: 'Manali Central Tourist Police Station',
      jurisdiction: 'Kullu Valley & Solang Pass',
      lat: 32.2400,
      lng: 77.1850,
      address: 'Mall Road, Manali, Himachal Pradesh',
      contact_phone: '01902-252326',
      active_officers: 34,
      available_vehicles: 8
    },
    {
      id: 'PS-VARANASI-01',
      name: 'Kotwali Tourist Helpdesk & Station',
      jurisdiction: 'Varanasi Ghats & Heritage Corridor',
      lat: 25.3150,
      lng: 83.0040,
      address: 'Dashashwamedh Main Road, Varanasi',
      contact_phone: '0542-2502220',
      active_officers: 42,
      available_vehicles: 12
    },
    {
      id: 'PS-DELHI-01',
      name: 'Connaught Place Police Station',
      jurisdiction: 'Central Delhi & Janpath Tourist Hub',
      lat: 28.6300,
      lng: 77.2150,
      address: 'Parliament Street, Connaught Place, New Delhi',
      contact_phone: '011-23361234',
      active_officers: 65,
      available_vehicles: 18
    },
    {
      id: 'PS-GOA-01',
      name: 'Canacona Coastal Police Station',
      jurisdiction: 'South Goa Beaches & Cliff Circuits',
      lat: 15.0150,
      lng: 74.0200,
      address: 'Chaudi, Canacona, South Goa',
      contact_phone: '0832-2643323',
      active_officers: 28,
      available_vehicles: 6
    }
  ];

  for (const s of initialStations) {
    await run(
      `INSERT INTO police_stations (id, name, jurisdiction, lat, lng, address, contact_phone, active_officers, available_vehicles)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.name, s.jurisdiction, s.lat, s.lng, s.address, s.contact_phone, s.active_officers, s.available_vehicles]
    );
  }

  // Seed Hospitals
  const initialHospitals = [
    {
      id: 'HOSP-MANALI-01',
      name: 'Manali Civil District Hospital & Trauma Center',
      jurisdiction: 'Mall Road Emergency Ward',
      lat: 32.2380,
      lng: 77.1890,
      address: 'Mall Road, Manali, Himachal Pradesh',
      contact_phone: '+91 1902 252222',
      icu_beds_available: 14,
      ambulances_ready: 4
    },
    {
      id: 'HOSP-KULLU-02',
      name: 'Kullu Regional Emergency Care Center',
      jurisdiction: 'Kullu Valley Medical Command',
      lat: 31.9580,
      lng: 77.1090,
      address: 'Regional Hospital Campus, Kullu',
      contact_phone: '+91 1902 222340',
      icu_beds_available: 22,
      ambulances_ready: 6
    },
    {
      id: 'HOSP-VARANASI-03',
      name: 'Heritage Super Specialty Hospital',
      jurisdiction: 'Varanasi Central Trauma Response',
      lat: 25.3120,
      lng: 83.0080,
      address: 'Lanka Crossing, Varanasi',
      contact_phone: '+91 542 2369999',
      icu_beds_available: 18,
      ambulances_ready: 5
    }
  ];

  for (const h of initialHospitals) {
    await run(
      `INSERT INTO hospitals (id, name, jurisdiction, lat, lng, address, contact_phone, icu_beds_available, ambulances_ready)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [h.id, h.name, h.jurisdiction, h.lat, h.lng, h.address, h.contact_phone, h.icu_beds_available, h.ambulances_ready]
    );
  }

  // Seed Anomaly Clusters
  const initialClusters = [
    {
      id: 'AC-101',
      region_name: 'Solang Valley North Trail (Kullu Sector)',
      risk_score: 88,
      tourist_density: 142,
      anomaly_type: 'Off-Route Signal Loss',
      confidence_score: 94,
      description_en: 'AI detected 3 active tourist digital bands deviating >2km from marked trekking trail after dusk.',
      description_hi: 'एआई ने सूर्यास्त के बाद चिह्नित ट्रैकिंग ट्रेल से >2 किमी दूर भटक रहे 3 सक्रिय पर्यटक डिजिटल बैंड का पता लगाया।',
      recommended_action_en: 'Deploy High Altitude PCR-04 van and send automated SMS advisory to registered trekking groups.',
      recommended_action_hi: 'हाई एल्टीट्यूड पीसीआर-04 वैन भेजें और पंजीकृत ट्रैकिंग समूहों को स्वचालित एसएमएस सलाह भेजें।',
      lat: 32.2432,
      lng: 77.1892,
      timestamp: '2026-08-12 08:12:00'
    },
    {
      id: 'AC-102',
      region_name: 'Varanasi Ghat Narrow Alleyway Grid',
      risk_score: 72,
      tourist_density: 890,
      anomaly_type: 'Unusual Grouping',
      confidence_score: 89,
      description_en: 'High density congestion detected near unlit alley #4. Slow movement and sudden drop in GPS precision.',
      description_hi: 'अप्रकाशित गली #4 के पास उच्च घनत्व वाली भीड़ का पता चला। धीमी गति और जीपीएस सटीकता में अचानक गिरावट।',
      recommended_action_en: 'Dispatch Ghat Bike Team for crowd flow management and illuminate emergency LED arrays.',
      recommended_action_hi: 'भीड़ प्रवाह प्रबंधन के लिए घाट बाइक टीम भेजें और आपातकालीन एलईडी समूह चालू करें।',
      lat: 25.3176,
      lng: 83.0062,
      timestamp: '2026-08-12 08:05:00'
    },
    {
      id: 'AC-103',
      region_name: 'Anjuna - Palolem Coastal Cliff Edge',
      risk_score: 81,
      tourist_density: 210,
      anomaly_type: 'Hazard Zone Entry',
      confidence_score: 91,
      description_en: 'High tide alert active. 5 tourists located past danger warning barrier near tidal cliff.',
      description_hi: 'उच्च ज्वार की चेतावनी सक्रिय। ज्वारीय चट्टान के पास खतरे की चेतावनी बाधा के पार 5 पर्यटक स्थित हैं।',
      recommended_action_en: 'Trigger geofenced audio warning beacon and broadcast SMS to coastal cell towers.',
      recommended_action_hi: 'जियोफेंस किए गए ऑडियो चेतावनी बीकन को ट्रिगर करें और तटीय सेल टावरों पर एसएमएस प्रसारित करें।',
      lat: 15.0102,
      lng: 74.0231,
      timestamp: '2026-08-12 07:50:00'
    }
  ];

  for (const c of initialClusters) {
    await run(
      `INSERT INTO anomaly_clusters (
        id, region_name, risk_score, tourist_density, anomaly_type, confidence_score,
        description_en, description_hi, recommended_action_en, recommended_action_hi, lat, lng, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.region_name, c.risk_score, c.tourist_density, c.anomaly_type, c.confidence_score, c.description_en, c.description_hi, c.recommended_action_en, c.recommended_action_hi, c.lat, c.lng, c.timestamp]
    );
  }

  // Seed Broadcast Alerts
  const initialBroadcasts = [
    {
      id: 'BC-501',
      sender_badge: 'IPS-7742 (Rajesh Kumar)',
      region: 'Himachal Pradesh (Solang Valley & Rohtang Pass)',
      radius_km: 15,
      title_en: '⚠️ Flash Flood & Sudden Weather Warning',
      title_hi: '⚠️ अचानक बाढ़ और खराब मौसम की चेतावनी',
      body_en: 'Heavy rainfall and cloudburst alert in Solang Valley. Avoid unmapped riverbanks and return to main highway immediately.',
      body_hi: 'सोलंग घाटी में भारी बारिश और बादल फटने का अलर्ट। बिना नक्शे वाले नदी तटों से दूर रहें और तुरंत मुख्य राजमार्ग पर लौटें।',
      severity: 'Critical',
      timestamp: '2026-08-12 07:30:00',
      recipient_count: 3420,
      delivered_count: 3389,
      status: 'Completed'
    },
    {
      id: 'BC-502',
      sender_badge: 'IPS-7742 (Rajesh Kumar)',
      region: 'Varanasi Ghats Heritage Area',
      radius_km: 3,
      title_en: 'ℹ️ Ganga Aarti Crowd Diversion Advisory',
      title_hi: 'ℹ️ गंगा आरती भीड़ डायवर्जन सलाह',
      body_en: 'Dashashwamedh Ghat experiencing maximum capacity. Please use Rajghat or Assi Ghat for comfortable view.',
      body_hi: 'दशाश्वमेध घाट अधिकतम क्षमता पर है। आरामदायक दर्शन के लिए कृपया राजघाट या अस्सी घाट का उपयोग करें।',
      severity: 'Advisory',
      timestamp: '2026-08-11 18:00:00',
      recipient_count: 12500,
      delivered_count: 12410,
      status: 'Completed'
    }
  ];

  for (const b of initialBroadcasts) {
    await run(
      `INSERT INTO broadcast_alerts (
        id, sender_badge, region, radius_km, title_en, title_hi, body_en, body_hi, severity, timestamp, recipient_count, delivered_count, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.id, b.sender_badge, b.region, b.radius_km, b.title_en, b.title_hi, b.body_en, b.body_hi, b.severity, b.timestamp, b.recipient_count, b.delivered_count, b.status]
    );
  }

  // Seed Audit Logs
  const initialAuditLogs = [
    {
      id: 'AUD-9901',
      timestamp: '2026-08-12 08:14:02',
      officer_name: 'Rajesh Kumar, IPS',
      officer_badge: 'IPS-7742',
      action_type: 'TOURIST_LOOKUP',
      target_id: 'TR-88219 (Elena Rostova)',
      reason: 'Active SOS Response',
      details: 'Accessed live GPS telemetry and emergency contact records during active panic beacon event SOS-9021.',
      ip_address: '10.142.0.88 (NIC Secure Gateway)'
    },
    {
      id: 'AUD-9902',
      timestamp: '2026-08-12 07:56:10',
      officer_name: 'Rajesh Kumar, IPS',
      officer_badge: 'IPS-7742',
      action_type: 'DISPATCH_UNIT',
      target_id: 'PCR-GOA-08',
      reason: 'Active SOS Response',
      details: 'Dispatched Coastal Rescue Speedboat to South Palolem Cliff Point for incident SOS-9022.',
      ip_address: '10.142.0.88 (NIC Secure Gateway)'
    },
    {
      id: 'AUD-9903',
      timestamp: '2026-08-12 07:30:15',
      officer_name: 'Rajesh Kumar, IPS',
      officer_badge: 'IPS-7742',
      action_type: 'BROADCAST_SENT',
      target_id: 'Geofence Solang (15km)',
      reason: 'Disaster Prevention Protocol',
      details: 'Pushed Critical Flash Flood warning SMS to 3,420 active tourist devices.',
      ip_address: '10.142.0.88 (NIC Secure Gateway)'
    }
  ];

  for (const a of initialAuditLogs) {
    await run(
      `INSERT INTO audit_logs (id, timestamp, officer_name, officer_badge, action_type, target_id, reason, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.timestamp, a.officer_name, a.officer_badge, a.action_type, a.target_id, a.reason, a.details, a.ip_address]
    );
  }

  // Seed AI Logs
  const initialAILogs = [
    {
      id: 'LOG-1',
      timestamp: '08:19:12',
      severity: 'critical',
      message_en: 'AI Model Threat-Predictor v4.2 flagged rapid signal loss for TR-88219 near Solang Ravine. Anomaly confidence: 94%.',
      message_hi: 'एआई मॉडल खतरा-पूर्वानुमानकर्ता v4.2 ने सोलंग खड्ड के पास TR-88219 के लिए तेज सिग्नल हानि को चिह्नित किया। विसंगति विश्वसनीयता: 94%।',
      model_confidence: 94,
      region: 'Solang Valley, HP'
    },
    {
      id: 'LOG-2',
      timestamp: '08:15:30',
      severity: 'warning',
      message_en: 'Density threshold surpassed in Varanasi Sector 4 (+38% over average baseline). Recommended squad re-allocation.',
      message_hi: 'वाराणसी सेक्टर 4 में घनत्व सीमा पार हो गई (औसत आधार रेखा से +38% अधिक)। अनुशंसित दस्ता पुनरावंटन।',
      model_confidence: 89,
      region: 'Varanasi, UP'
    },
    {
      id: 'LOG-3',
      timestamp: '08:02:44',
      severity: 'info',
      message_en: 'Geofence heartbeats synced with 18,940 active tourist digital wristbands across major national circuits.',
      message_hi: 'प्रमुख राष्ट्रीय सर्किटों में 18,940 सक्रिय पर्यटक डिजिटल कलाई बैंड के साथ जियोफेंस धड़कनें सिंक की गईं।',
      model_confidence: 99,
      region: 'National Network'
    }
  ];

  for (const ai of initialAILogs) {
    await run(
      `INSERT INTO ai_logs (id, timestamp, severity, message_en, message_hi, model_confidence, region)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ai.id, ai.timestamp, ai.severity, ai.message_en, ai.message_hi, ai.model_confidence, ai.region]
    );
  }

  console.log('Successfully seeded database tables.');
}
