import {
  TouristProfile,
  SOSIncident,
  PatrollingUnit,
  PoliceStation,
  Hospital,
  AnomalyCluster,
  BroadcastAlert,
  AuditLog,
  AILog,
  GeoFenceZone
} from '../types';


export const INITIAL_TOURISTS: TouristProfile[] = [
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
    currentLocation: {
      lat: 32.2432,
      lng: 77.1892,
      address: 'Solang Valley North Trail, Kullu, HP'
    },
    batteryLevel: 84,
    safetyStatus: 'SOS Active',
    lastSeenTime: '10 mins ago',
    digitalBandId: 'BAND-3301',
    pastSOSHistory: [
      {
        id: 'SOS-8012',
        date: '2026-08-01',
        location: 'Hadimba Temple Trek',
        reason: 'Network Drop & Altitude Confusion',
        status: 'Resolved'
      }
    ],
    tourist_id: '8f7a9d1b-3c4e-4f52-a1b2-c3d4e5f67890',
    digital_id: 'TR-88219',
    full_name: 'Elena Rostova',
    kyc_document_type: 'Passport',
    kyc_verified: true,
    email: 'elena.rostova@example.com',
    emergency_contact: '+34 612 001 223',
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
    currentLocation: {
      lat: 25.3176,
      lng: 83.0062,
      address: 'Dashashwamedh Ghat Alley #4, Varanasi, UP'
    },
    batteryLevel: 62,
    safetyStatus: 'Watch',
    lastSeenTime: '2 mins ago',
    digitalBandId: 'BAND-1192',
    pastSOSHistory: [],
    tourist_id: '3b2a1c0d-9e8f-4765-b4a3-102938475610',
    digital_id: 'TR-44021',
    full_name: 'Marcus Vance',
    kyc_document_type: 'Passport',
    kyc_verified: true,
    email: 'marcus.vance@example.au',
    emergency_contact: '+61 412 000 888',
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
    currentLocation: {
      lat: 28.6315,
      lng: 77.2167,
      address: 'Connaught Place Inner Circle, New Delhi'
    },
    batteryLevel: 91,
    safetyStatus: 'Safe',
    lastSeenTime: 'Just now',
    digitalBandId: 'BAND-9081',
    pastSOSHistory: [],
    tourist_id: '6c5b4a3f-2e1d-4890-a5b6-7c8d9e0f1a2b',
    digital_id: 'TR-90423',
    full_name: 'Amina Al-Mansoor',
    kyc_document_type: 'National ID',
    kyc_verified: true,
    email: 'amina.almansoor@example.ae',
    emergency_contact: '+971 50 999 8877',
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
    currentLocation: {
      lat: 15.0102,
      lng: 74.0231,
      address: 'South Palolem Cliff Point, Canacona, Goa'
    },
    batteryLevel: 45,
    safetyStatus: 'SOS Active',
    lastSeenTime: '5 mins ago',
    digitalBandId: 'BAND-5512',
    pastSOSHistory: [
      {
        id: 'SOS-7110',
        date: '2026-07-28',
        location: 'Agonda Beach Cliff',
        reason: 'Water Tide Isolation Warning',
        status: 'Resolved'
      }
    ],
    tourist_id: '9d8c7b6a-5f4e-3d2c-1b0a-fe9d8c7b6a5f',
    digital_id: 'TR-12890',
    full_name: 'Kenji Takahashi',
    kyc_document_type: 'Passport',
    kyc_verified: true,
    email: 'kenji.takahashi@example.jp',
    emergency_contact: '+81 90 0011 2233',
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
    currentLocation: {
      lat: 30.1231,
      lng: 78.3211,
      address: 'Laxman Jhula North Bank, Rishikesh, Uttarakhand'
    },
    batteryLevel: 78,
    safetyStatus: 'Safe',
    lastSeenTime: '15 mins ago',
    digitalBandId: 'BAND-8840',
    pastSOSHistory: [],
    tourist_id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    digital_id: 'TR-55310',
    full_name: 'Priya Sharma',
    kyc_document_type: 'Aadhaar Card',
    kyc_verified: true,
    email: 'priya.sharma@example.in',
    emergency_contact: '+91 98123 45678',
    preferred_language: 'Hindi',
    created_at: '2026-08-05T16:10:00Z'
  }
];

