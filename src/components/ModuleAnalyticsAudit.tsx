import React, { useState } from 'react';
import {
  BarChart3,
  FileCheck2,
  Download,
  Search,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  MapPin,
  Calendar,
  Filter
} from 'lucide-react';
import { Language, AuditLog } from '../types';
import { i18n } from '../data/i18n';

interface ModuleAnalyticsAuditProps {
  language: Language;
  auditLogs: AuditLog[];
}

export const ModuleAnalyticsAudit: React.FC<ModuleAnalyticsAuditProps> = ({
  language,
  auditLogs
}) => {
  const t = i18n[language];
  const [searchFilter, setSearchFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.officerName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      log.targetId.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (log.reason && log.reason.toLowerCase().includes(searchFilter.toLowerCase())) ||
      log.details.toLowerCase().includes(searchFilter.toLowerCase());

    const matchesAction = actionFilter === 'ALL' || log.actionType === actionFilter;

    return matchesSearch && matchesAction;
  });

  const exportCsv = () => {
    const headers = ['ID', 'Timestamp', 'Officer', 'Badge', 'Action', 'Target ID', 'Reason', 'Details', 'IP'];
    const rows = auditLogs.map((l) => [
      l.id,
      l.timestamp,
      `"${l.officerName}"`,
      l.officerBadge,
      l.actionType,
      `"${l.targetId}"`,
      `"${l.reason || ''}"`,
      `"${l.details}"`,
      l.ipAddress
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Safety_Command_AuditLogs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* PERFORMANCE METRICS BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 mb-4">
          <BarChart3 className="w-5 h-5 text-[#FF9933]" />
          <h3 className="text-base font-bold text-slate-900">
            {t.performanceTitle}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 text-xs font-bold uppercase">{t.avgResponseTime}</div>
            <div className="text-2xl font-black text-[#138808] mt-1 font-mono">4.2 min</div>
            <div className="text-[11px] text-[#138808] font-bold mt-0.5">↓ 18% improvement vs Q2</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 text-xs font-bold uppercase">{t.resolutionRate}</div>
            <div className="text-2xl font-black text-[#0B2447] mt-1 font-mono">96.4%</div>
            <div className="text-[11px] text-blue-700 font-bold mt-0.5">342 incidents resolved</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 text-xs font-bold uppercase">Statutory Compliance</div>
            <div className="text-2xl font-black text-[#FF9933] mt-1 font-mono">100% Audit</div>
            <div className="text-[11px] text-slate-600 font-medium mt-0.5">0 unverified search breaches</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 text-xs font-bold uppercase">Monthly Inflow Sync</div>
            <div className="text-2xl font-black text-purple-700 mt-1 font-mono">1.42 Lakhs</div>
            <div className="text-[11px] text-slate-600 font-medium mt-0.5">Verified tourist check-ins</div>
          </div>

        </div>

        {/* Visual Charts / Breakdown Mockup */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 1: Frequent Incident Zones Bar */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              {t.frequentZones}
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-medium">
                  <span>1. Solang Trekking Trail, Kullu (HP)</span>
                  <span className="font-mono text-[#0B2447] font-bold">42 incidents</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-[#FF9933] w-[84%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-medium">
                  <span>2. Dashashwamedh Ghat Alleys, Varanasi (UP)</span>
                  <span className="font-mono text-[#0B2447] font-bold">28 incidents</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-[#FF9933] w-[56%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-medium">
                  <span>3. Canacona Tidal Cliffs, Goa</span>
                  <span className="font-mono text-[#0B2447] font-bold">19 incidents</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-[#FF9933] w-[38%]"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 2: Tourist Inflow vs Anomaly Trend */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              {t.inflowVsRisk}
            </div>

            <div className="h-32 flex items-end justify-between gap-2 pt-4 px-2 border-b border-slate-200">
              {['May', 'Jun', 'Jul', 'Aug (Cur)'].map((m, idx) => {
                const heightPct = [40, 65, 85, 55][idx];
                return (
                  <div key={m} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-gradient-to-t from-[#0B2447] to-[#FF9933] rounded-t hover:brightness-110 transition shadow-sm"
                    ></div>
                    <span className="text-[10px] text-slate-600 font-bold">{m}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* AUDIT LOGS TABLE & EXPORT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#138808]" />
              <span>{t.auditLogsTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">{t.auditLogsDesc}</p>
          </div>

          <button
            onClick={exportCsv}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4 text-[#FF9933]" />
            <span>{t.exportCsvBtn}</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4 text-xs">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search by Officer, Target ID, Reason, or Details..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF9933] focus:bg-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 font-semibold focus:outline-none focus:bg-white"
          >
            <option value="ALL">All Action Types</option>
            <option value="TOURIST_LOOKUP">TOURIST_LOOKUP</option>
            <option value="DISPATCH_UNIT">DISPATCH_UNIT</option>
            <option value="BROADCAST_SENT">BROADCAST_SENT</option>
          </select>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase font-mono text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3">{t.colTimestamp}</th>
                <th className="p-3">{t.colOfficer}</th>
                <th className="p-3">{t.colAction}</th>
                <th className="p-3">{t.colTarget}</th>
                <th className="p-3">{t.colReason}</th>
                <th className="p-3">Details</th>
                <th className="p-3">{t.colIp}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                    No matching audit logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition font-mono">
                    <td className="p-3 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                    <td className="p-3 text-slate-900 font-bold">{log.officerName} ({log.officerBadge})</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        log.actionType === 'TOURIST_LOOKUP'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : log.actionType === 'DISPATCH_UNIT'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {log.actionType}
                      </span>
                    </td>
                    <td className="p-3 text-[#0B2447] font-bold">{log.targetId}</td>
                    <td className="p-3 text-[#138808] font-bold">{log.reason || 'N/A'}</td>
                    <td className="p-3 text-slate-700 max-w-xs truncate font-sans font-medium">{log.details}</td>
                    <td className="p-3 text-slate-400 text-[10px]">{log.ipAddress}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
