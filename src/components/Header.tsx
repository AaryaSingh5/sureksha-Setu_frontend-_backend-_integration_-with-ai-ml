import React from 'react';
import {
  Brain,
  UserCheck,
  MapPin,
  Radio,
  BarChart3,
  Search,
  Globe,
  Sun,
  Moon,
  LogOut,
  Compass,
  ShieldAlert
} from 'lucide-react';
import { Language, UserRole, ActiveModule } from '../types';
import { i18n } from '../data/i18n';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  userRole: UserRole;
  onLogout: () => void;
  activeModule: ActiveModule;
  onSelectModule: (mod: ActiveModule) => void;
  globalSearchQuery: string;
  onGlobalSearchChange: (q: string) => void;
  onExecuteGlobalSearch: () => void;
  activeSosCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  darkMode,
  onToggleDarkMode,
  userRole,
  onLogout,
  activeModule,
  onSelectModule,
  globalSearchQuery,
  onGlobalSearchChange,
  onExecuteGlobalSearch,
  activeSosCount
}) => {
  const t = i18n[language];

  // Navigation items matching exact requested titles and badges
  const navItems = [
    {
      id: 'ai_hub' as ActiveModule,
      icon: Brain,
      titleEn: 'AI Anomaly & Prediction Hub',
      badge: 'AI ACTIVE',
      badgeStyle: 'bg-amber-500/20 text-[#E8935C] border-amber-500/40'
    },
    {
      id: 'tourist_tracking' as ActiveModule,
      icon: UserCheck,
      titleEn: 'Tourist Detail Tracking',
      badge: null,
      badgeStyle: ''
    },
    {
      id: 'sos_map' as ActiveModule,
      icon: MapPin,
      titleEn: 'SOS Alert & Command Map',
      badge: `${activeSosCount} SOS`,
      badgeStyle: 'bg-red-500/20 text-red-400 border-red-500/40 font-black animate-pulse'
    },
    {
      id: 'broadcast' as ActiveModule,
      icon: Radio,
      titleEn: 'Broadcast & Geofenced Alerts',
      badge: null,
      badgeStyle: ''
    },
    {
      id: 'analytics_audit' as ActiveModule,
      icon: BarChart3,
      titleEn: 'Audit Logs & Analytics',
      badge: null,
      badgeStyle: ''
    }
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#1B2A4A] text-white border-b border-[#7C93A8]/20 shadow-sm">
      
      {/* Dawn Amber Top Bar Accent */}
      <div className="h-[2px] w-full bg-[#E8935C]"></div>

      {/* ROW 1: DARK NAVY BAR WITH BRAND & HORIZONTAL NAV TABS */}
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-3">
          
          {/* Brand Logo & Emblem */}
          <div
            className="flex items-center space-x-3 cursor-pointer group flex-shrink-0"
            onClick={() => userRole === 'authority' && onSelectModule('ai_hub')}
          >
            {/* Round White Wheel Emblem */}
            <div className="w-9 h-9 rounded-full bg-white text-[#1B2A4A] flex items-center justify-center font-bold shadow-sm border border-slate-200 group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5 text-[#1B2A4A]" />
            </div>

            <div className="flex flex-col leading-tight">
              <span className="text-sm font-black tracking-wider text-white uppercase whitespace-nowrap">
                SURAKSHA SETU
              </span>
              <span className="text-[10px] font-bold text-[#E8935C] whitespace-nowrap">
                सुरक्षा सेतु • National Portal
              </span>
            </div>
          </div>

          {/* Horizontal Nav Tabs (Requested Modules) */}
          {userRole === 'authority' && (
            <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto w-full xl:w-auto py-1 no-scrollbar">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectModule(item.id)}
                    className={`flex items-center space-x-2.5 px-3.5 py-2 rounded text-left transition-all flex-shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-white/10 border border-[#7C93A8]/45 shadow-sm'
                        : 'bg-transparent hover:bg-white/5 text-slate-300 hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-[#E8935C]' : 'text-slate-300'
                      }`}
                    />
                    <span
                      className={`text-xs whitespace-nowrap font-bold ${
                        isActive ? 'text-white' : 'text-slate-200'
                      }`}
                    >
                      {item.titleEn}
                    </span>

                    {item.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-extrabold ${item.badgeStyle}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* ROW 2: LIGHT SUB-BAR WITH PAGE TITLE, SEARCH & OFFICER PROFILE */}
      <div className="bg-[#FAF7F2] text-[#1B2A4A] border-t border-[#7C93A8]/15 border-b border-[#7C93A8]/25 py-2.5">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            
            {/* Title & Subtitle */}
            <div className="flex flex-col">
              <h1 className="text-lg sm:text-xl font-black text-[#1B2A4A] tracking-tight whitespace-nowrap uppercase">
                {t.nationalPortalName}
              </h1>
              <p className="text-xs text-[#7C93A8] font-semibold mt-0.5 whitespace-nowrap">
                {t.nationalPortalName} • {language === 'hi' ? 'हिमाचल प्रदेश राज्य' : 'Himachal Pradesh State'}
              </p>
            </div>

            {/* Right Controls: Search, Profile & Action Utilities */}
            <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
              
              {/* Search Box */}
              {userRole === 'authority' && (
                <div className="relative flex-1 md:flex-initial">
                  <input
                    type="text"
                    placeholder="Search districts or schemes..."
                    value={globalSearchQuery}
                    onChange={(e) => onGlobalSearchChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onExecuteGlobalSearch()}
                    className="w-full md:w-72 lg:w-80 pl-9 pr-8 py-1.5 text-xs rounded-full bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1B2A4A] focus:ring-1 focus:ring-[#1B2A4A] shadow-sm font-medium transition-all"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  {globalSearchQuery && (
                    <button
                      onClick={onExecuteGlobalSearch}
                      className="absolute right-2 top-1.5 px-2 py-0.5 bg-[#1B2A4A] text-white text-[10px] font-bold rounded-full hover:bg-slate-800"
                    >
                      GO
                    </button>
                  )}
                </div>
              )}

              {/* Active SOS Badge Banner */}
              {userRole === 'authority' && activeSosCount > 0 && (
                <button
                  onClick={() => onSelectModule('sos_map')}
                  className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-full text-xs font-black shadow-sm border border-red-400/40 whitespace-nowrap animate-pulse transition-all cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-white" />
                  <span>{activeSosCount} Active SOS</span>
                </button>
              )}

              {/* Officer Profile Badge */}
              {userRole === 'authority' ? (
                <div className="flex items-center space-x-2.5 border-l border-slate-300 pl-3">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
                    alt="Rajesh Kumar, IAS"
                    className="w-8 h-8 rounded-full border border-slate-300 object-cover shadow-xs flex-shrink-0"
                  />
                  <div className="flex flex-col leading-tight">
                    <span className="text-xs font-extrabold text-[#1B2A4A] whitespace-nowrap">
                      Rajesh Kumar, IAS
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                      State Chief Administrator
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Utilities: Theme & Logout */}
              <div className="flex items-center space-x-1.5 border-l border-slate-300 pl-2">
                {/* Theme Toggle */}
                <button
                  onClick={onToggleDarkMode}
                  className="p-1.5 rounded-lg bg-slate-200/80 border border-slate-300 text-slate-700 hover:bg-slate-300 transition-colors"
                  title="Toggle High-Contrast Theme"
                >
                  {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
                </button>

                {/* Logout / Switch Gateway */}
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 border border-red-300 text-red-800 transition-colors"
                  title={t.logoutBtn}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>

              </div>

            </div>

          </div>
        </div>
      </div>

    </header>
  );
};

