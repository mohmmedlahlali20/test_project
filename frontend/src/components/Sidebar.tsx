import React, { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { 
  Search, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Car
} from 'lucide-react';
import type { Device, MovementStatus } from '../types';
import { VehicleCard } from './VehicleCard';

interface SidebarProps {
  devices: Device[];
  selectedDevice: Device | null;
  onSelectDevice: (device: Device) => void;
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  devices,
  selectedDevice,
  onSelectDevice,
  isLoading,
  isOpen,
  onToggle,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MovementStatus>('all');

  // Count by status
  const counts = useMemo(() => {
    return {
      all: devices.length,
      moving: devices.filter((d) => d.status === 'moving').length,
      idle: devices.filter((d) => d.status === 'idle').length,
      offline: devices.filter((d) => d.status === 'offline').length,
    };
  }, [devices]);

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.ident.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || d.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [devices, searchTerm, statusFilter]);

  return (
    <div
      className={`relative z-20 flex flex-col h-full bg-zinc-950/90 border-r border-zinc-800/80 backdrop-blur-xl transition-all duration-300 ${
        isOpen ? 'w-96' : 'w-0'
      }`}
    >
      {/* Collapse / Expand Tab Button */}
      <button
        onClick={onToggle}
        aria-label={isOpen ? 'Collapse fleet sidebar' : 'Expand fleet sidebar'}
        className="sidebar-collapse-btn"
        style={{ left: isOpen ? '100%' : '0px' }}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Sidebar Content (hidden when collapsed) */}
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Search Header */}
        <div className="p-4 pb-3 border-b border-zinc-800/70">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by vehicle name or ident..."
              className="search-input"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 mt-3 p-1 bg-zinc-900/80 border border-zinc-800/80 rounded-lg">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter('moving')}
              className={`flex-1 tab-btn ${statusFilter === 'moving' ? 'active' : ''}`}
            >
              In Motion ({counts.moving})
            </button>
            <button
              onClick={() => setStatusFilter('idle')}
              className={`flex-1 tab-btn ${statusFilter === 'idle' ? 'active' : ''}`}
            >
              Idle ({counts.idle})
            </button>
          </div>
        </div>

        {/* Vehicles List Container */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {isLoading ? (
            // Skeleton loaders
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-32 skeleton" />
                    <div className="h-5 w-16 skeleton rounded-full" />
                  </div>
                  <div className="h-3 w-24 skeleton" />
                  <div className="h-1.5 w-full skeleton rounded-full" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-7 skeleton rounded-lg" />
                    <div className="h-7 skeleton rounded-lg" />
                    <div className="h-7 skeleton rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDevices.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {filteredDevices.map((device) => (
                <VehicleCard
                  key={device.ident}
                  device={device}
                  isSelected={selectedDevice?.ident === device.ident}
                  onSelect={onSelectDevice}
                />
              ))}
            </AnimatePresence>
          ) : (
            // Empty state
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                <Car className="w-6 h-6 text-zinc-400" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-1">
                {devices.length === 0 ? 'Database Empty' : 'No Vehicles Found'}
              </h4>
              <p className="text-xs text-zinc-400 max-w-xs">
                {devices.length === 0
                  ? 'No vehicle records exist in the database. Run "php artisan fleet:simulate" or click "Run Live Simulation" to ingest GPS telemetry.'
                  : searchTerm
                  ? `No vehicle matches "${searchTerm}". Try a different keyword.`
                  : 'No vehicles in the selected status filter.'}
              </p>
              {(searchTerm || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
                  className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Reset all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Footer Info */}
        <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-800/70 text-[11px] text-zinc-400 flex items-center justify-between">
          <span>
            Showing <strong className="text-zinc-300">{filteredDevices.length}</strong> of{' '}
            <strong className="text-zinc-300">{devices.length}</strong> units
          </span>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-mono text-[10px]">AUTO-SYNC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
