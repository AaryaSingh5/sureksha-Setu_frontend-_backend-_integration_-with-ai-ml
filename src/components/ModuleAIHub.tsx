import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Flame,
  AlertTriangle,
  Activity,
  MapPin,
  Cpu,
  ArrowRight,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Language, AnomalyCluster, AILog } from '../types';
import { i18n } from '../data/i18n';
import { fetchRiskAlertsAPI, submitAlertFeedbackAPI, fetchModelMetadataAPI } from '../lib/api';

interface ModuleAIHubProps {
  language: Language;
  clusters: AnomalyCluster[];
  aiLogs: AILog[];
  onInvestigateCluster: (cluster: AnomalyCluster) => void;
  onNavigateToMap: () => void;
}

export const ModuleAIHub: React.FC<ModuleAIHubProps> = ({
  language,
  clusters,
  aiLogs,
  onInvestigateCluster,
  onNavigateToMap
}) => {
  const t = i18n[language];
  const [selectedClusterId, setSelectedClusterId] = useState<string>(clusters[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'heatmaps' | 'alerts' | 'metadata'>('heatmaps');

  // FastAPI Risk States
  const [riskAlerts, setRiskAlerts] = useState<any[]>([]);
  const [modelMeta, setModelMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);

  const loadRiskEngineData = async () => {
    try {
      setLoading(true);
      const alerts = await fetchRiskAlertsAPI();
      setRiskAlerts(alerts);
      const meta = await fetchModelMetadataAPI();
      setModelMeta(meta);
    } catch (e) {
      console.warn("FastAPI Risk Engine is not online yet. Using placeholder data.", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiskEngineData();
    // Poll alerts every 10 seconds for real-time status updates
    const interval = setInterval(loadRiskEngineData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleFeedback = async (alertId: string, feedbackType: 'false_positive' | 'confirmed') => {
    try {
      setFeedbackLoading(alertId);
      await submitAlertFeedbackAPI(alertId, feedbackType);
      // Reload alerts immediately
      const alerts = await fetchRiskAlertsAPI();
      setRiskAlerts(alerts);
    } catch (e) {
      console.error("Feedback error:", e);
    } finally {
      setFeedbackLoading(null);
    }
  };

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId) || clusters[0];

  return (
    <div className="space-y-6">
      
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Stat 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.riskScore}</div>
            <div className="text-2xl font-black text-[#1B2A4A] mt-1">
              {riskAlerts.length > 0 ? `${riskAlerts[0].total_score} / 100` : "88 / 100"}
            </div>
            <div className="text-[11px] text-amber-700 font-bold mt-0.5">
              {riskAlerts.length > 0 ? `Active risk: ${riskAlerts[0].band}` : "High Risk in Kullu Sector"}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#E8935C]">
            <Flame className="w-6 h-6 text-[#E8935C] animate-pulse" />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Threat Clusters</div>
            <div className="text-2xl font-black text-red-600 mt-1">{clusters.length} Zones</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {riskAlerts.filter(a => a.status === 'NEW').length} Pending AI Reviews
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.confidenceLevel}</div>
            <div className="text-2xl font-black text-[#2F4538] mt-1">
              {modelMeta ? "98.5%" : "94.2%"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {modelMeta ? `Model: ${modelMeta.model_version}` : "Model Anomaly-v4.2"}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#2F4538]">
            <Cpu className="w-6 h-6 text-[#2F4538]" />
          </div>
        </div>

      </div>

      {/* Tabs Selector Bar */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('heatmaps')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'heatmaps'
              ? 'border-[#E8935C] text-[#1B2A4A] font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Regional Heatmaps</span>
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'alerts'
              ? 'border-[#E8935C] text-[#1B2A4A] font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>Context Risk Alerts</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold font-mono ${
            riskAlerts.filter(a => a.status === 'NEW').length > 0
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-slate-200 text-slate-700'
          }`}>
            {riskAlerts.filter(a => a.status === 'NEW').length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('metadata')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'metadata'
              ? 'border-[#E8935C] text-[#1B2A4A] font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>ML Model Specs</span>
        </button>
      </div>

      {/* Tab 1: Heatmaps */}
      {activeTab === 'heatmaps' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Left 2 Cols: High-Risk Map Heatmap */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <BrainCircuit className="w-5 h-5 text-[#E8935C]" />
                <h3 className="text-base font-bold text-slate-900">{t.highRiskHeatmap}</h3>
              </div>
              <button
                onClick={onNavigateToMap}
                className="text-xs font-extrabold text-[#1B2A4A] hover:underline flex items-center gap-1"
              >
                <span>{t.viewInMap}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#E8935C]" />
              </button>
            </div>

            {/* Simulated Heatmap Vector Canvas */}
            <div className="relative w-full h-80 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-40"></div>
              <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-ping pointer-events-none"></div>

              {clusters.map((cluster) => {
                const isSelected = cluster.id === selectedCluster.id;
                const leftPos = cluster.id === 'AC-101' ? '30%' : cluster.id === 'AC-102' ? '65%' : '48%';
                const topPos = cluster.id === 'AC-101' ? '25%' : cluster.id === 'AC-102' ? '55%' : '75%';

                return (
                  <div
                    key={cluster.id}
                    onClick={() => setSelectedClusterId(cluster.id)}
                    style={{ left: leftPos, top: topPos }}
                    className="absolute cursor-pointer -translate-x-1/2 -translate-y-1/2 group"
                  >
                    <div className={`w-24 h-24 rounded-full blur-xl animate-pulse transition-all ${
                      cluster.riskScore > 80 ? 'bg-red-500/30' : 'bg-amber-500/30'
                    }`}></div>
                    <div className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs shadow-md transition-transform ${
                      isSelected
                        ? 'bg-red-600 border-white text-white scale-125 z-20'
                        : 'bg-[#1B2A4A] border-[#E8935C] text-white group-hover:scale-110'
                    }`}>
                      {cluster.riskScore}
                    </div>
                  </div>
                );
              })}

              <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200 rounded-lg p-2.5 text-[10px] space-y-1 shadow-md text-slate-800">
                <div className="font-extrabold text-[#1B2A4A]">HEATMAP INTENSITY</div>
                <div className="flex items-center gap-1 font-semibold">
                  <span className="w-3 h-3 rounded bg-red-600"></span> 80-100 Critical Hazard
                </div>
                <div className="flex items-center gap-1 font-semibold">
                  <span className="w-3 h-3 rounded bg-amber-500"></span> 60-79 Moderate Anomaly
                </div>
              </div>
            </div>

            {selectedCluster && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-600" />
                    <span>{selectedCluster.regionName}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 font-extrabold">
                    {selectedCluster.anomalyType}
                  </span>
                </div>
                <p className="mt-2 text-slate-700 leading-relaxed font-medium">
                  {language === 'hi' ? selectedCluster.descriptionHi : selectedCluster.descriptionEn}
                </p>
                <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-medium">
                  <strong>Recommended Action:</strong> {language === 'hi' ? selectedCluster.recommendedActionHi : selectedCluster.recommendedActionEn}
                </div>
              </div>
            )}
          </div>

          {/* Right Col: Incident Clusters List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-600" />
                  <span>{t.incidentClusters}</span>
                </h3>
                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] font-bold">
                  {clusters.length} Active
                </span>
              </div>
              <div className="space-y-3">
                {clusters.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClusterId(c.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      selectedClusterId === c.id
                        ? 'bg-amber-50/80 border-[#E8935C] shadow-sm'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-extrabold text-slate-900">{c.regionName}</span>
                      <span className="font-mono font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">
                        {c.riskScore}% Risk
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 line-clamp-2 font-medium">
                      {language === 'hi' ? c.descriptionHi : c.descriptionEn}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-500 font-medium">Continuous AI Anomaly Model: Active Stream</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Context-Aware Risk Alerts */}
      {activeTab === 'alerts' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span>Real-Time Context Risk Alerts</span>
            </h3>
            <button
              onClick={loadRiskEngineData}
              className="text-xs flex items-center gap-1 text-[#1B2A4A] font-bold hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Engine Data</span>
            </button>
          </div>

          {riskAlerts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-medium space-y-2">
              <CheckCircle2 className="w-12 h-12 text-[#2F4538] mx-auto" />
              <p className="text-sm">No risk alerts detected. All active tourists are within safe baseline bounds.</p>
              <p className="text-xs opacity-75">Connect the simulator or trigger pings to test the scoring pipeline.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {riskAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between gap-4 transition duration-200 ${
                    alert.status === 'NEW'
                      ? 'bg-slate-50 border-slate-300 shadow-sm'
                      : alert.status === 'DISMISSED'
                      ? 'bg-emerald-50/50 border-emerald-200 opacity-60'
                      : 'bg-red-50/50 border-red-200'
                  }`}
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-800 bg-slate-200 px-2.5 py-0.5 rounded-full font-mono">
                        {alert.tourist_id}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                        alert.priority === 'P1' ? 'bg-red-600 text-white' : alert.priority === 'P2' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {alert.priority}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                        alert.band === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-700' : alert.band === 'HIGH' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        {alert.band} ({alert.total_score}/100)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 ml-auto">
                        <Clock className="w-3 h-3" />
                        {alert.created_at.substring(11, 19)} UTC
                      </span>
                    </div>

                    {/* Fired Factors explainability */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                      {/* Rules */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="font-extrabold text-[#1B2A4A] mb-1">Rule Engine Contribution: +{alert.details.breakdown.rule_based.score} pts</div>
                        {alert.details.breakdown.rule_based.factors.length === 0 ? (
                          <div className="text-slate-400 italic">No rules fired.</div>
                        ) : (
                          <ul className="list-disc pl-4 space-y-0.5 text-slate-600 font-medium">
                            {alert.details.breakdown.rule_based.factors.map((f: any, i: number) => (
                              <li key={i}>{f.factor.replace('_', ' ')} (+{f.points})</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Regional */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="font-extrabold text-[#1B2A4A] mb-1">Regional Context Layer: +{alert.details.breakdown.regional_context.score} pts</div>
                        <p className="text-slate-600 leading-relaxed font-medium">
                          {alert.details.breakdown.regional_context.reason || "Normal context risk parameters."}
                        </p>
                      </div>

                      {/* ML Anomaly */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="font-extrabold text-[#1B2A4A] mb-1">ML Isolation Forest: +{alert.details.breakdown.ml_anomaly.score} pts</div>
                        <div className="text-slate-600 font-medium space-y-0.5">
                          <div>Anomaly Score: {Math.round(alert.details.breakdown.ml_anomaly.raw_anomaly_score * 100)}%</div>
                          <div className="text-[10px] opacity-75 font-mono">Decision: {alert.details.breakdown.ml_anomaly.raw_decision_value}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex md:flex-col justify-end items-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
                    {alert.status === 'NEW' ? (
                      <>
                        <button
                          disabled={feedbackLoading === alert.id}
                          onClick={() => handleFeedback(alert.id, 'confirmed')}
                          className="px-3 py-1.5 bg-[#E8935C] text-white hover:bg-amber-600 text-xs font-black rounded-lg flex items-center gap-1 shadow-sm transition disabled:opacity-50"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Confirm</span>
                        </button>
                        <button
                          disabled={feedbackLoading === alert.id}
                          onClick={() => handleFeedback(alert.id, 'false_positive')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 transition disabled:opacity-50"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>False Pos</span>
                        </button>
                      </>
                    ) : (
                      <div className="text-xs font-bold font-mono py-1 px-2.5 rounded bg-white border border-slate-200 text-slate-500">
                        {alert.status}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Model Metadata */}
      {activeTab === 'metadata' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-center border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#2F4538]" />
              <span>Machine Learning Anomaly Detection Model Specs</span>
            </h3>
          </div>

          {!modelMeta ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs font-medium text-center">
              Risk Engine backend not connected. Run train_model.py to initialize the Isolation Forest.
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-1">
                <div className="font-extrabold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Synthetic Data Disclosure Notice</span>
                </div>
                <p className="leading-relaxed font-medium text-[11px]">
                  {modelMeta.warning}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 border border-slate-200 p-4 rounded-xl bg-slate-50">
                  <div className="font-black text-[#1B2A4A] text-sm mb-2">Model Summary</div>
                  <div className="space-y-1.5 font-medium text-slate-700">
                    <div><strong>Algorithm:</strong> {modelMeta.model_type}</div>
                    <div><strong>Version ID:</strong> {modelMeta.model_version}</div>
                    <div><strong>Training Date:</strong> {modelMeta.training_date}</div>
                    <div><strong>DataSource:</strong> {modelMeta.training_data_source}</div>
                  </div>
                </div>

                <div className="space-y-2 border border-slate-200 p-4 rounded-xl bg-slate-50">
                  <div className="font-black text-[#1B2A4A] text-sm mb-2">Features Extracted per Location Ping</div>
                  <ul className="list-decimal pl-5 space-y-1 font-mono text-[10px] text-slate-600">
                    {modelMeta.features.map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Contextual Stream Logs (always present) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-[#2F4538] animate-pulse" />
            <h3 className="text-base font-bold text-slate-900">
              {t.contextualAnalysis}
            </h3>
          </div>
          <span className="text-xs font-mono text-[#2F4538] flex items-center gap-1 font-bold">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Live Telemetry
          </span>
        </div>

        <div className="space-y-2 font-mono text-xs">
          {aiLogs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded-lg border flex items-start space-x-3 ${
                log.severity === 'critical'
                  ? 'bg-red-50 border-red-200 text-red-950'
                  : log.severity === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <span className="text-slate-500 flex-shrink-0 text-[10px] pt-0.5">[{log.timestamp}]</span>
              <div className="flex-1">
                <div className="font-bold">{language === 'hi' ? log.messageHi : log.messageEn}</div>
                <div className="text-[10px] opacity-80 mt-0.5">Region: {log.region} • Confidence Index: {log.modelConfidence}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
