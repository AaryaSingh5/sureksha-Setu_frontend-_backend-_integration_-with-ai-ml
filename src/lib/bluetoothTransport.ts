/**
 * ==============================================================================
 * 🛡️ SURAKSHA SETU - REAL ANDROID BLE MULTI-HOP STORE-AND-FORWARD TRANSPORT
 * ==============================================================================
 * Enables offline SOS packets to hop across REAL Android Bluetooth Low Energy
 * (BLE Central & Peripheral) devices until reaching an internet-connected
 * gateway node that uploads the alert to the Suraksha Setu backend.
 *
 * Physical Live Demo Topology:
 *   Android Phone A (Tourist, Offline)
 *         │ REAL BLE
 *         ▼
 *   Android Phone B (Relay, Offline)
 *         │ REAL BLE
 *         ▼
 *   Laptop (Gateway, Online)
 *         │ HTTP
 *         ▼
 *   Suraksha Setu Backend & Police Command Center
 * ==============================================================================
 */

import { SOSRecord, queueSOSRecord, updateSOSRecordStatus, getQueuedSOSRecords, getSOSRecord } from "./db";
import { submitSOSOnline, checkBackendReachability } from "./api";

export const BLE_SURAKSHA_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
export const BLE_SURAKSHA_CHAR_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb";
export const DEFAULT_MAX_HOPS = 5;

const PROCESSED_IDS_KEY = "suraksha_ble_processed_sos_ids";
const DEVICE_ID_KEY = "suraksha_ble_device_id";
const DEVICE_ROLE_KEY = "suraksha_ble_device_role";

export type DeviceRole = "TOURIST" | "RELAY" | "GATEWAY" | "AUTO";

/**
 * Standard Bluetooth SOS Payload structure transmitted between hops.
 */
export interface BluetoothSOSPacket {
  protocol_version: "SURAKSHA_BLE_v1";
  packet_id: string;
  sos_id: string;
  tourist_id: string | null;
  tourist_name?: string | null;
  tourist_phone?: string | null;
  triggered_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  location_source: string;
  description: string;
  severity: string;
  hop_count: number;
  max_hops: number;
  hop_path: string[];
  origin_device_id: string;
  relay_timestamp: string;
  packet_type: "SOS_ALERT" | "DELIVERY_ACK";
}

/**
 * Standard interface for SOS transports.
 */
export interface SOSTransport {
  name: string;
  isAvailable(): boolean;
  send(record: SOSRecord): Promise<{ success: boolean; relayed: boolean; message?: string; targetDevice?: string }>;
}

// ----------------------------------------------------------------------
// Device ID, Role & Deduplication Cache
// ----------------------------------------------------------------------

