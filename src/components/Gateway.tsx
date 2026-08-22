import React, { useState } from 'react';
import {
  Lock,
  ArrowRight,
  Smartphone,
  KeyRound,
  AlertTriangle
} from 'lucide-react';
import { Language, UserRole } from '../types';
import { i18n } from '../data/i18n';

interface GatewayProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onSelectRole: (role: UserRole) => void;
  onAuthenticateAuthority: (badgeId: string, otp: string) => boolean;
}

export const Gateway: React.FC<GatewayProps> = ({
  language,
  onLanguageChange,
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
    <div className="min-h-screen bg-[#FAF7F2] text-[#1B2A4A] flex flex-col justify-between font-sans relative">
      
      {/* UNDERSTATED STATE TOP BAR */}
      <header className="w-full border-b border-[#7C93A8]/20 py-3 bg-[#FAF7F2] z-20">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Clean minimal state design logo representation */}
            <svg className="w-4 h-4 text-[#1B2A4A] opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="text-[10px] tracking-[0.25em] font-semibold text-[#7C93A8] uppercase">
              Himachal Pradesh State
            </span>
          </div>
          <div className="flex items-center space-x-4 text-[10px] tracking-[0.15em] text-[#7C93A8]/80 font-semibold uppercase">
            <span>Govt of India</span>
            <span className="text-[#7C93A8]/30">|</span>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => onLanguageChange('en')} 
                className={`hover:text-[#1B2A4A] transition-colors cursor-pointer ${language === 'en' ? 'font-bold text-[#1B2A4A]' : 'text-[#7C93A8]'}`}
              >
                EN
              </button>
              <span>/</span>
              <button 
                onClick={() => onLanguageChange('hi')} 
                className={`hover:text-[#1B2A4A] transition-colors cursor-pointer ${language === 'hi' ? 'font-bold text-[#1B2A4A]' : 'text-[#7C93A8]'}`}
              >
                हिंदी
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ATMOSPHERIC HERO SECTION */}
      <section className="relative w-full h-[65vh] md:h-[75vh] overflow-hidden flex items-end">
        {/* Full-bleed background image with slow drift */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img 
            src="/himalayan_dawn.jpg" 
            alt="Hot air balloons over misty Himalayan forest ridges at sunrise" 
            className="w-full h-full object-cover select-none pointer-events-none scale-105 animate-slow-drift"
          />
        </div>

        {/* Dark gradient overlay at the bottom third only */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#1B2A4A]/90 via-[#1B2A4A]/40 to-transparent z-10"></div>

        {/* Headline low-left inside overlay zone */}
        <div className="relative max-w-6xl w-full mx-auto px-6 pb-12 sm:pb-16 z-20 text-left">
          <h1 className="font-editorial text-5xl md:text-7xl font-light text-white tracking-tight leading-none mb-4">
            Suraksha Setu
          </h1>
          <p className="text-white/80 font-light text-sm md:text-base max-w-lg leading-relaxed">
            Emergency response and safety monitoring for travelers across Himachal Pradesh.
          </p>
        </div>
      </section>

      {/* TWO PATHS - UNEQUAL VISUAL WEIGHT */}
      <main className="max-w-6xl w-full mx-auto px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-5 gap-12 items-start flex-1">
        
        {/* CARD 1: Travelers - Spans 3 columns (Primary, warm) */}
        <div className="md:col-span-3 bg-white border border-[#E8935C]/35 rounded p-8 md:p-10 flex flex-col justify-between min-h-[380px] transition-colors duration-300">
          <div>
            <span className="text-[10px] tracking-[0.25em] font-semibold text-[#E8935C] uppercase block mb-3">
              Safety Portal
            </span>
            <h2 className="font-editorial text-3xl md:text-4xl text-[#1B2A4A] font-normal leading-tight mb-6">
              For Travelers
            </h2>
            
            <p className="text-slate-600 font-light text-base leading-relaxed mb-8">
              Your safety is our priority as you explore the serene valleys of Himachal Pradesh. Get instant location tracking, offline SOS triggers, and helpline contacts.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-[#1B2A4A] mb-8 font-light">
              <div className="flex items-start space-x-3">
                <Smartphone className="w-4 h-4 text-[#E8935C] mt-1 flex-shrink-0" />
                <span>
                  <strong>Instant SOS Trigger</strong>
                  <span className="text-slate-500 text-xs block mt-0.5">5-second cancelable panic signal to authorities</span>
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <Smartphone className="w-4 h-4 text-[#E8935C] mt-1 flex-shrink-0" />
                <span>
                  <strong>Live Location Beacon</strong>
                  <span className="text-slate-500 text-xs block mt-0.5">Continuous encrypted coordination telemetry</span>
                </span>
              </div>
              <div className="flex items-start space-x-3 sm:col-span-2">
                <Smartphone className="w-4 h-4 text-[#E8935C] mt-1 flex-shrink-0" />
                <span>
                  <strong>Emergency Helplines</strong>
                  <span className="text-slate-500 text-xs block mt-0.5">Direct lines to state protection and hospitals (112 / 100) working offline</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectRole('tourist')}
            className="self-start px-8 py-3.5 bg-[#1B2A4A] hover:bg-[#E8935C] text-[#FAF7F2] hover:text-[#1B2A4A] text-sm font-medium tracking-wide rounded transition-all duration-300 flex items-center space-x-2 cursor-pointer"
          >
            <span>Open Safety App</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* CARD 2: Authorities - Spans 2 columns (Secondary, restrained) */}
        <div className="md:col-span-2 border border-[#7C93A8]/30 rounded p-8 md:p-10 flex flex-col justify-between min-h-[380px] transition-colors duration-300 bg-transparent">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] tracking-[0.25em] font-semibold text-[#7C93A8] uppercase block">
                Command Control
              </span>
              <Lock className="w-4 h-4 text-[#2F4538]" />
            </div>
            <h2 className="font-editorial text-3xl text-[#1B2A4A] font-normal leading-tight mb-6">
              For Authorities
            </h2>
            
            <p className="text-slate-500 font-light text-sm leading-relaxed mb-8">
              Secured access for police forces, rescue units, and civil administrators. Monitored & audit-logged environment.
            </p>

            <div className="space-y-4 text-xs text-slate-600 mb-8 font-light">
              <p>• Threat prediction clusters & anomaly feed</p>
              <p>• Live tourist tracking & telemetry maps</p>
              <p>• GIS-based patrol unit dispatch & routing</p>
              <p>• Geofenced emergency SMS broadcast centers</p>
            </div>
          </div>

          <button
            onClick={() => setShowMfaModal(true)}
            className="self-start px-6 py-3 border border-[#2F4538] hover:bg-[#2F4538] hover:text-[#FAF7F2] text-[#2F4538] text-xs font-semibold tracking-wider uppercase rounded transition-all duration-300 cursor-pointer"
          >
            Sign in as Authority
          </button>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="w-full border-t border-[#7C93A8]/15 py-8 bg-[#FAF7F2] z-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-[#7C93A8] space-y-4 md:space-y-0 font-light">
          <span>Digital India Civil Safety Command Framework</span>
          <div className="flex space-x-6">
            <span>Encrypted NIC Protocol</span>
            <span>•</span>
            <span>Himachal Pradesh Tourism 2026</span>
          </div>
        </div>
      </footer>

      {/* MFA VERIFICATION MODAL */}
      {showMfaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B2A4A]/40 backdrop-blur-sm">
          <div className="bg-[#FAF7F2] border border-[#7C93A8]/30 rounded max-w-md w-full p-8 shadow-xl relative text-left">
            
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded border border-[#2F4538]/30 flex items-center justify-center text-[#2F4538]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-editorial text-xl font-normal text-[#1B2A4A]">
                  Secure Verification
                </h3>
                <p className="text-[10px] tracking-[0.15em] text-[#7C93A8] uppercase">
                  MFA / Badge Verification
                </p>
              </div>
            </div>

            <form onSubmit={handleMfaSubmit} className="space-y-5">
              {mfaError && (
                <div className="p-3 border border-red-200 bg-red-50 text-red-800 text-xs rounded flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{mfaError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] tracking-[0.15em] font-semibold text-slate-700 uppercase mb-1.5">
                  Officer Badge ID
                </label>
                <input
                  type="text"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  placeholder="IPS-7742"
                  className="w-full px-3.5 py-2.5 rounded bg-white border border-[#7C93A8]/30 text-[#1B2A4A] font-mono text-sm focus:outline-none focus:border-[#1B2A4A] transition"
                />
              </div>

              <div>
                <label className="block text-[10px] tracking-[0.15em] font-semibold text-slate-700 uppercase mb-1.5">
                  MFA Authentication Code
                </label>
                <input
                  type="password"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="789012"
                  className="w-full px-3.5 py-2.5 rounded bg-white border border-[#7C93A8]/30 text-[#1B2A4A] font-mono text-sm tracking-widest focus:outline-none focus:border-[#1B2A4A] transition"
                />
              </div>

              <div className="p-3 bg-white border border-[#7C93A8]/20 rounded text-[11px] text-slate-500 font-mono">
                ℹ️ Demo access: Use IPS-7742 / 789012
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowMfaModal(false)}
                  className="flex-1 px-4 py-2.5 rounded border border-[#7C93A8]/30 text-slate-600 hover:bg-slate-100 text-xs font-semibold tracking-wider uppercase transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded bg-[#2F4538] hover:bg-[#1B2A4A] text-[#FAF7F2] text-xs font-semibold tracking-wider uppercase transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Authenticate</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
