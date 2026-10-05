import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gauge, 
  MapPin, 
  Navigation, 
  Compass, 
  Mountain, 
  Signal, 
  Zap, 
  BatteryCharging, 
  Milestone, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Copy, 
  Check, 
  Route 
} from 'lucide-react';
import type { Device, HistoryPoint } from '../types';
import { getHeadingName } from '../utils/geo';

interface TelemetryHudProps {
  device: Device | null;
  trajectory: HistoryPoint[];
  onClose: () => void;
}

export const TelemetryHud: React.FC<TelemetryHudProps> = ({
  device,
  trajectory,
  onClose,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

  if (!device) return null;

  const copyCoords = () => {
    const text = `${device.position.lat.toFixed(6)}, ${device.position.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 1500);
  };

  const speed = Math.round(device.position.speed);
  const heading = Math.round(device.position.direction);
  const headingText = getHeadingName(heading);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 200 }}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-4xl select-none"
      >
        <div className="glass-strong rounded-2xl shadow-2xl overflow-hidden border border-zinc-700/80">
          {/* Top Bar / Header of HUD */}
          <div className="px-5 py-2.5 bg-zinc-950/70 border-b border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white tracking-wide">
                  TELEMETRY HUD
                </span>
                <span className="text-zinc-400 font-mono text-xs">/</span>
                <span className="text-xs font-bold text-cyan-400 tracking-tight">
                  {device.name}
                </span>
                <span className="text-[11px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                  {device.ident}
                </span>
              </div>
            </div>

            {/* Minimize / Close */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand Telemetry HUD' : 'Minimize Telemetry HUD'}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
              >
                {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                title="Close Telemetry HUD"
                className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expanded HUD Content */}
          {!isMinimized && (
            <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* 1. Speed Gauge Dial / Digital readout */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    Speed
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">km/h</span>
                </div>
                <div className="my-1.5 flex items-baseline gap-1">
                  <span className="text-3xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                    {speed}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">KM/H</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (speed / 130) * 100)}%` }}
                  />
                </div>
              </div>

              {/* 2. Coordinates & Altitude */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    GPS Position
                  </span>
                  <button
                    onClick={copyCoords}
                    title="Copy Lat, Lng"
                    className="text-zinc-400 hover:text-white"
                  >
                    {copiedCoords ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <div className="my-1 space-y-0.5">
                  <div className="text-[11px] font-mono text-zinc-300 flex justify-between">
                    <span className="text-zinc-400">LAT:</span>
                    <span className="font-semibold text-zinc-100">
                      {device.position.lat.toFixed(5)}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-300 flex justify-between">
                    <span className="text-zinc-400">LNG:</span>
                    <span className="font-semibold text-zinc-100">
                      {device.position.lng.toFixed(5)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/50">
                  <span className="flex items-center gap-1">
                    <Mountain className="w-3 h-3 text-indigo-400" />
                    Alt:
                  </span>
                  <span className="font-mono text-zinc-200">
                    {device.position.altitude ? `${Math.round(device.position.altitude)} m` : '--'}
                  </span>
                </div>
              </div>

              {/* 3. Heading & Compass */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    Heading
                  </span>
                  <span className="font-mono text-zinc-300 font-bold">{headingText}</span>
                </div>
                <div className="my-1.5 flex items-center justify-center gap-3">
                  <div className="w-9 h-9 rounded-full border border-zinc-700 bg-zinc-950 flex items-center justify-center relative shadow-inner">
                    <Navigation
                      className="w-4 h-4 text-cyan-400 transition-transform duration-300"
                      style={{ transform: `rotate(${heading}deg)` }}
                    />
                  </div>
                  <div className="font-mono text-lg font-bold text-white">
                    {heading}°
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 text-center font-mono">
                  Bearing: {heading}° {headingText}
                </div>
              </div>

              {/* 4. Electrical & GSM Signal */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Power & Comm
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      device.engine
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {device.engine ? 'IGN ON' : 'IGN OFF'}
                  </span>
                </div>
                <div className="my-1 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400 flex items-center gap-1">
                      <BatteryCharging className="w-3 h-3 text-emerald-400" />
                      Battery:
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      {device.battery_voltage ? `${device.battery_voltage.toFixed(1)}V` : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400 flex items-center gap-1">
                      <Signal className="w-3 h-3 text-cyan-400" />
                      Cellular:
                    </span>
                    <span className="font-mono text-cyan-300">
                      {device.gsm_signal ? `${device.gsm_signal}/5 Bars` : '--'}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/50 flex justify-between">
                  <span>Status:</span>
                  <span className="font-semibold uppercase tracking-wider text-emerald-400">
                    {device.status}
                  </span>
                </div>
              </div>

              {/* 5. Mileage & History Trail Stats */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Milestone className="w-3.5 h-3.5 text-indigo-400" />
                    Odometer
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">KM</span>
                </div>
                <div className="my-1.5">
                  <span className="text-lg font-bold font-mono text-zinc-100">
                    {device.odometer.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono ml-1">km</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/50">
                  <span className="flex items-center gap-1">
                    <Route className="w-3 h-3 text-cyan-400" />
                    Trail Points:
                  </span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {trajectory.length} pts
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