export function getOrCreateDeviceId(): string {
  try {
    let devId = localStorage.getItem(DEVICE_ID_KEY);
    if (!devId) {
      devId = `DEV-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString(36).toUpperCase()}`;
      localStorage.setItem(DEVICE_ID_KEY, devId);
    }
    return devId;
  } catch {
    return `DEV-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}

export function getDeviceRole(): DeviceRole {
  try {
    return (localStorage.getItem(DEVICE_ROLE_KEY) as DeviceRole) || "AUTO";
  } catch {
    return "AUTO";
  }
}

export async function setDeviceRole(role: DeviceRole): Promise<void> {
  try {
    localStorage.setItem(DEVICE_ROLE_KEY, role);
    console.log(`[BLE-ROLE] Selected role: ${role}`);
    await syncNativeBleAdvertisingRole(role);
  } catch (e) {
    console.warn("Could not save device role:", e);
  }
}

export async function syncNativeBleAdvertisingRole(role?: DeviceRole): Promise<void> {
  const nativePlugin = getNativeBlePlugin();
  if (!nativePlugin) return;

  const currentRole = role || getDeviceRole();

  if (currentRole === "GATEWAY") {
    console.log(`[BLE-ROLE] Selected role: GATEWAY`);
    console.log(`[BLE-GATEWAY] Gateway role active`);
    try {
      await nativePlugin.stopContinuousScan();
    } catch (_) {}
    try {
      const res = await nativePlugin.startAdvertising();
      console.log(`[BLE-GATEWAY] GATT server started`);
      console.log(`[BLE-GATEWAY] Advertising started:`, res);
    } catch (err: any) {
      console.warn(`[BLE-GATEWAY] Advertising failed: ${err.message || err}`);
    }
  } else if (currentRole === "RELAY") {
    console.log(`[BLE-ROLE] Selected role: RELAY`);
    console.log(`[BLE-RELAY] Starting relay advertising`);
    try {
      const advRes = await nativePlugin.startAdvertising();
      console.log("[BLE-ADV] Advertising started successfully:", advRes);
    } catch (err: any) {
      console.warn(`[BLE-ADV] Advertising failed: ${err.message || err}`);
    }

    console.log(`[BLE-SCAN] Starting continuous RELAY scanner`);
    try {
      const scanRes = await nativePlugin.startContinuousScan();
      console.log("[BLE-SCAN] Continuous RELAY scanner started:", scanRes);
    } catch (scanErr: any) {
      console.warn(`[BLE-SCAN] Continuous scanner failed:`, scanErr);
    }
  } else if (currentRole === "AUTO") {
    console.log(`[BLE-ROLE] Selected role: AUTO`);
    try {
      await nativePlugin.stopContinuousScan();
    } catch (_) {}
    try {
      const res = await nativePlugin.startAdvertising();
      console.log("[BLE-ADV] Advertising started successfully:", res);
    } catch (err: any) {
      console.warn(`[BLE-ADV] Advertising failed: ${err.message || err}`);
    }
  } else if (currentRole === "TOURIST") {
    console.log("[BLE-ROLE] Selected role: TOURIST");
    console.log("[BLE-TOURIST] Tourist role active (Standby mode).");
    try {
      await nativePlugin.stopContinuousScan();
    } catch (_) {}
    try {
      await nativePlugin.stopAdvertising();
    } catch (err: any) {
      console.warn("Could not stop BLE advertising:", err);
    }
  }
}

export function getProcessedSOSIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PROCESSED_IDS_KEY);
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch (e) {
    console.warn("Could not read processed SOS ids:", e);
  }
  return new Set();
}

export function markSOSIdProcessed(sosId: string): void {
  try {
    const set = getProcessedSOSIds();
    set.add(sosId);
    // Keep max 300 IDs to prevent storage bloat
    const arr = Array.from(set).slice(-300);
    localStorage.setItem(PROCESSED_IDS_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn("Could not save processed SOS id:", e);
  }
}

export function isSOSAlreadyProcessed(sosId: string): boolean {
  const set = getProcessedSOSIds();
  return set.has(sosId);
}

// ----------------------------------------------------------------------
// Native Android BLE Plugin Wrapper & Status
// ----------------------------------------------------------------------

export function getNativeBlePlugin(): any {
  if (typeof window !== "undefined" && (window as any).Capacitor) {
    return (window as any).Capacitor.Plugins?.SurakshaBlePlugin || null;
  }
  return null;
}

export function isNativeAndroid(): boolean {
  if (typeof window !== "undefined" && (window as any).Capacitor) {
    return (window as any).Capacitor.isNativePlatform() || false;
  }
  return false;
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export async function checkBluetoothStatus(): Promise<{
  supported: boolean;
  enabled: boolean;
  isAdvertising: boolean;
  isScanning: boolean;
  hasPermissions: boolean;
  isNative: boolean;
  description: string;
}> {
  const nativePlugin = getNativeBlePlugin();

  if (nativePlugin) {
    try {
      const status = await nativePlugin.getBleStatus();
      return {
        supported: status.supported ?? true,
        enabled: status.enabled ?? false,
        isAdvertising: status.isAdvertising ?? false,
        isScanning: status.isScanning ?? false,
        hasPermissions: status.hasPermissions ?? false,
        isNative: true,
        description: status.enabled
          ? `Real Android BLE Active (Advertising: ${status.isAdvertising ? "ON" : "STANDBY"})`
          : "Bluetooth is disabled on Android device."
      };
    } catch (e: any) {
      console.warn("Native BLE status check error:", e);
    }
  }

  // Fallback for Desktop / Web Browser
  const webBleSupported = isWebBluetoothSupported();
  return {
    supported: webBleSupported,
    enabled: webBleSupported,
    isAdvertising: false,
    isScanning: false,
    hasPermissions: true,
    isNative: false,
    description: webBleSupported
      ? "Web Bluetooth GATT Client available (Gateway mode)."
      : "Standard browser sandbox: Real BLE requires Android app."
  };
}

export async function requestBluetoothPermissions(): Promise<boolean> {
  const nativePlugin = getNativeBlePlugin();
  if (nativePlugin) {
    try {
      const res = await nativePlugin.requestBlePermissions();
      return res.granted === true;
    } catch (err) {
      console.warn("Error requesting BLE permissions:", err);
      return false;
    }
  }
  return true;
}

// ----------------------------------------------------------------------
// Background BLE Mesh Store-and-Forward Listener
// ----------------------------------------------------------------------

let bleListenerInitialized = false;
let activeRelayCallback: ((packet: BluetoothSOSPacket, uploadedOnline: boolean) => void) | null = null;

export function initNativeBleServerIfApplicable(): void {
  const nativePlugin = getNativeBlePlugin();
  if (!nativePlugin) return;

  const role = getDeviceRole();
  // Relays and Gateways must advertise their BLE GATT server so senders can connect
  if (role === "RELAY" || role === "GATEWAY" || role === "AUTO") {
    nativePlugin
      .startAdvertising()
      .then((res: any) => {
        console.log("[SurakshaBLE] Native BLE Advertising started:", res);
      })
      .catch((err: any) => {
        console.warn("[SurakshaBLE] Could not auto-start BLE advertising:", err);
      });
  }
}

/**
 * Initializes the background listener for incoming real BLE SOS relays.
 */
export function initBluetoothMeshListener(
  onRelayReceived?: (packet: BluetoothSOSPacket, uploadedOnline: boolean) => void
): void {
  if (onRelayReceived) {
    activeRelayCallback = onRelayReceived;
  }
  if (bleListenerInitialized) return;
  bleListenerInitialized = true;

  const nativePlugin = getNativeBlePlugin();

  if (nativePlugin) {
    console.log("[SurakshaBLE] Registering native Android 'sosRelayPacketReceived' listener...");

    nativePlugin.addListener("sosRelayPacketReceived", async (packet: BluetoothSOSPacket) => {
      console.log(`[BLE-RECV] SOS packet received: #${packet?.sos_id} (Origin: ${packet?.origin_device_id || 'unknown'}, Current Hop: ${packet?.hop_count}/${packet?.max_hops})`, packet);
      if (!packet || packet.protocol_version !== "SURAKSHA_BLE_v1") return;

      const myDeviceId = getOrCreateDeviceId();

      // Handle delivery confirmation
      if (packet.packet_type === "DELIVERY_ACK") {
        console.log(`[BLE-RECV] Received delivery ACK for SOS ${packet.sos_id}`);
        markSOSIdProcessed(packet.sos_id);
        const local = await getSOSRecord(packet.sos_id);
        if (local && local.status !== "SYNCED") {
          await updateSOSRecordStatus(packet.sos_id, "SYNCED");
        }
        return;
      }

      // 1. Deduplication check: drop if already processed or already visited this device
      if (isSOSAlreadyProcessed(packet.sos_id) || packet.hop_path.includes(myDeviceId)) {
        console.log(`[BLE-RECV] Dropping duplicate or cyclic SOS packet: ${packet.sos_id}`);
        return;
      }

      // 2. TTL / Hop limit check
      if (packet.hop_count >= packet.max_hops) {
        console.warn(`[BLE-RECV] Dropping SOS ${packet.sos_id}: Hop limit reached (${packet.hop_count}/${packet.max_hops})`);
        return;
      }

      // Mark as processed locally
      markSOSIdProcessed(packet.sos_id);

      // 3. Store relayed record in local IndexedDB (Source of Truth)
      const nextHopCount = packet.hop_count + 1;
      const currentPath = Array.isArray(packet.hop_path) ? packet.hop_path : [];
      const updatedPath = currentPath.includes(myDeviceId) ? currentPath : [...currentPath, myDeviceId];

      const relayedRecord: SOSRecord = {
        local_sos_id: packet.sos_id,
        tourist_id: packet.tourist_id,
        tourist_name: packet.tourist_name || null,
        tourist_phone: packet.tourist_phone || null,
        triggered_at: packet.triggered_at,
        latitude: packet.latitude,
        longitude: packet.longitude,
        accuracy: packet.accuracy,
        location_source: `${packet.location_source} (Relayed Hop ${nextHopCount})`,
        description: packet.description,
        severity: packet.severity,
        status: "RELAYED_OFFLINE",
        hop_count: nextHopCount,
        max_hops: packet.max_hops,
        hop_path: updatedPath,
        origin_device_id: packet.origin_device_id,
        is_relayed: true,
        relay_timestamp: new Date().toISOString()
      };

      await queueSOSRecord(relayedRecord);
      console.log(`[BLE-RELAY] Forwarding packet: Stored relayed SOS into IndexedDB queue (Hop ${nextHopCount}/${packet.max_hops}).`);

      // 4. Check Internet Connectivity on this Receiving Node
      let uploaded = false;
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          console.log(`[BLE-BACKEND] Uploading SOS #${packet.sos_id} to backend...`);
          const serverRes = await submitSOSOnline(relayedRecord);
          console.log(`[BLE-BACKEND] Upload successful:`, serverRes);
          console.log(`[BLE-GATEWAY] SOS successfully forwarded to backend`);

          await updateSOSRecordStatus(packet.sos_id, "SYNCED", {
            server_sos_id: serverRes.sos_id || `RELAY-SRV-${Date.now()}`,
            server_incident_id: serverRes.incident_id || `RELAY-INC-${Date.now()}`
          });

          uploaded = true;
        } catch (uploadErr) {
          console.warn("[BLE-BACKEND] Upload failed on receiving node, will retry on next online sync:", uploadErr);
        }
      } else {
        console.log(`[BLE-GATEWAY] Node is offline. Queued SOS #${packet.sos_id} for next BLE hop / gateway upload.`);
      }

      if (activeRelayCallback) {
        activeRelayCallback(packet, uploaded);
      } else if (onRelayReceived) {
        onRelayReceived(packet, uploaded);
      }
    });

    // Start BLE peripheral advertising on load
    initNativeBleServerIfApplicable();
  }
}

