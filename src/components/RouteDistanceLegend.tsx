import { formatDistanceKm } from "../utils/distanceGradient";

interface RouteDistanceLegendProps {
  totalDistanceKm: number;
}

export function RouteDistanceLegend({
  totalDistanceKm,
}: RouteDistanceLegendProps) {
  return (
    <div className="route-distance-legend" aria-label="Route distance legend">
      <span className="route-distance-legend__label">Distance traveled</span>
      <div className="route-distance-legend__bar" />
      <div className="route-distance-legend__scale">
        <span>0 km</span>
        <span>{formatDistanceKm(totalDistanceKm)}</span>
      </div>
    </div>
  );
}
