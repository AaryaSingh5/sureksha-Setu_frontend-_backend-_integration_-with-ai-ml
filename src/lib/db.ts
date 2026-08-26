export interface LocationData {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string;
  location_source?: string;
}

export interface SOSRecord {
  local_sos_id?: string;
  tourist_id?: string | null;
  tourist_name?: string | null;
  tourist_phone?: string | null;
  triggered_at?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  location_source?: string;
  description?: string;
  severity?: string;
  status?: string;
  server_sos_id?: string | null;
  server_incident_id?: string | null;
  synced_at?: string | null;

  // Bluetooth Mesh & Multi-Hop Relay Fields
  hop_count?: number;
  max_hops?: number;
  hop_path?: string[];
  origin_device_id?: string;
  is_relayed?: boolean;
  relay_timestamp?: string | null;
}

const DB_NAME = "smart_tourist_safety_sos";
const DB_VERSION = 1;
const STORE_LOCATION = "last_location";
const STORE_QUEUE = "sos_queue";

let dbInstance: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_LOCATION)) {
        db.createObjectStore(STORE_LOCATION, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: "local_sos_id" });
        queueStore.createIndex("status", "status", { unique: false });
        queueStore.createIndex("triggered_at", "triggered_at", { unique: false });
      }
    };

    request.onsuccess = (event: Event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event: Event) => {
      console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function saveLastKnownLocation(locationData: LocationData): Promise<any> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LOCATION, "readwrite");
    const store = tx.objectStore(STORE_LOCATION);
    const record = {
      id: "latest",
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      accuracy: locationData.accuracy || null,
      timestamp: locationData.timestamp || new Date().toISOString(),
    };
    const request = store.put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function getLastKnownLocation(): Promise<LocationData | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LOCATION, "readonly");
    const store = tx.objectStore(STORE_LOCATION);
    const request = store.get("latest");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function queueSOSRecord(sosRecord: SOSRecord): Promise<SOSRecord> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    const record: SOSRecord = {
      local_sos_id: sosRecord.local_sos_id || crypto.randomUUID(),
      tourist_id: sosRecord.tourist_id || null,
      triggered_at: sosRecord.triggered_at || new Date().toISOString(),
      latitude: sosRecord.latitude !== undefined ? sosRecord.latitude : null,
      longitude: sosRecord.longitude !== undefined ? sosRecord.longitude : null,
      accuracy: sosRecord.accuracy || null,
      location_source: sosRecord.location_source || "unavailable",
      description: sosRecord.description || "Offline Emergency SOS Alert",
      severity: sosRecord.severity || "HIGH",
      status: sosRecord.status || "QUEUED_OFFLINE",
      server_sos_id: sosRecord.server_sos_id || null,
      server_incident_id: sosRecord.server_incident_id || null,
      synced_at: sosRecord.synced_at || null,

      // Bluetooth Hop Fields
      hop_count: sosRecord.hop_count ?? 0,
      max_hops: sosRecord.max_hops ?? 5,
      hop_path: sosRecord.hop_path ? [...sosRecord.hop_path] : [],
      origin_device_id: sosRecord.origin_device_id || "ORIGIN_NODE",
      is_relayed: sosRecord.is_relayed || false,
      relay_timestamp: sosRecord.relay_timestamp || null,
    };
    const request = store.put(record);
    request.onsuccess = () => resolve(record as SOSRecord);
    request.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function getQueuedSOSRecords(): Promise<SOSRecord[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, "readonly");
    const store = tx.objectStore(STORE_QUEUE);
    const request = store.getAll();
    request.onsuccess = () => {
      const all: SOSRecord[] = request.result || [];
      const queued = all.filter(
        (r) => r.status === "QUEUED_OFFLINE" || r.status === "RELAYED_OFFLINE"
      );
      resolve(queued);
    };
    request.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function getSOSRecord(local_sos_id: string): Promise<SOSRecord | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, "readonly");
    const store = tx.objectStore(STORE_QUEUE);
    const request = store.get(local_sos_id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function updateSOSRecordStatus(
  local_sos_id: string,
  newStatus: string,
  serverData: Partial<SOSRecord> = {}
): Promise<SOSRecord> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    const getReq = store.get(local_sos_id);
    getReq.onsuccess = () => {
      const record = getReq.result as SOSRecord;
      if (!record) return reject(new Error("Record not found"));

      record.status = newStatus;
      if (serverData.server_sos_id) record.server_sos_id = serverData.server_sos_id;
      if (serverData.server_incident_id) record.server_incident_id = serverData.server_incident_id;
      if (serverData.hop_count !== undefined) record.hop_count = serverData.hop_count;
      if (serverData.hop_path) record.hop_path = serverData.hop_path;
      if (newStatus === "SYNCED") record.synced_at = new Date().toISOString();

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = (e) => reject((e.target as IDBRequest).error);
    };
    getReq.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}
