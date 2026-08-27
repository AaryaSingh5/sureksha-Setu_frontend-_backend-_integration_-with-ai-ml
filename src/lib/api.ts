import { Capacitor } from "@capacitor/core";
import { SOSRecord, getQueuedSOSRecords, updateSOSRecordStatus } from "./db";
import {
  BACKEND_PORT,
  RISK_ENGINE_PORT,
  DEFAULT_NATIVE_API_BASE_URL,
  DEFAULT_NATIVE_RISK_ENGINE_BASE_URL,
  DEFAULT_RISK_ENGINE_BASE_URL
} from "../config";
import {
  TouristProfile,
  SOSIncident,
  PatrollingUnit,
  PoliceStation,
  Hospital,
  AnomalyCluster,
  BroadcastAlert,
  AuditLog,
  AILog
} from "../types";

let isSyncing = false;

/**
 * Returns the active API base URL following the strict priority order:
 * (a) Runtime localStorage override ('sos_api_base_url') if explicitly set
 * (b) Native platform detection (Capacitor Android/iOS) -> DEFAULT_NATIVE_API_BASE_URL (http://10.0.96.233:8080/api/v1)
 * (c) Genuinely a desktop/laptop web browser (not native app) -> http://${window.location.hostname}:8080/api/v1
 * (d) Fallback -> DEFAULT_NATIVE_API_BASE_URL
 */
export function getApiBaseUrl(): string {
  // Robust native platform detection
  const isNative =
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.())) ||
    (typeof window !== 'undefined' && (window as any).Capacitor?.platform === 'android');

  const detectedPlatform = typeof Capacitor.getPlatform === 'function' ? Capacitor.getPlatform() : 'unknown';
  console.log(`[API-BASE-URL] Detection: isNativePlatform=${isNative}, platform=${detectedPlatform}`);

  // (a) LocalStorage override takes highest priority if explicitly set
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem('sos_api_base_url');
    if (custom && custom.trim()) {
      console.log(`[API-BASE-URL] Using localStorage override: ${custom.trim()}`);
      return custom.trim();
    }
  }

  // (b) Native Android/iOS App check MUST take priority BEFORE hostname check
  // (because Capacitor on Android serves from origin http://localhost/ causing hostname to be "localhost")
  if (isNative) {
    console.log(`[API-BASE-URL] Native Android App detected -> Using LAN target: ${DEFAULT_NATIVE_API_BASE_URL}`);
    return DEFAULT_NATIVE_API_BASE_URL;
  }

  // (c) Genuinely a web browser (laptop/desktop Authority Dashboard)
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const browserUrl = `http://${window.location.hostname}:${BACKEND_PORT}/api/v1`;
    console.log(`[API-BASE-URL] Web Browser detected -> Using hostname target: ${browserUrl}`);
    return browserUrl;
  }

  return DEFAULT_NATIVE_API_BASE_URL;
}

/**
 * Helper to set or remove a runtime custom API base URL in localStorage.
 * Allows switching backend IP on a physical phone without rebuilding the APK.
 */
export function setCustomApiBaseUrl(url?: string): void {
  if (typeof localStorage !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('sos_api_base_url', url.trim());
    } else {
      localStorage.removeItem('sos_api_base_url');
    }
  }
}
export function getAuthToken(): string {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem("sos_auth_token") || "";
  }
  return "";
}

export function getTouristId(): string {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem("sos_tourist_id") || "eee6684b-dee5-4471-bfd0-00b9a7ee9b66";
  }
  return "eee6684b-dee5-4471-bfd0-00b9a7ee9b66";
}

/**
 * Actively checks whether the backend health endpoint is reachable with a strict bounded timeout.
 */
export async function checkBackendReachability(timeoutMs = 2000): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store"
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch (e) {
    clearTimeout(timeoutId);
    return false;
  }
}

// ----------------------------------------------------
// Master Data Fetchers
// ----------------------------------------------------

