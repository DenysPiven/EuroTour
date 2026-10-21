import { Polyline } from "react-leaflet";
import type { RouteResult } from "../types";
import type { DistanceGradientRoute } from "../utils/distanceGradient";

const ROUTE_WEIGHT = 6;
const FALLBACK_WEIGHT = 4;
const OUTLINE_EXTRA = 4;

const ROUTE_COLORS = {
  driving: "#2563eb",
  train: "#7c3aed",
} as const;

interface TimeGradientRouteProps {
  route: RouteResult;
  gradient: DistanceGradientRoute | null;
}

function RouteOutline({
  positions,
  weight,
  dashed,
}: {
  positions: [number, number][];
  weight: number;
  dashed?: boolean;
}) {
  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color: "#0f172a",
          weight: weight + OUTLINE_EXTRA + 1,
          opacity: 0.28,
          lineCap: "round",
          lineJoin: "round",
          dashArray: dashed ? "6 8" : undefined,
        }}
      />
      <Polyline
        positions={positions}
        pathOptions={{
          color: "#ffffff",
          weight: weight + OUTLINE_EXTRA,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
          dashArray: dashed ? "6 8" : undefined,
        }}
      />
    </>
  );
}

export function TimeGradientRoute({ route, gradient }: TimeGradientRouteProps) {
  const weight = route.fallback ? FALLBACK_WEIGHT : ROUTE_WEIGHT;
  const opacity = route.fallback ? 0.7 : 1;
  const solidColor = ROUTE_COLORS[route.mode ?? "driving"];

  if (!gradient) {
    return (
      <>
        <RouteOutline
          positions={route.coordinates}
          weight={weight}
          dashed={route.fallback}
        />
        <Polyline
          positions={route.coordinates}
          pathOptions={{
            color: solidColor,
            weight,
            opacity,
            dashArray: route.fallback ? "6 8" : undefined,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      </>
    );
  }

  return (
    <>
      <RouteOutline positions={route.coordinates} weight={weight} />
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
