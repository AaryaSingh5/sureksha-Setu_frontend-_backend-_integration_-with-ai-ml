import React, { useState } from 'react';
import { Users, AlertTriangle, ShieldCheck, Search, MapPin, ArrowRight, RefreshCw, Clock, CheckCircle2, Sparkles, Filter, Layers } from 'lucide-react';

export interface CrowdCluster {
  id: string;
  name: string;
  region: string;
  coordinates: { lat: number; lng: number };
  crowdCount: number;
  capacityPercentage: number; // 0 - 100
  crowdLevel: 'extreme' | 'high' | 'medium' | 'low';
  peakHours: string;
  avgWaitMinutes: number;
  statusNotice: string;
  suggestedAlternative: {
    name: string;
    crowdCount: number;
    capacityPercentage: number;
    distance: string;
    description: string;
  };
}

export const CROWD_CLUSTERS: CrowdCluster[] = [
  {
    id: 'cluster-1',
    name: 'Manali Mall Road & Town Square',
    region: 'Central Manali',
    coordinates: { lat: 32.2396, lng: 77.1887 },
    crowdCount: 1850,
    capacityPercentage: 94,
    crowdLevel: 'extreme',
    peakHours: '12:00 PM - 6:30 PM',
    avgWaitMinutes: 45,
    statusNotice: 'Severe pedestrian congestion & parking gridlock. 45 min entry delay.',
    suggestedAlternative: {
      name: 'Vashisht Village & Ancient Hot Springs',
      crowdCount: 280,
      capacityPercentage: 22,
      distance: '2.8 km away',
      description: 'Peaceful traditional timber village with open views and thermal spring baths.'
    }
  },
  {
    id: 'cluster-2',
    name: 'Solang Valley Ropeway & Activity Hub',
    region: 'North Manali',
    coordinates: { lat: 32.3167, lng: 77.1574 },
    crowdCount: 1240,
    capacityPercentage: 82,
    crowdLevel: 'high',
    peakHours: '10:00 AM - 3:30 PM',
    avgWaitMinutes: 60,
    statusNotice: 'Long token queues for paragliding & ropeway rides.',
    suggestedAlternative: {
      name: 'Gulaba Alpine Snow Meadows',
      crowdCount: 340,
      capacityPercentage: 35,
      distance: '6.5 km away',
      description: 'Quiet high-altitude meadow with pristine mountain vistas and low crowd density.'
    }
  },
  {
    id: 'cluster-3',
    name: 'Rohtang Pass Crest & Snow Ridge',
    region: 'Lahaul Border',
    coordinates: { lat: 32.3716, lng: 77.2466 },
    crowdCount: 1410,
    capacityPercentage: 88,
    crowdLevel: 'high',
    peakHours: '9:00 AM - 2:00 PM',
    avgWaitMinutes: 50,
    statusNotice: 'Permit checkpoint slowdown. Heavy vehicle queue at pass summit.',
    suggestedAlternative: {
      name: 'Hampta Pass Trailhead & Sethan Village',
      crowdCount: 210,
      capacityPercentage: 25,
      distance: '12.0 km away',
      description: 'Scenic pine forest sanctuary and quiet igloo village with zero vehicular noise.'
    }
  },
  {
    id: 'cluster-4',
    name: 'Kasol Market & Parvati Riverfront',
    region: 'Parvati Valley',
    coordinates: { lat: 32.0100, lng: 77.3150 },
    crowdCount: 1120,
    capacityPercentage: 86,
    crowdLevel: 'high',
    peakHours: '2:00 PM - 8:00 PM',
    avgWaitMinutes: 35,
    statusNotice: 'River bridge bottleneck. Parking full in central market.',
    suggestedAlternative: {
      name: 'Chalal Pine Forest River Trail',
      crowdCount: 120,
      capacityPercentage: 15,
      distance: '1.2 km walk',
      description: 'Shaded suspension bridge walk along rushing turquoise waters.'
    }
  },
  {
    id: 'cluster-5',
    name: 'Atal Tunnel South Portal',
    region: 'Solang Corridor',
    coordinates: { lat: 32.3582, lng: 77.1625 },
    crowdCount: 620,
    capacityPercentage: 55,
    crowdLevel: 'medium',
    peakHours: '11:00 AM - 4:00 PM',
    avgWaitMinutes: 15,
    statusNotice: 'Moderate tourist influx. Security checks moving steadily.',
    suggestedAlternative: {
      name: 'Sissu North Portal Waterfall Meadow',
      crowdCount: 180,
      capacityPercentage: 18,
      distance: '9.0 km through tunnel',
      description: 'Expansive green valley with roaring waterfall backdrop and calm atmosphere.'
    }
  },
  {
    id: 'cluster-6',
    name: 'Hadimba Devi Temple & Forest Trail',
    region: 'Dungri Woods',
    coordinates: { lat: 32.2483, lng: 77.1802 },
    crowdCount: 510,
    capacityPercentage: 48,
    crowdLevel: 'medium',
    peakHours: '10:00 AM - 1:00 PM',
    avgWaitMinutes: 15,
    statusNotice: 'Moderate queue inside pagoda temple courtyard.',
    suggestedAlternative: {
      name: 'Museum of Himachal Culture & Folk Art',
      crowdCount: 90,
      capacityPercentage: 12,
      distance: '200m walk',
      description: 'Intimate heritage museum showcasing traditional Himachali crafts and architecture.'
    }
  },
  {
    id: 'cluster-7',
    name: 'Old Manali Craft & Cafe Street',
    region: 'Upper Manali',
    coordinates: { lat: 32.2533, lng: 77.1750 },
    crowdCount: 290,
    capacityPercentage: 28,
    crowdLevel: 'low',
    peakHours: '5:00 PM - 9:00 PM',
    avgWaitMinutes: 0,
    statusNotice: 'Low crowd density. Excellent for relaxed strolling and dining.',
    suggestedAlternative: {
      name: 'Currently Peaceful!',
      crowdCount: 290,
      capacityPercentage: 28,
      distance: 'Direct Access',
      description: 'No change needed. This area is currently relaxed and under capacity.'
    }
  }
];