export const INITIAL_INCIDENTS: SOSIncident[] = [
  {
    id: 'SOS-9021',
    touristId: 'TR-88219',
    touristName: 'Elena Rostova',
    touristPhone: '+34 612 884 902',
    location: {
      lat: 32.2432,
      lng: 77.1892,
      address: 'Solang Valley North Trail (Off-route 2.4 km)'
    },
    timestamp: '2026-08-12 08:10:12',
    status: 'New',
    severity: 'Critical',
    hazardType: 'Panic Beacon / Off-Route Isolation',
    notes: 'Panic button pressed continuously for 5s. Rapid heart-rate spike recorded by digital band.',
  },
  {
    id: 'SOS-9022',
    touristId: 'TR-12890',
    touristName: 'Kenji Takahashi',
    touristPhone: '+81 90 4432 1100',
    location: {
      lat: 15.0102,
      lng: 74.0231,
      address: 'South Palolem Cliff Point, Goa'
    },
    timestamp: '2026-08-12 07:55:00',
    status: 'Units Dispatched',
    severity: 'Critical',
    unitAssigned: 'PCR-GOA-08',
    hazardType: 'High Tide Cliff Isolation',
    notes: 'Coastal Patrol boat dispatched with life jackets.'
  },
  {
    id: 'SOS-9018',
    touristId: 'TR-44021',
    touristName: 'Marcus Vance',
    touristPhone: '+61 412 990 123',
    location: {
      lat: 25.3176,
      lng: 83.0062,
      address: 'Manikarnika Ghat Lane, Varanasi'
    },
    timestamp: '2026-08-12 06:30:15',
    status: 'Resolved',
    severity: 'Warning',
    unitAssigned: 'PCR-VAR-02',
    hazardType: 'Crowd Disorientation',
    notes: 'Tourist safely escorted back to hotel by Ghat Tourist Squad.'
  }
];

export const INITIAL_PATROL_UNITS: PatrollingUnit[] = [
  {
    id: 'PCR-KULLU-04',
    unitName: 'PCR Van - Himachal High Sector 04',
    type: 'PCR Van',
    unitLeader: 'SI Inspector Vikram Singh',
    location: {
      lat: 32.2390,
      lng: 77.1820,
      address: 'Solang Valley Checkpost'
    },
    status: 'Patrolling',
    contactPhone: '+91 94180 12345'
  },
  {
    id: 'PCR-GOA-08',
    unitName: 'Coastal Rescue Speedboat - Unit 8',
    type: 'Quick Response Motorcycle',
    unitLeader: 'Coast Guard Sub-Officer Rahul Naik',
    location: {
      lat: 15.0080,
      lng: 74.0210,
      address: 'Palolem Beach Patrol Bay'
    },
    status: 'Dispatched',
    contactPhone: '+91 98221 88990',
    assignedIncidentId: 'SOS-9022'
  },
  {
    id: 'WSS-DELHI-01',
    unitName: 'Pink Panther Women Safety Squad - CP',
    type: 'Women Safety Squad',
    unitLeader: 'Inspector Sunita Rani',
    location: {
      lat: 28.6320,
      lng: 77.2180,
      address: 'Connaught Place Outer Ring'
    },
    status: 'Patrolling',
    contactPhone: '+91 98100 55443'
  },
  {
    id: 'PCR-VAR-02',
    unitName: 'Ghat Quick Response Bike Team 2',
    type: 'Quick Response Motorcycle',
    unitLeader: 'Head Constable Ramesh Yadav',
    location: {
      lat: 25.3120,
      lng: 83.0080,
      address: 'Godowlia Crossing, Varanasi'
    },
    status: 'Standby',
    contactPhone: '+91 94500 11223'
  }
];

