import { useEffect, useState } from "react";
import { getDefaultRouteId, getRouteById, getRoutes } from "./data/routes";
import type { RouteMode, RouteResult, Stop } from "./types";
import { RoutePicker } from "./components/RoutePicker";
import { TripMap } from "./components/TripMap";
import { buildFallbackRoute } from "./utils/routing";
import { getStopsSync, loadRoute } from "./utils/loadRoute";

const STORAGE_KEY = "eurotour-selected-route";
const routes = getRoutes();

function getInitialRouteId(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && routes.some((route) => route.id === saved)) {
    return saved;
  }
  return getDefaultRouteId();
}

function getInitialRoute(stops: Stop[], mode: RouteMode): RouteResult | null {
  return stops.length >= 2 ? buildFallbackRoute(stops, mode) : null;
}

export function App() {
  const [selectedRouteId, setSelectedRouteId] = useState(getInitialRouteId);
  const initialMode = getRouteById(getInitialRouteId())?.mode ?? "driving";
  const [stops, setStops] = useState(() => getStopsSync(getInitialRouteId()));
  const [route, setRoute] = useState<RouteResult | null>(() =>
    getInitialRoute(getStopsSync(getInitialRouteId()), initialMode),
  );
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, selectedRouteId);
  }, [selectedRouteId]);

  useEffect(() => {
    const mode = getRouteById(selectedRouteId)?.mode ?? "driving";
    const syncStops = getStopsSync(selectedRouteId);
    setStops(syncStops);
    setRoute(getInitialRoute(syncStops, mode));
    setWarning(null);

    let cancelled = false;

    void loadRoute(selectedRouteId)
      .then(({ stops, route, warnings }) => {
        if (cancelled) return;
        setStops(stops);
        setRoute(route ?? getInitialRoute(stops, mode));
        setWarning(warnings.length > 0 ? warnings.join("; ") : null);
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackStops = getStopsSync(selectedRouteId);
        setStops(fallbackStops);
        setRoute(getInitialRoute(fallbackStops, mode));
        setWarning(
          mode === "train"
            ? "Could not load train route — showing direct path"
            : "Could not load road route — showing direct path",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRouteId]);

  return (
    <div className="app">
      <RoutePicker
        routes={routes}
        selectedId={selectedRouteId}
        onSelect={setSelectedRouteId}
      />
      <TripMap stops={stops} route={route} />
      {warning && <div className="overlay warn">{warning}</div>}
    </div>
  );
}
