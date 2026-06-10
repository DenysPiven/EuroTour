import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { RouteResult, Stop } from "../types";
import { RouteDistanceLegend } from "./RouteDistanceLegend";
import { TimeGradientRoute } from "./TimeGradientRoute";
import { buildDistanceGradientRoute } from "../utils/distanceGradient";

const ROUTE_WEIGHT = 5;
const FALLBACK_WEIGHT = 3;

type StopRole = "start" | "end" | "both" | "middle";

function dotRadius(fallback?: boolean) {
  const lineWeight = fallback ? FALLBACK_WEIGHT : ROUTE_WEIGHT;
  return Math.max(1.5, lineWeight / 2 - 0.5);
}

function loopsHome(stops: Stop[]) {
  if (stops.length < 2) return false;
  const first = stops[0];
  const last = stops[stops.length - 1];
  return first.lat === last.lat && first.lng === last.lng;
}

function getStopRole(index: number, stops: Stop[]): StopRole | "skip" {
  const lastIndex = stops.length - 1;
  const isStart = index === 0;
  const isEnd = index === lastIndex;
  const homeLoop = loopsHome(stops);

  if (isStart && isEnd) return "both";
  if (homeLoop && isEnd) return "skip";
  if (homeLoop && isStart) return "both";
  if (isStart) return "start";
  if (isEnd) return "end";
  return "middle";
}

function markerStyle(role: StopRole, fallback?: boolean) {
  const radius = dotRadius(fallback);

  switch (role) {
    case "start":
      return {
        radius,
        pathOptions: {
          color: "#15803d",
          weight: 1.5,
          fillColor: "#22c55e",
          fillOpacity: 1,
        },
      };
    case "end":
      return {
        radius,
        pathOptions: {
          color: "#b91c1c",
          weight: 1.5,
          fillColor: "#ef4444",
          fillOpacity: 1,
        },
      };
    case "both":
      return {
        radius,
        pathOptions: {
          color: "#b91c1c",
          weight: 2,
          fillColor: "#22c55e",
          fillOpacity: 1,
        },
      };
    default:
      return {
        radius,
        pathOptions: {
          color: "#2563eb",
          weight: 1,
          fillColor: "#fff",
          fillOpacity: 1,
        },
      };
  }
}

function roleLabel(role: StopRole) {
  switch (role) {
    case "start":
      return "Start";
    case "end":
      return "End";
    case "both":
      return "Start & End";
    default:
      return null;
  }
}

function FitBounds({ stops, route }: { stops: Stop[]; route: RouteResult | null }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = stops.map((s) => [s.lat, s.lng]);
    if (route?.coordinates.length) {
      points.push(...route.coordinates);
    }
    if (points.length === 0) {
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [map, stops, route]);

  return null;
}

interface TripMapProps {
  stops: Stop[];
  route: RouteResult | null;
}

export function TripMap({ stops, route }: TripMapProps) {
  const center: [number, number] = stops[0]
    ? [stops[0].lat, stops[0].lng]
    : [50.0, 10.0];

  const gradient = useMemo(
    () =>
      route ? buildDistanceGradientRoute(route.coordinates) : null,
    [route],
  );

  return (
    <>
    <MapContainer center={center} zoom={5} className="trip-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <FitBounds stops={stops} route={route} />
      {route && <TimeGradientRoute route={route} gradient={gradient} />}
      {stops.map((stop, index) => {
        const role = getStopRole(index, stops);
        if (role === "skip") return null;

        const { radius, pathOptions } = markerStyle(role, route?.fallback);
        const label = roleLabel(role);

        return (
          <CircleMarker
            key={stop.id}
            center={[stop.lat, stop.lng]}
            radius={radius}
            pathOptions={pathOptions}
          >
            <Popup>
              {label && (
                <>
                  <strong>{label}</strong>
                  <br />
                </>
              )}
              <strong>{stop.name}</strong>
              <br />
              {stop.resolvedAddress ?? `${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}`}
              {stop.date && (
                <>
                  <br />
                  <em>{stop.date}</em>
                </>
              )}
              {stop.notes && (
                <>
                  <br />
                  {stop.notes}
                </>
              )}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
    {gradient && (
      <RouteDistanceLegend totalDistanceKm={gradient.totalDistanceKm} />
    )}
    </>
  );
}