export const POLICE_STATIONS: PoliceStation[] = [
  {
    id: 'PS-MANALI-01',
    name: 'Manali Central Tourist Police Station',
    jurisdiction: 'Kullu Valley & Solang Pass',
    location: {
      lat: 32.2400,
      lng: 77.1850,
      address: 'Mall Road, Manali, Himachal Pradesh'
    },
    contactPhone: '01902-252326',
    activeOfficers: 34,
    availableVehicles: 8
  },
  {
    id: 'PS-VARANASI-01',
    name: 'Kotwali Tourist Helpdesk & Station',
    jurisdiction: 'Varanasi Ghats & Heritage Corridor',
    location: {
      lat: 25.3150,
      lng: 83.0040,
      address: 'Dashashwamedh Main Road, Varanasi'
    },
    contactPhone: '0542-2502220',
    activeOfficers: 42,
    availableVehicles: 12
  },
  {
    id: 'PS-DELHI-01',
    name: 'Connaught Place Police Station',
    jurisdiction: 'Central Delhi & Janpath Tourist Hub',
    location: {
      lat: 28.6300,
      lng: 77.2150,
      address: 'Parliament Street, Connaught Place, New Delhi'
    },
    contactPhone: '011-23361234',
    activeOfficers: 65,
    availableVehicles: 18
  },
  {
    id: 'PS-GOA-01',
    name: 'Canacona Coastal Police Station',
    jurisdiction: 'South Goa Beaches & Cliff Circuits',
    location: {
      lat: 15.0150,
      lng: 74.0200,
      address: 'Chaudi, Canacona, South Goa'
    },
    contactPhone: '0832-2643323',
    activeOfficers: 28,
    availableVehicles: 6
  }
];

export const HOSPITALS: Hospital[] = [
  {
    id: 'HOSP-MANALI-01',
    name: 'Manali Civil District Hospital & Trauma Center',
    jurisdiction: 'Mall Road Emergency Ward',
    location: {
      lat: 32.2380,
      lng: 77.1890,
      address: 'Mall Road, Manali, Himachal Pradesh'
    },
    contactPhone: '+91 1902 252222',
    icuBedsAvailable: 14,
    ambulancesReady: 4
  },
  {
    id: 'HOSP-KULLU-02',
    name: 'Kullu Regional Emergency Care Center',
    jurisdiction: 'Kullu Valley Medical Command',
    location: {
      lat: 31.9580,
      lng: 77.1090,
      address: 'Regional Hospital Campus, Kullu'
    },
    contactPhone: '+91 1902 222340',
    icuBedsAvailable: 22,
    ambulancesReady: 6
  },
  {
    id: 'HOSP-VARANASI-03',
    name: 'Heritage Super Specialty Hospital',
    jurisdiction: 'Varanasi Central Trauma Response',
    location: {
      lat: 25.3120,
      lng: 83.0080,
      address: 'Lanka Crossing, Varanasi'
    },
    contactPhone: '+91 542 2369999',
    icuBedsAvailable: 18,
    ambulancesReady: 5
  }
];

