import L from 'leaflet';
import type { MovementStatus } from '../types';

/**
 * Convert heading degrees (0-360) to 8-point compass abbreviation
 */
export function getHeadingName(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

/**
 * Calculate forward compass bearing (0-360 deg) from (lat1, lng1) to (lat2, lng2)
 * 0 = North, 90 = East, 180 = South, 270 = West
 */
export function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return ((brng % 360) + 360) % 360;
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 5) return 'Just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffSeconds / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recent';
  }
}

/**
 * Determine vehicle type from name or ident
 */
export function getVehicleType(name = ''): 'truck' | 'van' | 'car' {
  const lower = name.toLowerCase();
  if (/truck|heavy|titan|semi|lorry|freight|trailer/i.test(lower)) return 'truck';
  if (/van|cargo|delivery|transit|sprinter/i.test(lower)) return 'van';
  return 'car';
}

/**
 * Generate top-down realistic vehicle silhouette SVG
 */
function getVehicleSilhouetteSvg(type: 'truck' | 'van' | 'car', color: string): string {
  if (type === 'truck') {
    // Top-down Semi-Truck / Heavy Duty Vehicle
    return `
      <g>
        <!-- Wheels / Tires -->
        <rect x="2" y="10" width="4" height="9" rx="1.5" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
        <rect x="26" y="10" width="4" height="9" rx="1.5" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
        <rect x="2" y="38" width="4" height="10" rx="1.5" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
        <rect x="26" y="38" width="4" height="10" rx="1.5" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
        <rect x="2" y="49" width="4" height="10" rx="1.5" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
        <rect x="26" y="49" width="4" height="10" rx="1.5" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />

        <!-- Trailer Body -->
        <rect x="4" y="24" width="24" height="37" rx="2.5" fill="#27272a" stroke="#52525b" stroke-width="1.2" />
        <!-- Trailer Roof Ribs -->
        <line x1="6" y1="30" x2="26" y2="30" stroke="#3f3f46" stroke-width="1" />
        <line x1="6" y1="36" x2="26" y2="36" stroke="#3f3f46" stroke-width="1" />
        <line x1="6" y1="42" x2="26" y2="42" stroke="#3f3f46" stroke-width="1" />
        <line x1="6" y1="48" x2="26" y2="48" stroke="#3f3f46" stroke-width="1" />
        <line x1="6" y1="54" x2="26" y2="54" stroke="#3f3f46" stroke-width="1" />

        <!-- Cab Connector -->
        <rect x="13" y="21" width="6" height="4" fill="#09090b" />

        <!-- Front Truck Cab -->
        <path d="M 6 22 L 6 9 C 6 6 9 4 16 4 C 23 4 26 6 26 9 L 26 22 Z" fill="${color}" stroke="#ffffff" stroke-width="1.2" />
        <!-- Windshield -->
        <path d="M 8 11 C 10 9 22 9 24 11 L 24 14 C 21 13 11 13 8 14 Z" fill="#09090b" stroke="#3f3f46" stroke-width="0.6" />
        <!-- Sun visor / roof cap -->
        <rect x="9" y="15" width="14" height="5" rx="1" fill="rgba(0,0,0,0.3)" />

        <!-- Headlights -->
        <circle cx="8" cy="5" r="1.8" fill="#fef08a" />
        <circle cx="24" cy="5" r="1.8" fill="#fef08a" />

        <!-- Taillights -->
        <rect x="5" y="60" width="4" height="1.5" fill="#ef4444" />
        <rect x="23" y="60" width="4" height="1.5" fill="#ef4444" />
      </g>
    `;
  }

  if (type === 'van') {
    // Top-down Cargo Delivery Van
    return `
      <g>
        <!-- Wheels / Tires -->
        <rect x="1.5" y="11" width="3.5" height="9" rx="1.2" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
        <rect x="25" y="11" width="3.5" height="9" rx="1.2" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
        <rect x="1.5" y="41" width="3.5" height="9" rx="1.2" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
        <rect x="25" y="41" width="3.5" height="9" rx="1.2" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />

        <!-- Van Body -->
        <rect x="4" y="6" width="22" height="47" rx="4" fill="${color}" stroke="#ffffff" stroke-width="1.2" />

        <!-- Windshield -->
        <path d="M 6 14 C 9 12 21 12 24 14 L 23 18 C 19 17 11 17 7 18 Z" fill="#09090b" stroke="#3f3f46" stroke-width="0.8" />
        
        <!-- Cargo Roof Section -->
        <rect x="6" y="20" width="18" height="30" rx="2" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.2)" stroke-width="0.8" />
        <line x1="8" y1="26" x2="22" y2="26" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
        <line x1="8" y1="33" x2="22" y2="33" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
        <line x1="8" y1="40" x2="22" y2="40" stroke="rgba(255,255,255,0.15)" stroke-width="1" />

        <!-- Side Mirrors -->
        <rect x="1" y="14" width="3" height="2" rx="0.8" fill="#27272a" />
        <rect x="26" y="14" width="3" height="2" rx="0.8" fill="#27272a" />

        <!-- Headlights -->
        <circle cx="7" cy="7" r="1.6" fill="#fef08a" />
        <circle cx="23" cy="7" r="1.6" fill="#fef08a" />

        <!-- Rear Lights -->
        <rect x="5" y="52" width="3.5" height="1.5" fill="#ef4444" />
        <rect x="21.5" y="52" width="3.5" height="1.5" fill="#ef4444" />
      </g>
    `;
  }

  // Top-down Sleek Sports / Fleet Sedan
  return `
    <g>
      <!-- Wheels / Tires -->
      <rect x="2" y="12" width="3.5" height="8.5" rx="1.2" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
      <rect x="24.5" y="12" width="3.5" height="8.5" rx="1.2" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
      <rect x="2" y="36" width="3.5" height="8.5" rx="1.2" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />
      <rect x="24.5" y="36" width="3.5" height="8.5" rx="1.2" fill="#18181b" stroke="#3f3f46" stroke-width="0.8" />

      <!-- Aerodynamic Chassis -->
      <path d="M 6 8 C 8 5 22 5 24 8 C 26 12 26 43 24 47 C 22 50 8 50 6 47 C 4 43 4 12 6 8 Z" 
            fill="${color}" stroke="#ffffff" stroke-width="1.3" />

      <!-- Hood Creases -->
      <path d="M 10 7 L 11 15" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" stroke-linecap="round" />
      <path d="M 20 7 L 19 15" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" stroke-linecap="round" />

      <!-- Front Windshield -->
      <path d="M 7 16 C 10 14 20 14 23 16 L 22 22 C 18 21 12 21 8 22 Z" fill="#09090b" stroke="#3f3f46" stroke-width="0.8" />

      <!-- Glass Roof Panel -->
      <rect x="8.5" y="22" width="13" height="12" rx="1.5" fill="#111113" stroke="#27272a" stroke-width="0.6" />

      <!-- Rear Window -->
      <path d="M 8 35 C 11 36 19 36 22 35 L 23 39 C 19 40 11 40 7 39 Z" fill="#09090b" stroke="#3f3f46" stroke-width="0.8" />

      <!-- Side Mirrors -->
      <path d="M 2 17 L 5 18" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" />
      <path d="M 28 17 L 25 18" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" />

      <!-- Xenon Headlights -->
      <ellipse cx="7" cy="8" rx="2" ry="1.2" fill="#e0f2fe" />
      <ellipse cx="23" cy="8" rx="2" ry="1.2" fill="#e0f2fe" />

      <!-- LED Taillights -->
      <rect x="7" y="47" width="3" height="1.5" rx="0.5" fill="#ef4444" />
      <rect x="20" y="47" width="3" height="1.5" rx="0.5" fill="#ef4444" />
    </g>
  `;
}

