import React, { useEffect, useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap
} from 'react-leaflet';
import L from 'leaflet';
import type { Device, HistoryPoint } from '../types';
import {
  createVehicleIcon,
  formatRelativeTime,
  getHeadingName,
  calculateBearing,
  calculatePolylineDistance,
  computeWayArrows,
  createRouteStartIcon,
  createRouteEndIcon,
  createWayDirectionIcon,
  formatTimestamp,
} from '../utils/geo';
import { Gauge, Compass, Zap, BatteryCharging, Clock, Navigation, Milestone, ArrowRight } from 'lucide-react';
import { useSnappedRoute } from '../hooks/useSnappedRoute';

// ── Static Initial Map Position & Zoom (Never pass dynamic state to MapContainer) ──
const STATIC_INITIAL_CENTER: [number, number] = [33.5731, -7.5898];
const STATIC_INITIAL_ZOOM = 14;

interface MapAreaProps {
  devices: Device[];
  selectedDevice: Device | null;
  trajectory: HistoryPoint[];
  onSelectDevice: (device: Device) => void;
  fitBoundsTrigger: number;
  invertHeading: boolean;
}

interface MapControllerProps {
  selectedIdent: string | null;
  selectedCoordinates: [number, number] | null;
  devices: Device[];
  fitBoundsTrigger: number;
}

/**
 * MapController Component
 * Handles programmatic camera movements (FlyTo and FitBounds) via Leaflet's useMap hook.
 * Preserves user's manual pan and zoom during live WebSocket updates and polyline rendering.
 */
const MapController: React.FC<MapControllerProps> = ({
  selectedIdent,
  selectedCoordinates,
  devices,
  fitBoundsTrigger,
}) => {
  const map = useMap();
  const lastSelectedIdent = useRef<string | null>(null);

  // Keep a stable ref for devices so fitBounds only triggers on explicit user action
  const devicesRef = useRef(devices);
  devicesRef.current = devices;

  // 1. Smooth FlyTo: ONLY when a vehicle is explicitly selected by the user
  useEffect(() => {
    // If no vehicle is selected, reset tracker ref
    if (!selectedIdent || !selectedCoordinates) {
      lastSelectedIdent.current = null;
      return;
    }

    const [lat, lng] = selectedCoordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      return;
    }

    // Only flyTo if the selected vehicle identity has actually changed
    if (lastSelectedIdent.current !== selectedIdent) {
      lastSelectedIdent.current = selectedIdent;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), {
        duration: 1.2,
      });
    }
    // CRITICAL: No "else { map.panTo(...) }" here!
    // Live coordinate updates must NEVER hijack the camera or override user zoom/pan.
  }, [selectedIdent, selectedCoordinates, map]);

  // 2. Fit Bounds: ONLY on explicit user trigger (button click), NOT on live data updates
  useEffect(() => {
    if (fitBoundsTrigger === 0 || devicesRef.current.length === 0) return;

    const validPositions = devicesRef.current
      .map((d) => [d.position.lat, d.position.lng] as [number, number])
      .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0);

    if (validPositions.length === 1) {
      map.flyTo(validPositions[0], 15, { duration: 1.2 });
    } else if (validPositions.length > 1) {
      const bounds = L.latLngBounds(validPositions);
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 16,
        animate: true,
        duration: 1.2,
      });
    }
  }, [fitBoundsTrigger, map]);

  return null;
};

