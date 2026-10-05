import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Gauge, 
  Zap, 
  BatteryCharging, 
  Clock, 
  Copy, 
  Check, 
  Compass,
  Truck,
  Car,
  Bus
} from 'lucide-react';
import type { Device } from '../types';
import { formatRelativeTime, getHeadingName, getVehicleType } from '../utils/geo';

interface VehicleCardProps {
  device: Device;
  isSelected: boolean;
  onSelect: (device: Device) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  device,
  isSelected,
  onSelect,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyIdent = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(device.ident);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const statusConfig = {
    moving: {
      label: 'In Motion',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse',
      glow: 'glow-moving',
    },
    idle: {
      label: 'Idling',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      dotClass: 'bg-amber-500 shadow-sm shadow-amber-500/50',
      glow: 'glow-idle',
    },
    offline: {
      label: 'Offline',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      dotClass: 'bg-rose-500',
      glow: 'glow-offline',
    },
  }[device.status];

  // Battery health styling
  const getBatteryColor = (voltage: number) => {
    if (voltage >= 24 || (voltage >= 12.2 && voltage <= 14.8)) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5';
    if (voltage >= 11.5) return 'text-amber-400 border-amber-500/30 bg-amber-500/5';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/5';
  };

  const speedPercent = Math.min(100, Math.round((device.position.speed / 140) * 100));

  return (
    <motion.div
      layout
      layoutId={`card-${device.ident}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      onClick={() => onSelect(device)}
      className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
        isSelected
          ? 'bg-zinc-900/90 border-indigo-500/70 shadow-[0_0_24px_rgba(99,102,241,0.22)] ring-1 ring-indigo-500/40'
          : 'bg-zinc-900/40 hover:bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700/90'
      }`}
    >
      {/* Top Row: Name, Status & Ident */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-zinc-300">
              {getVehicleType(device.name) === 'truck' ? (
                <Truck className="w-3.5 h-3.5 text-cyan-400" />
              ) : getVehicleType(device.name) === 'van' ? (
                <Bus className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Car className="w-3.5 h-3.5 text-indigo-400" />
              )}
            </span>
            <h3 className="text-sm font-semibold text-white truncate tracking-tight group-hover:text-indigo-300 transition-colors">
              {device.name}
            </h3>
            {isSelected && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400 animate-pulse" />
            )}
          </div>

          {/* Copyable Ident */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] font-mono text-zinc-400 truncate">
              {device.ident}
            </span>
            <button
              onClick={handleCopyIdent}
              title="Copy device ident"
              className="p-0.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${statusConfig.badgeClass}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {/* Speed Gauge & Progress Bar */}
      <div className="mt-3 pt-2.5 border-t border-zinc-800/60">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Velocity</span>
          </div>
          <div className="flex items-baseline gap-1 font-mono font-semibold text-white">
            <span className="text-sm text-cyan-300">{Math.round(device.position.speed)}</span>
            <span className="text-[10px] text-zinc-400">km/h</span>
          </div>
        </div>

        {/* Mini Speedometer Bar */}
        <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${speedPercent}%` }}
          />
        </div>
      </div>

      {/* Telemetry Metrics Row (Ignition, Battery, GSM, Heading) */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
        {/* Ignition */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
          <Zap
            className={`w-3 h-3 ${
              device.engine ? 'text-amber-400 fill-amber-400/30' : 'text-zinc-400'
            }`}
          />
          <span className="text-zinc-400">IGN:</span>
          <span
            className={`font-semibold font-mono ${
              device.engine ? 'text-amber-300' : 'text-zinc-400'
            }`}
          >
            {device.engine ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* Battery */}
        <div
          className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${getBatteryColor(
            device.battery_voltage
          )}`}
        >
          <BatteryCharging className="w-3 h-3" />
          <span className="font-semibold font-mono">
            {device.battery_voltage ? `${device.battery_voltage.toFixed(1)}V` : '12.4V'}
          </span>
        </div>

        {/* Heading Direction */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 text-zinc-400">
          <Compass className="w-3 h-3 text-indigo-400" />
          <span className="font-semibold font-mono text-zinc-200">
            {getHeadingName(device.position.direction)} ({Math.round(device.position.direction)}°)
          </span>
        </div>
      </div>

      {/* Footer Info: Relative timestamp & Signal */}
      <div className="flex items-center justify-between mt-2.5 pt-2 text-[10px] text-zinc-400 border-t border-zinc-800/40">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Updated {formatRelativeTime(device.updated_at)}</span>
        </div>

        {/* GSM Signal Indicator */}
        <div className="flex items-center gap-1" title={`GSM Signal: ${device.gsm_signal || 4}/5`}>
          <div className="signal-bars">
            {[1, 2, 3, 4, 5].map((bar) => {
              const active = bar <= (device.gsm_signal || 4);
              return (
                <div
                  key={bar}
                  className={`signal-bar ${active ? 'active' : ''}`}
                  style={{ height: `${bar * 2 + 3}px` }}
                />
              );
            })}
          </div>
          <span className="font-mono text-zinc-400">{device.gsm_signal || 4}G</span>
        </div>
      </div>
    </motion.div>
  );
};
