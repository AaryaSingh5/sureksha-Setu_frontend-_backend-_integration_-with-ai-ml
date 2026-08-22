# Offline-First SOS Implementation Guide

The SOS Panic Button functionality in the Suraksha Setu app has been successfully migrated from a UI mock to a robust, **offline-first** system. It now interacts with real browser APIs and a local database, ensuring reliable functionality even in areas with zero network connectivity (like remote mountain passes).

## How It Works (The User Flow)
1. **Trigger**: The user presses the SOS button in the Tourist Portal, starting a 5-second cancelable countdown.
2. **Location Acquisition**: When the countdown hits zero, the app attempts to fetch the live GPS coordinates using the browser's Geolocation API.
   - If the user is offline or the GPS is weak, it falls back to the *last known location* stored on the device.
3. **Offline Queuing (IndexedDB)**: The SOS alert is instantly saved to the device's local database (`IndexedDB`). This guarantees the data isn't lost if the network request fails.
4. **Backend Transmission**: 
   - If **online**, the app immediately sends the SOS payload to the server (`/api/v1/sos`).
   - If **offline**, the alert remains "Queued Offline". 
5. **Background Auto-Sync**: The app listens for the browser's `online` event. The moment the device regains cellular reception, the app automatically syncs all queued offline records to the authorities in the background.

---

## Where to Find the Code

The logic is modularized and located within the `/src` directory of the `suraksha-setu (2)` project.

### 1. `src/lib/location.ts`
**Purpose:** Handles robust GPS acquisition.
- `getLiveLocation()`: Requests live coordinates from `navigator.geolocation` and caches them locally.
- `getSOSLocation()`: The main entry point. Tries live GPS first, falls back to the IndexedDB cache, and defaults to "unavailable" if all else fails (ensuring the SOS dispatch is never blocked by a location error).

### 2. `src/lib/db.ts`
**Purpose:** Encapsulates the local device database (`IndexedDB`).
- Uses the database `smart_tourist_safety_sos` to maintain two stores:
  - `last_location`: Caches the tourist's most recent known coordinates.
  - `sos_queue`: Acts as an offline outbox for SOS alerts waiting to be transmitted.

### 3. `src/lib/api.ts`
**Purpose:** Manages server communication and synchronization.
- `submitSOSOnline()`: Formats the SOS record and sends a `POST` request to the backend.
- `syncQueuedSOS()`: Reads all pending records from the `sos_queue` and pushes them to the server. Updates the local status to `SYNCED` upon success.

### 4. `src/components/TouristPortal.tsx`
**Purpose:** The user interface integration point.
- **`handleExecuteSosSend()`**: Integrates the library functions. It fetches the location, saves the record to the offline queue, and attempts the online submission, updating the UI loading states respectively.
- **`useEffect` Hook (Online Listener)**: Contains `window.addEventListener('online', syncQueuedSOS)` to ensure automatic background recovery when the network reconnects.
