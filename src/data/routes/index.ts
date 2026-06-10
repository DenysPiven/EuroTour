import manifest from "./manifest.json";
import type { RouteMeta, StopInput } from "../../types";

const stopFiles = import.meta.glob("./*.json", {
  eager: true,
  import: "default",
}) as Record<string, StopInput[]>;

export interface RouteDefinition extends RouteMeta {
  stops: StopInput[];
}

function getRouteStops(file: string): StopInput[] {
  return stopFiles[`./${file}`] ?? [];
}

export function getRoutes(): RouteDefinition[] {
  return (manifest as RouteMeta[]).map((entry) => ({
    ...entry,
    stops: getRouteStops(entry.file),
  }));
}

export function getRouteById(routeId: string): RouteDefinition | undefined {
  return getRoutes().find((route) => route.id === routeId);
}

function routeMonthKey(id: string): string {
  const match = id.match(/^(\d{4}-\d{2})-/);
  return match?.[1] ?? id;
}

export function getDefaultRouteId(): string {
  const routes = getRoutes();
  if (routes.length === 0) {
    return "";
  }

  return routes.reduce((newest, route) =>
    routeMonthKey(route.id) > routeMonthKey(newest.id) ? route : newest,
  ).id;
}