export async function fetchInitialData(): Promise<{
  tourists?: TouristProfile[];
  incidents?: SOSIncident[];
  units?: PatrollingUnit[];
  stations?: PoliceStation[];
  hospitals?: Hospital[];
  clusters?: AnomalyCluster[];
  broadcasts?: BroadcastAlert[];
  auditLogs?: AuditLog[];
  aiLogs?: AILog[];
}> {
  const baseUrl = getApiBaseUrl();
  try {
    const [
      touristsRes,
      incidentsRes,
      unitsRes,
      stationsRes,
      hospitalsRes,
      clustersRes,
      broadcastsRes,
      auditLogsRes,
      aiLogsRes
    ] = await Promise.all([
      fetch(`${baseUrl}/tourists`).catch(() => null),
      fetch(`${baseUrl}/sos`).catch(() => null),
      fetch(`${baseUrl}/units`).catch(() => null),
      fetch(`${baseUrl}/stations`).catch(() => null),
      fetch(`${baseUrl}/hospitals`).catch(() => null),
      fetch(`${baseUrl}/clusters`).catch(() => null),
      fetch(`${baseUrl}/broadcasts`).catch(() => null),
      fetch(`${baseUrl}/audit-logs`).catch(() => null),
      fetch(`${baseUrl}/ai-logs`).catch(() => null)
    ]);

    const result: any = {};
    if (touristsRes?.ok) result.tourists = await touristsRes.json();
    if (incidentsRes?.ok) result.incidents = await incidentsRes.json();
    if (unitsRes?.ok) result.units = await unitsRes.json();
    if (stationsRes?.ok) result.stations = await stationsRes.json();
    if (hospitalsRes?.ok) result.hospitals = await hospitalsRes.json();
    if (clustersRes?.ok) result.clusters = await clustersRes.json();
    if (broadcastsRes?.ok) result.broadcasts = await broadcastsRes.json();
    if (auditLogsRes?.ok) result.auditLogs = await auditLogsRes.json();
    if (aiLogsRes?.ok) result.aiLogs = await aiLogsRes.json();

    return result;
  } catch (err) {
    console.warn("Failed to fetch initial backend data, using local state fallback:", err);
    return {};
  }
}

// ----------------------------------------------------
// Authentication API
// ----------------------------------------------------

export async function loginAuthorityAPI(username: string, password?: string): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) throw new Error(`Login failed with status ${res.status}`);
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("sos_auth_token", data.access_token);
  }
  return data;
}

// ----------------------------------------------------
// SOS & Emergency Operations
// ----------------------------------------------------

export async function submitSOSOnline(sosRecord: SOSRecord): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const token = getAuthToken();
  const touristId = sosRecord.tourist_id || getTouristId();

  const payload = {
    tourist_id: touristId,
    tourist_name: sosRecord.tourist_name || undefined,
    tourist_phone: sosRecord.tourist_phone || undefined,
    latitude: sosRecord.latitude !== undefined ? sosRecord.latitude : null,
    longitude: sosRecord.longitude !== undefined ? sosRecord.longitude : null,
    description: sosRecord.description || `SOS Emergency Alert (${sosRecord.location_source || "live"})`,
    severity: sosRecord.severity || "HIGH",
    trigger_source: sosRecord.is_relayed ? "BLE_MESH_RELAY" : "APP",
    client_generated_id: sosRecord.local_sos_id,
    hop_count: sosRecord.hop_count ?? 0,
    max_hops: sosRecord.max_hops ?? 5,
    hop_path: sosRecord.hop_path || [],
    origin_device_id: sosRecord.origin_device_id
  };

  console.log(`[SOS] Network upload attempted: ${baseUrl}/sos for SOS #${sosRecord.local_sos_id || 'new'}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 4000); // 4-second bounded timeout

  try {
    const response = await fetch(`${baseUrl}/sos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    console.log(`[SOS] Network upload succeeded: Incident #${data.incident_id || data.sos_id}`);
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn(`[SOS] Network timeout/failure: HTTP request to ${baseUrl}/sos timed out after 4000ms`);
      throw new Error(`Network timeout (4s exceeded) reaching ${baseUrl}/sos`);
    }
    console.warn(`[SOS] Network timeout/failure: ${err.message}`);
    throw err;
  }
}

