import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { echo } from './echo';
import type { 
  Device, 
  ApiDeviceRecord, 
  HistoryPoint, 
  FleetStats, 
  WebSocketPositionUpdate 
} from './types';
import { fixLeafletIcons } from './utils/geo';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MapArea } from './components/MapArea';
import { TelemetryHud } from './components/TelemetryHud';

export const App: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [trajectory, setTrajectory] = useState<HistoryPoint[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [fitBoundsTrigger, setFitBoundsTrigger] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [invertHeading, setInvertHeading] = useState<boolean>(false);

  const simulationTimerRef = useRef<number | null>(null);

  // Initialize Leaflet icons
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  // Normalize API device records strictly from Database columns
  const normalizeDeviceRecord = (record: ApiDeviceRecord): Device => {
    const lat = Number(record.last_latitude ?? 0);
    const lng = Number(record.last_longitude ?? 0);
    const speed = Number(record.last_speed ?? 0);
    const direction = Number(record.last_direction ?? 0);
    const isEngine = Boolean(record.engine_ignition);
    const isMoving = Boolean(record.movement_status) || speed > 3;

    let status: 'moving' | 'idle' | 'offline' = 'offline';
    if (isMoving) status = 'moving';
    else if (isEngine) status = 'idle';
    else status = 'offline';

    return {
      id: record.id,
      ident: record.ident,
      name: record.name || ('Vehicle ' + record.ident),
      status,
      engine: isEngine,
      battery_voltage: (record as any).battery_voltage ?? 0,
      gsm_signal: (record as any).gsm_signal ?? 0,
      odometer: Number(record.mileage ?? 0),
      position: {
        lat,
        lng,
        speed,
        direction,
        altitude: (record as any).altitude ?? 0,
      },
      updated_at: record.last_seen_at || new Date().toISOString(),
    };
  };

  // Fetch initial fleet devices strictly from Laravel Database API
  const fetchDevices = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    try {
      const response = await fetch('/api/devices');
      if (!response.ok) {
        throw new Error('HTTP error ' + response.status);
      }
      const data = await response.json();
      const records: ApiDeviceRecord[] = Array.isArray(data)
        ? data
        : data?.data && Array.isArray(data.data)
        ? data.data
        : [];

      if (records.length > 0) {
        const normalized = records
          .filter((r) => r.last_latitude != null && r.last_longitude != null && !isNaN(Number(r.last_latitude)) && !isNaN(Number(r.last_longitude)))
          .map(normalizeDeviceRecord);

        setDevices((prevDevices) => {
          if (prevDevices.length === 0 && normalized.length > 0) {
            setFitBoundsTrigger((t) => t + 1);
          }
          return normalized;
        });

        setSelectedDevice((prev) => {
          if (!prev) {
            if (normalized.length > 0) {
              handleSelectDevice(normalized[0]);
              return normalized[0];
            }
            return null;
          }
          const stillExists = normalized.find((d) => d.ident === prev.ident);
          if (stillExists) return stillExists;
          if (normalized.length > 0) {
            handleSelectDevice(normalized[0]);
            return normalized[0];
          }
          return null;
        });
      } else {
        // Zero records in DB - pure empty state
        setDevices([]);
        setSelectedDevice(null);
        setTrajectory([]);
      }
    } catch (err) {
      console.error('Database API unavailable or empty:', err);
      setDevices([]);
      setSelectedDevice(null);
      setTrajectory([]);
    } finally {
      if (isInitial) {
        setIsLoading(false);
        setFitBoundsTrigger((prev) => prev + 1);
      }
    }
  }, []);

  useEffect(() => {
    fetchDevices(true);
    // Auto-sync polling every 2.5s so newly queued & ingested vehicles appear instantly
    const interval = setInterval(() => {
      fetchDevices(false);
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  // Handle vehicle selection & fetch trajectory strictly from Database
  const handleSelectDevice = async (device: Device) => {
    setSelectedDevice(device);

    try {
      const response = await fetch('/api/devices/' + encodeURIComponent(device.ident) + '/history?limit=100');
      if (response.ok) {
        const json = await response.json();
        const rawPoints = Array.isArray(json)
          ? json
          : json?.data && Array.isArray(json.data)
          ? json.data
          : [];

        if (rawPoints.length > 0) {
          // Backend returns orderByDesc('recorded_at')
          // Sort chronologically (oldest to newest) for polyline
          const mapped: HistoryPoint[] = rawPoints
            .map((item: any) => ({
              id: item.id,
              lat: Number(item.latitude),
              lng: Number(item.longitude),
              speed: Number(item.speed ?? 0),
              direction: Number(item.direction ?? 0),
              altitude: Number(item.altitude ?? 0),
              engine_ignition: Boolean(item.engine_ignition),
              movement_status: Boolean(item.movement_status),
              recorded_at: item.recorded_at || new Date().toISOString(),
            }))
            .sort((a: HistoryPoint, b: HistoryPoint) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

          setTrajectory(mapped);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch trajectory history from DB:', err);
    }

    // Pure DB data: if no points recorded in database, trajectory is empty!
    setTrajectory([]);
  };

  // Process incoming telemetry updates (from WebSocket or Ingestion)
  const applyTelemetryUpdate = useCallback((update: WebSocketPositionUpdate) => {
    const lat = Number(update.latitude);
    const lng = Number(update.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const speed = update.speed !== undefined ? Number(update.speed) : undefined;
    const direction = update.direction !== undefined ? Number(update.direction) : undefined;
    const isEngine = update.engine_ignition;
    const isMoving = update.movement_status ?? (speed !== undefined && speed > 2);

    setDevices((prevDevices) => {
      let found = false;
      const updated = prevDevices.map((d) => {
        if (d.ident === update.ident || (update.device_id && d.id === update.device_id)) {
          found = true;
          const nextSpeed = speed !== undefined ? speed : d.position.speed;
          const nextDir = direction !== undefined ? direction : d.position.direction;
          const nextEngine = isEngine !== undefined ? isEngine : d.engine;
          const nextMoving = isMoving !== undefined ? isMoving : d.status === 'moving';

          let nextStatus: 'moving' | 'idle' | 'offline' = 'offline';
          if (nextMoving) nextStatus = 'moving';
          else if (nextEngine) nextStatus = 'idle';

          return {
            ...d,
            name: update.name || d.name,
            status: nextStatus,
            engine: nextEngine,
            battery_voltage: update.battery_voltage !== undefined ? update.battery_voltage : d.battery_voltage,
            gsm_signal: update.gsm_signal !== undefined ? update.gsm_signal : d.gsm_signal,
            odometer: update.odometer !== undefined ? update.odometer : d.odometer,
            position: {
              ...d.position,
              lat,
              lng,
              speed: nextSpeed,
              direction: nextDir,
              altitude: update.altitude !== undefined ? update.altitude : d.position.altitude,
            },
            updated_at: update.recorded_at || new Date().toISOString(),
          };
        }
        return d;
      });

      // If new device arrived over WebSocket, append it
      if (!found && update.ident) {
        const newDevice: Device = {
          id: update.device_id ?? Date.now(),
          ident: update.ident,
          name: update.name || ('Device ' + update.ident),
          status: isMoving ? 'moving' : isEngine ? 'idle' : 'offline',
          engine: Boolean(isEngine),
          battery_voltage: update.battery_voltage ?? 0,
          gsm_signal: update.gsm_signal ?? 0,
          odometer: update.odometer ?? 0,
          position: {
            lat,
            lng,
            speed: speed ?? 0,
            direction: direction ?? 0,
            altitude: update.altitude ?? 0,
          },
          updated_at: update.recorded_at || new Date().toISOString(),
        };
        return [newDevice, ...updated];
      }

      return updated;
    });

    // If updated device is the currently selected vehicle, append to polyline trajectory
    setSelectedDevice((currentSelected) => {
      if (
        currentSelected &&
        (currentSelected.ident === update.ident ||
          (update.device_id && currentSelected.id === update.device_id))
      ) {
        const updatedVehicle: Device = {
          ...currentSelected,
          position: {
            ...currentSelected.position,
            lat,
            lng,
            speed: speed !== undefined ? speed : currentSelected.position.speed,
            direction: direction !== undefined ? direction : currentSelected.position.direction,
            altitude: update.altitude !== undefined ? update.altitude : currentSelected.position.altitude,
          },
          engine: isEngine !== undefined ? isEngine : currentSelected.engine,
          battery_voltage: update.battery_voltage !== undefined ? update.battery_voltage : currentSelected.battery_voltage,
          gsm_signal: update.gsm_signal !== undefined ? update.gsm_signal : currentSelected.gsm_signal,
          odometer: update.odometer !== undefined ? update.odometer : currentSelected.odometer,
          updated_at: update.recorded_at || new Date().toISOString(),
        };

        // Append to trajectory
        setTrajectory((prev) => [
          ...prev,
          {
            lat,
            lng,
            speed: speed ?? updatedVehicle.position.speed,
            direction: direction ?? updatedVehicle.position.direction,
            altitude: update.altitude ?? 0,
            recorded_at: update.recorded_at || new Date().toISOString(),
          },
        ]);

        return updatedVehicle;
      }
      return currentSelected;
    });
  }, []);

  // WebSocket Subscription via Laravel Echo (Laravel Reverb)
  useEffect(() => {
    try {
      const pusherConnection = (echo.connector as any)?.pusher?.connection;
      if (pusherConnection) {
        setConnectionStatus(
          pusherConnection.state === 'connected' ? 'connected' : 'connecting'
        );

        pusherConnection.bind('connected', () => setConnectionStatus('connected'));
        pusherConnection.bind('connecting', () => setConnectionStatus('connecting'));
        pusherConnection.bind('disconnected', () => setConnectionStatus('disconnected'));
        pusherConnection.bind('unavailable', () => setConnectionStatus('disconnected'));
      }
    } catch {
      // Ignore initial connection errors
    }

    const channel = echo.channel('fleet-tracker');

    const handlePayload = (payload: any) => {
      if (!payload) return;

      if (Array.isArray(payload.positions)) {
        payload.positions.forEach((pos: any) => {
          applyTelemetryUpdate({
            device_id: pos.device_id,
            ident: pos.ident,
            name: pos.name,
            latitude: pos.latitude,
            longitude: pos.longitude,
            speed: pos.speed,
            direction: pos.direction,
            altitude: pos.altitude,
            engine_ignition: pos.engine_ignition,
            movement_status: pos.movement_status,
            battery_voltage: pos.battery_voltage,
            gsm_signal: pos.gsm_signal,
            odometer: pos.odometer,
            recorded_at: pos.recorded_at,
          });
        });
      } else if (payload.device) {
        const d = payload.device;
        applyTelemetryUpdate({
          device_id: d.id,
          ident: d.ident,
          name: d.name,
          latitude: d.position?.lat ?? d.latitude,
          longitude: d.position?.lng ?? d.longitude,
          speed: d.position?.speed ?? d.speed,
          direction: d.position?.direction ?? d.direction,
          altitude: d.position?.altitude ?? d.altitude,
          engine_ignition: d.engine ?? d.engine_ignition,
          movement_status: d.status === 'moving' || d.movement_status,
          battery_voltage: d.battery_voltage,
          gsm_signal: d.gsm_signal,
          odometer: d.odometer,
          recorded_at: d.updated_at,
        });
      } else if (payload.ident && payload.latitude !== undefined) {
        applyTelemetryUpdate(payload);
      }
    };

    channel.listen('position.updated', handlePayload);
    channel.listen('.position.updated', handlePayload);
    channel.listen('VehiclePositionUpdated', handlePayload);
    channel.listen('.VehiclePositionUpdated', handlePayload);

    return () => {
      channel.stopListening('position.updated');
      channel.stopListening('.position.updated');
      channel.stopListening('VehiclePositionUpdated');
      channel.stopListening('.VehiclePositionUpdated');
      echo.leaveChannel('fleet-tracker');
    };
  }, [applyTelemetryUpdate]);

  // Real Ingestion Pipeline Simulator:
  // When active, sends actual IoT payloads to POST /api/gps/ingest.
  // The backend queue worker writes them directly into the database (Device::upsert + GpsPosition::insert).
  useEffect(() => {
    if (!isSimulating) {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      return;
    }

    const simVehicles = [
      { ident: '111110000000001', name: 'Truck Alpha', lat: 33.5892, lng: -7.6185, speed: 65, dir: 135, mileage: 15234.5 },
      { ident: '111110000000002', name: 'Van Beta', lat: 33.5950, lng: -7.6050, speed: 45, dir: 45, mileage: 48120.3 },
      { ident: '111110000000003', name: 'Car Gamma', lat: 33.5780, lng: -7.6250, speed: 75, dir: 270, mileage: 91002.7 },
    ];

    simulationTimerRef.current = window.setInterval(async () => {
      const batch = simVehicles.map((v) => {
        v.speed = Math.max(10, Math.min(110, v.speed + (Math.random() - 0.5) * 15));
        v.dir = (v.dir + (Math.random() - 0.5) * 20 + 360) % 360;
        const distKm = (v.speed / 3600) * 2;
        v.lat += (distKm * Math.cos((v.dir * Math.PI) / 180)) / 111.32;
        v.lng += (distKm * Math.sin((v.dir * Math.PI) / 180)) / (111.32 * Math.cos((v.lat * Math.PI) / 180));
        v.mileage += distKm;

        return {
          'battery.voltage': Number((13.7 + Math.random() * 0.5).toFixed(2)),
          'channel.id': 429,
          'device.id': parseInt(v.ident.slice(-6), 10),
          'device.name': v.name,
          'device.type.id': 744,
          'engine.ignition.status': true,
          'event.priority.enum': 0,
          'external.powersource.voltage': 14.1,
          'gnss.state.enum': 1,
          'gnss.status': true,
          'gsm.cellid': 11511,
          'gsm.lac': 108,
          'gsm.mcc': 257,
          'gsm.mnc': 1,
          'gsm.operator.code': '25701',
          'gsm.signal.level': 85,
          'ident': v.ident,
          'movement.status': true,
          'position.altitude': 180,
          'position.direction': Math.round(v.dir),
          'position.hdop': 0.8,
          'position.latitude': Number(v.lat.toFixed(7)),
          'position.longitude': Number(v.lng.toFixed(7)),
          'position.satellites': 14,
          'position.speed': Math.round(v.speed),
          'position.valid': true,
          'protocol.id': 14,
          'server.timestamp': Date.now() / 1000,
          'timestamp': Math.floor(Date.now() / 1000),
          'vehicle.mileage': Number(v.mileage.toFixed(3)),
        };
      });

      try {
        await fetch('/api/gps/ingest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(batch),
        });
      } catch (err) {
        console.error('Simulation ingest failed:', err);
      }
    }, 2000);

    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, [isSimulating]);

  // Compute fleet statistics strictly from real database devices
  const stats = useMemo<FleetStats>(() => {
    const total = devices.length;
    const moving = devices.filter((d) => d.status === 'moving').length;
    const idle = devices.filter((d) => d.status === 'idle').length;
    const offline = devices.filter((d) => d.status === 'offline').length;
    const movingSpeeds = devices
      .filter((d) => d.status === 'moving')
      .map((d) => d.position.speed);
    const avgSpeed =
      movingSpeeds.length > 0
        ? movingSpeeds.reduce((a, b) => a + b, 0) / movingSpeeds.length
        : 0;

    return { total, moving, idle, offline, avgSpeed };
  }, [devices]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Top Header Bar */}
      <Header
        stats={stats}
        connectionStatus={connectionStatus}
        isSimulating={isSimulating}
        onToggleSimulation={() => setIsSimulating(!isSimulating)}
        onRefresh={fetchDevices}
        onFitBounds={() => setFitBoundsTrigger((prev) => prev + 1)}
        isLoading={isLoading}
        invertHeading={invertHeading}
        onToggleInvertHeading={() => setInvertHeading(!invertHeading)}
      />

      {/* Main Workspace: Collapsible Sidebar + Map Area */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Left Telemetry Sidebar */}
        <Sidebar
          devices={devices}
          selectedDevice={selectedDevice}
          onSelectDevice={handleSelectDevice}
          isLoading={isLoading}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Leaflet Dark Matter Interactive Map Area */}
        <MapArea
          devices={devices}
          selectedDevice={selectedDevice}
          trajectory={trajectory}
          onSelectDevice={handleSelectDevice}
          fitBoundsTrigger={fitBoundsTrigger}
          invertHeading={invertHeading}
        />

        {/* Bottom Floating Telemetry Inspector HUD */}
        <TelemetryHud
          device={selectedDevice}
          trajectory={trajectory}
          onClose={() => setSelectedDevice(null)}
        />
      </div>
    </div>
  );
};

export default App;
