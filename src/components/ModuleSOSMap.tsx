import React, { useState } from 'react';
import {
  MapPin,
  ShieldAlert,
  Radio,
  Building2,
  HeartPulse,
  Flame,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  Send,
  Check,
  User,
  PhoneCall,
  Navigation,
  ExternalLink
} from 'lucide-react';
import {
  Language,
  SOSIncident,
  PatrollingUnit,
  PoliceStation,
  Hospital,
  SOSStatus
} from '../types';
import { i18n } from '../data/i18n';
import { HOSPITALS } from '../data/mockData';
import { GoogleMapSOSView } from './GoogleMapSOSView';

interface ModuleSOSMapProps {
  language: Language;
  incidents: SOSIncident[];
  units: PatrollingUnit[];
  stations: PoliceStation[];
  hospitals?: Hospital[];
  onDispatchUnit: (incidentId: string, unitId: string) => void;
  onResolveIncident: (incidentId: string) => void;
  onAddMockSos: () => void;
}

function formatTicketTime(timestamp?: string): string {
  if (!timestamp) return 'Just now';
  try {
    if (timestamp.includes(' ')) {
      return timestamp.split(' ')[1] || timestamp;
    }
    if (timestamp.includes('T')) {
      return timestamp.split('T')[1]?.substring(0, 8) || timestamp;
    }
    return timestamp;
  } catch {
    return 'Active';
  }
}