export async function syncQueuedSOS(
  onProgressCallback?: (status: string, record: SOSRecord, serverRes?: any) => void
): Promise<{ count: number; synced: number; error?: string }> {
  if (isSyncing) {
    return { count: 0, synced: 0 };
  }

  // Actively test if backend is reachable before attempting sync to avoid noisy failed fetch logs
  const isReachable = await checkBackendReachability(1500);
  if (!isReachable) {
    return { count: 0, synced: 0, error: "Offline" };
  }

  isSyncing = true;
  let syncedCount = 0;
  let queuedRecords: SOSRecord[] = [];

  try {
    queuedRecords = await getQueuedSOSRecords();
    console.log(`Found ${queuedRecords.length} queued offline SOS records to synchronize.`);

    for (const record of queuedRecords) {
      if (record.status === "SYNCED") continue;

      try {
        if (record.local_sos_id) {
          await updateSOSRecordStatus(record.local_sos_id, "SYNCING");
        }

        if (onProgressCallback) onProgressCallback("SYNCING", record);

        const serverResponse = await submitSOSOnline(record);
        console.log("Successfully synchronized SOS record:", serverResponse);

        if (record.local_sos_id) {
          await updateSOSRecordStatus(record.local_sos_id, "SYNCED", {
            server_sos_id: serverResponse.sos_id || `MOCK-${Date.now()}`,
            server_incident_id: serverResponse.incident_id || `MOCK-INC-${Date.now()}`
          });
        }

        syncedCount++;
        if (onProgressCallback) onProgressCallback("SYNCED", record, serverResponse);
      } catch (err: any) {
        console.error(`Failed to synchronize SOS record ${record.local_sos_id}:`, err);
        if (record.local_sos_id) {
          await updateSOSRecordStatus(record.local_sos_id, record.is_relayed ? "RELAYED_OFFLINE" : "QUEUED_OFFLINE");
        }
        if (onProgressCallback) onProgressCallback("FAILED", record, err);
      }
    }
  } catch (e) {
    console.error("Error during synchronization process:", e);
  } finally {
    isSyncing = false;
  }

  return { count: queuedRecords.length, synced: syncedCount };
}

export async function dispatchUnitAPI(incidentId: string, unitId: string): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/sos/${incidentId}/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unitId })
  });
  if (!res.ok) throw new Error(`Dispatch failed with status ${res.status}`);
  return await res.json();
}

export async function resolveIncidentAPI(incidentId: string): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/sos/${incidentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Resolved" })
  });
  if (!res.ok) throw new Error(`Resolve failed with status ${res.status}`);
  return await res.json();
}

// ----------------------------------------------------
// Tourist API Operations
// ----------------------------------------------------

export async function createTouristAPI(tourist: TouristProfile): Promise<TouristProfile> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/tourists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tourist)
  });
  if (!res.ok) throw new Error(`Failed to create tourist (${res.status})`);
  return await res.json();
}

export async function updateTouristAPI(id: string, updates: Partial<TouristProfile>): Promise<TouristProfile> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/tourists/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error(`Failed to update tourist (${res.status})`);
  return await res.json();
}

// ----------------------------------------------------
// Broadcast & Audit Log APIs
// ----------------------------------------------------

export async function sendBroadcastAPI(broadcast: Omit<BroadcastAlert, 'id' | 'timestamp' | 'deliveredCount' | 'status'>): Promise<BroadcastAlert> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/broadcasts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(broadcast)
  });
  if (!res.ok) throw new Error(`Failed to send broadcast (${res.status})`);
  return await res.json();
}

export async function createAuditLogAPI(log: Partial<AuditLog>): Promise<AuditLog> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/audit-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(log)
  });
  if (!res.ok) throw new Error(`Failed to create audit log (${res.status})`);
  return await res.json();
}

