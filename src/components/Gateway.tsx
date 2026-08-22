import React, { useState } from 'react';
import {
  ShieldAlert,
  UserCheck,
  Smartphone,
  Lock,
  ArrowRight,
  Shield,
  KeyRound,
  Radio,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Language, UserRole } from '../types';
import { i18n } from '../data/i18n';

interface GatewayProps {
  language: Language;
  onSelectRole: (role: UserRole) => void;
  onAuthenticateAuthority: (badgeId: string, otp: string) => boolean;
}

export const Gateway: React.FC<GatewayProps> = ({
  language,
  onSelectRole,
  onAuthenticateAuthority
}) => {
  const t = i18n[language];
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [badgeId, setBadgeId] = useState('IPS-7742');
  const [otp, setOtp] = useState('789012');
  const [mfaError, setMfaError] = useState('');

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeId.trim() || !otp.trim()) {
      setMfaError('Please provide both Badge ID and MFA Auth Code.');
      return;
    }
    const success = onAuthenticateAuthority(badgeId, otp);
    if (!success) {
      setMfaError('Invalid credentials. Use demo credentials (IPS-7742 / 789012)');
    } else {
      setShowMfaModal(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F8FAFC] text-slate-900 flex flex-col justify-between relative overflow-hidden">
      {/* Background Decorative Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-70 pointer-events-none"></div>
      
      {/* Top Banner Accent */}
      <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-16 text-center z-10">
        
        {/* Emblem & Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#FF9933] text-[#0B2447] text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
          <ShieldAlert className="w-4 h-4 text-[#FF9933]" />
          <span>{t.gatewayTitle} • Govt. of India</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#0B2447] max-w-4xl mx-auto leading-tight uppercase">
          SURAKSHA <span className="text-[#FF9933]">SETU</span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
          {t.gatewaySub}
        </p>

        {/* 2 Main Selection Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
          
          {/* TOURIST CARD */}
          <div
            onClick={() => onSelectRole('tourist')}
            className="group relative bg-white rounded-2xl p-6 sm:p-8 border-2 border-slate-200 hover:border-[#138808] transition-all duration-300 shadow-sm hover:shadow-xl cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#138808]/10 rounded-full blur-2xl group-hover:bg-[#138808]/20 transition-all"></div>
            
            <div>
              <div className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-300 text-[#138808] flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Smartphone className="w-8 h-8 text-[#138808]" />
              </div>

              <div className="inline-block px-2.5 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 text-xs font-extrabold mb-3">
                PUBLIC MOBILE APP
              </div>

              <h2 className="text-2xl font-black text-slate-900 group-hover:text-[#138808] transition-colors">
                {t.forTouristsTitle}
              </h2>

              <p className="mt-3 text-sm text-slate-600 leading-relaxed font-medium">
                {t.forTouristsDesc}
              </p>

              <div className="mt-6 space-y-2 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#138808]" />
                  <span className="font-semibold">Instant 1-Tap SOS Panic Trigger</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#138808]" />
                  <span className="font-semibold">GPS Coordinate Telemetry Beacon</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#138808]" />
                  <span className="font-semibold">Directory of Emergency Helplines (112 / 100)</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between font-black text-[#138808] group-hover:translate-x-1 transition-transform">
              <span>{t.enterTouristPortal}</span>
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          {/* AUTHORITY CARD */}
          <div
            onClick={() => setShowMfaModal(true)}
            className="group relative bg-white rounded-2xl p-6 sm:p-8 border-2 border-slate-200 hover:border-[#0B2447] transition-all duration-300 shadow-sm hover:shadow-xl cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#0B2447]/10 rounded-full blur-2xl group-hover:bg-[#0B2447]/20 transition-all"></div>
            
            <div>
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-[#0B2447]/30 text-[#0B2447] flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Shield className="w-8 h-8 text-[#0B2447]" />
              </div>

              <div className="inline-block px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold mb-3">
                MFA RESTRICTED ACCESS
              </div>

              <h2 className="text-2xl font-black text-slate-900 group-hover:text-[#0B2447] transition-colors">
                {t.forAuthoritiesTitle}
              </h2>

              <p className="mt-3 text-sm text-slate-600 leading-relaxed font-medium">
                {t.forAuthoritiesDesc}
              </p>

              <div className="mt-6 space-y-2 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#FF9933]" />
                  <span className="font-semibold">Module 1: AI Anomaly & Threat Predictor</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#FF9933]" />
                  <span className="font-semibold">Module 2: Tourist Interception & Profile Tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#FF9933]" />
                  <span className="font-semibold">Module 3: Live GIS SOS Map & Dispatch Ticketing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#FF9933]" />
                  <span className="font-semibold">Module 4: Geofenced Emergency SMS Broadcast</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between font-black text-[#0B2447] group-hover:translate-x-1 transition-transform">
              <span>{t.enterAuthorityPortal}</span>
              <Lock className="w-5 h-5 text-[#FF9933]" />
            </div>
          </div>

        </div>

        {/* Footnote */}
        <div className="mt-12 text-xs text-slate-500 flex items-center justify-center space-x-4 font-medium">
          <span className="flex items-center gap-1 text-slate-600">
            <Radio className="w-3.5 h-3.5 text-emerald-600" /> Encrypted Protocol NIC-v4.2
          </span>
          <span>•</span>
          <span>Digital India Civil Safety Command Framework</span>
        </div>

      </div>

      {/* MFA VERIFICATION MODAL */}
      {showMfaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border-2 border-[#FF9933] rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-left">
            
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-amber-100 border border-[#FF9933] flex items-center justify-center text-[#0B2447]">
                <KeyRound className="w-6 h-6 text-[#0B2447]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {t.mfaModalTitle}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Authentication & Badge Verification
                </p>
              </div>
            </div>

            <form onSubmit={handleMfaSubmit} className="space-y-4">
              {mfaError && (
                <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs rounded-lg flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{mfaError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.mfaBadgeIdLabel}
                </label>
                <input
                  type="text"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  placeholder="IPS-7742"
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FF9933]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.mfaOtpLabel}
                </label>
                <input
                  type="password"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="789012"
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-mono text-sm tracking-widest focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FF9933]"
                />
              </div>

              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900 font-mono font-medium">
                ℹ️ {t.mfaDemoNote}
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowMfaModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-bold transition"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#0B2447] hover:bg-[#071933] text-white text-sm font-extrabold transition shadow-lg flex items-center justify-center gap-2"
                >
                  <span>{t.mfaVerifyBtn}</span>
                  <ArrowRight className="w-4 h-4 text-[#FF9933]" />
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
