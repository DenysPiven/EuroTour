import { getRouteById } from "../data/routes";
import type { RouteMode, RouteResult, Stop, StopInput } from "../types";
import { resolveStops } from "./geocoding";
import { buildFallbackRoute, buildRoute } from "./routing";

function createStop(input: StopInput, index: number): Stop {
  return {
    id: `${index}-${input.lat}-${input.lng}`,
    name: input.name ?? `Stop ${index + 1}`,
    lat: input.lat!,
    lng: input.lng!,
    address: input.address,
    date: input.date,
    notes: input.notes,
    resolvedAddress: input.resolvedAddress,
  };
}

function getRouteMode(routeId: string): RouteMode {
  return getRouteById(routeId)?.mode ?? "driving";
}

function getRouteInputs(routeId: string): StopInput[] {
  return getRouteById(routeId)?.stops ?? [];
}

export function getStopsSync(routeId: string): Stop[] {
  return getRouteInputs(routeId)
    .filter((input) => input.lat != null && input.lng != null)
    .map((input, index) => createStop(input, index));
}

export async function loadRoute(routeId: string): Promise<{
  stops: Stop[];
  route: RouteResult | null;
  warnings: string[];
}> {
  const mode = getRouteMode(routeId);
  const inputs = getRouteInputs(routeId);
  const warnings: string[] = [];

  if (inputs.length === 0) {
    return { stops: [], route: null, warnings };
  }

  let stops = getStopsSync(routeId);

  const needsGeocoding = inputs.some(
    (input) => (input.lat == null || input.lng == null) && input.address?.trim(),
  );

  if (needsGeocoding) {
    try {
      const resolved = await resolveStops(inputs);
      warnings.push(
        ...resolved.filter((r) => !r.ok).map((r) => (r.ok ? "" : r.error)),
      );
      stops = resolved
        .filter((r): r is Extract<typeof r, { ok: true }> => r.ok)
        .map((r, i) => createStop(r.stop, i));
    } catch {
      warnings.push("Geocoding unavailable — showing stops with coordinates only");
    }
  }

  if (stops.length < 2) {
    return { stops, route: null, warnings };
  }

  try {
    const route = await buildRoute(stops, mode);
    if (route.fallback && mode === "train") {
      warnings.push("Some train segments unavailable — showing direct path");
    }
    return { stops, route, warnings };
  } catch {
    warnings.push(
      mode === "train"
        ? "Train route unavailable — showing direct path"
        : "Road route unavailable — showing direct path",
    );
    return { stops, route: buildFallbackRoute(stops, mode), warnings };
  }
}
