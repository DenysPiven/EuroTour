import type { RouteMode, RouteResult, Stop } from "../types";
import { buildTrainRoute } from "./trainRouting";

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const CHUNK_SIZE = 25;

interface OsrmRouteResponse {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
    };
  }>;
  code?: string;
  message?: string;
}

async function fetchOsrmSegment(
  stops: Stop[],
): Promise<{ coordinates: [number, number][]; distance: number; duration: number }> {
  const coordString = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url = `${OSRM_URL}/${coordString}?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OSRM error: ${response.statusText}`);
  }

  const data = (await response.json()) as OsrmRouteResponse;
  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error(data.message ?? "Failed to build route segment");
  }

  const route = data.routes[0];
  return {
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distance: route.distance,
    duration: route.duration,
  };
}

export function buildFallbackRoute(
  stops: Stop[],
  mode: RouteMode = "driving",
): RouteResult {
  return {
    coordinates: stops.map((s) => [s.lat, s.lng] as [number, number]),
    stats: { distanceKm: 0, durationHours: 0, segments: 0 },
    fallback: true,
    mode,
  };
}

async function buildDrivingRoute(
  stops: Stop[],
  onProgress?: (segment: number, total: number) => void,
): Promise<RouteResult> {
  if (stops.length < 2) {
    return {
      coordinates: stops.map((s) => [s.lat, s.lng] as [number, number]),
      stats: { distanceKm: 0, durationHours: 0, segments: 0 },
      mode: "driving",
    };
  }

  const allCoordinates: [number, number][] = [];
  let totalDistance = 0;
  let totalDuration = 0;

  const step = CHUNK_SIZE - 1;
  const segmentCount = Math.ceil((stops.length - 1) / step);
  let segmentIndex = 0;

  for (let start = 0; start < stops.length - 1; start += step) {
    segmentIndex++;
    onProgress?.(segmentIndex, segmentCount);

    const end = Math.min(start + CHUNK_SIZE, stops.length);
    const segmentStops = stops.slice(start, end);
    const segment = await fetchOsrmSegment(segmentStops);

    if (allCoordinates.length > 0) {
      segment.coordinates.shift();
    }

    allCoordinates.push(...segment.coordinates);
    totalDistance += segment.distance;
    totalDuration += segment.duration;
  }

  return {
    coordinates: allCoordinates,
    stats: {
      distanceKm: totalDistance / 1000,
      durationHours: totalDuration / 3600,
      segments: segmentCount,
    },
    mode: "driving",
  };
}

function legMode(stop: Stop, defaultMode: RouteMode): RouteMode {
  return stop.mode ?? defaultMode;
}

/** Split stops into contiguous groups that share the same travel mode. */
export function splitStopsByMode(
  stops: Stop[],
  defaultMode: RouteMode,
): Array<{ mode: RouteMode; stops: Stop[] }> {
  if (stops.length < 2) {
    return [];
  }

  const groups: Array<{ mode: RouteMode; stops: Stop[] }> = [];
  let currentMode = legMode(stops[0], defaultMode);
  let currentStops: Stop[] = [stops[0]];

  for (let i = 1; i < stops.length; i++) {
    currentStops.push(stops[i]);

    if (i < stops.length - 1) {
      const nextMode = legMode(stops[i], defaultMode);
      if (nextMode !== currentMode) {
        groups.push({ mode: currentMode, stops: currentStops });
        currentMode = nextMode;
        currentStops = [stops[i]];
      }
    }
  }

  groups.push({ mode: currentMode, stops: currentStops });
  return groups;
}

async function buildUniformRoute(
  stops: Stop[],
  mode: RouteMode,
  onProgress?: (segment: number, total: number) => void,
): Promise<RouteResult> {
  if (mode === "train") {
    return buildTrainRoute(stops, onProgress);
  }
  return buildDrivingRoute(stops, onProgress);
}

export async function buildRoute(
  stops: Stop[],
  mode: RouteMode = "driving",
  onProgress?: (segment: number, total: number) => void,
): Promise<RouteResult> {
  const groups = splitStopsByMode(stops, mode);

  if (groups.length === 0) {
    return {
      coordinates: stops.map((s) => [s.lat, s.lng] as [number, number]),
      stats: { distanceKm: 0, durationHours: 0, segments: 0 },
      mode,
    };
  }

  if (groups.length === 1) {
    return buildUniformRoute(groups[0].stops, groups[0].mode, onProgress);
  }

  const allCoordinates: [number, number][] = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let totalSegments = 0;
  let anyFallback = false;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    onProgress?.(i + 1, groups.length);

    let part: RouteResult;
    try {
      part = await buildUniformRoute(group.stops, group.mode);
    } catch {
      part = buildFallbackRoute(group.stops, group.mode);
    }

    if (allCoordinates.length > 0 && part.coordinates.length > 0) {
      part.coordinates.shift();
    }

    allCoordinates.push(...part.coordinates);
    totalDistance += part.stats.distanceKm;
    totalDuration += part.stats.durationHours;
    totalSegments += part.stats.segments;
    anyFallback = anyFallback || Boolean(part.fallback);
  }

  return {
    coordinates: allCoordinates,
    stats: {
      distanceKm: totalDistance,
      durationHours: totalDuration,
      segments: totalSegments,
    },
    mode,
    fallback: anyFallback,
  };
}
