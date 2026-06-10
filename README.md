# EuroTour

Interactive map of road and train trips across Europe. Routes are defined in JSON files — no editing UI, just the map.

**Live:** https://denyspiven.github.io/EuroTour/

## Routes

| Trip | Mode |
|------|------|
| Dragobrat, February 2026 | train |
| Switzerland, May 2026 | driving |

The route line uses a **distance gradient** (blue → red) to show how far you've traveled. Stops with dates show charging info in popups.

## Stack

React · TypeScript · Vite · Leaflet · OSRM (driving) · OpenRailRouting / Overpass (train)

## Local development

```bash
npm install
npm run dev
```

## Adding a route

1. Add a stops file in `src/data/routes/` (e.g. `2026-06-trip.json`)
2. Register it in `src/data/routes/manifest.json`

Each stop needs `name`, `lat`, and `lng`. Optional: `date`, `notes`.