export const REGIONS_LIST = [
  'All Regions',
  'Central Manali',
  'North Manali',
  'Lahaul Border',
  'Parvati Valley',
  'Solang Corridor',
  'Dungri Woods',
  'Upper Manali'
];

interface CrowdHeatmapProps {
  onAddItineraryDestination?: (destName: string) => void;
}

export const CrowdHeatmap: React.FC<CrowdHeatmapProps> = ({ onAddItineraryDestination }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [densityFilter, setDensityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedClusterId, setSelectedClusterId] = useState<string>('cluster-1');
  const [planChangedToast, setPlanChangedToast] = useState<string | null>(null);

  // Filter clusters by search query and density filter
  const filteredClusters = CROWD_CLUSTERS.filter((c) => {
    // Search query match (searches across name, region, notice, and suggested alternative)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const altName = c.suggestedAlternative?.name || '';
      const altDesc = c.suggestedAlternative?.description || '';
      const searchableText = `${c.name || ''} ${c.region || ''} ${c.statusNotice || ''} ${altName} ${altDesc}`.toLowerCase();
      
      const terms = q.split(/\s+/).filter(Boolean);
      const matchesSearch = terms.every((term) => searchableText.includes(term));
      if (!matchesSearch) return false;
    }

    // Density filter match
    if (densityFilter === 'high') {
      return c.crowdLevel === 'extreme' || c.crowdLevel === 'high';
    }
    if (densityFilter === 'medium') {
      return c.crowdLevel === 'medium';
    }
    if (densityFilter === 'low') {
      return c.crowdLevel === 'low';
    }
    return true;
  });

  const selectedCluster =
    filteredClusters.find((c) => c.id === selectedClusterId) || filteredClusters[0] || CROWD_CLUSTERS[0];

  const handleSwitchPlan = (alternativeName: string) => {
    if (onAddItineraryDestination) {
      onAddItineraryDestination(alternativeName);
    }
    setPlanChangedToast(`Plan Updated! Added "${alternativeName}" to your itinerary planner.`);
    setTimeout(() => setPlanChangedToast(null), 4000);
  };

  return (
    <div className="space-y-5 text-left">
      
      {/* Toast Notification for changing plan */}
      {planChangedToast && (
        <div className="p-3.5 bg-[#138808] text-white rounded-xl shadow-lg border-2 border-emerald-300 text-xs font-black flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-amber-300" />
            <span>{planChangedToast}</span>
          </div>
          <button onClick={() => setPlanChangedToast(null)} className="text-white hover:text-slate-200 font-bold">✕</button>
        </div>
      )}

      {/* SEARCH BAR & HEADER TOP */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl border-2 border-slate-800 shadow-md space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-600/30 border border-red-500 flex items-center justify-center text-red-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>Regional Footfall Heatmap & Density Search</span>
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 text-[9px] font-black uppercase">
                LIVE TELEMETRY
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Search for any area or location to view real-time tourist density clusters.
            </p>
          </div>
        </div>

        {/* Search Bar & Density Pills */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-800 items-center">
          <div className="md:col-span-7 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area (e.g., Mall Road, Solang, Kasol, Hadimba, Vashisht)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-700"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="md:col-span-5 flex items-center justify-start md:justify-end gap-1.5 flex-wrap">
            <button
              onClick={() => setDensityFilter('all')}
              className={`px-3 py-2 rounded-xl text-[11px] font-black transition ${
                densityFilter === 'all' ? 'bg-blue-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Densities
            </button>
            <button
              onClick={() => setDensityFilter('high')}
              className={`px-3 py-2 rounded-xl text-[11px] font-black transition ${
                densityFilter === 'high' ? 'bg-red-600 text-white shadow' : 'bg-slate-800 text-red-400 hover:bg-slate-700'
              }`}
            >
              🔴 Heavy ({CROWD_CLUSTERS.filter(c => c.crowdLevel === 'extreme' || c.crowdLevel === 'high').length})
            </button>
            <button
              onClick={() => setDensityFilter('medium')}
              className={`px-3 py-2 rounded-xl text-[11px] font-black transition ${
                densityFilter === 'medium' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
              }`}
            >
              🟡 Moderate
            </button>
            <button
              onClick={() => setDensityFilter('low')}
              className={`px-3 py-2 rounded-xl text-[11px] font-black transition ${
                densityFilter === 'low' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
              }`}
            >
              🟢 Low
            </button>
          </div>
        </div>
      </div>

      {/* HEATMAP VISUAL GRID DISPLAY & DENSITY DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT: CUSTOM VISUAL DENSITY HEATMAP CANVAS */}
        <div className="lg:col-span-7 space-y-3">
          
          {/* Heatmap Visual Canvas */}
          <div className="relative w-full h-[350px] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-xl p-4 text-white flex flex-col justify-between">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:20px_20px] opacity-40 pointer-events-none"></div>

            {/* Top Canvas Header */}
            <div className="relative z-10 flex items-center justify-between bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400 animate-spin-slow" />
                <span className="font-extrabold text-white">
                  Area Density Layer {searchQuery ? `- "${searchQuery}"` : ''}
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 font-bold">
                {filteredClusters.length} Clusters Found
              </span>
            </div>

            {/* Interactive Footfall Heat Clusters Layer */}
            {filteredClusters.length === 0 ? (
              <div className="relative z-10 my-auto text-center space-y-2 p-6 bg-slate-900/60 rounded-2xl border border-slate-800">
                <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">No crowd clusters match your search query</h4>
                <p className="text-xs text-slate-400">Try adjusting or clearing your search input.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDensityFilter('all');
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition"
                >
                  Clear Search & Filters
                </button>
              </div>
            ) : (
              <div className="relative z-10 my-auto grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredClusters.map((cluster) => {
                  const isSelected = selectedCluster?.id === cluster.id;
                  let gradientBg = 'from-emerald-900/70 to-emerald-950/90 border-emerald-500/60 text-emerald-100';
                  let glowColor = 'bg-emerald-500/30';
                  let badgeText = '🟢 Low Density';

                  if (cluster.crowdLevel === 'extreme' || cluster.crowdLevel === 'high') {
                    gradientBg = 'from-red-950/90 to-red-900/80 border-red-500/80 text-red-100';
                    glowColor = 'bg-red-500/40 animate-pulse';
                    badgeText = '🔴 Heavy Congestion';
                  } else if (cluster.crowdLevel === 'medium') {
                    gradientBg = 'from-amber-950/80 to-amber-900/70 border-amber-500/70 text-amber-100';
                    glowColor = 'bg-amber-500/30';
                    badgeText = '🟡 Moderate Load';
                  }

                  return (
                    <button
                      key={cluster.id}
                      onClick={() => setSelectedClusterId(cluster.id)}
                      className={`relative p-3 rounded-2xl border text-left transition backdrop-blur-md bg-gradient-to-br shadow-md flex flex-col justify-between ${gradientBg} ${
                        isSelected ? 'ring-2 ring-white scale-[1.02] shadow-2xl' : 'hover:border-white/50 opacity-90 hover:opacity-100'
                      }`}
                    >
                      {/* Radial Heat Blob Glow effect */}
                      <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full blur-xl pointer-events-none ${glowColor}`}></div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                          <span className="uppercase font-bold tracking-wide">{cluster.region}</span>
                          <span className="font-extrabold px-1.5 py-0.5 rounded bg-black/40 border border-white/20">
                            {badgeText}
                          </span>
                        </div>
                        <h5 className="text-xs font-black text-white mt-1 leading-snug">
                          {cluster.name}
                        </h5>
                      </div>

                      <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono">
                        <span className="font-extrabold flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-amber-300" />
                          <span>{cluster.crowdCount} people</span>
                        </span>
                        <span className="font-bold text-slate-200">
                          {cluster.capacityPercentage}% Cap
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bottom Heatmap Legend */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-xl border border-slate-800 text-[10px] text-slate-300">
              <span className="font-bold">Heat Legend:</span>
              <div className="flex items-center gap-3 font-semibold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> &gt;80% Overcrowded</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> 40-80% Moderate</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> &lt;40% Sparse</span>
              </div>
            </div>
          </div>

          {/* Quick Area Cards List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredClusters.map((c) => {
              const isSelected = selectedCluster?.id === c.id;
              let borderCol = 'border-slate-200';
              if (c.crowdLevel === 'extreme' || c.crowdLevel === 'high') borderCol = 'border-red-300 bg-red-50/60';
              else if (c.crowdLevel === 'medium') borderCol = 'border-amber-300 bg-amber-50/60';
              else if (c.crowdLevel === 'low') borderCol = 'border-emerald-300 bg-emerald-50/60';

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedClusterId(c.id)}
                  className={`p-3 rounded-xl text-left transition border shadow-2xs space-y-1.5 ${borderCol} ${
                    isSelected ? 'ring-2 ring-[#0B2447] bg-white font-bold' : 'hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="truncate text-slate-900">{c.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 font-mono">👥 {c.crowdCount} tourists</span>
                    <span className={`font-black ${
                      c.capacityPercentage > 80 ? 'text-red-600' : c.capacityPercentage > 50 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {c.capacityPercentage}% Load
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        {/* RIGHT: DETAILED DENSITY ANALYTICS & ALTERNATIVE REROUTE CARD */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 text-left">
            
            {/* Cluster Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  {selectedCluster.region}
                </span>
                <h4 className="text-base font-black text-slate-900 mt-0.5">
                  {selectedCluster.name}
                </h4>
              </div>

              {selectedCluster.capacityPercentage >= 80 ? (
                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-300 text-xs font-black flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Heavy Overcrowding
                </span>
              ) : selectedCluster.capacityPercentage >= 50 ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black flex items-center gap-1">
                  🟡 Moderate Crowd
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-[#138808] border border-emerald-300 text-xs font-black flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#138808]" /> Low Density
                </span>
              )}
            </div>

            {/* Density Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <div className="text-slate-500 text-[10px] font-extrabold uppercase">Live Footfall</div>
                <div className="text-base font-black text-slate-900 flex items-center gap-1 mt-0.5">
                  <Users className="w-4 h-4 text-red-500" />
                  <span>{selectedCluster.crowdCount} tourists</span>
                </div>
              </div>

              <div>
                <div className="text-slate-500 text-[10px] font-extrabold uppercase">Est. Queue / Delay</div>
                <div className="text-base font-black text-slate-900 flex items-center gap-1 mt-0.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>{selectedCluster.avgWaitMinutes} mins</span>
                </div>
              </div>
            </div>

            {/* Capacity Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-black">
                <span className="text-slate-600">Footfall Capacity Meter</span>
                <span className={selectedCluster.capacityPercentage >= 80 ? 'text-red-600' : 'text-slate-900'}>
                  {selectedCluster.capacityPercentage}% Capacity
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    selectedCluster.capacityPercentage >= 80
                      ? 'bg-gradient-to-r from-red-500 to-red-600'
                      : selectedCluster.capacityPercentage >= 50
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                      : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                  }`}
                  style={{ width: `${selectedCluster.capacityPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Status Notice Box */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950 font-semibold space-y-1">
              <div className="font-extrabold text-amber-900 flex items-center gap-1 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Peak Traffic Window: {selectedCluster.peakHours}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900">
                {selectedCluster.statusNotice}
              </p>
            </div>

            {/* SUGGESTED PEACEFUL ALTERNATIVE CARD & CHANGE PLAN ACTION */}
            <div className="p-4 bg-emerald-50/90 border-2 border-emerald-300 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-[#138808] text-white text-[9px] font-black uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" /> Quiet Alternative
                </span>
                <span className="text-[10px] font-extrabold text-emerald-800">
                  {selectedCluster.suggestedAlternative.distance}
                </span>
              </div>

              <div>
                <h5 className="text-sm font-black text-slate-900">
                  {selectedCluster.suggestedAlternative.name}
                </h5>
                <p className="text-[11px] text-slate-600 font-medium mt-1 leading-relaxed">
                  {selectedCluster.suggestedAlternative.description}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-emerald-200 font-bold">
                <span className="text-emerald-800">Crowd Load:</span>
                <span className="text-[#138808] font-black">
                  👥 {selectedCluster.suggestedAlternative.crowdCount} tourists ({selectedCluster.suggestedAlternative.capacityPercentage}% capacity)
                </span>
              </div>

              {/* CHANGE PLAN BUTTON */}
              <button
                onClick={() => handleSwitchPlan(selectedCluster.suggestedAlternative.name)}
                className="w-full py-3 px-4 bg-[#138808] hover:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-md transition flex items-center justify-center gap-2 group cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-amber-300 group-hover:rotate-180 transition-transform duration-500" />
                <span>Change Plan: Switch to {selectedCluster.suggestedAlternative.name}</span>
                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