export async function verifyAuditChainAPI(): Promise<{
  valid: boolean;
  brokenAtLogId?: string;
  message?: string;
  totalEntries?: number;
  latestHash?: string;
}> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/audit-logs/verify`);
  if (!res.ok) throw new Error(`Failed to verify audit chain: ${res.status}`);
  return await res.json();
}

// ----------------------------------------------------
// Python Risk Scoring & Anomaly Detection Engine APIs
// ----------------------------------------------------

export function getRiskEngineBaseUrl(): string {
  // Robust native platform detection
  const isNative =
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.())) ||
    (typeof window !== 'undefined' && (window as any).Capacitor?.platform === 'android');

  // (a) LocalStorage override takes highest priority if explicitly set
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem('sos_risk_engine_url');
    if (custom && custom.trim()) {
      return custom.trim();
    }
  }

  // (b) Native platform check MUST take priority BEFORE hostname check
  if (isNative) {
    return DEFAULT_NATIVE_RISK_ENGINE_BASE_URL;
  }

  // (c) Genuinely a desktop/laptop web browser (Authority Dashboard)
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:${RISK_ENGINE_PORT}`;
  }

  return DEFAULT_RISK_ENGINE_BASE_URL;
}

export function setCustomRiskEngineBaseUrl(url?: string): void {
  if (typeof localStorage !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('sos_risk_engine_url', url.trim());
    } else {
      localStorage.removeItem('sos_risk_engine_url');
    }
  }
}
export async function sendLocationPingAPI(ping: {
  tourist_id: string;
  latitude: number;
  longitude: number;
  speed?: number;
  battery_level?: number;
  connectivity_status?: string;
  dwell_time?: number;
  sos_triggered_override?: boolean;
}): Promise<any> {
  const baseUrl = getRiskEngineBaseUrl();
  const res = await fetch(`${baseUrl}/tourist/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ping)
  });
  if (!res.ok) throw new Error(`Risk engine ping failed with status ${res.status}`);
  return await res.json();
}

export async function fetchRiskAlertsAPI(filters?: { status?: string; priority?: string; band?: string }): Promise<any[]> {
  const baseUrl = getRiskEngineBaseUrl();
  let url = `${baseUrl}/alerts`;
  if (filters) {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.priority) params.append("priority", filters.priority);
    if (filters.band) params.append("band", filters.band);
    url += `?${params.toString()}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch risk alerts: ${res.status}`);
  return await res.json();
}

export async function submitAlertFeedbackAPI(alertId: string, feedbackType: "false_positive" | "confirmed"): Promise<any> {
  const baseUrl = getRiskEngineBaseUrl();
  const res = await fetch(`${baseUrl}/alerts/${alertId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback_type: feedbackType })
  });
  if (!res.ok) throw new Error(`Feedback submission failed: ${res.status}`);
  return await res.json();
}

export async function fetchModelMetadataAPI(): Promise<any> {
  const baseUrl = getRiskEngineBaseUrl();
  const res = await fetch(`${baseUrl}/model/metadata`);
  if (!res.ok) throw new Error(`Failed to fetch model metadata: ${res.status}`);
  return await res.json();
}

// ----------------------------------------------------
// Live Geofence Data (Himachal Pradesh zones from risk_engine)
// ----------------------------------------------------

export interface LiveGeofenceZoneRaw {
  id: string;
  name: string;
  tier: 'restricted' | 'caution' | 'safe';
  description: string;
  polygon: [number, number][]; // array of [lat, lon] pairs, closed ring
}

export interface LiveGeofencesResponse {
  restricted_zones: LiveGeofenceZoneRaw[];
  caution_zones: LiveGeofenceZoneRaw[];
  safe_zones: LiveGeofenceZoneRaw[];
}

