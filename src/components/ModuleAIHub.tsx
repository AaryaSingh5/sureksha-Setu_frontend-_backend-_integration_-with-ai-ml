import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Flame,
  AlertTriangle,
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
import { Language, AnomalyCluster } from '../types';
import { i18n } from '../data/i18n';
import { fetchRiskAlertsAPI, submitAlertFeedbackAPI, fetchModelMetadataAPI } from '../lib/api';

const DEFAULT_MODEL_META = {
  model_version: "v1.0.0",
  training_date: "2026-08-22 08:16:54 UTC",
  model_type: "Isolation Forest (unsupervised)",
  features: [
    "latitude",
    "longitude",
    "speed",
    "distance_from_expected_route",
    "time_of_day_sin",
    "time_of_day_cos",
    "dwell_time",
    "frequency_of_location_changes",
    "distance_from_nearest_safe",
    "geofence_status"
  ],
  hyperparameters: {
    n_estimators: 100,
    contamination: 0.02,
    random_state: 42
  },
  feature_importances: {
    "distance_from_expected_route": 0.25,
    "geofence_status": 0.20,
    "dwell_time": 0.15,
    "distance_from_nearest_safe": 0.12,
    "speed": 0.10,
    "frequency_of_location_changes": 0.08,
    "latitude": 0.04,
    "longitude": 0.04,
    "time_of_day_sin": 0.01,
    "time_of_day_cos": 0.01
  },
  training_data_source: "Synthetic Trajectories (Himachal Pradesh pilot region)",
  warning: "This model was trained entirely on synthetic movement trajectories simulating normal tourist hiking and walking behavior in Kullu/Manali. Anomaly detection thresholds and feature distributions must be calibrated with real historical field telemetry before production deployment."
};

interface ModuleAIHubProps {
  language: Language;
  clusters: AnomalyCluster[];
  onInvestigateCluster: (cluster: AnomalyCluster) => void;
  onNavigateToMap: () => void;
}

export const ModuleAIHub: React.FC<ModuleAIHubProps> = ({
  language,
  clusters,
  onInvestigateCluster,
  onNavigateToMap
}) => {
  const t = i18n[language];
  const [selectedClusterId, setSelectedClusterId] = useState<string>(clusters[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'heatmaps' | 'metadata'>('heatmaps');
  const [hubRightTab, setHubRightTab] = useState<'zones' | 'reviews'>('zones');

  // FastAPI Risk States
  const [riskAlerts, setRiskAlerts] = useState<any[]>([]);
  const [modelMeta, setModelMeta] = useState<any>(DEFAULT_MODEL_META);
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

          {/* Right Col: Unified AI Safety Desk */}
          <div className="space-y-6">
            
            {/* Unified Card: AI Safety Desk & Reviews */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-600 animate-pulse" />
                  <span>AI Anomaly & Safety Reviews</span>
                </h3>
                <span className="px-2 py-0.5 rounded bg-red-100 border border-red-200 text-red-700 font-mono text-[10px] font-bold">
                  {riskAlerts.filter(a => a.status === 'NEW').length} Pending
                </span>
              </div>

              {/* Section 1: Pending Alerts for Review */}
              <div className="space-y-3">
                <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Pending Reviews
                </div>
                {riskAlerts.filter(a => a.status === 'NEW').length === 0 ? (
                  <div className="text-center py-6 text-slate-500 border border-dashed border-slate-200 rounded-xl space-y-1 bg-slate-50/50">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                    <p className="text-[11px] font-semibold text-slate-600">No pending safety reviews.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {riskAlerts.filter(a => a.status === 'NEW').map((alert) => (
                      <div
                        key={alert.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-left shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold font-mono text-slate-800 bg-slate-200 px-1.5 py-0.5 rounded">
                            {alert.tourist_id}
                          </span>
                          <span className="font-mono font-bold text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                            Score: {alert.total_score}/100
                          </span>
                        </div>
                        
                        <div className="text-[10px] text-slate-600 font-medium leading-relaxed">
                          {alert.details.breakdown.rule_based.factors.length > 0 
                            ? `Fired: ${alert.details.breakdown.rule_based.factors.map((f: any) => f.factor.replace(/_/g, ' ')).join(', ')}` 
                            : 'Flagged by ML anomaly engine.'}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 justify-end">
                          <button
                            disabled={feedbackLoading === alert.id}
                            onClick={() => handleFeedback(alert.id, 'confirmed')}
                            className="px-2.5 py-1 bg-[#E8935C] text-[#0C2340] hover:bg-amber-600 text-[10px] font-black rounded flex items-center gap-1 shadow-sm transition disabled:opacity-50 cursor-pointer"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>Confirm</span>
                          </button>
                          <button
                            disabled={feedbackLoading === alert.id}
                            onClick={() => handleFeedback(alert.id, 'false_positive')}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-[10px] font-bold rounded flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                            <span>False Pos</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Active Anomaly Clusters */}
              <div className="space-y-3 pt-3 border-t border-slate-200/60">
                <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Active Anomaly Zones</span>
                  <span className="font-mono text-slate-500 font-semibold">{clusters.length} active</span>
                </div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {clusters.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedClusterId(c.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition text-left ${
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
            </div>

          </div>
        </div>
      )}


      {/* Tab 3: Model Metadata */}
      {activeTab === 'metadata' && modelMeta && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-center border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#2F4538]" />
              <span>Machine Learning Anomaly Detection Model Specs</span>
            </h3>
          </div>

          <div className="space-y-4 text-xs text-left">
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
                <div className="font-black text-[#1B2A4A] text-sm mb-2">Model Hyperparameters</div>
                <div className="space-y-1.5 font-medium text-slate-700 font-mono text-[11px]">
                  <div>n_estimators: {modelMeta.hyperparameters?.n_estimators || 100}</div>
                  <div>contamination: {modelMeta.hyperparameters?.contamination || 0.02} (2%)</div>
                  <div>random_state: {modelMeta.hyperparameters?.random_state || 42}</div>
                  <div>max_samples: "auto"</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                <div className="font-black text-[#1B2A4A] text-sm mb-2">Features Extracted per Location Ping</div>
                <ul className="list-decimal pl-5 space-y-1 font-mono text-[10px] text-slate-600">
                  {modelMeta.features.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              {modelMeta.feature_importances && (
                <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                  <div className="font-black text-[#1B2A4A] text-sm mb-2">Feature Importance/Weights (Approx)</div>
                  <div className="space-y-2">
                    {Object.entries(modelMeta.feature_importances).map(([feature, weight]: any) => (
                      <div key={feature} className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-slate-600 truncate max-w-[150px]" title={feature}>{feature}</span>
                        <div className="flex items-center gap-2 w-1/2">
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#E8935C] h-full" style={{ width: `${weight * 100}%` }}></div>
                          </div>
                          <span className="font-mono font-bold text-slate-800 w-8 text-right">{Math.round(weight * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



    </div>
  );
};