export const MapArea: React.FC<MapAreaProps> = ({
  devices,
  selectedDevice,
  trajectory,
  onSelectDevice,
  fitBoundsTrigger,
  invertHeading,
}) => {
  // Road-snapped polyline coordinates via OSRM with raw fallback
  const { polylineCoords, isSnapping } = useSnappedRoute(trajectory);

  // Selected vehicle coordinates for MapController
  const selectedCoordinates = useMemo<[number, number] | null>(() => {
    if (!selectedDevice) return null;
    const { lat, lng } = selectedDevice.position;
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return null;
    return [lat, lng];
  }, [selectedDevice?.ident, selectedDevice?.position.lat, selectedDevice?.position.lng]);

  // Trip Start (Origin / Departure Point A)
  const startPoint = useMemo<[number, number] | null>(() => {
    if (polylineCoords.length === 0) return null;
    return polylineCoords[0];
  }, [polylineCoords]);

  // Trip End (Destination / Latest Arrival Point B)
  const endPoint = useMemo<[number, number] | null>(() => {
    if (polylineCoords.length < 2) return null;
    return polylineCoords[polylineCoords.length - 1];
  }, [polylineCoords]);

  // Direction arrows along the road trajectory showing the exact "Way" of travel
  const wayArrows = useMemo(() => {
    return computeWayArrows(polylineCoords, 8);
  }, [polylineCoords]);

  // Total Trajectory Distance
  const totalDistanceKm = useMemo(() => {
    return calculatePolylineDistance(polylineCoords);
  }, [polylineCoords]);

  // Start & End raw telematics records
  const startRaw = trajectory.length > 0 ? trajectory[0] : null;
  const endRaw = trajectory.length > 1 ? trajectory[trajectory.length - 1] : null;

  // Travel duration in minutes
  const tripDurationMinutes = useMemo(() => {
    if (!startRaw?.recorded_at || !endRaw?.recorded_at) return null;
    const diffMs = new Date(endRaw.recorded_at).getTime() - new Date(startRaw.recorded_at).getTime();
    if (isNaN(diffMs) || diffMs <= 0) return null;
    return Math.round(diffMs / 60000);
  }, [startRaw, endRaw]);

  return (
    <div className="relative flex-1 h-full w-full bg-zinc-950 overflow-hidden">
      {/* Floating Road-Snapped Status Pill (Top-Right) */}
      {selectedDevice && trajectory.length >= 2 && (
        <div 
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute top-4 right-4 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950/85 border border-zinc-800/90 backdrop-blur-md text-[11px] font-mono text-zinc-300 pointer-events-auto shadow-xl select-none"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isSnapping ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400 shadow-sm shadow-emerald-400/80'
            }`}
          />
          <span>{isSnapping ? 'Snapping to Road Network...' : 'Road-Snapped (OSRM Match)'}</span>
        </div>
      )}

      {/* Floating Route Precision Card (Top-Left) */}
      {selectedDevice && trajectory.length >= 2 && startRaw && endRaw && (
        <div 
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute top-4 left-4 z-[400] flex flex-col gap-2 p-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 backdrop-blur-xl text-xs font-mono shadow-2xl select-none min-w-[270px] pointer-events-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5 text-xs">
              <Navigation className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              Route Trajectory
            </span>
            <span className="text-[10px] text-zinc-400 font-semibold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              {trajectory.length} waypoints
            </span>
          </div>

          {/* Waypoints Origin & Destination */}
          <div className="space-y-2 text-[11px]">
            {/* Start Waypoint */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80"></span>
                <span className="text-emerald-400 font-bold">START (A):</span>
              </div>
              <div className="text-right">
                <div className="text-zinc-200 font-bold">{formatTimestamp(startRaw.recorded_at)}</div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  {startRaw.lat.toFixed(4)}, {startRaw.lng.toFixed(4)}
                </div>
              </div>
            </div>

            {/* Direction Indicator */}
            <div className="flex items-center justify-center gap-2 py-0.5 text-[10px] text-cyan-400/80 font-bold">
              <span className="h-[1px] flex-1 bg-zinc-800"></span>
              <span className="flex items-center gap-1 uppercase tracking-widest text-[9px]">
                Forward Way <ArrowRight className="w-3 h-3 text-cyan-400" />
              </span>
              <span className="h-[1px] flex-1 bg-zinc-800"></span>
            </div>

            {/* End Waypoint */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-sm shadow-rose-400/80"></span>
                <span className="text-rose-400 font-bold">END (B):</span>
              </div>
              <div className="text-right">
                <div className="text-zinc-200 font-bold">{formatTimestamp(endRaw.recorded_at)}</div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  {endRaw.lat.toFixed(4)}, {endRaw.lng.toFixed(4)}
                </div>
              </div>
            </div>
          </div>

          {/* Distance & Duration Summary */}
          <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Milestone className="w-3.5 h-3.5 text-indigo-400" />
              <span>Distance:</span>
              <span className="font-bold text-white font-mono">{totalDistanceKm.toFixed(2)} km</span>
            </div>
            {tripDurationMinutes !== null && (
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Duration:</span>
                <span className="font-bold text-white font-mono">{tripDurationMinutes} min</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MapContainer with STATIC default center and zoom (No dynamic center/zoom props, no dynamic key) */}
      <MapContainer
        center={STATIC_INITIAL_CENTER}
        zoom={STATIC_INITIAL_ZOOM}
        zoomControl={false}
        className="w-full h-full z-10"
        attributionControl={true}
      >
        {/* CartoDB Dark Matter Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=cb1_4apn_1_d9490620425562857738e3de"
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Map Controller for programmatic camera movement */}
        <MapController
          selectedIdent={selectedDevice?.ident ?? null}
          selectedCoordinates={selectedCoordinates}
          devices={devices}
          fitBoundsTrigger={fitBoundsTrigger}
        />

        {/* Historical Trajectory Polyline (Road-Snapped via OSRM) */}
        {polylineCoords.length > 1 && (
          <>
            {/* Outer Glow Polyline */}
            <Polyline
              positions={polylineCoords}
              pathOptions={{
                color: '#22d3ee',
                weight: 6,
                opacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Core Bright Polyline */}
            <Polyline
              positions={polylineCoords}
              pathOptions={{
                color: '#38bdf8',
                weight: 3.5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'trajectory-line',
              }}
            />

            {/* Intermediate Direction Chevrons indicating the Way of travel */}
            {wayArrows.map((arrow, idx) => (
              <Marker
                key={`way-arrow-${idx}-${arrow.index}`}
                position={[arrow.lat, arrow.lng]}
                icon={createWayDirectionIcon(arrow.bearing)}
                interactive={false}
                zIndexOffset={50}
              />
            ))}

            {/* START Waypoint Marker (Origin Point A) */}
            {startPoint && (
              <Marker
                position={startPoint}
                icon={createRouteStartIcon()}
                zIndexOffset={120}
              >
                <Popup className="custom-telematics-popup">
                  <div className="p-3 space-y-2 min-w-[210px] select-none font-mono">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse"></span>
                        <strong className="text-emerald-400 text-xs tracking-wide">TRIP ORIGIN (START)</strong>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                        POINT A
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-zinc-300">
                        <span className="text-zinc-500">Departure:</span>
                        <span className="font-bold text-white">{formatTimestamp(startRaw?.recorded_at)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-300">
                        <span className="text-zinc-500">Initial Speed:</span>
                        <span className="font-bold text-cyan-400">{Math.round(startRaw?.speed ?? 0)} km/h</span>
                      </div>
                      <div className="flex justify-between text-zinc-300">
                        <span className="text-zinc-500">Ignition:</span>
                        <span className={startRaw?.engine_ignition ? 'text-amber-400 font-bold' : 'text-zinc-400'}>
                          {startRaw?.engine_ignition ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
                      <div>GPS: {startPoint[0].toFixed(5)}, {startPoint[1].toFixed(5)}</div>
                      {startRaw?.recorded_at && (
                        <div className="text-zinc-500 text-[9px] mt-0.5">{new Date(startRaw.recorded_at).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* END Waypoint Marker (Destination Point B) */}
            {endPoint && (
              <Marker
                position={endPoint}
                icon={createRouteEndIcon()}
                zIndexOffset={120}
              >
                <Popup className="custom-telematics-popup">
                  <div className="p-3 space-y-2 min-w-[210px] select-none font-mono">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-sm shadow-rose-400 animate-pulse"></span>
                        <strong className="text-rose-400 text-xs tracking-wide">TRIP DESTINATION (END)</strong>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                        POINT B
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-zinc-300">
                        <span className="text-zinc-500">Arrival / Latest:</span>
                        <span className="font-bold text-white">{formatTimestamp(endRaw?.recorded_at)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-300">
                        <span className="text-zinc-500">Terminal Speed:</span>
                        <span className="font-bold text-cyan-400">{Math.round(endRaw?.speed ?? 0)} km/h</span>
                      </div>
                      <div className="flex justify-between text-zinc-300">
                        <span className="text-zinc-500">Status:</span>
                        <span className={endRaw?.movement_status ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                          {endRaw?.movement_status ? 'In Motion' : 'Idling / Stopped'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
                      <div>GPS: {endPoint[0].toFixed(5)}, {endPoint[1].toFixed(5)}</div>
                      {endRaw?.recorded_at && (
                        <div className="text-zinc-500 text-[9px] mt-0.5">{new Date(endRaw.recorded_at).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </>
        )}

        {/* Vehicle Markers */}
        {devices.map((device) => {
          const isSelected = selectedDevice?.ident === device.ident;

          // Compute forward travel heading dynamically if moving along trajectory
          let forwardDirection = device.position.direction;
          if (isSelected && trajectory.length >= 2 && device.position.speed > 1) {
            const curr = trajectory[trajectory.length - 1];
            const prev = trajectory[trajectory.length - 2];
            const dist = Math.hypot(curr.lat - prev.lat, curr.lng - prev.lng);
            if (dist > 0.00003) {
              forwardDirection = calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng);
            }
          }

          const icon = createVehicleIcon(
            device.status,
            forwardDirection,
            device.position.speed,
            isSelected,
            invertHeading,
            device.name
          );

          return (
            <Marker
              key={device.ident}
              position={[device.position.lat, device.position.lng]}
              icon={icon}
              zIndexOffset={isSelected ? 300 : 10}
              eventHandlers={{
                click: () => onSelectDevice(device),
              }}
            >
              {/* Custom Dark Telematics Popup */}
              <Popup className="custom-telematics-popup">
                <div className="p-4 space-y-3 min-w-[250px] select-none">
                  {/* Title & Status */}
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">
                        {device.name}
                      </h4>
                      <p className="text-[11px] font-mono text-zinc-400">
                        {device.ident}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${device.status === 'moving'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : device.status === 'idle'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                    >
                      {device.status}
                    </span>
                  </div>

                  {/* Telemetry Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                      <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                      <div>
                        <div className="text-[10px] text-zinc-400">Velocity</div>
                        <div className="font-mono font-bold text-white">
                          {Math.round(device.position.speed)} km/h
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                      <Compass className="w-3.5 h-3.5 text-indigo-400" />
                      <div>
                        <div className="text-[10px] text-zinc-400">Heading</div>
                        <div className="font-mono font-bold text-white">
                          {Math.round(forwardDirection)}° {getHeadingName(forwardDirection)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <div>
                        <div className="text-[10px] text-zinc-400">Ignition</div>
                        <div className="font-mono font-bold text-white">
                          {device.engine ? 'ON' : 'OFF'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                      <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <div className="text-[10px] text-zinc-400">Battery</div>
                        <div className="font-mono font-bold text-white">
                          {device.battery_voltage ? `${device.battery_voltage.toFixed(1)}V` : '--'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coordinates & Timestamp */}
                  <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
                    <span className="font-mono">
                      {device.position.lat.toFixed(4)}, {device.position.lng.toFixed(4)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(device.updated_at)}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapArea;