// ----------------------------------------------------------------------
// Transport Implementations
// ----------------------------------------------------------------------

/**
 * 1. Direct Internet Transport (HTTP/REST)
 */
export class InternetTransport implements SOSTransport {
  name = "InternetTransport";

  isAvailable(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine;
  }

  async send(record: SOSRecord): Promise<{ success: boolean; relayed: boolean; message?: string }> {
    if (!this.isAvailable()) {
      return { success: false, relayed: false, message: "Device is offline" };
    }
    const res = await submitSOSOnline(record);
    if (record.local_sos_id) {
      markSOSIdProcessed(record.local_sos_id);
    }
    return { success: true, relayed: false, message: res.message || "Delivered via Internet" };
  }
}

/**
 * 2. REAL Android Bluetooth Low Energy Multi-Hop Transport
 */
export class BluetoothTransport implements SOSTransport {
  name = "BluetoothTransport";

  isAvailable(): boolean {
    return true;
  }

  /**
   * Transmits the SOS record over physical Android BLE GATT connection.
   */
  async send(record: SOSRecord): Promise<{ success: boolean; relayed: boolean; message?: string; targetDevice?: string }> {
    const myDeviceId = getOrCreateDeviceId();
    const currentHop = record.hop_count ?? 0;
    const maxHops = record.max_hops ?? DEFAULT_MAX_HOPS;

    if (currentHop >= maxHops) {
      console.warn(`[BluetoothTransport] Hop limit reached (${currentHop}/${maxHops}). Will not forward.`);
      return { success: false, relayed: false, message: "Hop limit reached" };
    }

    const nextHop = currentHop + 1;
    const existingPath = Array.isArray(record.hop_path) ? record.hop_path : [];
    const updatedPath = existingPath.includes(myDeviceId) ? existingPath : [...existingPath, myDeviceId];

    const packet: BluetoothSOSPacket = {
      protocol_version: "SURAKSHA_BLE_v1",
      packet_id: `BLE-PKT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sos_id: record.local_sos_id || crypto.randomUUID(),
      tourist_id: record.tourist_id || null,
      tourist_name: record.tourist_name || null,
      tourist_phone: record.tourist_phone || null,
      triggered_at: record.triggered_at || new Date().toISOString(),
      latitude: record.latitude ?? null,
      longitude: record.longitude ?? null,
      accuracy: record.accuracy ?? null,
      location_source: record.location_source || "offline_gps",
      description: record.description || "Emergency SOS Alert",
      severity: record.severity || "HIGH",
      hop_count: nextHop,
      max_hops: maxHops,
      hop_path: updatedPath,
      origin_device_id: record.origin_device_id || myDeviceId,
      relay_timestamp: new Date().toISOString(),
      packet_type: "SOS_ALERT"
    };

    // Mark as processed locally so origin does not re-process
    markSOSIdProcessed(packet.sos_id);

    // Update local record hop state
    if (record.local_sos_id) {
      await updateSOSRecordStatus(record.local_sos_id, record.status || "QUEUED_OFFLINE", {
        hop_count: nextHop,
        hop_path: updatedPath
      });
    }

    // 1. Native Android BLE Transmission (Central Mode Scan & Connect)
    const nativePlugin = getNativeBlePlugin();
    if (nativePlugin) {
      try {
        console.log(`[BLE-TOURIST] Sending SOS packet to nearby Gateway over BLE...`);
        const res = await nativePlugin.transmitBlePacket({ packet });
        if (res && res.success) {
          console.log(`[BLE-SOS-SEND] SOS transmission completed: Sent to ${res.targetDevice || "Gateway"}`);
          return {
            success: true,
            relayed: true,
            targetDevice: res.targetDevice,
            message: `Transmitted via real BLE to ${res.targetDevice || "Gateway Node"} (Hop ${nextHop}/${maxHops})`
          };
        } else {
          console.warn(`[BLE-SCAN] No Gateway found in range: ${res?.message || "No response"}`);
          return {
            success: false,
            relayed: false,
            message: res?.message || "No nearby Suraksha Setu BLE Gateway nodes found in range."
          };
        }
      } catch (nativeErr: any) {
        console.warn(`[BLE-TOURIST] BLE transmission failed: ${nativeErr.message}`);
        return {
          success: false,
          relayed: false,
          message: nativeErr.message || "BLE transmission failed"
        };
      }
    }

    // 2. Web Bluetooth GATT client (for Laptop demo)
    if (isWebBluetoothSupported()) {
      try {
        console.log("[BluetoothTransport] Laptop Web Bluetooth: Scanning for nearby Suraksha BLE SOS Service...");
        const device = await (navigator as any).bluetooth.requestDevice({
          filters: [{ services: [BLE_SURAKSHA_SERVICE_UUID] }]
        });

        if (!device.gatt) throw new Error("Device does not support GATT.");
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(BLE_SURAKSHA_SERVICE_UUID);
        const characteristic = await service.getCharacteristic(BLE_SURAKSHA_CHAR_UUID);

        const packetJson = JSON.stringify(packet);
        const encoder = new TextEncoder();
        await characteristic.writeValue(encoder.encode(packetJson));
        console.log(`[BLE-SOS-SEND] Packet sent successfully over Web Bluetooth GATT to ${device.name || device.id}`);

        return {
          success: true,
          relayed: true,
          message: `Connected via Web BLE to ${device.name || "Android Node"} & forwarded SOS.`
        };
      } catch (err: any) {
        console.warn("[BLE] Web Bluetooth notice:", err);
        return { success: false, relayed: false, message: err.message || "Web BLE connection cancelled" };
      }
    }

    return {
      success: false,
      relayed: false,
      message: "Real Android BLE or Web Bluetooth required for wireless hopping."
    };
  }
}

// ----------------------------------------------------------------------
// Unified SOS Router (Store-and-Forward Coordinator)
// ----------------------------------------------------------------------

export class SOSRouter {
  private internet = new InternetTransport();
  private bluetooth = new BluetoothTransport();

  constructor() {
    initBluetoothMeshListener();
  }

  /**
   * Routes an SOS record:
   * 1. If online -> uploads directly to backend
   * 2. If offline -> transmits over REAL Android BLE to nearby relay/gateway nodes
   */
  async routeSOS(record: SOSRecord): Promise<{
    transportUsed: "INTERNET" | "BLUETOOTH";
    status: string;
    hopCount: number;
    maxHops: number;
    details: string;
  }> {
    console.log(`[BLE-TOURIST] SOS pressed (ID: #${record.local_sos_id})`);
    console.log("[BLE-TOURIST] Checking connectivity...");
    const hopCount = record.hop_count ?? 0;
    const maxHops = record.max_hops ?? DEFAULT_MAX_HOPS;

    // 1. Actively test backend reachability with a strict 2s timeout rather than relying on unreliable navigator.onLine
    const isOnlineAndReachable = await checkBackendReachability(2000);

    if (isOnlineAndReachable) {
      console.log("[BLE-TOURIST] Backend reachable! Attempting direct upload...");
      try {
        const result = await this.internet.send(record);
        if (result.success) {
          console.log("[BLE-TOURIST] Direct internet upload succeeded.");
          if (record.local_sos_id) {
            await updateSOSRecordStatus(record.local_sos_id, "SYNCED");
          }
          return {
            transportUsed: "INTERNET",
            status: "DELIVERED_ONLINE",
            hopCount,
            maxHops,
            details: "Directly delivered to Suraksha Setu Command Center via Internet."
          };
        }
      } catch (netErr: any) {
        console.warn(`[BLE-TOURIST] Direct upload failed: ${netErr.message}`);
      }
    }

    // 2. Reachability failed or offline -> Immediately trigger BLE fallback
    console.log("[BLE-TOURIST] Internet unavailable, falling back to BLE");
    console.log("[BLE-TOURIST] Starting BLE scan");
    const bleResult = await this.bluetooth.send(record);

    return {
      transportUsed: "BLUETOOTH",
      status: "RELAYING_BLUETOOTH",
      hopCount: (record.hop_count ?? 0) + 1,
      maxHops,
      details: bleResult.message || "Stored in IndexedDB & broadcasting over Android BLE."
    };
  }

  /**
   * Forwards all queued & relayed offline SOS records across transports.
   */
  async processAllPendingTransports(): Promise<{ onlineSynced: number; bleRelayed: number }> {
    const records = await getQueuedSOSRecords();
    let onlineSynced = 0;
    let bleRelayed = 0;

    for (const rec of records) {
      if (rec.status === "SYNCED") continue;

      if (this.internet.isAvailable()) {
        try {
          await this.internet.send(rec);
          if (rec.local_sos_id) {
            await updateSOSRecordStatus(rec.local_sos_id, "SYNCED");
          }
          onlineSynced++;
        } catch (err) {
          console.warn("[SOSRouter] Failed to sync record online:", err);
        }
      } else {
        try {
          await this.bluetooth.send(rec);
          bleRelayed++;
        } catch (err) {
          console.warn("[SOSRouter] Failed to relay record via BLE:", err);
        }
      }
    }

    return { onlineSynced, bleRelayed };
  }
}

export const globalSOSRouter = new SOSRouter();
