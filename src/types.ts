export type RouteMode = "driving" | "train";

export interface RouteMeta {
  id: string;
  name: string;
  file: string;
  mode?: RouteMode;
}

export interface StopInput {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  date?: string;
  notes?: string;
  resolvedAddress?: string;
}

export interface Stop extends StopInput {
  id: string;
  name: string;
  lat: number;
  lng: number;
  resolvedAddress?: string;
}

export interface RouteStats {
  distanceKm: number;
  durationHours: number;
  segments: number;
}

export interface RouteResult {
  coordinates: [number, number][];
  stats: RouteStats;
  fallback?: boolean;
  mode?: RouteMode;
}
