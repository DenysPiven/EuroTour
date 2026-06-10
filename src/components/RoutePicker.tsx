import type { RouteMeta } from "../types";

interface RoutePickerProps {
  routes: RouteMeta[];
  selectedId: string;
  onSelect: (routeId: string) => void;
}

export function RoutePicker({ routes, selectedId, onSelect }: RoutePickerProps) {
  if (routes.length === 0) {
    return null;
  }

  return (
    <nav className="route-picker" aria-label="Routes">
      <ul>
        {routes.map((route) => (
          <li key={route.id}>
            <button
              type="button"
              className={route.id === selectedId ? "active" : undefined}
              onClick={() => onSelect(route.id)}
            >
              {route.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