export const ANOMALY_CLUSTERS: AnomalyCluster[] = [
  {
    id: 'AC-101',
    regionName: 'Solang Valley North Trail (Kullu Sector)',
    riskScore: 88,
    touristDensity: 142,
    anomalyType: 'Off-Route Signal Loss',
    confidenceScore: 94,
    descriptionEn: 'AI detected 3 active tourist digital bands deviating >2km from marked trekking trail after dusk.',
    descriptionHi: 'एआई ने सूर्यास्त के बाद चिह्नित ट्रैकिंग ट्रेल से >2 किमी दूर भटक रहे 3 सक्रिय पर्यटक डिजिटल बैंड का पता लगाया।',
    recommendedActionEn: 'Deploy High Altitude PCR-04 van and send automated SMS advisory to registered trekking groups.',
    recommendedActionHi: 'हाई एल्टीट्यूड पीसीआर-04 वैन भेजें और पंजीकृत ट्रैकिंग समूहों को स्वचालित एसएमएस सलाह भेजें।',
    coordinates: { lat: 32.2432, lng: 77.1892 },
    timestamp: '2026-08-12 08:12:00'
  },
  {
    id: 'AC-102',
    regionName: 'Varanasi Ghat Narrow Alleyway Grid',
    riskScore: 72,
    touristDensity: 890,
    anomalyType: 'Unusual Grouping',
    confidenceScore: 89,
    descriptionEn: 'High density congestion detected near unlit alley #4. Slow movement and sudden drop in GPS precision.',
    descriptionHi: 'अप्रकाशित गली #4 के पास उच्च घनत्व वाली भीड़ का पता चला। धीमी गति और जीपीएस सटीकता में अचानक गिरावट।',
    recommendedActionEn: 'Dispatch Ghat Bike Team for crowd flow management and illuminate emergency LED arrays.',
    recommendedActionHi: 'भीड़ प्रवाह प्रबंधन के लिए घाट बाइक टीम भेजें और आपातकालीन एलईडी समूह चालू करें।',
    coordinates: { lat: 25.3176, lng: 83.0062 },
    timestamp: '2026-08-12 08:05:00'
  },
  {
    id: 'AC-103',
    regionName: 'Anjuna - Palolem Coastal Cliff Edge',
    riskScore: 81,
    touristDensity: 210,
    anomalyType: 'Hazard Zone Entry',
    confidenceScore: 91,
    descriptionEn: 'High tide alert active. 5 tourists located past danger warning barrier near tidal cliff.',
    descriptionHi: 'उच्च ज्वार की चेतावनी सक्रिय। ज्वारीय चट्टान के पास खतरे की चेतावनी बाधा के पार 5 पर्यटक स्थित हैं।',
    recommendedActionEn: 'Trigger geofenced audio warning beacon and broadcast SMS to coastal cell towers.',
    recommendedActionHi: 'जियोफेंस किए गए ऑडियो चेतावनी बीकन को ट्रिगर करें और तटीय सेल टावरों पर एसएमएस प्रसारित करें।',
    coordinates: { lat: 15.0102, lng: 74.0231 },
    timestamp: '2026-08-12 07:50:00'
  }
];

export const INITIAL_BROADCASTS: BroadcastAlert[] = [
  {
    id: 'BC-501',
    senderBadge: 'IPS-7742 (Rajesh Kumar)',
    region: 'Himachal Pradesh (Solang Valley & Rohtang Pass)',
    radiusKm: 15,
    titleEn: '⚠️ Flash Flood & Sudden Weather Warning',
    titleHi: '⚠️ अचानक बाढ़ और खराब मौसम की चेतावनी',
    bodyEn: 'Heavy rainfall and cloudburst alert in Solang Valley. Avoid unmapped riverbanks and return to main highway immediately.',
    bodyHi: 'सोलंग घाटी में भारी बारिश और बादल फटने का अलर्ट। बिना नक्शे वाले नदी तटों से दूर रहें और तुरंत मुख्य राजमार्ग पर लौटें।',
    severity: 'Critical',
    timestamp: '2026-08-12 07:30:00',
    recipientCount: 3420,
    deliveredCount: 3389,
    status: 'Completed'
  },
  {
    id: 'BC-502',
    senderBadge: 'IPS-7742 (Rajesh Kumar)',
    region: 'Varanasi Ghats Heritage Area',
    radiusKm: 3,
    titleEn: 'ℹ️ Ganga Aarti Crowd Diversion Advisory',
    titleHi: 'ℹ️ गंगा आरती भीड़ डायवर्जन सलाह',
    bodyEn: 'Dashashwamedh Ghat experiencing maximum capacity. Please use Rajghat or Assi Ghat for comfortable view.',
    bodyHi: 'दशाश्वमेध घाट अधिकतम क्षमता पर है। आरामदायक दर्शन के लिए कृपया राजघाट या अस्सी घाट का उपयोग करें।',
    severity: 'Advisory',
    timestamp: '2026-08-11 18:00:00',
    recipientCount: 12500,
    deliveredCount: 12410,
    status: 'Completed'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'AUD-9901',
    timestamp: '2026-08-12 08:14:02',
    officerName: 'Rajesh Kumar, IPS',
    officerBadge: 'IPS-7742',
    actionType: 'TOURIST_LOOKUP',
    targetId: 'TR-88219 (Elena Rostova)',
    reason: 'Active SOS Response',
    details: 'Accessed live GPS telemetry and emergency contact records during active panic beacon event SOS-9021.',
    ipAddress: '10.142.0.88 (NIC Secure Gateway)'
  },
  {
    id: 'AUD-9902',
    timestamp: '2026-08-12 07:56:10',
    officerName: 'Rajesh Kumar, IPS',
    officerBadge: 'IPS-7742',
    actionType: 'DISPATCH_UNIT',
    targetId: 'PCR-GOA-08',
    reason: 'Active SOS Response',
    details: 'Dispatched Coastal Rescue Speedboat to South Palolem Cliff Point for incident SOS-9022.',
    ipAddress: '10.142.0.88 (NIC Secure Gateway)'
  },
  {
    id: 'AUD-9903',
    timestamp: '2026-08-12 07:30:15',
    officerName: 'Rajesh Kumar, IPS',
    officerBadge: 'IPS-7742',
    actionType: 'BROADCAST_SENT',
    targetId: 'Geofence Solang (15km)',
    reason: 'Disaster Prevention Protocol',
    details: 'Pushed Critical Flash Flood warning SMS to 3,420 active tourist devices.',
    ipAddress: '10.142.0.88 (NIC Secure Gateway)'
  }
];

