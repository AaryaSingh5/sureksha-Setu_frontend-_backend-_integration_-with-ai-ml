import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileCheck2,
  Download,
  Search,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  CheckCircle,
  MapPin,
  Calendar,
  Filter,
  Lock,
  Link2,
  ShieldAlert,
  RefreshCw,
  Database
} from 'lucide-react';
import { Language, AuditLog, TouristProfile, SOSIncident } from '../types';
import { i18n } from '../data/i18n';
import {
  verifyAuditChainAPI,
  fetchAuditChainAPI,
  verifyAuditBlockchainAPI,
  type ChainBlock
} from '../lib/api';

interface ModuleAnalyticsAuditProps {
  language: Language;
  auditLogs: AuditLog[];
  tourists: TouristProfile[];
  incidents: SOSIncident[];
}

export const ModuleAnalyticsAudit: React.FC<ModuleAnalyticsAuditProps> = ({
  language,
  auditLogs,
  tourists,
  incidents
}) => {
  const t = i18n[language];
  const [searchFilter, setSearchFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  // Tab Management & Blockchain Ledger Integration State
  const [activeTab, setActiveTab] = useState<'officer' | 'blockchain'>('officer');
  const [chainBlocks, setChainBlocks] = useState<ChainBlock[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<{
    isValid: boolean | null;
    blocksCount: number;
    message: string;
  }>({ isValid: null, blocksCount: 0, message: 'Not verified yet' });
  const [isLoadingChain, setIsLoadingChain] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);

  // Cryptographic Chain Verification State (Local)
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    brokenAtLogId?: string;
    message?: string;
    totalEntries?: number;
    latestHash?: string;
  } | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    setVerificationError(null);
    try {
      const res = await verifyAuditChainAPI();
      setVerificationResult(res);
    } catch (err: any) {
      setVerificationError(err.message || 'Verification service unreachable');
    } finally {
      setIsVerifying(false);
    }
  };

  const loadChain = async () => {
    setIsLoadingChain(true);
    setChainError(null);
    try {
      const blocks = await fetchAuditChainAPI();
      setChainBlocks(Array.isArray(blocks) ? blocks : []);
    } catch (err: any) {
      console.error("Error loading chain:", err);
      setChainBlocks([]);
      setChainError(err?.message || 'Failed to load blockchain ledger. The risk engine may be offline.');
    } finally {
      setIsLoadingChain(false);
    }
  };

  const verifyChain = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyAuditBlockchainAPI();
      setVerificationStatus({
        isValid: Boolean(result?.is_valid),
        blocksCount: result?.blocks_count ?? 0,
        message: result?.verification_message || 'Verification completed'
      });
    } catch (err: any) {
      setVerificationStatus({
        isValid: false,
        blocksCount: 0,
        message: 'Verification request failed: ' + (err?.message || 'network error')
      });
    } finally {
      setIsVerifying(false);
    }
  };


  useEffect(() => {
    if (activeTab === 'blockchain') {
      loadChain();
    }
  }, [activeTab]);

  const filteredLogs = (auditLogs || []).filter((log) => {
    const q = (searchFilter || '').toLowerCase();
    const officerName = (log.officerName || '').toLowerCase();
    const targetId = (log.targetId || '').toLowerCase();
    const reason = (log.reason || '').toLowerCase();
    const details = (log.details || '').toLowerCase();
    const entryHash = (log.entryHash || '').toLowerCase();
    const matchesSearch =
      !q ||
      officerName.includes(q) ||
      targetId.includes(q) ||
      reason.includes(q) ||
      details.includes(q) ||
      entryHash.includes(q);

    const matchesAction = actionFilter === 'ALL' || log.actionType === actionFilter;

    return matchesSearch && matchesAction;
  });

  const exportCsv = () => {
    const headers = ['ID', 'Timestamp', 'Officer', 'Badge', 'Action', 'Target ID', 'Reason', 'Details', 'IP', 'Prev Hash', 'Entry Hash'];
    const rows = (auditLogs || []).map((l) => [
      l.id || '',
      l.timestamp || '',
      `"${(l.officerName || '').replace(/"/g, '""')}"`,
      l.officerBadge || '',
      l.actionType || '',
      `"${(l.targetId || '').replace(/"/g, '""')}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      l.ipAddress || '',
      l.prevHash || 'GENESIS',
      l.entryHash || ''
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
  
  const totalIncidents = incidents ? incidents.length : 0;
  const resolvedIncidents = incidents ? incidents.filter((i) => i.status === 'Resolved').length : 0;
  const resolutionRate = totalIncidents > 0 ? ((resolvedIncidents / totalIncidents) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-6">

      {/* PERFORMANCE METRICS BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 mb-4">
          <BarChart3 className="w-5 h-5 text-[#E8935C]" />
          <h3 className="text-base font-bold text-slate-900">
            {t.performanceTitle}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 text-xs font-bold uppercase">{t.avgResponseTime}</div>
            <div className="text-2xl font-black text-[#2F4538] mt-1 font-mono">4.2 min</div>
            <div className="text-[11px] text-[#2F4538] font-bold mt-0.5">↓ 18% improvement vs Q2</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 text-xs font-bold uppercase">{t.resolutionRate}</div>
            <div className="text-2xl font-black text-[#1B2A4A] mt-1 font-mono">{resolutionRate}%</div>
            <div className="text-[11px] text-blue-700 font-bold mt-0.5">{resolvedIncidents} / {totalIncidents} resolved</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 text-xs font-bold uppercase">Audit Log Count</div>
            <div className="text-2xl font-black text-[#138808] mt-1 font-mono">{auditLogs.length} Entries</div>
            <div className="text-[11px] text-slate-600 font-medium mt-0.5">Cryptographically chained logs</div>
          </div >

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 text-xs font-bold uppercase">Registered Tourists</div>
            <div className="text-2xl font-black text-purple-700 mt-1 font-mono">{tourists.length} Tourists</div>
            <div className="text-[11px] text-slate-600 font-medium mt-0.5">Active in safety database</div>
          </div>

        </div >

        {/* Visual Charts / Breakdown Mockup */}
        <div className="mt-6">

          {/* Chart 1: Frequent Incident Zones Bar (Full Width) */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              {t.frequentZones}
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-medium text-xs">
                  <span>1. Solang Trekking Trail, Kullu (HP)</span>
                  <span className="font-mono text-[#1B2A4A] font-bold">42 incidents</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-[#E8935C] w-[84%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-medium text-xs">
                  <span>2. Dashashwamedh Ghat Alleys, Varanasi (UP)</span>
                  <span className="font-mono text-[#1B2A4A] font-bold">28 incidents</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-[#E8935C] w-[56%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-medium text-xs">
                  <span>3. Canacona Tidal Cliffs, Goa</span>
                  <span className="font-mono text-[#1B2A4A] font-bold">19 incidents</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-[#E8935C] w-[38%]"></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div >

      {/* TABS SELECTOR FOR OFFICER ACTIVITY VS BLOCKCHAIN LEDGER */}
      < div className="flex border-b border-slate-200 space-x-6 text-sm mb-2" >
        <button
          onClick={() => setActiveTab('officer')}
          className={`pb-3 font-bold transition flex items-center gap-2 ${activeTab === 'officer'
            ? 'border-b-2 border-[#FF9933] text-[#0B2447]'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Officer Activity Logs</span>
        </button>
        <button
          onClick={() => setActiveTab('blockchain')}
          className={`pb-3 font-bold transition flex items-center gap-2 ${activeTab === 'blockchain'
            ? 'border-b-2 border-[#FF9933] text-[#0B2447]'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          <Database className="w-4 h-4" />
          <span className="flex items-center gap-1.5">
            <span>Blockchain Audit Ledger</span>
            <span className="px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 rounded font-mono">Simulated</span>
          </span>
        </button>
      </div >

      {/* AUDIT LOGS TABLE & EXPORT */}
      < div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" >

        {activeTab === 'officer' ? (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#138808]" />
                  <span>{t.auditLogsTitle}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Immutable, tamper-evident log records cryptographically chained using SHA-256 hashes.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={handleVerifyChain}
                  disabled={isVerifying}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 shadow-sm border cursor-pointer ${isVerifying
                      ? 'bg-slate-100 text-slate-400 border-slate-300'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-[#138808] border-emerald-300'
                    }`}
                >
                  <Lock className={`w-4 h-4 ${isVerifying ? 'animate-spin' : 'text-[#138808]'}`} />
                  <span>{isVerifying ? 'Verifying Chain...' : 'Verify Chain Integrity'}</span>
                </button>

                <button
                  onClick={exportCsv}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#E8935C]" />
                  <span>{t.exportCsvBtn}</span>
                </button>
              </div>
            </div>

            {/* Cryptographic Verification Status Banner */}
            {verificationResult && (
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 text-xs animate-fade-in mb-4 ${verificationResult.valid
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-red-50 border-red-300 text-red-950'
                  }`}
              >
                {verificationResult.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-[#138808] shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 flex-1">
                  <div className="font-black text-sm flex items-center justify-between flex-wrap gap-2">
                    <span>
                      {verificationResult.valid
                        ? `✅ Cryptographic Chain Integrity Verified (${verificationResult.totalEntries} Blocks Linked)`
                        : `⚠️ Tampering Detected at Log #${verificationResult.brokenAtLogId}`}
                    </span>
                    <span className="font-mono text-[10px] bg-white/80 px-2 py-0.5 rounded border border-slate-300 font-bold">
                      SHA-256 Hash Chain
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed font-medium">
                    {verificationResult.valid
                      ? `All audit log blocks match their computed cryptographic hashes in strict sequence. No records have been altered, injected, or removed. Latest Block Hash: ${verificationResult.latestHash || 'N/A'}`
                      : verificationResult.message || 'Cryptographic mismatch detected between stored hash and computed record state.'}
                  </p>
                </div>
              </div>
            )}

            {verificationError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold mb-4">
                Verification Error: {verificationError}
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 text-xs">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search by Officer, Target ID, Reason, Details, or SHA-256 Hash..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#E8935C] focus:bg-white"
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
                <option value="TICKET_STATUS_CHANGE">TICKET_STATUS_CHANGE</option>
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
                    <th className="p-3">Hash Link (SHA-256)</th>
                    <th className="p-3">{t.colIp}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                        No matching audit logs found.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition font-mono">
                        <td className="p-3 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-3 text-slate-900 font-bold">{log.officerName} ({log.officerBadge})</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${log.actionType === 'TOURIST_LOOKUP'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : log.actionType === 'DISPATCH_UNIT'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                            {log.actionType}
                          </span>
                        </td>
                        <td className="p-3 text-[#1B2A4A] font-bold">{log.targetId}</td>
                        <td className="p-3 text-[#2F4538] font-bold">{log.reason || 'N/A'}</td>
                        <td className="p-3 text-slate-700 max-w-xs truncate font-sans font-medium">{log.details}</td>
                        <td className="p-3 font-mono text-[10px] text-slate-500 max-w-[120px] truncate" title={log.entryHash || 'GENESIS / UNCHAINED'}>
                          {log.entryHash ? `${log.entryHash.slice(0, 10)}...` : '—'}
                        </td>
                        <td className="p-3 text-slate-400 text-[10px]">{log.ipAddress}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
    <div className="space-y-6">

      {/* Blockchain Header & Verification Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-[#FF9933]" />
            <span>Cryptographic Safety Audit Ledger</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            A tamper-proof permissioned blockchain ledger logging critical safety alerts and DID registrations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Verification Badge */}
          {verificationStatus.isValid === null ? (
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold border border-slate-300">
              Ledger Status: Unverified
            </span>
          ) : verificationStatus.isValid ? (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Integrity Verified</span>
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold border border-rose-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Ledger Corrupted!</span>
            </span>
          )}

          <button
            onClick={verifyChain}
            disabled={isVerifying}
            className="px-4 py-2 bg-[#0B2447] hover:bg-[#0b2447]/90 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>Verify Ledger</span>
          </button>
        </div>
      </div>

      {/* Verification Status Details Alert */}
      {verificationStatus.message && (
        <div className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 ${verificationStatus.isValid === null
          ? 'bg-slate-50 border-slate-200 text-slate-600'
          : verificationStatus.isValid
            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
          {verificationStatus.isValid === false ? (
            <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <div className="font-bold">Ledger Integrity Message</div>
            <div className="mt-0.5 font-mono">{verificationStatus.message}</div>
          </div>
        </div>
      )}

      {/* Block Ledger Explorer */}
      {isLoadingChain ? (
        <div className="p-12 text-center text-xs text-slate-500 font-medium">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#FF9933] mb-2" />
          <span>Loading blockchain blocks...</span>
        </div>
      ) : chainError ? (
        <div className="p-12 text-center text-slate-500 border border-dashed border-rose-200 rounded-xl bg-rose-50/40">
          <ShieldAlert className="w-8 h-8 text-rose-300 mx-auto mb-2" />
          <div className="text-xs font-bold text-rose-800">Unable to load ledger</div>
          <p className="text-[11px] text-rose-600 mt-1 max-w-xs mx-auto">{chainError}</p>
        </div>
      ) : chainBlocks.length === 0 ? (
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
          <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <div className="text-xs font-bold text-slate-800">Ledger is Empty</div>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
            No blocks have been generated yet. Issue a Digital Identity or trigger critical alerts to record on-chain.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Blockchain Blocks Ledger ({chainBlocks.length} Blocks)
          </div>

          <div className="grid grid-cols-1 gap-4 max-h-[500px] overflow-y-auto pr-1">
            {chainBlocks.map((block) => (
              <div
                key={block.block_index}
                className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition text-xs space-y-3"
              >
                {/* Top bar */}
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#0B2447] text-white rounded text-[10px] font-mono font-bold">
                      BLOCK #{block.block_index}
                    </span>
                    {block.block_index === 0 && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[9px] font-mono font-bold">
                        Genesis Block
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">{block.timestamp}</span>
                </div>

                {/* Cryptographic Linkage Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
                  <div>
                    <span className="font-bold text-slate-700">Block Hash:</span>
                    <span className="ml-1 text-slate-600 bg-slate-200/50 px-1.5 py-0.5 rounded truncate inline-block max-w-[250px] align-middle" title={block.hash}>
                      {block.hash}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">Previous Hash:</span>
                    <span className="ml-1 text-slate-600 bg-slate-200/50 px-1.5 py-0.5 rounded truncate inline-block max-w-[250px] align-middle" title={block.previous_hash}>
                      {block.previous_hash}
                    </span>
                  </div>
                </div>

                {/* Block Data Payload */}
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto shadow-inner border border-slate-800">
                  <div className="text-[9px] text-slate-500 uppercase font-sans font-bold mb-1">Block Data Payload</div>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(block.data, null, 2)}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )}
</div>
    </div>
  );
};


