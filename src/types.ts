export type Language = 'en' | 'hi';

export type UserRole = 'gateway' | 'tourist' | 'authority';

export type ActiveModule = 'ai_hub' | 'tourist_tracking' | 'sos_map' | 'broadcast' | 'analytics_audit';

export type InterceptionReason =
  | 'Active SOS Response'
  | 'Filed Missing Person Report'
  | 'Designated Check-in Routine'
  | 'Judicial / Legal Warrant';

export type SOSStatus = 'New' | 'Units Dispatched' | 'Resolved';

export type AlertSeverity = 'Critical' | 'Warning' | 'Advisory';

export type AnomalyType =
  | 'Unusual Grouping'
  | 'Off-Route Signal Loss'
  | 'Rapid Density Spike'
  | 'Late-Night Isolated Signal'
  | 'Hazard Zone Entry';

export interface LocationPoint {
  lat: number;
  lng: number;
  address: string;
}

export interface PastSOSRecord {
  id: string;
  date: string;
  location: string;
  reason: string;
  status: 'Resolved' | 'False Alarm';
}

export interface TouristProfile {
  id: string; // e.g. TR-88219 or TR-2026-8942
  name: string;
  nationality: string;
  passportHash: string;
  photoUrl: string;
  phone: string;
  emergencyContact: string;
  emergencyRelation: string;
  hotel: string;
  currentLocation: LocationPoint;
  batteryLevel: number;
  safetyStatus: 'Safe' | 'Watch' | 'SOS Active';
  lastSeenTime: string;
  digitalBandId: string;
  pastSOSHistory: PastSOSRecord[];
  email?: string;
  digiLockerVerified?: boolean;
  aadhaarHash?: string;
  locationConsent?: 'granted' | 'declined';

  // Schema fields as per DB spec
  tourist_id?: string;
  digital_id?: string;
  full_name?: string;
  kyc_document_type?: string;
  kyc_verified?: boolean;
  emergency_contact?: string;
  preferred_language?: string;
  created_at?: string;
}

export interface SOSIncident {
  id: string; // e.g. SOS-9021
  touristId: string;
  touristName: string;
  touristPhone: string;
  location: LocationPoint;
  timestamp: string;
  status: SOSStatus;
  severity: AlertSeverity;
  unitAssigned?: string;
  hazardType: string;
  notes: string;
  audioRecordingUrl?: string;
}

export interface PatrollingUnit {
  id: string;
  unitName: string;
  type: 'PCR Van' | 'Quick Response Motorcycle' | 'Women Safety Squad' | 'Highway Patrol';
  unitLeader: string;
  location: LocationPoint;
  status: 'Patrolling' | 'Dispatched' | 'On Scene' | 'Standby';
  contactPhone: string;
  assignedIncidentId?: string;
}

export interface PoliceStation {
  id: string;
  name: string;
  jurisdiction: string;
  location: LocationPoint;
  contactPhone: string;
  activeOfficers: number;
  availableVehicles: number;
}

export interface Hospital {
  id: string;
  name: string;
  jurisdiction: string;
  location: LocationPoint;
  contactPhone: string;
  icuBedsAvailable: number;
  ambulancesReady: number;
}

export interface AnomalyCluster {
  id: string;
  regionName: string;
  riskScore: number; // 0 - 100
  touristDensity: number;
  anomalyType: AnomalyType;
  confidenceScore: number; // %
  descriptionEn: string;
  descriptionHi: string;
  recommendedActionEn: string;
  recommendedActionHi: string;
  coordinates: { lat: number; lng: number };
  timestamp: string;
}

export interface BroadcastAlert {
  id: string;
  senderBadge: string;
  region: string;
  radiusKm: number;
  titleEn: string;
  titleHi: string;
  bodyEn: string;
  bodyHi: string;
  severity: AlertSeverity;
  timestamp: string;
  recipientCount: number;
  deliveredCount: number;
  status: 'Active' | 'Completed' | 'Draft';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  officerName: string;
  officerBadge: string;
  actionType: 'TOURIST_LOOKUP' | 'DISPATCH_UNIT' | 'BROADCAST_SENT' | 'TICKET_STATUS_CHANGE' | 'AUTHORITY_LOGIN';
  targetId: string;
  reason?: InterceptionReason | string;
  details: string;
  ipAddress: string;
  prevHash?: string | null;
  entryHash?: string;
}

export interface AILog {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  messageEn: string;
  messageHi: string;
  modelConfidence: number;
  region: string;
}

export interface ItineraryItem {
  id: string;
  destination: string;
  date: string;
  hotel: string;
  activities: string;
  safetyStatus: 'Safe Corridor' | 'Weather Advisory' | 'High Risk Zone';
  coordinates?: { lat: number; lng: number };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  quickActions?: string[];
}

export type GeoFenceRiskLevel = 'Safe' | 'Caution' | 'Unsafe';

export interface GeoFenceZone {
  id: string;
  name: string;
  riskLevel: GeoFenceRiskLevel;
  description: string;
  center: { lat: number; lng: number };
  radiusKm: number;
}

export type SosStepState = 'ready' | 'confirming' | 'sending' | 'success' | 'error' | 'active';

