export interface GradientSegment {
  positions: [number, number][];
  color: string;
}

export interface DistanceGradientRoute {
  segments: GradientSegment[];
  totalDistanceKm: number;
}

const COLOR_STEPS = 36;
const EARTH_RADIUS_KM = 6371;

function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistanceKm(km: number): string {
  if (km >= 1000) {
    return `${Math.round(km).toLocaleString("en-US")} km`;
  }
  if (km >= 10) {
    return `${Math.round(km)} km`;
  }
  return `${km.toFixed(1)} km`;
}

function buildCumulativeDistances(
  coordinates: [number, number][],
): number[] {
  const cumulative = [0];

  for (let i = 1; i < coordinates.length; i += 1) {
    cumulative.push(
      cumulative[i - 1] + haversineKm(coordinates[i - 1], coordinates[i]),
    );
  }

  return cumulative;
}

function colorAtRatio(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const hue = 220 - clamped * 220;
  return `hsl(${hue}, 82%, 48%)`;
}

export function buildDistanceGradientRoute(
  coordinates: [number, number][],
): DistanceGradientRoute | null {
  if (coordinates.length < 2) {
    return null;
  }

  const cumulative = buildCumulativeDistances(coordinates);
  const totalDistanceKm = cumulative[cumulative.length - 1];

  if (totalDistanceKm <= 0) {
    return null;
  }

  const segments: GradientSegment[] = [];
  let currentBucket = -1;
  let currentPositions: [number, number][] = [];

  const bucketAt = (distanceKm: number) =>
    Math.min(
      COLOR_STEPS - 1,
      Math.floor((distanceKm / totalDistanceKm) * COLOR_STEPS),
    );

  for (let i = 0; i < coordinates.length; i += 1) {
    const bucket = bucketAt(cumulative[i]);

    if (bucket !== currentBucket) {
      if (currentPositions.length > 1) {
        const ratio = cumulative[i - 1] / totalDistanceKm;
        segments.push({
          positions: [...currentPositions],
          color: colorAtRatio(ratio),
        });
      }

      currentPositions =
        currentPositions.length > 0
          ? [currentPositions[currentPositions.length - 1]]
          : [];
      currentBucket = bucket;
    }

    currentPositions.push(coordinates[i]);
  }

  if (currentPositions.length > 1) {
    segments.push({
      positions: currentPositions,
      color: colorAtRatio(1),
    });
  }

  return segments.length > 0 ? { segments, totalDistanceKm } : null;
}
