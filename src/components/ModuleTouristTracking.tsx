import React, { useState } from 'react';
import {
  UserSearch,
  Search,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Mail,
  PhoneCall,
  MapPin,
  Clock,
  Radio,
  History,
  CheckCircle2,
  FileText,
  User,
  Globe,
  Award,
  Key,
  BadgeCheck,
  Calendar,
  Lock
} from 'lucide-react';
import { Language, TouristProfile, InterceptionReason } from '../types';
import { i18n } from '../data/i18n';
import { InterceptionModal } from './InterceptionModal';

interface ModuleTouristTrackingProps {
  language: Language;
  tourists: TouristProfile[];
  onLogAudit: (
    actionType: 'TOURIST_LOOKUP' | 'DISPATCH_UNIT' | 'BROADCAST_SENT' | 'TICKET_STATUS_CHANGE',
    targetId: string,
    reason: string,
    details: string
  ) => void;
  onDispatchToTourist: (tourist: TouristProfile) => void;
  onSendSmsToTourist: (tourist: TouristProfile) => void;
  onMarkSafe: (touristId: string) => void;
  prefilledTouristId?: string;
}

function formatRegistrationDate(isoString?: string): string {
  if (!isoString) return '15 July 2026, 08:30 UTC';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    
    const day = date.getUTCDate();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');

    return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
  } catch {
    return isoString;
  }
}