/**
 * Fetches the live Himachal Pradesh geofence zones from the risk engine
 * (risk_engine/regional_context.py, exposed via GET /offline/geofences).
 * Throws on failure — callers should catch this and fall back to
 * MOCK_GEOFENCE_ZONES so the map still renders if the Python service
 * isn't running (e.g. during a demo where only the frontend is up).
 */
export async function fetchLiveGeofencesAPI(): Promise<LiveGeofencesResponse> {
  const baseUrl = getRiskEngineBaseUrl();
  const res = await fetch(`${baseUrl}/offline/geofences`);
  if (!res.ok) throw new Error(`Failed to fetch live geofences: ${res.status}`);
  return await res.json();
}

// ----------------------------------------------------
// Blockchain-style Digital ID & Audit Trail
// (risk_engine/identity/ — chain.py, did_service.py, audit_service.py)
// ----------------------------------------------------

export interface DigitalIdRecord {
  tourist_id: string;
  did: string;
  kyc_hash: string;
  issued_at: string;
  valid_until: string;
  is_active: boolean;
}

export interface ChainBlock {
  block_index: number;
  timestamp: string;
  data: Record<string, any> | { raw_data: string };
  previous_hash: string;
  hash: string;
}

export interface ChainVerification {
  is_valid: boolean;
  blocks_count: number;
  verification_message: string;
}

/** Issues a new blockchain-anchored digital ID for a tourist. */
export async function issueDigitalIdAPI(
  touristId: string,
  kycHash: string,
  validUntil: string
): Promise<DigitalIdRecord> {
  const baseUrl = getRiskEngineBaseUrl();
  const res = await fetch(`${baseUrl}/identity/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tourist_id: touristId,
      kyc_hash: kycHash,
      valid_until: validUntil
    })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to issue digital ID: ${res.status}`);
  }
  const json = await res.json();
  return json.data as DigitalIdRecord;
}

/**
 * Verifies a tourist's digital ID. Returns null (not an error) if no DID has
 * been issued yet for this tourist_id — this is an expected, common state,
 * not a failure.
 */
export async function verifyDigitalIdAPI(touristId: string): Promise<DigitalIdRecord | null> {
  const baseUrl = getRiskEngineBaseUrl();
  const res = await fetch(`${baseUrl}/identity/verify/${encodeURIComponent(touristId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to verify digital ID: ${res.status}`);
  }
  const json = await res.json();
  return json.data as DigitalIdRecord;
}

/** Fetches the full hash-linked audit chain (all issued IDs + logged incidents). */
export async function fetchChainAPI(): Promise<ChainBlock[]> {
  const baseUrl = getRiskEngineBaseUrl();
  const res = await fetch(`${baseUrl}/identity/chain`);
  if (!res.ok) throw new Error(`Failed to fetch chain: ${res.status}`);
  const json = await res.json();
  return json.data as ChainBlock[];
}

/** Verifies chain integrity (confirms no block has been tampered with). */
export async function verifyChainIntegrityAPI(): Promise<ChainVerification> {
  const baseUrl = getRiskEngineBaseUrl();
  const res = await fetch(`${baseUrl}/identity/chain/verify`);
  if (!res.ok) throw new Error(`Failed to verify chain integrity: ${res.status}`);
  const json = await res.json();
  return json.data as ChainVerification;
}

// Aliases matching the names used in ModuleAnalyticsAudit.tsx's blockchain
// ledger explorer tab — same underlying implementation, kept as separate
// exported names so both call sites work without needing to agree on one
// naming convention.
export const fetchAuditChainAPI = fetchChainAPI;
export const verifyAuditBlockchainAPI = verifyChainIntegrityAPI;

export async function accessTelemetryAPI(
  touristId: string,
  mandatoryReason: string,
  caseReference: string,
  officerName: string,
  officerBadge: string
): Promise<{ tourist: TouristProfile; auditEntry: AuditLog }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/tourists/${touristId}/telemetry-access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mandatoryReason, caseReference, officerName, officerBadge })
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to log secure access (${res.status})`);
  }
  return await res.json();
}

