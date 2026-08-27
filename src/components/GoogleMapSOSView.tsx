import React, { useState, useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  MapPin,
  Navigation,
  Radio,
  Building2,
  HeartPulse,
  ShieldAlert,
  Clock,
  ExternalLink,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Compass,
  AlertTriangle,
  Locate,
  Route,
  X
} from 'lucide-react';
import { SOSIncident, PatrollingUnit, PoliceStation, Hospital } from '../types';
import { GOOGLE_MAPS_API_KEY, COMMAND_CENTER_HQ_COORDS } from '../config';

interface GoogleMapSOSViewProps {
  incidents: SOSIncident[];
  units: PatrollingUnit[];
  stations: PoliceStation[];
  hospitals: Hospital[];
  selectedIncident: SOSIncident | null;
  onSelectIncident: (incident: SOSIncident | null) => void;
  showSosLayer: boolean;
  showRespondersLayer: boolean;
  showStationsLayer: boolean;
  showHospitalsLayer: boolean;
  showHeatmapLayer: boolean;
  height?: string;
}

export interface RouteInfo {
  distanceText: string;
  durationText: string;
  distanceMeters: number;
  durationSeconds: number;
  originName: string;
  destName: string;
}

// Calculate approximate straight-line / mountain driving estimate for fallback
function computeFallbackRouteEstimate(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { distanceText: string; durationText: string } {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;
  // Mountain terrain winding road factor ~ 1.45x
  const roadKm = straightKm * 1.45;
  // Average mountain response vehicle speed ~ 35 km/h
  const minutes = Math.max(2, Math.round((roadKm / 35) * 60));

  return {
    distanceText: `${roadKm.toFixed(1)} km`,
    durationText: `${minutes} mins`
  };
}

/**
 * Sub-component that manages DirectionsService & DirectionsRenderer inside @vis.gl/react-google-maps
 */
const DirectionsRouteLayer: React.FC<{
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  onRouteCalculated: (info: RouteInfo) => void;
  originLabel: string;
  destLabel: string;
}> = ({ origin, destination, onRouteCalculated, originLabel, destLabel }) => {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!routesLibrary || !map) return;
    const ds = new routesLibrary.DirectionsService();
    const dr = new routesLibrary.DirectionsRenderer({
      map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#DC2626', // High-visibility red emergency route
        strokeWeight: 6,
        strokeOpacity: 0.9
      }
    });
    setDirectionsService(ds);
    setDirectionsRenderer(dr);

    return () => {
      dr.setMap(null);
    };
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer) return;

    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRenderer.setDirections(result);
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            onRouteCalculated({
              distanceText: leg.distance?.text || '',
              durationText: leg.duration?.text || '',
              distanceMeters: leg.distance?.value || 0,
              durationSeconds: leg.duration?.value || 0,
              originName: originLabel,
              destName: destLabel
            });
          }
        } else {
          console.warn('[MAP-DIRECTIONS] Directions request returned status:', status);
          const fallback = computeFallbackRouteEstimate(origin.lat, origin.lng, destination.lat, destination.lng);
          onRouteCalculated({
            distanceText: fallback.distanceText,
            durationText: fallback.durationText,
            distanceMeters: 0,
            durationSeconds: 0,
            originName: originLabel,
            destName: destLabel
          });
        }
      }
    );
  }, [directionsService, directionsRenderer, origin.lat, origin.lng, destination.lat, destination.lng, originLabel, destLabel]);

  return null;
};