export const ModuleTouristTracking: React.FC<ModuleTouristTrackingProps> = ({
  language,
  tourists,
  onLogAudit,
  onDispatchToTourist,
  onSendSmsToTourist,
  onMarkSafe,
  prefilledTouristId
}) => {
  const t = i18n[language];
  const [searchInput, setSearchInput] = useState(prefilledTouristId || 'TR-88219');
  const [selectedTourist, setSelectedTourist] = useState<TouristProfile | null>(
    tourists.find((t) => t.id === (prefilledTouristId || 'TR-88219')) || tourists[0]
  );
  const [pendingTouristId, setPendingTouristId] = useState<string | null>(null);
  const [showInterceptionModal, setShowInterceptionModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const triggerSearch = (idToSearch: string) => {
    if (!idToSearch.trim()) return;
    setPendingTouristId(idToSearch.trim());
    setShowInterceptionModal(true);
  };

  const handleConfirmInterception = (reason: InterceptionReason, notes: string) => {
    if (!pendingTouristId) return;

    const found = tourists.find(
      (tp) => tp.id.toLowerCase() === pendingTouristId.toLowerCase() || tp.name.toLowerCase().includes(pendingTouristId.toLowerCase())
    );

    if (found) {
      setSelectedTourist(found);
      onLogAudit(
        'TOURIST_LOOKUP',
        found.id + ' (' + found.name + ')',
        reason,
        `Accessed profile & telemetry. Notes: ${notes || 'None'}`
      );
      setToastMessage(`✓ Interception Verified: Audit Logged for ${found.name}`);
    } else {
      setToastMessage(`⚠️ Tourist ID "${pendingTouristId}" not found in database.`);
    }

    setShowInterceptionModal(false);
    setPendingTouristId(null);
    setTimeout(() => setToastMessage(''), 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Alert Notice */}
      {toastMessage && (
        <div className="p-3 bg-emerald-950 border border-emerald-600 text-emerald-200 text-xs font-bold rounded-xl flex items-center justify-between shadow-lg animate-fade-in">
          <span>{toastMessage}</span>
          <span className="text-[10px] opacity-75">Statutory Audit Log #AUD-LOK</span>
        </div>
      )}

      {/* SEARCH CARD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-[#E8935C] text-[#1B2A4A] text-xs font-bold uppercase">
            <UserSearch className="w-4 h-4 text-[#E8935C]" />
            <span>{t.touristSearchTitle}</span>
          </div>

          <p className="text-xs text-slate-600 font-medium">
            {t.touristSearchSub}
          </p>

          <div className="flex items-center gap-2 pt-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && triggerSearch(searchInput)}
                placeholder="Enter Tourist ID (e.g., TR-88219, TR-44021)..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E8935C]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            <button
              onClick={() => triggerSearch(searchInput)}
              className="px-5 py-2.5 bg-[#1B2A4A] hover:bg-[#071933] text-white font-black rounded-xl text-sm transition shadow-md flex items-center gap-2"
            >
              <span>{t.searchBtn}</span>
            </button>
          </div>

          {/* Quick Demo Tourist Pills */}
          <div className="pt-2 flex items-center justify-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500 text-[11px] font-bold">Quick Demo IDs:</span>
            {tourists.map((tp) => (
              <button
                key={tp.id}
                onClick={() => {
                  setSearchInput(tp.id);
                  triggerSearch(tp.id);
                }}
                className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] font-bold transition ${
                  selectedTourist?.id === tp.id
                    ? 'bg-[#E8935C] text-slate-950 border-[#E8935C] shadow-sm'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {tp.id} ({tp.name.split(' ')[0]})
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* TOURIST PROFILE DASHBOARD */}
      {selectedTourist && (() => {
        const fullName = selectedTourist.full_name || selectedTourist.name;
        const digitalId = selectedTourist.digital_id || selectedTourist.id;
        const touristUuid = selectedTourist.tourist_id || '8f7a9d1b-3c4e-4f52-a1b2-c3d4e5f67890';
        const docType = selectedTourist.kyc_document_type || 'Passport';
        const isKycVerified = selectedTourist.kyc_verified ?? true;
        const phone = selectedTourist.phone;
        const email = selectedTourist.email || `${fullName.toLowerCase().replace(/\s+/g, '.')}@example.com`;
        const emergencyContact = selectedTourist.emergency_contact || selectedTourist.emergencyContact;
        const languagePref = selectedTourist.preferred_language || 'Spanish';
        const regDateFormatted = formatRegistrationDate(selectedTourist.created_at || '2026-07-15T08:30:00Z');

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left & Center: Modern Tourist Profile Dashboard Card */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Main Card Wrapper */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                
                {/* 1. Profile Header Banner */}
                <div className="bg-gradient-to-r from-[#1B2A4A] via-[#0f305c] to-[#143d73] text-white p-6 relative">
                  
                  {/* Subtle decorative background pattern */}
                  <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none"></div>

                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    
                    {/* Avatar & Key Profile Info */}
                    <div className="flex items-center gap-4 sm:gap-5">
                      
                      {/* Avatar with Verification Halo */}
                      <div className="relative flex-shrink-0">
                        <img
                          src={selectedTourist.photoUrl}
                          alt={fullName}
                          className="w-20 h-20 rounded-2xl object-cover border-2 border-[#E8935C] shadow-lg"
                        />
                        {isKycVerified && (
                          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 border-2 border-[#1B2A4A] shadow" title="KYC Verified">
                            <BadgeCheck className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Name, Digital ID & Badges */}
                      <div className="space-y-1.5">
                        
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-amber-300 font-mono text-xs font-extrabold border border-white/20 tracking-wide">
                            {digitalId}
                          </span>

                          {isKycVerified ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>KYC Verified</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-400/30">
                              <span>KYC Pending</span>
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-500/20 text-sky-200 text-xs font-semibold border border-sky-400/30">
                            <FileText className="w-3.5 h-3.5 text-sky-300" />
                            <span>{docType}</span>
                          </span>
                        </div>

                        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                          {fullName}
                        </h2>

                        <div className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                          <Globe className="w-3.5 h-3.5 text-[#E8935C]" />
                          <span>Preferred Language: <strong className="text-white">{languagePref}</strong></span>
                        </div>

                      </div>

                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-2 self-start md:self-auto flex-wrap sm:flex-nowrap">
                      <button
                        onClick={() => onDispatchToTourist(selectedTourist)}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs transition shadow-md flex items-center gap-2"
                      >
                        <Radio className="w-4 h-4" />
                        <span>{t.dispatchToTourist}</span>
                      </button>

                      {selectedTourist.safetyStatus !== 'Safe' && (
                        <button
                          onClick={() => onMarkSafe(selectedTourist.id)}
                          className="px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl text-xs transition shadow-md flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t.markSafeBtn}</span>
                        </button>
                      )}
                    </div>

                  </div>

                </div>

                {/* Body Content - 4 Organized Section Cards */}
                <div className="p-6 space-y-6 bg-slate-50/50">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* 2. Personal Information Section */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                          <User className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Personal Information
                        </h3>
                      </div>

                      <div className="space-y-3 text-xs">
                        
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-500 font-medium">Full Name</span>
                          <span className="font-bold text-slate-900">{fullName}</span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium">Digital Tourist ID</span>
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {digitalId}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium">Tourist System UUID</span>
                          <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[170px]" title={touristUuid}>
                            {touristUuid}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium">Preferred Language</span>
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-teal-600" />
                            <span>{languagePref}</span>
                          </span>
                        </div>

                      </div>

                    </div>

                    {/* 3. Contact Information Section */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                          <Phone className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Contact Information
                        </h3>
                      </div>

                      <div className="space-y-3 text-xs">
                        
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            Phone Number
                          </span>
                          <span className="font-mono font-bold text-slate-900">{phone}</span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            Email Address
                          </span>
                          <span className="font-mono text-slate-900 font-semibold truncate max-w-[180px]" title={email}>
                            {email}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <PhoneCall className="w-3.5 h-3.5 text-rose-500" />
                            Emergency Contact
                          </span>
                          <span className="font-mono font-extrabold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                            {emergencyContact}
                          </span>
                        </div>

                      </div>

                    </div>

                    {/* 4. Verification & Security Section */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Verification & Security
                        </h3>
                      </div>

                      <div className="space-y-3 text-xs">
                        
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-500 font-medium">KYC Verification</span>
                          {isKycVerified ? (
                            <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Verified</span>
                            </span>
                          ) : (
                            <span className="font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                              Pending
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between items-center py-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium">Verification Document</span>
                          <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                            {docType}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium">Security Status</span>
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Identity Authenticated</span>
                          </span>
                        </div>

                      </div>

                    </div>

                    {/* 5. Account Information Section */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Account Information
                        </h3>
                      </div>

                      <div className="space-y-3 text-xs">
                        
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-500 font-medium">Registration Date</span>
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{regDateFormatted}</span>
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium">System Compliance</span>
                          <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Compliant & Active
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium">Digital Safety Band</span>
                          <span className="font-mono text-slate-800 font-bold">
                            {selectedTourist.digitalBandId || 'BAND-8812'}
                          </span>
                        </div>

                      </div>

                    </div>

                  </div>

                </div>

              </div>

            </div>

            {/* Right Column: Live GPS Telemetry & Safety History */}
            <div className="space-y-6">
              
              {/* Live Location Map View */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-red-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      {t.liveLocation}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#2F4538] font-bold">
                    {selectedTourist.lastSeenTime}
                  </span>
                </div>

                {/* Map Canvas Mockup */}
                <div className="relative w-full h-52 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] opacity-40"></div>

                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <path
                      d="M 120 180 L 180 140 L 260 110 L 320 80"
                      fill="none"
                      stroke="#E8935C"
                      strokeWidth="3"
                      strokeDasharray="6 4"
                    />
                  </svg>

                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-500 flex items-center justify-center animate-ping absolute"></div>
                    <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-white text-white flex items-center justify-center font-bold text-xs shadow-2xl z-10">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="mt-2 bg-white/95 border border-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold text-slate-900 shadow-md max-w-[200px] truncate text-center">
                      {selectedTourist.currentLocation.address}
                    </div>
                  </div>

                  <div className="absolute bottom-2 right-2 bg-white/95 px-2 py-0.5 rounded border border-slate-200 text-[9px] font-mono text-slate-700 shadow">
                    LAT: {selectedTourist.currentLocation.lat.toFixed(4)} • LNG: {selectedTourist.currentLocation.lng.toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Safety Status & SOS History */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center space-x-2">
                    <History className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      {t.sosHistory}
                    </h3>
                  </div>
                  <div className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    selectedTourist.safetyStatus === 'SOS Active'
                      ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse'
                      : selectedTourist.safetyStatus === 'Watch'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {selectedTourist.safetyStatus}
                  </div>
                </div>

                {selectedTourist.pastSOSHistory.length === 0 ? (
                  <div className="text-center py-4 text-slate-500 text-xs">
                    No prior emergency SOS alerts recorded for this profile.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedTourist.pastSOSHistory.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{rec.location}</div>
                          <div className="text-[10px] text-slate-600 mt-0.5">{rec.reason}</div>
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">Date: {rec.date}</div>
                        </div>

                        <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-[#2F4538] font-extrabold text-[10px]">
                          {rec.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        );
      })()}

      {/* Mandatory Interception Modal */}
      {showInterceptionModal && pendingTouristId && (
        <InterceptionModal
          language={language}
          touristId={pendingTouristId}
          onConfirm={handleConfirmInterception}
          onCancel={() => {
            setShowInterceptionModal(false);
            setPendingTouristId(null);
          }}
        />
      )}

    </div>
  );
};

