// ─── Telematics & GPS Types ──────────────────────────────────────────────────

export interface GpsPosition {
  lat: number;
  lng: number;
  speed: number;        // km/h
  direction: number;    // degrees 0-360
  altitude: number;     // meters
  accuracy?: number;
  hdop?: number;
}

export type MovementStatus = 'moving' | 'idle' | 'offline';

export interface Device {
  id: number;
  ident: string;
  name: string;
  status: MovementStatus;
  engine: boolean;           // ignition on/off
  battery_voltage: number;   // volts
  gsm_signal: number;        // 1-5 bars
  odometer: number;          // km or mileage
  position: GpsPosition;
  updated_at: string;        // ISO 8601
}

export interface ApiDeviceRecord {
  id: number;
  ident: string;
  name: string;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_speed?: number | null;
  last_direction?: number | null;
  engine_ignition?: boolean | null;
  movement_status?: boolean | null;
  mileage?: number | null;
  last_seen_at?: string | null;
}

export interface HistoryPoint {
  id?: number;
  lat: number;
  lng: number;
  speed: number;
  direction: number;
  altitude?: number;
  engine_ignition?: boolean;
  movement_status?: boolean;
  recorded_at: string;
}

export interface WebSocketPositionUpdate {
  device_id?: number;
  ident: string;
  name?: string | null;
  latitude: number;
  longitude: number;
  speed?: number;
  direction?: number;
  altitude?: number;
  engine_ignition?: boolean;
  movement_status?: boolean;
  recorded_at?: string;
  battery_voltage?: number;
  gsm_signal?: number;
  odometer?: number;
}

export interface FleetStats {
  total: number;
  moving: number;
  idle: number;
  offline: number;
  avgSpeed: number;
}