export const GoogleMapSOSView: React.FC<GoogleMapSOSViewProps> = ({
  incidents,
  units,
  stations,
  hospitals,
  selectedIncident,
  onSelectIncident,
  showSosLayer,
  showRespondersLayer,
  showStationsLayer,
  showHospitalsLayer,
  showHeatmapLayer,
  height = '460px'
}) => {
  // Officer current location state
  const [officerLocation, setOfficerLocation] = useState<{
    lat: number;
    lng: number;
    isLiveGps: boolean;
    name: string;
  }>({
    lat: COMMAND_CENTER_HQ_COORDS.lat,
    lng: COMMAND_CENTER_HQ_COORDS.lng,
    isLiveGps: false,
    name: COMMAND_CENTER_HQ_COORDS.name
  });

  const [activeInfoWindow, setActiveInfoWindow] = useState<{
    type: 'sos' | 'unit' | 'station' | 'hospital';
    item: any;
  } | null>(null);

  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [mapMode, setMapMode] = useState<'m' | 'k' | 'p'>('m'); // m: roadmap, k: satellite, p: terrain
  const [currentZoom, setCurrentZoom] = useState<number>(12);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Check if API key is provided and valid
  const hasValidKey =
    Boolean(GOOGLE_MAPS_API_KEY) &&
    GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY' &&
    GOOGLE_MAPS_API_KEY.length > 10;

  // Acquire officer location via Geolocation API on mount
  const locateOfficer = () => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOfficerLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            isLiveGps: true,
            name: `Officer Live GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`
          });
          setIsLocating(false);
          console.log('[OFFICER-GPS] Acquired live coordinates:', pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('[OFFICER-GPS] Geolocation error or permission denied. Using Command HQ fallback.', err.message);
          setOfficerLocation({
            lat: COMMAND_CENTER_HQ_COORDS.lat,
            lng: COMMAND_CENTER_HQ_COORDS.lng,
            isLiveGps: false,
            name: COMMAND_CENTER_HQ_COORDS.name
          });
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    }
  };

  useEffect(() => {
    locateOfficer();
  }, []);

  // Update fallback route info when selected incident changes
  useEffect(() => {
    if (selectedIncident && selectedIncident.location) {
      const destLat = selectedIncident.location.lat;
      const destLng = selectedIncident.location.lng;
      const fallback = computeFallbackRouteEstimate(officerLocation.lat, officerLocation.lng, destLat, destLng);
      setRouteInfo({
        distanceText: fallback.distanceText,
        durationText: fallback.durationText,
        distanceMeters: 0,
        durationSeconds: 0,
        originName: officerLocation.name,
        destName: selectedIncident.touristName || selectedIncident.id
      });
    } else {
      setRouteInfo(null);
    }
  }, [selectedIncident, officerLocation]);

  // Construct external Google Maps Directions link for vehicle navigation
  const getExternalNavUrl = () => {
    if (!selectedIncident?.location) return 'https://maps.google.com';
    const saddr = `${officerLocation.lat},${officerLocation.lng}`;
    const daddr = `${selectedIncident.location.lat},${selectedIncident.location.lng}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(saddr)}&destination=${encodeURIComponent(daddr)}`;
  };

  // Center coordinate: follow selected incident or officer location or default Manali
  const mapCenter = selectedIncident?.location
    ? { lat: selectedIncident.location.lat, lng: selectedIncident.location.lng }
    : { lat: officerLocation.lat, lng: officerLocation.lng };

  return (
    <div className="space-y-3">
      {/* MAP VIEW CONTAINER */}
      <div
        className="relative w-full rounded-2xl overflow-hidden border-2 border-slate-300 shadow-lg bg-slate-900 transition-all"
        style={{ height, minHeight: '440px' }}
      >
        {/* ========================================================= */}
        {/* 1. REAL GOOGLE MAPS JS API (when API key is provided)     */}
        {/* ========================================================= */}
        {hasValidKey ? (
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
            <Map
              defaultCenter={mapCenter}
              defaultZoom={currentZoom}
              mapId="SURAKSHA_SETU_COMMAND_MAP"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Driving Directions Layer */}
              {selectedIncident && selectedIncident.location && (
                <DirectionsRouteLayer
                  origin={{ lat: officerLocation.lat, lng: officerLocation.lng }}
                  destination={{ lat: selectedIncident.location.lat, lng: selectedIncident.location.lng }}
                  onRouteCalculated={(info) => setRouteInfo(info)}
                  originLabel={officerLocation.name}
                  destLabel={selectedIncident.touristName || selectedIncident.id}
                />
              )}

              {/* Officer Current Location Marker */}
              <AdvancedMarker
                position={{ lat: officerLocation.lat, lng: officerLocation.lng }}
                onClick={() => setActiveInfoWindow({ type: 'unit', item: { unitName: officerLocation.name, type: 'Command Post' } })}
              >
                <div className="relative flex items-center justify-center">
                  <span className="w-8 h-8 rounded-full bg-blue-500/40 animate-ping absolute"></span>
                  <div className="w-9 h-9 rounded-full bg-blue-600 border-2 border-white text-white flex items-center justify-center shadow-2xl font-bold">
                    <Compass className="w-5 h-5 text-white animate-spin-slow" />
                  </div>
                </div>
              </AdvancedMarker>

              {/* Active SOS Beacons Layer */}
              {showSosLayer &&
                incidents.map((inc) => {
                  const isSelected = selectedIncident?.id === inc.id;
                  const isResolved = inc.status === 'Resolved';
                  const lat = inc.location?.lat ?? 32.2432;
                  const lng = inc.location?.lng ?? 77.1892;

                  return (
                    <AdvancedMarker
                      key={inc.id}
                      position={{ lat, lng }}
                      onClick={() => {
                        onSelectIncident(inc);
                        setActiveInfoWindow({ type: 'sos', item: inc });
                      }}
                    >
                      <div className="relative flex items-center justify-center cursor-pointer group">
                        {!isResolved && (
                          <span className="w-10 h-10 rounded-full bg-red-600/40 border border-red-500 animate-ping absolute"></span>
                        )}
                        <div
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-2xl transition-transform ${
                            isSelected
                              ? 'bg-red-600 border-white scale-125 z-30 ring-4 ring-red-400'
                              : isResolved
                              ? 'bg-[#2F4538] border-emerald-300 text-white'
                              : 'bg-red-600 border-amber-300 text-white group-hover:scale-110'
                          }`}
                        >
                          <ShieldAlert className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </AdvancedMarker>
                  );
                })}

              {/* Patrolling Units Layer */}
              {showRespondersLayer &&
                units.map((u) => {
                  const lat = u.location?.lat ?? 32.24;
                  const lng = u.location?.lng ?? 77.19;

                  return (
                    <AdvancedMarker
                      key={u.id}
                      position={{ lat, lng }}
                      onClick={() => setActiveInfoWindow({ type: 'unit', item: u })}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#1B2A4A] border-2 border-blue-400 text-white flex items-center justify-center shadow-lg hover:scale-110 transition cursor-pointer">
                        <Radio className="w-4 h-4 text-amber-300" />
                      </div>
                    </AdvancedMarker>
                  );
                })}

              {/* Police Stations Layer */}
              {showStationsLayer &&
                stations.map((st) => {
                  const lat = st.location?.lat ?? 32.24;
                  const lng = st.location?.lng ?? 77.19;

                  return (
                    <AdvancedMarker
                      key={st.id}
                      position={{ lat, lng }}
                      onClick={() => setActiveInfoWindow({ type: 'station', item: st })}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#2F4538] border-2 border-emerald-300 text-white flex items-center justify-center shadow-lg hover:scale-110 transition cursor-pointer">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                    </AdvancedMarker>
                  );
                })}

              {/* Hospitals Layer */}
              {showHospitalsLayer &&
                hospitals.map((hosp) => {
                  const lat = hosp.location?.lat ?? 32.24;
                  const lng = hosp.location?.lng ?? 77.19;

                  return (
                    <AdvancedMarker
                      key={hosp.id}
                      position={{ lat, lng }}
                      onClick={() => setActiveInfoWindow({ type: 'hospital', item: hosp })}
                    >
                      <div className="w-8 h-8 rounded-lg bg-rose-600 border-2 border-rose-200 text-white flex items-center justify-center shadow-lg hover:scale-110 transition cursor-pointer">
                        <HeartPulse className="w-4 h-4 text-white" />
                      </div>
                    </AdvancedMarker>
                  );
                })}

              {/* InfoWindow Popup on Marker Click */}
              {activeInfoWindow && (
                <InfoWindow
                  position={{
                    lat: activeInfoWindow.item.location?.lat || officerLocation.lat,
                    lng: activeInfoWindow.item.location?.lng || officerLocation.lng
                  }}
                  onCloseClick={() => setActiveInfoWindow(null)}
                >
                  <div className="p-2 text-slate-900 text-xs max-w-xs space-y-1">
                    {activeInfoWindow.type === 'sos' && (
                      <>
                        <div className="font-extrabold text-red-700 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>{activeInfoWindow.item.id}: {activeInfoWindow.item.touristName}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">
                          {activeInfoWindow.item.hazardType} • Status: <strong>{activeInfoWindow.item.status}</strong>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Coords: {activeInfoWindow.item.location?.lat?.toFixed(4)}, {activeInfoWindow.item.location?.lng?.toFixed(4)}
                        </div>
                        <button
                          onClick={() => {
                            onSelectIncident(activeInfoWindow.item);
                            setActiveInfoWindow(null);
                          }}
                          className="mt-2 w-full py-1 bg-red-600 text-white font-bold rounded text-[10px] flex items-center justify-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Show Driving Route</span>
                        </button>
                      </>
                    )}
                    {activeInfoWindow.type === 'unit' && (
                      <>
                        <div className="font-extrabold text-blue-900 flex items-center gap-1">
                          <Radio className="w-3.5 h-3.5" />
                          <span>{activeInfoWindow.item.unitName}</span>
                        </div>
                        <div className="text-[10px] text-slate-600">
                          Leader: {activeInfoWindow.item.unitLeader} • Status: {activeInfoWindow.item.status}
                        </div>
                        <div className="text-[10px] text-slate-500">📞 {activeInfoWindow.item.contactPhone}</div>
                      </>
                    )}
                    {activeInfoWindow.type === 'station' && (
                      <>
                        <div className="font-extrabold text-emerald-900 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{activeInfoWindow.item.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-600">
                          👮 {activeInfoWindow.item.activeOfficers} Officers • 🚓 {activeInfoWindow.item.availableVehicles} Vehicles
                        </div>
                        <div className="text-[10px] text-slate-500">📞 {activeInfoWindow.item.contactPhone}</div>
                      </>
                    )}
                    {activeInfoWindow.type === 'hospital' && (
                      <>
                        <div className="font-extrabold text-rose-900 flex items-center gap-1">
                          <HeartPulse className="w-3.5 h-3.5" />
                          <span>{activeInfoWindow.item.name}</span>
                        </div>
                        <div className="text-[10px] text-rose-700">
                          🚑 {activeInfoWindow.item.ambulancesReady} Ambulances • 🏥 {activeInfoWindow.item.icuBedsAvailable} ICU Beds
                        </div>
                        <div className="text-[10px] text-slate-500">📞 {activeInfoWindow.item.contactPhone}</div>
                      </>
                    )}
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        ) : (
          /* ========================================================= */
          /* 2. DYNAMIC GOOGLE MAPS EMBED LAYER (Fallback/Direct)       */
          /* ========================================================= */
          (() => {
            let embedSrc = '';
            if (selectedIncident?.location) {
              const saddr = `${officerLocation.lat},${officerLocation.lng}`;
              const daddr = `${selectedIncident.location.lat},${selectedIncident.location.lng}`;
              embedSrc = `https://maps.google.com/maps?saddr=${encodeURIComponent(saddr)}&daddr=${encodeURIComponent(daddr)}&t=${mapMode}&z=${currentZoom}&output=embed`;
            } else {
              const coords = `${officerLocation.lat},${officerLocation.lng}`;
              embedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(coords)}&t=${mapMode}&z=${currentZoom}&ie=UTF8&iwloc=&output=embed`;
            }

            return (
              <iframe
                key={embedSrc}
                title="Google Maps Tactical View"
                src={embedSrc}
                className="w-full h-full border-0 filter contrast-105"
                loading="lazy"
                allowFullScreen
              />
            );
          })()
        )}

        {/* AI Threat Heatmap Visual Overlay Layer */}
        {showHeatmapLayer && (
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute top-1/4 left-1/3 w-48 h-48 rounded-full bg-red-500/20 blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full bg-amber-500/20 blur-3xl"></div>
          </div>
        )}

        {/* TOP MAP CONTROLS OVERLAY */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none gap-2">
          {/* Active Status Badge */}
          <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 shadow-md text-white text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="truncate max-w-[180px] sm:max-w-[320px]">
              {selectedIncident
                ? `Route: ${officerLocation.isLiveGps ? 'Officer GPS' : 'Command HQ'} ➔ ${selectedIncident.touristName || selectedIncident.id}`
                : `Kullu-Manali Pilot Corridor • Sat-Link NavIC Active`}
            </span>
          </div>

          {/* Quick Actions & GPS Control */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            {/* Locate Me / GPS Refresh Button */}
            <button
              onClick={locateOfficer}
              disabled={isLocating}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition border ${
                officerLocation.isLiveGps
                  ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
              }`}
              title="Acquire live officer GPS coordinates"
            >
              <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isLocating ? 'Locating...' : officerLocation.isLiveGps ? 'GPS Active' : 'Locate Me'}
              </span>
            </button>

            {/* Clear Route Button */}
            {selectedIncident && (
              <button
                onClick={() => {
                  onSelectIncident(null);
                  setRouteInfo(null);
                }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold shadow transition"
                title="Clear route selection"
              >
                <X className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline">Clear Route</span>
              </button>
            )}

            {/* Open in Google Maps External Navigation */}
            {selectedIncident && (
              <a
                href={getExternalNavUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs shadow border border-red-400 transition"
                title="Open in Google Maps for vehicle turn-by-turn navigation"
              >
                <span>Navigate</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DRIVING ROUTE & DISPATCH HUD BAR                          */}
      {/* ========================================================= */}
      {selectedIncident && routeInfo && (
        <div className="p-4 bg-gradient-to-r from-red-950/90 via-slate-900/95 to-slate-900 rounded-2xl border-2 border-red-500/80 text-white shadow-xl flex flex-wrap items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-600/30 border border-red-500 flex items-center justify-center text-red-400 shadow-inner flex-shrink-0">
              <Navigation className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-extrabold text-red-400">
                  Driving Dispatch Route Active
                </span>
                <span className="px-2 py-0.5 rounded bg-red-500/30 border border-red-400/50 text-[10px] font-mono font-bold text-red-200">
                  {selectedIncident.id}
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-white mt-0.5">
                {routeInfo.originName} ➔ {selectedIncident.touristName || 'Citizen'} ({selectedIncident.location?.address || 'Sector Corridor'})
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-slate-800/90 px-3 py-2 rounded-xl border border-slate-700 text-center min-w-[90px]">
              <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Est. Distance</span>
              <span className="text-sm font-black text-amber-400">{routeInfo.distanceText}</span>
            </div>
            <div className="bg-slate-800/90 px-3 py-2 rounded-xl border border-slate-700 text-center min-w-[90px]">
              <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Est. Drive Time</span>
              <span className="text-sm font-black text-emerald-400">{routeInfo.durationText}</span>
            </div>
            <a
              href={getExternalNavUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl shadow-lg transition flex items-center gap-1.5 font-sans"
            >
              <span>Launch Turn-by-Turn</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