/**
 * Create a custom SVG rotated Leaflet DivIcon with realistic vehicle silhouette & dynamic lighting
 */
export function createVehicleIcon(
  status: MovementStatus, 
  direction: number, 
  speed: number, 
  isSelected: boolean,
  invertHeading = false,
  vehicleName = ''
): L.DivIcon {
  const vehicleType = getVehicleType(vehicleName);

  const colorMap = {
    moving: '#10b981', // emerald-500
    idle: '#f59e0b',   // amber-500
    offline: '#f43f5e',// rose-500
  };

  const glowMap = {
    moving: 'rgba(16, 185, 129, 0.45)',
    idle: 'rgba(245, 158, 11, 0.4)',
    offline: 'rgba(244, 63, 94, 0.3)',
  };

  const color = colorMap[status] || colorMap.offline;
  const glow = glowMap[status] || glowMap.offline;

  // Normalized heading with optional 180 inversion
  const effectiveDirection = ((direction + (invertHeading ? 180 : 0)) % 360 + 360) % 360;

  // Dimensions based on type
  const width = vehicleType === 'truck' ? 34 : vehicleType === 'van' ? 30 : 28;
  const height = vehicleType === 'truck' ? 66 : vehicleType === 'van' ? 56 : 52;
  const containerSize = Math.max(width, height) + 32;

  const vehicleSvg = getVehicleSilhouetteSvg(vehicleType, color);

  const html = `
    <div style="
      position: relative; 
      width: ${containerSize}px; 
      height: ${containerSize}px; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      cursor: pointer;
    ">
      <!-- Pulsing Underglow when In Motion -->
      ${status === 'moving' ? `
        <div style="
          position: absolute;
          width: ${containerSize - 10}px;
          height: ${containerSize - 10}px;
          border-radius: 50%;
          border: 2px solid ${color};
          animation: marker-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        "></div>
      ` : ''}

      <!-- Selected Holographic Target Ring -->
      ${isSelected ? `
        <div style="
          position: absolute;
          width: ${containerSize + 12}px;
          height: ${containerSize + 12}px;
          border-radius: 50%;
          border: 2px dashed #22d3ee;
          animation: spin 8s linear infinite;
          box-shadow: 0 0 20px rgba(34,211,238,0.4);
          pointer-events: none;
        "></div>
      ` : ''}

      <!-- Rotated Vehicle Chassis Container -->
      <div style="
        position: relative;
        width: ${width}px;
        height: ${height}px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${effectiveDirection}deg);
        transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        filter: drop-shadow(0 6px 14px rgba(0,0,0,0.8)) drop-shadow(0 0 12px ${glow});
      ">
        <!-- Forward Headlight Conical Beam (Active when moving or idling) -->
        ${status !== 'offline' ? `
          <svg style="position: absolute; top: -48px; left: -18px; width: ${width + 36}px; height: 55px; pointer-events: none; overflow: visible;">
            <defs>
              <linearGradient id="headlight-beam-${vehicleName.replace(/\s+/g, '')}" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8" />
                <stop offset="30%" stop-color="#38bdf8" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#0284c7" stop-opacity="0" />
              </linearGradient>
            </defs>
            <polygon points="${(width + 36) / 2},54 -4,-2 ${width + 40},-2" fill="url(#headlight-beam-${vehicleName.replace(/\s+/g, '')})" />
          </svg>
        ` : ''}

        <!-- Vehicle Silhouette SVG -->
        <svg width="${width}" height="${height}" viewBox="0 0 30 56" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
          ${vehicleSvg}
        </svg>
      </div>

      <!-- Floating Speed / Name Pill Badge (Centered directly below vehicle) -->
      <div style="
        position: absolute;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(9,9,11,0.92);
        backdrop-filter: blur(8px);
        border: 1px solid ${isSelected ? '#22d3ee' : color};
        color: #f4f4f5;
        font-size: 10px;
        font-weight: 700;
        font-family: monospace;
        padding: 1px 6px;
        border-radius: 9999px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.9), 0 0 8px ${color}60;
        white-space: nowrap;
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 3px;
        z-index: 20;
      ">
        <span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: ${color};"></span>
        <span>${speed > 0 ? `${Math.round(speed)} km/h` : vehicleName.slice(0, 10)}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-vehicle-div-icon',
    iconSize: [containerSize, containerSize],
    iconAnchor: [containerSize / 2, containerSize / 2],
    popupAnchor: [0, -containerSize / 2 - 4],
  });
}

/**
 * Clean default leaflet icons fix
 */
export function fixLeafletIcons(): void {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

/**
 * Calculate Haversine distance between two coordinates in kilometers
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate total path distance along coordinates in kilometers
 */
export function calculatePolylineDistance(coords: [number, number][]): number {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += calculateDistanceKm(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }
  return total;
}

/**
 * Format timestamp into readable local time
 */
export function formatTimestamp(dateString?: string | null): string {
  if (!dateString) return '--:--:--';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
}

/**
 * Intermediate Way Direction Point along the route
 */
export interface WayDirectionPoint {
  lat: number;
  lng: number;
  bearing: number;
  index: number;
}

/**
 * Compute evenly spaced direction chevrons along the polyline path to indicate the "Way" of travel
 */
export function computeWayArrows(coords: [number, number][], targetCount = 7): WayDirectionPoint[] {
  if (!coords || coords.length < 3) return [];
  const arrows: WayDirectionPoint[] = [];
  const step = Math.max(1, Math.floor(coords.length / (targetCount + 1)));

  for (let i = step; i < coords.length - 1; i += step) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const next = coords[i + 1];
    const bearing = calculateBearing(prev[0], prev[1], next[0], next[1]);
    arrows.push({
      lat: curr[0],
      lng: curr[1],
      bearing,
      index: i,
    });
  }

  return arrows;
}

/**
 * Create custom SVG Leaflet DivIcon for START waypoint (Origin / Point A)
 */
export function createRouteStartIcon(): L.DivIcon {
  const html = `
    <div style="
      position: relative;
      width: 44px;
      height: 52px;
      display: flex;
      flex-direction: column;
      align-items: center;
      filter: drop-shadow(0 4px 12px rgba(0,0,0,0.9));
      cursor: pointer;
    ">
      <!-- Pulsing Underglow -->
      <div style="
        position: absolute;
        top: 2px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px solid #10b981;
        animation: marker-pulse 2s cubic-bezier(0,0,0.2,1) infinite;
        pointer-events: none;
      "></div>

      <!-- Main Badge -->
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        border: 2.5px solid #ffffff;
        box-shadow: 0 0 16px rgba(16,185,129,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        font-size: 13px;
        font-weight: 900;
        color: #ffffff;
        z-index: 2;
      ">
        A
      </div>

      <!-- Needle pointer -->
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid #059669;
        margin-top: -1px;
        z-index: 1;
      "></div>

      <!-- Label Pill -->
      <div style="
        position: absolute;
        bottom: -2px;
        background: #022c22;
        color: #34d399;
        border: 1px solid #059669;
        font-size: 9px;
        font-family: monospace;
        font-weight: 800;
        padding: 0px 5px;
        border-radius: 4px;
        letter-spacing: 0.5px;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.9);
      ">
        START
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-route-start-icon',
    iconSize: [44, 52],
    iconAnchor: [22, 39],
    popupAnchor: [0, -42],
  });
}

