import React from 'react';
import {
  BrainCircuit,
  UserSearch,
  MapPin,
  Radio,
  BarChart3,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';
import { Language, ActiveModule } from '../types';
import { i18n } from '../data/i18n';

interface SidebarProps {
  language: Language;
  activeModule: ActiveModule;
  onSelectModule: (mod: ActiveModule) => void;
  activeSosCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  language,
  activeModule,
  onSelectModule,
  activeSosCount
}) => {
  const t = i18n[language];

  const navItems = [
    {
      id: 'ai_hub' as ActiveModule,
      label: t.modAiHub,
      icon: BrainCircuit,
      badge: 'AI ACTIVE'
    },
    {
      id: 'tourist_tracking' as ActiveModule,
      label: t.modTouristTracking,
      icon: UserSearch,
      badge: null
    },
    {
      id: 'sos_map' as ActiveModule,
      label: t.modSosMap,
      icon: MapPin,
      badge: activeSosCount > 0 ? `${activeSosCount} SOS` : null,
      badgeColor: 'bg-red-600 text-white animate-pulse'
    },
    {
      id: 'broadcast' as ActiveModule,
      label: t.modBroadcast,
      icon: Radio,
      badge: null
    },
    {
      id: 'analytics_audit' as ActiveModule,
      label: t.modAnalyticsAudit,
      icon: BarChart3,
      badge: 'AUDIT'
    }
  ];

  return (
    <aside className="w-full lg:w-64 bg-white text-slate-800 border-r border-slate-200 flex-shrink-0 flex flex-col justify-between p-3 lg:p-4 shadow-sm">
      
      {/* Module Links */}
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-[#1B2A4A] flex items-center justify-between">
          <span>Command Modules</span>
          <span className="w-2 h-2 rounded-full bg-[#2F4538]"></span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectModule(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[#1B2A4A] text-white shadow-md scale-[1.01]'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-3 truncate">
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#E8935C]' : 'text-[#1B2A4A]'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                    item.badgeColor
                      ? item.badgeColor
                      : isActive
                      ? 'bg-[#E8935C] text-slate-950'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* System Health Widget at Bottom */}
      <div className="mt-6 p-3 bg-slate-50 rounded-xl border border-slate-200 hidden lg:block text-xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="font-mono text-[10px] uppercase font-bold text-slate-600">Telemetry Link</span>
          <span className="flex items-center gap-1 text-emerald-600 font-bold text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> ONLINE
          </span>
        </div>
        <div className="space-y-1 text-[11px] text-slate-700">
          <div className="flex justify-between">
            <span>Server Cluster:</span>
            <span className="font-mono text-slate-900 font-bold">IN-DELHI-01</span>
          </div>
          <div className="flex justify-between">
            <span>Latency:</span>
            <span className="font-mono text-emerald-600 font-bold">14 ms</span>
          </div>
          <div className="flex justify-between">
            <span>Satellite Sync:</span>
            <span className="font-mono text-slate-900 font-bold">IRNSS-NavIC</span>
          </div>
        </div>
      </div>

    </aside>
  );
};