export const ModuleSOSMap: React.FC<ModuleSOSMapProps> = ({
  language,
  incidents,
  units,
  stations,
  hospitals = HOSPITALS,
  onDispatchUnit,
  onResolveIncident,
  onAddMockSos
}) => {
  const t = i18n[language];

  // Layer toggles
  const [showSosLayer, setShowSosLayer] = useState(true);
  const [showRespondersLayer, setShowRespondersLayer] = useState(true);
  const [showStationsLayer, setShowStationsLayer] = useState(true);
  const [showHospitalsLayer, setShowHospitalsLayer] = useState(true);
  const [showHeatmapLayer, setShowHeatmapLayer] = useState(true);

  const [selectedIncident, setSelectedIncident] = useState<SOSIncident | null>(incidents[0] || null);

  const newTickets = incidents.filter((i) => i.status === 'New');
  const dispatchedTickets = incidents.filter((i) => i.status === 'Units Dispatched');
  const resolvedTickets = incidents.filter((i) => i.status === 'Resolved');

  return (
    <div className="space-y-6">

      {/* GIS LIVE INTERACTIVE GOOGLE MAP CANVAS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-[#E8935C]" />
            <h3 className="text-base font-bold text-slate-900">
              {t.gisMapTitle}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#2F4538] font-bold hidden sm:inline">
              Grid IN-901 • Sat-Link: IRNSS NavIC Active
            </span>
            <button
              onClick={onAddMockSos}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Simulate Live Panic Signal</span>
            </button>
          </div>
        </div>

        {/* Interactive Google Map with Route Directions */}
        <GoogleMapSOSView
          incidents={incidents}
          units={units}
          stations={stations}
          hospitals={hospitals}
          selectedIncident={selectedIncident}
          onSelectIncident={(inc) => setSelectedIncident(inc)}
          showSosLayer={showSosLayer}
          showRespondersLayer={showRespondersLayer}
          showStationsLayer={showStationsLayer}
          showHospitalsLayer={showHospitalsLayer}
          showHeatmapLayer={showHeatmapLayer}
          height="460px"
        />
      </div>

      {/* INCIDENT LIFECYCLE KANBAN TICKETING SYSTEM */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-5">
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-[#E8935C]" />
            <h3 className="text-base font-bold text-slate-900">
              {t.kanbanTitle}
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-bold">
            Total Active Tickets: {incidents.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* COLUMN 1: NEW SOS ALERTS */}
          <div className="bg-red-50/60 border border-red-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-red-200 pb-2">
              <span className="font-extrabold text-xs uppercase text-red-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                {t.kanbanNew}
              </span>
              <span className="px-2 py-0.5 rounded bg-red-200 text-red-900 text-xs font-mono font-extrabold">
                {newTickets.length}
              </span>
            </div>

            {newTickets.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-medium">
                No unassigned SOS alerts.
              </div>
            ) : (
              newTickets.map((ticket) => {
                const isSelected = selectedIncident?.id === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedIncident(ticket)}
                    className={`p-3.5 bg-white rounded-xl space-y-2 shadow-sm cursor-pointer transition border-2 ${
                      isSelected
                        ? 'border-red-600 ring-2 ring-red-400 shadow-md'
                        : 'border-red-200 hover:border-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-red-700">{ticket.id}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{formatTicketTime(ticket.timestamp)}</span>
                    </div>

                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                      <span>{ticket.touristName || 'Tourist'}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIncident(ticket);
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        <Navigation className="w-3 h-3 text-red-600" />
                        <span>Show Route</span>
                      </button>
                    </div>
                    <div className="text-xs text-slate-600">{ticket.location?.address || 'Solang Valley Sector'}</div>

                    <div className="text-[11px] p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 font-medium">
                      ⚠️ {ticket.notes || 'Emergency distress signal'}
                    </div>

                    <div className="pt-2 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] font-extrabold text-slate-600 uppercase">Dispatch Responding PCR:</span>
                      <select
                        onChange={(e) => e.target.value && onDispatchUnit(ticket.id, e.target.value)}
                        defaultValue=""
                        className="w-full text-xs p-1.5 rounded bg-slate-50 border border-slate-300 text-slate-900 focus:ring-1 focus:ring-red-500 font-medium"
                      >
                        <option value="" disabled>Select Unit...</option>
                        <option value="Medical">Medical</option>
                        <option value="Police">Police</option>
                        <option value="Patrolling Unit">Patrolling Unit</option>
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* COLUMN 2: UNITS DISPATCHED */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <span className="font-extrabold text-xs uppercase text-amber-900 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-700" />
                {t.kanbanDispatched}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-xs font-mono font-extrabold">
                {dispatchedTickets.length}
              </span>
            </div>

            {dispatchedTickets.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-medium">
                No active dispatches in transit.
              </div>
            ) : (
              dispatchedTickets.map((ticket) => {
                const isSelected = selectedIncident?.id === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedIncident(ticket)}
                    className={`p-3.5 bg-white rounded-xl space-y-2 shadow-sm cursor-pointer transition border-2 ${
                      isSelected
                        ? 'border-amber-600 ring-2 ring-amber-400 shadow-md'
                        : 'border-amber-200 hover:border-amber-400'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-amber-800">{ticket.id}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold">DISPATCHED</span>
                    </div>

                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                      <span>{ticket.touristName || 'Tourist'}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIncident(ticket);
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        <Navigation className="w-3 h-3 text-amber-600" />
                        <span>Show Route</span>
                      </button>
                    </div>
                    <div className="text-xs text-slate-600">{ticket.location?.address || 'Solang Valley Sector'}</div>

                    <div className="p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-900 font-mono font-bold">
                      Assigned: {ticket.unitAssigned || 'PCR Unit'}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResolveIncident(ticket.id);
                      }}
                      className="w-full mt-2 py-1.5 bg-[#2F4538] hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow"
                    >
                      <Check className="w-4 h-4" />
                      <span>{t.markResolvedBtn}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* COLUMN 3: RESOLVED & SAFE */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
              <span className="font-extrabold text-xs uppercase text-[#2F4538] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t.kanbanResolved}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 text-xs font-mono font-extrabold">
                {resolvedTickets.length}
              </span>
            </div>

            {resolvedTickets.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-medium">
                No resolved cases today.
              </div>
            ) : (
              resolvedTickets.map((ticket) => {
                const isSelected = selectedIncident?.id === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedIncident(ticket)}
                    className={`p-3.5 bg-white rounded-xl space-y-1 text-xs shadow-sm cursor-pointer transition border-2 ${
                      isSelected
                        ? 'border-emerald-600 ring-2 ring-emerald-400'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#138808]">{ticket.id}</span>
                      <span className="text-[10px] text-slate-500">{formatTicketTime(ticket.timestamp)}</span>
                    </div>
                    <div className="font-bold text-slate-900">{ticket.touristName || 'Tourist'}</div>
                    <div className="text-[11px] text-slate-600">{ticket.hazardType || 'Distress Incident'}</div>
                    <div className="text-[10px] text-[#138808] font-bold mt-1">✓ Citizen Marked Safe</div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>

    </div>
  );
};
