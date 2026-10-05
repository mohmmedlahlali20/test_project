import { useState, useEffect, useRef } from 'react';
import type { HistoryPoint } from '../types';

// In-memory LRU-like cache for road-snapped trajectories
const routeCache = new Map<string, [number, number][]>();

/**
 * Downsample points uniformly to keep within OSRM URL limits (max ~40 waypoints)
 */
function downsamplePoints(points: HistoryPoint[], maxPoints = 35): HistoryPoint[] {
  if (points.length <= maxPoints) return points;
  const result: HistoryPoint[] = [points[0]];
  const step = (points.length - 1) / (maxPoints - 1);

  for (let i = 1; i < maxPoints - 1; i++) {
    const index = Math.round(i * step);
    result.push(points[index]);
  }

  result.push(points[points.length - 1]);
  return result;
}

/**
 * Generate a stable cache key based on start, end, and sampled middle points
 */
function getCacheKey(points: HistoryPoint[]): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  const mid = points[Math.floor(points.length / 2)];
  return `${first.lat.toFixed(5)},${first.lng.toFixed(5)}_${mid.lat.toFixed(5)},${mid.lng.toFixed(5)}_${last.lat.toFixed(5)},${last.lng.toFixed(5)}_${points.length}`;
}

/**
 * Custom Hook: useSnappedRoute
 * Uses OSRM Map Matching & Routing API to snap raw GPS trajectory points
 * to real road networks, with caching, debouncing, and graceful fallback.
 */
export function useSnappedRoute(rawPoints: HistoryPoint[]) {
  const [snappedCoords, setSnappedCoords] = useState<[number, number][]>(() =>
    rawPoints.map((p) => [p.lat, p.lng])
  );
  const [isSnapping, setIsSnapping] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // If fewer than 2 points, cannot calculate route
    if (!rawPoints || rawPoints.length < 2) {
      setSnappedCoords(rawPoints ? rawPoints.map((p) => [p.lat, p.lng]) : []);
      return;
    }

    const rawCoords: [number, number][] = rawPoints.map((p) => [p.lat, p.lng]);
    const cacheKey = getCacheKey(rawPoints);

    // 1. Check in-memory cache
    if (routeCache.has(cacheKey)) {
      setSnappedCoords(routeCache.get(cacheKey)!);
      return;
    }

    // 2. Debounce OSRM requests by 350ms to prevent spamming
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      // Abort previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsSnapping(true);

      try {
        const sampled = downsamplePoints(rawPoints, 30);
        // OSRM requires: longitude,latitude;longitude,latitude...
        const coordString = sampled.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');

        // Primary: OSRM Match API (Map matching for GPS traces)
        const matchUrl = `https://router.project-osrm.org/match/v1/driving/${coordString}?overview=full&geometries=geojson&tidy=true`;

        const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s timeout

        let response = await fetch(matchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        let data = response.ok ? await response.json() : null;
        let roadCoordinates: [number, number][] = [];

        if (data && data.code === 'Ok' && Array.isArray(data.matchings) && data.matchings.length > 0) {
          // Flatten matchings geometry coordinates
          for (const matching of data.matchings) {
            if (matching.geometry && Array.isArray(matching.geometry.coordinates)) {
              // Convert GeoJSON [lng, lat] -> Leaflet [lat, lng]
              const segment = matching.geometry.coordinates.map(
                ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
              );
              roadCoordinates.push(...segment);
            }
          }
        }

        // Secondary Fallback: OSRM Route API if Match had gaps or failed
        if (roadCoordinates.length < 2) {
          const routeUrl = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;
          const routeRes = await fetch(routeUrl, { signal: controller.signal });
          if (routeRes.ok) {
            const routeData = await routeRes.json();
            if (routeData.code === 'Ok' && routeData.routes?.[0]?.geometry?.coordinates) {
              roadCoordinates = routeData.routes[0].geometry.coordinates.map(
                ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
              );
            }
          }
        }

        // If road snapping succeeded, cache and display
        if (roadCoordinates.length >= 2) {
          routeCache.set(cacheKey, roadCoordinates);
          // Limit cache size to 100 entries
          if (routeCache.size > 100) {
            const firstKey = routeCache.keys().next().value;
            if (firstKey) routeCache.delete(firstKey);
          }
          setSnappedCoords(roadCoordinates);
        } else {
          // Graceful fallback to raw coordinates
          setSnappedCoords(rawCoords);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          // Graceful fallback to raw coordinates on network error / timeout
          setSnappedCoords(rawCoords);
        }
      } finally {
        setIsSnapping(false);
      }
    }, 350);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [rawPoints]);

  return {
    polylineCoords: snappedCoords.length >= 2 ? snappedCoords : rawPoints.map((p) => [p.lat, p.lng] as [number, number]),
    isSnapping,
  };
}
