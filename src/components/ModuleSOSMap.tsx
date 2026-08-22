import React, { useState } from 'react';
import {
  MapPin,
  ShieldAlert,
  Radio,
  Building2,
  HeartPulse,
  Flame,
  Layers,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  Send,
  Check,
  User,
  PhoneCall,
  Navigation
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
      
      {/* Top Layer Toggles & Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        
        {/* Layer Toggles */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-extrabold text-[#1B2A4A] uppercase tracking-wider text-[11px] flex items-center gap-1">
            <Layers className="w-4 h-4 text-[#E8935C]" />
            <span>{t.layersLabel}</span>
          </span>

          <button
            onClick={() => setShowSosLayer(!showSosLayer)}
            className={`px-3 py-1.5 rounded-lg border font-extrabold transition flex items-center gap-1.5 ${
              showSosLayer
                ? 'bg-red-50 border-red-300 text-red-800'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
            <span>{t.layerSosBeacons}</span>
          </button>

          <button
            onClick={() => setShowRespondersLayer(!showRespondersLayer)}
            className={`px-3 py-1.5 rounded-lg border font-extrabold transition flex items-center gap-1.5 ${
              showRespondersLayer
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            <span>{t.layerResponders}</span>
          </button>

          <button
            onClick={() => setShowStationsLayer(!showStationsLayer)}
            className={`px-3 py-1.5 rounded-lg border font-extrabold transition flex items-center gap-1.5 ${
              showStationsLayer
                ? 'bg-emerald-50 border-emerald-300 text-[#2F4538]'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-[#2F4538]" />
            <span>{t.layerStations}</span>
          </button>

          <button
            onClick={() => setShowHospitalsLayer(!showHospitalsLayer)}
            className={`px-3 py-1.5 rounded-lg border font-extrabold transition flex items-center gap-1.5 ${
              showHospitalsLayer
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
            <span>{t.layerHospitals}</span>
          </button>

          <button
            onClick={() => setShowHeatmapLayer(!showHeatmapLayer)}
            className={`px-3 py-1.5 rounded-lg border font-extrabold transition flex items-center gap-1.5 ${
              showHeatmapLayer
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            <span>{t.layerHeatmap}</span>
          </button>
        </div>



      </div>

      {/* GIS LIVE MAP CANVAS MOCKUP */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-[#E8935C]" />
            <h3 className="text-base font-bold text-slate-900">
              {t.gisMapTitle}
            </h3>
          </div>
          <span className="text-xs font-mono text-[#2F4538] font-bold">
            Grid IN-901 • Sat-Link: IRNSS NavIC Active
          </span>
        </div>

        <div className="relative w-full h-[400px] bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
          
          {/* Custom Stylized Map Grid & Terrain Lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:2.5rem_2.5rem] opacity-40"></div>

          {/* Heatmap Overlay Layer */}
          {showHeatmapLayer && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-1/3 w-48 h-48 rounded-full bg-red-500/20 blur-2xl animate-pulse"></div>
              <div className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full bg-amber-500/20 blur-2xl"></div>
            </div>
          )}

          {/* Active SOS Beacons Layer */}
          {showSosLayer && incidents.map((inc, index) => {
            const leftPct = `${25 + (index * 28)}%`;
            const topPct = `${30 + (index * 20)}%`;
            const isSelected = selectedIncident?.id === inc.id;

            return (
              <div
                key={inc.id}
                onClick={() => setSelectedIncident(inc)}
                style={{ left: leftPct, top: topPct }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group"
              >
                {inc.status !== 'Resolved' && (
                  <div className="w-12 h-12 rounded-full bg-red-600/30 border border-red-500 animate-ping absolute"></div>
                )}
                <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shadow-2xl transition-transform ${
                  isSelected
                    ? 'bg-red-600 border-white scale-125 z-30'
                    : inc.status === 'Resolved'
                    ? 'bg-[#2F4538] border-emerald-300 text-white'
                    : 'bg-red-600 border-amber-400 text-white group-hover:scale-110'
                }`}>
                  <ShieldAlert className="w-5 h-5 text-white" />
                </div>

                {/* Hover Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-700 text-white text-[11px] px-2.5 py-1 rounded shadow-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-40">
                  <div className="font-bold">{inc.touristName}</div>
                  <div className="text-red-400">{inc.hazardType} • [{inc.status}]</div>
                </div>
              </div>
            );
          })}

          {/* Patrolling Units Layer */}
          {showRespondersLayer && units.map((u, index) => {
            const leftPct = `${18 + (index * 24)}%`;
            const topPct = `${60 - (index * 12)}%`;

            return (
              <div
                key={u.id}
                style={{ left: leftPct, top: topPct }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#1B2A4A] border-2 border-blue-400 text-white flex items-center justify-center shadow-lg group-hover:scale-110">
                  <Radio className="w-4 h-4 text-amber-300" />
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-900 border border-slate-800 text-[10px] text-blue-300 px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {u.unitName}
                </div>
              </div>
            );
          })}

          {/* Police Stations Layer */}
          {showStationsLayer && stations.map((st, index) => {
            const leftPct = `${70 - (index * 20)}%`;
            const topPct = `${20 + (index * 30)}%`;

            return (
              <div
                key={st.id}
                style={{ left: leftPct, top: topPct }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 group"
              >
                <div className="w-9 h-9 rounded-lg bg-[#2F4538] border-2 border-emerald-200 text-white flex items-center justify-center shadow-lg group-hover:scale-110">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-900 border border-slate-800 text-[10px] text-emerald-300 px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {st.name}
                </div>
              </div>
            );
          })}

          {/* Hospitals & Medical Care Layer */}
          {showHospitalsLayer && hospitals.map((hosp, index) => {
            const leftPct = `${48 + (index * 22)}%`;
            const topPct = `${32 + (index * 24)}%`;

            return (
              <div
                key={hosp.id}
                style={{ left: leftPct, top: topPct }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 group"
              >
                <div className="w-9 h-9 rounded-lg bg-rose-600 border-2 border-rose-200 text-white flex items-center justify-center shadow-lg group-hover:scale-110">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-900 border border-slate-800 text-[10px] text-rose-300 p-2 rounded shadow-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-30">
                  <div className="font-bold text-white text-xs">{hosp.name}</div>
                  <div className="text-rose-200 text-[10px] mt-0.5">
                    🚑 {hosp.ambulancesReady} Ambulances Ready • 🏥 {hosp.icuBedsAvailable} ICU Beds
                  </div>
                  <div className="text-slate-400 text-[9px] mt-0.5">📞 {hosp.contactPhone}</div>
                </div>
              </div>
            );
          })}

        </div>
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
              newTickets.map((ticket) => (
                <div key={ticket.id} className="p-3.5 bg-white border border-red-200 rounded-xl space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-red-700">{ticket.id}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{ticket.timestamp.split(' ')[1]}</span>
                  </div>

                  <div className="font-bold text-slate-900 text-sm">{ticket.touristName}</div>
                  <div className="text-xs text-slate-600">{ticket.location.address}</div>

                  <div className="text-[11px] p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 font-medium">
                    ⚠️ {ticket.notes}
                  </div>

                  <div className="pt-2 flex flex-col gap-1.5">
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
              ))
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
              dispatchedTickets.map((ticket) => (
                <div key={ticket.id} className="p-3.5 bg-white border border-amber-200 rounded-xl space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-amber-800">{ticket.id}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold">DISPATCHED</span>
                  </div>

                  <div className="font-bold text-slate-900 text-sm">{ticket.touristName}</div>
                  <div className="text-xs text-slate-600">{ticket.location.address}</div>

                  <div className="p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-900 font-mono font-bold">
                    Assigned: {ticket.unitAssigned || 'PCR Unit'}
                  </div>

                  <button
                    onClick={() => onResolveIncident(ticket.id)}
                    className="w-full mt-2 py-1.5 bg-[#2F4538] hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <Check className="w-4 h-4" />
                    <span>{t.markResolvedBtn}</span>
                  </button>
                </div>
              ))
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
              resolvedTickets.map((ticket) => (
                <div key={ticket.id} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1 text-xs shadow-sm hover:border-slate-300 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#2F4538]">{ticket.id}</span>
                    <span className="text-[10px] text-slate-500">{ticket.timestamp.split(' ')[1]}</span>
                  </div>
                  <div className="font-bold text-slate-900">{ticket.touristName}</div>
                  <div className="text-[11px] text-slate-600">{ticket.hazardType}</div>
                  <div className="text-[10px] text-[#2F4538] font-bold mt-1">✓ Citizen Marked Safe</div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>

    </div>
  );
};
