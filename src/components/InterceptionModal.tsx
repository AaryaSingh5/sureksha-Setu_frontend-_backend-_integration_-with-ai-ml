import React, { useState } from 'react';
import {
  Lock,
  ShieldAlert,
  FileCheck2,
  AlertOctagon,
  Scale,
  Search,
  X,
  FileText
} from 'lucide-react';
import { Language, InterceptionReason } from '../types';
import { i18n } from '../data/i18n';

interface InterceptionModalProps {
  language: Language;
  touristId: string;
  onConfirm: (reason: InterceptionReason, notes: string) => void;
  onCancel: () => void;
}

export const InterceptionModal: React.FC<InterceptionModalProps> = ({
  language,
  touristId,
  onConfirm,
  onCancel
}) => {
  const t = i18n[language];
  const [selectedReason, setSelectedReason] = useState<InterceptionReason>('Active SOS Response');
  const [officerNotes, setOfficerNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(selectedReason, officerNotes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border-2 border-[#E8935C] rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-left">
        
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-950/90 border border-[#E8935C] flex items-center justify-center text-[#E8935C] flex-shrink-0 shadow-lg">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#E8935C] flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> STATUTORY INTERCEPTION PROTOCOL
            </div>
            <h3 className="text-xl font-extrabold text-white">
              {t.interceptionTitle}
            </h3>
          </div>
        </div>

        {/* Notice Disclaimer */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 mb-5 leading-relaxed">
          {t.interceptionDesc}
          <div className="mt-2 font-mono font-bold text-amber-300">
            Target ID: <span className="underline decoration-[#E8935C]">{touristId}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Reason Radio Group */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
              {t.selectReasonLabel} *
            </label>

            <div className="space-y-2">
              
              {/* Reason 1 */}
              <label
                onClick={() => setSelectedReason('Active SOS Response')}
                className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition ${
                  selectedReason === 'Active SOS Response'
                    ? 'bg-red-950/60 border-red-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <AlertOctagon className={`w-5 h-5 ${selectedReason === 'Active SOS Response' ? 'text-red-400' : 'text-slate-500'}`} />
                <div className="flex-1">
                  <div className="text-sm font-bold">{t.reasonActiveSos}</div>
                  <div className="text-[11px] text-slate-400">Emergency beacon active or continuous heart-rate anomaly detected.</div>
                </div>
              </label>

              {/* Reason 2 */}
              <label
                onClick={() => setSelectedReason('Filed Missing Person Report')}
                className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition ${
                  selectedReason === 'Filed Missing Person Report'
                    ? 'bg-amber-950/60 border-amber-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <FileCheck2 className={`w-5 h-5 ${selectedReason === 'Filed Missing Person Report' ? 'text-amber-400' : 'text-slate-500'}`} />
                <div className="flex-1">
                  <div className="text-sm font-bold">{t.reasonMissing}</div>
                  <div className="text-[11px] text-slate-400">Formal missing report logged by embassy or family member.</div>
                </div>
              </label>

              {/* Reason 3 */}
              <label
                onClick={() => setSelectedReason('Designated Check-in Routine')}
                className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition ${
                  selectedReason === 'Designated Check-in Routine'
                    ? 'bg-emerald-950/60 border-emerald-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Search className={`w-5 h-5 ${selectedReason === 'Designated Check-in Routine' ? 'text-emerald-400' : 'text-slate-500'}`} />
                <div className="flex-1">
                  <div className="text-sm font-bold">{t.reasonRoutine}</div>
                  <div className="text-[11px] text-slate-400">Scheduled checkpoint audit for high-risk trekking circuits.</div>
                </div>
              </label>

              {/* Reason 4 */}
              <label
                onClick={() => setSelectedReason('Judicial / Legal Warrant')}
                className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition ${
                  selectedReason === 'Judicial / Legal Warrant'
                    ? 'bg-blue-950/60 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Scale className={`w-5 h-5 ${selectedReason === 'Judicial / Legal Warrant' ? 'text-blue-400' : 'text-slate-500'}`} />
                <div className="flex-1">
                  <div className="text-sm font-bold">{t.reasonWarrant}</div>
                  <div className="text-[11px] text-slate-400">Court order or law enforcement investigative request.</div>
                </div>
              </label>

            </div>
          </div>

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.officerNotesLabel}</span>
            </label>
            <input
              type="text"
              value={officerNotes}
              onChange={(e) => setOfficerNotes(e.target.value)}
              placeholder="e.g., FIR-902/2026 or Solang Patrol Ref #4"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E8935C]"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#E8935C] hover:bg-amber-500 text-slate-950 text-sm font-black transition shadow-lg"
            >
              {t.confirmAccessBtn}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
