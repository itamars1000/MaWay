# CLAUDE.md

Guidance for working in this repository. **Maway / RunRoute** is a running-route
app — generate closed running loops that prefer straight, continuous streets
(few sharp turns) and show them on a map. The product UI is in Hebrew (RTL).

> Note: this directory is **not** a git repository.

## Three subprojects

This repo contains three independent codebases that together form the product:

| Dir | Stack | Role | Status |
|-----|-------|------|--------|
| `runroute-web/` | React 18 + Vite + Leaflet/OSM | **Active** web client (mobile-first, RTL Hebrew) | primary |
| `route_engine/` | Python + FastAPI + osmnx/networkx/rustworkx | **Active** route-generation backend (HTTP) | primary |
| `lib/` + `test/` + `pubspec.yaml` | Flutter/Dart + google_maps_flutter | Original front-end shell (UI only, no live engine) | legacy/parallel |

The live product is **`runroute-web` (UI) talking to `route_engine` (HTTP API)**.
The Flutter app in `lib/` is an earlier shell of the same UI; treat it as a
separate, parallel implementation — changes to one do not propagate to the other.

Each subproject has its own README with deeper detail:
[runroute-web/README.md](runroute-web/README.md) (Hebrew),
[route_engine/README.md](route_engine/README.md), and the root
[README.md](README.md) (Flutter shell).

## How web ↔ engine connect

- The web client calls the engine over HTTP from
  [runroute-web/src/lib/engine.js](runroute-web/src/lib/engine.js).
  Base URL is `VITE_ENGINE_URL` (default `http://localhost:8000`).
- Main endpoint: `GET /loop?lat=..&lng=..&distance=<meters>[&seed][&n][&via_lat/lng][&end_lat/lng]`
  returns a GeoJSON `FeatureCollection` of loop candidates, best-first. The UI
  shows the first and cycles with "מסלול הבא". `end_lat/lng` switches to an A→B path.
- `POST /feedback` records a 👍/👎 so the scorer's weights learn (see `learning.py`).
- The README in `runroute-web` mentions OpenRouteService — that's the **legacy**
  path. The current default is the local Python engine.

## Running things

### Web client (`runroute-web/`)
```bash
cd runroute-web
npm install
npm run dev        # Vite dev server on :5173, exposed on the LAN for phone testing
npm run build      # production build -> dist/
npm run preview
```
- HTTPS for real-phone GPS: `HTTPS=1 npm run dev` (PowerShell: `$env:HTTPS=1; npm run dev`).
- There is a Claude launch config ([.claude/launch.json](.claude/launch.json)) for `runroute-web`.
- Geolocation needs a secure context — localhost is fine; LAN needs HTTPS.

### Route engine (`route_engine/`)
Run from the **project root** (the folder that *contains* `route_engine/`):
```bash
# install (large: geopandas/scipy/osmnx); needs internet
route_engine/.venv/Scripts/python -m pip install -r route_engine/requirements.txt

# serve the API (loads precomputed regions into memory at startup)
route_engine/.venv/Scripts/python -m uvicorn route_engine.api:app --port 8000

# one-off CLI loop -> GeoJSON
python -m route_engine --lat 32.0810 --lng 34.7800 --distance 5000 --out route.geojson --plot route.html

# tests (turn-penalty math; no network/osmnx needed)
pytest route_engine/tests
```
A `.venv` already exists under `route_engine/.venv/`.

### Precomputing city regions
The engine serves covered cities instantly from in-memory `rustworkx` graphs;
points outside fall back to slower on-demand tiles.
```bash
python -m route_engine.warm                  # build all major Israeli cities
python -m route_engine.warm "Haifa, Israel"  # build one
python -m route_engine.builder --place "Tel Aviv, Israel" --out route_engine/regions/tel_aviv.pkl
```
Built regions live in `route_engine/regions/*.pkl` (registered in `regions/index.json`).

### Flutter shell (`lib/`)
The repo has Dart source only — generate the platform skeleton first:
```bash
flutter create .     # generates android/, ios/ around existing lib/
flutter pub get
flutter analyze
flutter test
flutter run          # live map tiles need a Google Maps API key (see README.md)
```

## Architecture notes

### route_engine pipeline (the core idea)
A running loop that prefers straight streets, built from first principles:
1. **Network** (`network.py`) — download walkable graph via `osmnx`.
2. **Dual graph + turn penalty** (`dual_graph.py`) — convert primal graph to a
   line graph where nodes = directed segments, edges = turns. Turn weight =
   `length(v) + alpha·(1 − cos θ)^k` (alpha=500, k=3); 0 when straight, max at U-turn.
3. **Vector field + two-phase A\*** (`heuristic.py`, `search.py`) — an ideal
   circle defines a tangent "pull"; A\* searches outbound to the far side, then
   back to start while penalising reused segments → a real closed loop.
4. **GeoJSON output** (`geometry.py`) — LineString with `distance_m` / `sharp_turns`.

Serving path: `api.py` → `graph_store.py` (region lookup) → `router.py`
(`find_loop_candidates`, the rustworkx real-time router) → `ondemand.py`
(builds a tile when no region covers the point). `elevation.py` adds best-effort
ascent/descent. `learning.py` adjusts scorer weights from `/feedback`.

Distance is **approximate** (the A\* heuristic is guidance, not admissible) —
expect the loop length to land near the target (~±20%), not exactly.

### Web layering (`runroute-web/src/`)
`App.jsx` stacks three layers inside `.app`: `MapView` (Leaflet, z1) →
`FloatingHeader` (transparent, z10) → `BottomSheet` (draggable snapping sheet, z20).
The sheet reports its height fraction up to `App`, which feeds `MapView` so the
route polyline stays visible above the sheet/header. State lives in a single
React Context: [src/state/AppState.jsx](runroute-web/src/state/AppState.jsx)
(`currentTab`, `routeType`, `selectedDistance`, `startLocation`), consumed via
`useAppState()`. Engine/geocode/gpx/routing helpers are in `src/lib/`.

### Flutter layering (`lib/`)
Mirrors the web layering: `HomeScreen` builds a `Stack` of `MapView` +
`FloatingHeader` + `DraggableScrollableSheet`. State is a single `AppState`
`ChangeNotifier` provided via `provider`. See [README.md](README.md) for the
file-by-file map.

## Conventions
- **Hebrew RTL** is the product language — user-facing strings, layout, and the
  distance slider (intentionally LTR) follow RTL conventions.
- Engine error codes are stable strings (`no-quality`, `via-too-far`,
  `end-uncovered`, `no-path`, …) mapped to friendly Hebrew messages in the UI;
  keep them in sync between `engine.js` and `api.py`.
- Flutter lints: `prefer_const_constructors` / `prefer_const_declarations` are
  enforced ([analysis_options.yaml](analysis_options.yaml)).

## Secrets / config
- `runroute-web/.env` — `VITE_ENGINE_URL` (engine base URL); legacy `VITE_ORS_API_KEY`.
  Copy from `.env.example`.
- Google Maps API key for the Flutter app goes in the generated `android/`/`ios/`
  platform files (instructions in [README.md](README.md)).
- `route.geojson` (root) and `cache/`, `route_engine/regions/_cache/` hold
  generated/cached output — not hand-edited source.