/**
 * Create custom SVG Leaflet DivIcon for END waypoint (Destination / Point B)
 */
export function createRouteEndIcon(): L.DivIcon {
  const html = `
    <div style="
      position: relative;
      width: 44px;
      height: 52px;
      display: flex;
      flex-direction: column;
      align-items: center;
      filter: drop-shadow(0 4px 12px rgba(0,0,0,0.9));
      cursor: pointer;
    ">
      <!-- Pulsing Underglow -->
      <div style="
        position: absolute;
        top: 2px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px solid #f43f5e;
        animation: marker-pulse 2s cubic-bezier(0,0,0.2,1) infinite;
        pointer-events: none;
      "></div>

      <!-- Main Badge -->
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
        border: 2.5px solid #ffffff;
        box-shadow: 0 0 16px rgba(244,63,94,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        font-size: 13px;
        font-weight: 900;
        color: #ffffff;
        z-index: 2;
      ">
        B
      </div>

      <!-- Needle pointer -->
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid #e11d48;
        margin-top: -1px;
        z-index: 1;
      "></div>

      <!-- Label Pill -->
      <div style="
        position: absolute;
        bottom: -2px;
        background: #4c0519;
        color: #fb7185;
        border: 1px solid #e11d48;
        font-size: 9px;
        font-family: monospace;
        font-weight: 800;
        padding: 0px 5px;
        border-radius: 4px;
        letter-spacing: 0.5px;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.9);
      ">
        END
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-route-end-icon',
    iconSize: [44, 52],
    iconAnchor: [22, 39],
    popupAnchor: [0, -42],
  });
}

/**
 * Create custom SVG Leaflet DivIcon for Way Direction arrow
 */
export function createWayDirectionIcon(bearing: number): L.DivIcon {
  const html = `
    <div style="
      width: 22px; 
      height: 22px; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      transform: rotate(${bearing}deg);
      pointer-events: none;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 0 8px #38bdf8);">
        <path d="M12 2 L21 21 L12 17 L3 21 Z" fill="#38bdf8" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-way-arrow-icon',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}
