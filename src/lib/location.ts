import { saveLastKnownLocation, getLastKnownLocation, LocationData } from "./db";

export async function getLiveLocation(
  options = { timeout: 6000, maxAge: 0, enableHighAccuracy: true }
): Promise<LocationData> {
  if (!navigator.geolocation) {
    throw new Error("Geolocation API not supported by browser");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const locData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString(),
          location_source: "live",
        };

        try {
          await saveLastKnownLocation(locData);
        } catch (err) {
          console.warn("Could not save last known location to IndexedDB:", err);
        }

        resolve(locData);
      },
      (error) => {
        reject(error);
      },
      options
    );
  });
}

export async function getSOSLocation(): Promise<LocationData> {
  try {
    console.log("Attempting live GPS location acquisition...");
    const liveLoc = await getLiveLocation();
    console.log("Live GPS acquired:", liveLoc);
    return liveLoc;
  } catch (gpsError: any) {
    console.warn("Live GPS unavailable or timed out:", gpsError.message || gpsError);

    try {
      const lastKnown = await getLastKnownLocation();
      if (lastKnown && lastKnown.latitude && lastKnown.longitude) {
        console.log("Using last-known location from IndexedDB:", lastKnown);
        return {
          latitude: lastKnown.latitude,
          longitude: lastKnown.longitude,
          accuracy: lastKnown.accuracy || null,
          timestamp: lastKnown.timestamp,
          location_source: "last_known",
        };
      }
    } catch (dbError) {
      console.warn("Could not read last-known location from IndexedDB:", dbError);
    }

    console.log("No GPS or last-known location available. Proceeding with 'unavailable'.");
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      timestamp: new Date().toISOString(),
      location_source: "unavailable",
    };
  }
}
