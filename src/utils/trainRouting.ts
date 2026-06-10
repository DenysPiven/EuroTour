import type { RouteResult, Stop } from "../types";

const RAIL_API = "https://routing.openrailrouting.org/route";
const RAIL_PROFILE = "all_tracks_1435";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CHUNK_SIZE = 25;

interface GraphHopperResponse {
  paths?: Array<{
    distance: number;
    time: number;
    points?: {
      coordinates: [number, number][];
    };
  }>;
  message?: string;
}

interface OverpassElement {
  type: string;
  geometry?: Array<{ lat: number; lon: number }>;
}

function haversine(a: [number, number], b: [number, number]) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function nodeKey(lat: number, lng: number) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

async function fetchOpenRailSegment(
  stops: Stop[],
): Promise<{ coordinates: [number, number][]; distance: number; duration: number } | null> {
  const params = new URLSearchParams({
    profile: RAIL_PROFILE,
    points_encoded: "false",
  });
  for (const stop of stops) {
    params.append("point", `${stop.lat},${stop.lng}`);
  }

  const response = await fetch(`${RAIL_API}?${params.toString()}`);
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GraphHopperResponse;
  if (data.message || !data.paths?.[0]?.points?.coordinates?.length) {
    return null;
  }

  const path = data.paths[0];
  return {
    coordinates: path.points!.coordinates.map(([lng, lat]) => [lat, lng]),
    distance: path.distance,
    duration: path.time / 1000,
  };
}

async function fetchOverpassRailLeg(
  from: Stop,
  to: Stop,
): Promise<[number, number][] | null> {
  const pad = 0.12;
  const south = Math.min(from.lat, to.lat) - pad;
  const north = Math.max(from.lat, to.lat) + pad;
  const west = Math.min(from.lng, to.lng) - pad;
  const east = Math.max(from.lng, to.lng) + pad;

  const query = `[out:json][timeout:25];
way["railway"~"^(rail|light_rail|narrow_gauge|subway|tram)$"](${south},${west},${north},${east});
out geom;`;

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    body: query,
  });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { elements: OverpassElement[] };
  const nodes = new Map<string, [number, number]>();
  const adjacency = new Map<string, Array<{ key: string; weight: number }>>();

  function addEdge(a: string, b: string, weight: number) {
    adjacency.get(a)?.push({ key: b, weight });
    adjacency.get(b)?.push({ key: a, weight });
  }

  for (const element of data.elements) {
    if (element.type !== "way" || !element.geometry?.length) {
      continue;
    }

    for (let i = 0; i < element.geometry.length; i++) {
      const point = element.geometry[i];
      const key = nodeKey(point.lat, point.lon);
      nodes.set(key, [point.lat, point.lon]);
      if (!adjacency.has(key)) {
        adjacency.set(key, []);
      }

      if (i > 0) {
        const prev = element.geometry[i - 1];
        const prevKey = nodeKey(prev.lat, prev.lon);
        const weight = haversine([prev.lat, prev.lon], [point.lat, point.lon]);
        addEdge(prevKey, key, weight);
      }
    }
  }

  if (nodes.size === 0) {
    return null;
  }

  function nearestNode(lat: number, lng: number) {
    let bestKey = "";
    let bestDist = Infinity;
    for (const [key, [nodeLat, nodeLng]] of nodes) {
      const dist = haversine([lat, lng], [nodeLat, nodeLng]);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = key;
      }
    }
    return bestDist < 25000 ? bestKey : null;
  }

  const startKey = nearestNode(from.lat, from.lng);
  const endKey = nearestNode(to.lat, to.lng);
  if (!startKey || !endKey) {
    return null;
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const queue = new Set<string>([startKey]);
  dist.set(startKey, 0);

  while (queue.size > 0) {
    let current = "";
    let currentDist = Infinity;
    for (const key of queue) {
      const value = dist.get(key) ?? Infinity;
      if (value < currentDist) {
        current = key;
        currentDist = value;
      }
    }

    if (!current || current === endKey) {
      break;
    }

    queue.delete(current);
    for (const edge of adjacency.get(current) ?? []) {
      const nextDist = currentDist + edge.weight;
      if (nextDist < (dist.get(edge.key) ?? Infinity)) {
        dist.set(edge.key, nextDist);
        prev.set(edge.key, current);
        queue.add(edge.key);
      }
    }
  }

  if (!dist.has(endKey)) {
    return null;
  }

  const path: [number, number][] = [];
  let cursor: string | undefined = endKey;
  while (cursor) {
    path.unshift(nodes.get(cursor)!);
    cursor = prev.get(cursor);
  }

  return path.length >= 2 ? path : null;
}

async function fetchTrainSegment(
  stops: Stop[],
): Promise<{ coordinates: [number, number][]; distance: number; duration: number; fallback: boolean }> {
  const openRail = await fetchOpenRailSegment(stops);
  if (openRail) {
    return { ...openRail, fallback: false };
  }

  const coordinates: [number, number][] = [];
  let totalDistance = 0;
  let usedFallback = false;

  for (let i = 0; i < stops.length - 1; i++) {
    const leg = await fetchOverpassRailLeg(stops[i], stops[i + 1]);
    const segment = leg ?? ([
      [stops[i].lat, stops[i].lng],
      [stops[i + 1].lat, stops[i + 1].lng],
    ] as [number, number][]);

    if (!leg) {
      usedFallback = true;
    }

    if (coordinates.length > 0) {
      segment.shift();
    }

    for (let j = 0; j < segment.length - 1; j++) {
      totalDistance += haversine(segment[j], segment[j + 1]);
    }

    coordinates.push(...segment);
  }

  return {
    coordinates,
    distance: totalDistance,
    duration: totalDistance / 80000,
    fallback: usedFallback,
  };
}

export async function buildTrainRoute(
  stops: Stop[],
  onProgress?: (segment: number, total: number) => void,
): Promise<RouteResult> {
  if (stops.length < 2) {
    return {
      coordinates: stops.map((s) => [s.lat, s.lng] as [number, number]),
      stats: { distanceKm: 0, durationHours: 0, segments: 0 },
      mode: "train",
    };
  }

  const allCoordinates: [number, number][] = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let anyFallback = false;

  const step = CHUNK_SIZE - 1;
  const segmentCount = Math.ceil((stops.length - 1) / step);
  let segmentIndex = 0;

  for (let start = 0; start < stops.length - 1; start += step) {
    segmentIndex++;
    onProgress?.(segmentIndex, segmentCount);

    const end = Math.min(start + CHUNK_SIZE, stops.length);
    const segmentStops = stops.slice(start, end);
    const segment = await fetchTrainSegment(segmentStops);

    if (allCoordinates.length > 0) {
      segment.coordinates.shift();
    }

    allCoordinates.push(...segment.coordinates);
    totalDistance += segment.distance;
    totalDuration += segment.duration;
    anyFallback = anyFallback || segment.fallback;
  }

  return {
    coordinates: allCoordinates,
    stats: {
      distanceKm: totalDistance / 1000,
      durationHours: totalDuration / 3600,
      segments: segmentCount,
    },
    mode: "train",
    fallback: anyFallback,
  };
}
