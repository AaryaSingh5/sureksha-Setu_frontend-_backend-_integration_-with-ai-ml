import React, { useState } from 'react';
import {
  Radio,
  Send,
  Users,
  AlertTriangle,
  Sliders,
  MapPin,
  FileText,
  CheckCircle2,
  History
} from 'lucide-react';
import { Language, BroadcastAlert, AlertSeverity } from '../types';
import { i18n } from '../data/i18n';

interface ModuleBroadcastProps {
  language: Language;
  broadcasts: BroadcastAlert[];
  onSendBroadcast: (newAlert: Omit<BroadcastAlert, 'id' | 'timestamp' | 'deliveredCount' | 'status'>) => void;
}

export const ModuleBroadcast: React.FC<ModuleBroadcastProps> = ({
  language,
  broadcasts,
  onSendBroadcast
}) => {
  const t = i18n[language];

  const [region, setRegion] = useState('Himachal Pradesh (Solang Valley & Rohtang Sector)');
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [severity, setSeverity] = useState<AlertSeverity>('Critical');
  const [titleEn, setTitleEn] = useState('');
  const [titleHi, setTitleHi] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [bodyHi, setBodyHi] = useState('');

  const [toastNotice, setToastNotice] = useState('');

  // Estimate audience mathematically based on radius
  const estimatedRecipients = Math.round(1800 * (radiusKm / 5));

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleEn.trim() || !bodyEn.trim()) return;

    onSendBroadcast({
      senderBadge: 'IPS-7742 (Rajesh Kumar)',
      region,
      radiusKm,
      titleEn,
      titleHi,
      bodyEn,
      bodyHi,
      severity,
      recipientCount: estimatedRecipients
    });

    setToastNotice(`🚀 Emergency Alert Broadcasted to ${estimatedRecipients.toLocaleString()} devices in ${radiusKm}km radius!`);
    setTimeout(() => setToastNotice(''), 5000);
  };

  return (
    <div className="space-y-6">
      
      {toastNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-2xl flex items-center justify-between shadow-md animate-bounce">
          <span>{toastNotice}</span>
          <span className="font-mono text-[10px] text-[#2F4538] font-bold">NIC Geofence Gateway v4</span>
        </div>
      )}

      {/* DRAFTING FORM GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Broadcast Form Inputs */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
          
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
            <Radio className="w-5 h-5 text-[#E8935C]" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t.broadcastTitle}
              </h3>
              <p className="text-xs text-slate-500 font-medium">{t.broadcastSub}</p>
            </div>
          </div>

          <form onSubmit={handlePublish} className="space-y-4 text-xs">
            
            {/* Region & Radius */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t.selectRegion}
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-medium focus:ring-2 focus:ring-[#E8935C] focus:bg-white"
                >
                  <option value="Himachal Pradesh (Solang Valley & Rohtang Sector)">Himachal Pradesh (Solang / Rohtang)</option>
                  <option value="Varanasi Ghats Heritage Area (UP)">Varanasi Ghats Heritage Corridor</option>
                  <option value="Central Delhi & Connaught Place Circle">Central Delhi & Connaught Place</option>
                  <option value="South Goa Coastal Beach Circuit">South Goa Coastal Beach Circuit</option>
                  <option value="Uttarakhand (Rishikesh - Haridwar Belt)">Uttarakhand (Rishikesh - Haridwar Belt)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>{t.radiusKm}</span>
                  <span className="text-[#1B2A4A] font-mono font-extrabold">{radiusKm} km</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full accent-[#E8935C] cursor-pointer"
                />
              </div>
            </div>

            {/* Severity Level */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                {t.severityLabel}
              </label>
              <div className="flex gap-3">
                {(['Critical', 'Warning', 'Advisory'] as AlertSeverity[]).map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    className={`flex-1 py-2 rounded-xl font-extrabold border transition ${
                      severity === sev
                        ? sev === 'Critical'
                          ? 'bg-red-600 text-white border-red-700 shadow-sm'
                          : sev === 'Warning'
                          ? 'bg-[#E8935C] text-slate-950 border-amber-500 shadow-sm'
                          : 'bg-[#1B2A4A] text-white border-slate-800 shadow-sm'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Title & Body */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.titleEnLabel}</label>
                <input
                  type="text"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-medium focus:ring-2 focus:ring-[#E8935C] focus:bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.bodyEnLabel}</label>
                <textarea
                  rows={2}
                  value={bodyEn}
                  onChange={(e) => setBodyEn(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-medium focus:ring-2 focus:ring-[#E8935C] focus:bg-white"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-3 bg-[#1B2A4A] hover:bg-[#071933] text-white font-black rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4 text-[#E8935C]" />
                <span>{t.sendBroadcastBtn}</span>
              </button>
            </div>

          </form>

        </div>

        {/* Right Col: Live Geofence Audience Estimator & Preview Card */}
        <div className="space-y-6">
          
          {/* Audience Counter Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-[#E8935C] mx-auto flex items-center justify-center text-[#E8935C]">
              <Users className="w-6 h-6" />
            </div>

            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.estimatedRecipients}
            </div>

            <div className="text-4xl font-black text-[#1B2A4A] font-mono">
              ~{estimatedRecipients.toLocaleString()}
            </div>

            <p className="text-[11px] text-slate-500 font-medium">
              Active cell towers in {radiusKm} km radius (NIC Telecommunication Gateway Sync)
            </p>
          </div>



        </div>

      </div>

      {/* RECENT BROADCAST LOG TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 mb-4">
          <History className="w-5 h-5 text-amber-600" />
          <h3 className="text-base font-bold text-slate-900">
            {t.broadcastHistoryTitle}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase font-mono text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3">Broadcast ID</th>
                <th className="p-3">Region & Radius</th>
                <th className="p-3">Title</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Recipients Delivered</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {broadcasts.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono font-bold text-[#1B2A4A]">{b.id}</td>
                  <td className="p-3 font-medium">{b.region} ({b.radiusKm} km)</td>
                  <td className="p-3 font-extrabold text-slate-900">{b.titleEn}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                      b.severity === 'Critical' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}>
                      {b.severity}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-[#2F4538] font-bold">{b.deliveredCount.toLocaleString()} / {b.recipientCount.toLocaleString()}</td>
                  <td className="p-3 font-extrabold text-[#2F4538]">✓ {b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
