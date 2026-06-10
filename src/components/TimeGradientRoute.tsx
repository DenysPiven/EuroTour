import { Polyline } from "react-leaflet";
import type { RouteResult } from "../types";
import type { DistanceGradientRoute } from "../utils/distanceGradient";

const ROUTE_WEIGHT = 5;
const FALLBACK_WEIGHT = 3;

const ROUTE_COLORS = {
  driving: "#2563eb",
  train: "#7c3aed",
} as const;

interface TimeGradientRouteProps {
  route: RouteResult;
  gradient: DistanceGradientRoute | null;
}

export function TimeGradientRoute({ route, gradient }: TimeGradientRouteProps) {
  const weight = route.fallback ? FALLBACK_WEIGHT : ROUTE_WEIGHT;
  const opacity = route.fallback ? 0.55 : 0.9;
  const solidColor = ROUTE_COLORS[route.mode ?? "driving"];

  if (!gradient) {
    return (
      <Polyline
        positions={route.coordinates}
        pathOptions={{
          color: solidColor,
          weight,
          opacity,
          dashArray: route.fallback ? "6 8" : undefined,
        }}
      />
    );
  }

  return (
    <>
      {gradient.segments.map((segment, index) => (
        <Polyline
          key={`${segment.color}-${index}`}
          positions={segment.positions}
          pathOptions={{
            color: segment.color,
            weight,
            opacity,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      ))}
    </>
  );
}
