import React from 'react';
import { 
  Radio, 
  Car, 
  Gauge, 
  Play, 
  Square, 
  RefreshCw, 
  Maximize2,
  ArrowUpDown
} from 'lucide-react';
import type { FleetStats } from '../types';

interface HeaderProps {
  stats: FleetStats;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onRefresh: () => void;
  onFitBounds: () => void;
  isLoading: boolean;
  invertHeading: boolean;
  onToggleInvertHeading: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  connectionStatus,
  isSimulating,
  onToggleSimulation,
  onRefresh,
  onFitBounds,
  isLoading,
  invertHeading,
  onToggleInvertHeading,
}) => {
  return (
    <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-5 flex items-center justify-between z-30 select-none">
      {/* Brand & Connection Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[11px] flex items-center justify-center">
              <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                FleetPulse <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 font-extrabold">IoT</span>
              </h1>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-medium">
                v2.4
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 tracking-wide flex items-center gap-1">
              Real-Time Telematics & GPS Stream
            </p>
          </div>
        </div>

        {/* WebSocket Connection Pill */}
        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-zinc-800/80">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'dot-connected'
                  : connectionStatus === 'connecting'
                  ? 'dot-connecting'
                  : 'dot-offline'
              }`}
            />
            <span className="text-zinc-300 font-mono text-[11px]">
              {connectionStatus === 'connected'
                ? 'Reverb Live'
                : connectionStatus === 'connecting'
                ? 'Reverb Connecting...'
                : 'Reverb Standby'}
            </span>
          </div>
        </div>
      </div>

      {/* Global Telemetry Metrics Pills */}
      <div className="hidden lg:flex items-center gap-2.5">
        <div className="metric-pill">
          <Car className="w-3.5 h-3.5 text-zinc-400" />
          <span>Total Fleet:</span>
          <span className="value">{stats.total}</span>
        </div>

        <div className="metric-pill">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse" />
          <span className="text-emerald-400">Moving:</span>
          <span className="value text-emerald-400">{stats.moving}</span>
        </div>

        <div className="metric-pill">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-amber-400">Idle:</span>
          <span className="value text-amber-400">{stats.idle}</span>
        </div>

        <div className="metric-pill">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          <span>Avg Speed:</span>
          <span className="value text-cyan-400">{Math.round(stats.avgSpeed)} km/h</span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2.5">
        {/* Invert Orientation Button */}
        <button
          onClick={onToggleInvertHeading}
          title={invertHeading ? 'Orientation Inverted (180° offset active) - Click to reset' : 'Invert vehicle arrow orientation (180° flip)'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            invertHeading
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{invertHeading ? 'Orientation: 180° Inverted' : 'Flip 180°'}</span>
        </button>

        {/* Simulator Toggle Button */}
        <button
          onClick={onToggleSimulation}
          title={isSimulating ? 'Pause IoT Telemetry Simulation' : 'Run IoT Telemetry Simulation'}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            isSimulating
              ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
              : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700'
          }`}
        >
          {isSimulating ? (
            <>
              <Square className="w-3 h-3 fill-current animate-pulse text-emerald-400" />
              <span>Simulating Live IoT</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current text-indigo-400" />
              <span>Run Live Simulation</span>
            </>
          )}
        </button>

        {/* Fit Bounds */}
        <button
          onClick={onFitBounds}
          title="Fit Fleet Map Bounds"
          className="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Refresh API */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Sync Fleet Data"
          className="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};