export const INITIAL_AI_LOGS: AILog[] = [
  {
    id: 'LOG-1',
    timestamp: '08:19:12',
    severity: 'critical',
    messageEn: 'AI Model Threat-Predictor v4.2 flagged rapid signal loss for TR-88219 near Solang Ravine. Anomaly confidence: 94%.',
    messageHi: 'एआई मॉडल खतरा-पूर्वानुमानकर्ता v4.2 ने सोलंग खड्ड के पास TR-88219 के लिए तेज सिग्नल हानि को चिह्नित किया। विसंगति विश्वसनीयता: 94%।',
    modelConfidence: 94,
    region: 'Solang Valley, HP'
  },
  {
    id: 'LOG-2',
    timestamp: '08:15:30',
    severity: 'warning',
    messageEn: 'Density threshold surpassed in Varanasi Sector 4 (+38% over average baseline). Recommended squad re-allocation.',
    messageHi: 'वाराणसी सेक्टर 4 में घनत्व सीमा पार हो गई (औसत आधार रेखा से +38% अधिक)। अनुशंसित दस्ता पुनरावंटन।',
    modelConfidence: 89,
    region: 'Varanasi, UP'
  },
  {
    id: 'LOG-3',
    timestamp: '08:02:44',
    severity: 'info',
    messageEn: 'Geofence heartbeats synced with 18,940 active tourist digital wristbands across major national circuits.',
    messageHi: 'प्रमुख राष्ट्रीय सर्किटों में 18,940 सक्रिय पर्यटक डिजिटल कलाई बैंड के साथ जियोफेंस धड़कनें सिंक की गईं।',
    modelConfidence: 99,
    region: 'National Network'
  }
];

export const MOCK_GEOFENCE_ZONES: GeoFenceZone[] = [
  {
    id: 'zone-1',
    name: 'Solang Riverbank & Avalanche Slope',
    riskLevel: 'Unsafe',
    description: 'High flash flood & avalanche hazard zone. Night movement prohibited after 17:00 IST.',
    center: { lat: 32.2432, lng: 77.1892 },
    radiusKm: 1.5
  },
  {
    id: 'zone-2',
    name: 'Hadimba Pine Forest Trek',
    riskLevel: 'Caution',
    description: 'Dense forest cover area. Stick to designated trails and maintain band connectivity.',
    center: { lat: 32.2480, lng: 77.1850 },
    radiusKm: 2.0
  },
  {
    id: 'zone-3',
    name: 'Manali Mall Road Safe Zone',
    riskLevel: 'Safe',
    description: 'Monitored safe tourist corridor with 24/7 Police Helpdesk & active PCR coverage.',
    center: { lat: 32.2396, lng: 77.1887 },
    radiusKm: 3.0
  }
];

