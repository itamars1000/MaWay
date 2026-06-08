# route_engine — low-turn running-loop generator

A standalone Python engine that builds running loops which **prefer straight,
continuous streets** (few sharp turns), from first principles:

1. **Network** (`network.py`) — download the walkable graph around the start
   with `osmnx.graph_from_point` (radius sized from the target distance).
2. **Dual graph + turn penalty** (`dual_graph.py`) — convert the primal graph
   (nodes=intersections, edges=streets) into a **dual/line graph**
   (nodes=directed street segments, edges=turns). Each turn edge is weighted

   ```
   weight(u→v) = length(v) + alpha · (1 − cos θ)^k        # alpha=500, k=3
   ```

   where `θ` is the heading change. Since each segment's direction is a unit
   vector `d = (sin β, cos β)`, `cos θ = d_in · d_out` (a dot product). So the
   penalty is 0 when straight, `alpha` at 90°, and `8·alpha` at a U-turn.
3. **Vector field + two-phase A\*** (`heuristic.py`, `search.py`) — an ideal
   circle of circumference = target distance defines a tangent "pull". A\*
   searches **outbound** to the far side (~half distance), then **back to the
   start** while penalising reused segments, so the result is a real closed
   loop rather than an out-and-back.
4. **Output** (`geometry.py`) — resolve the path to coordinates and emit a
   GeoJSON `LineString` Feature with `distance_m` / `sharp_turns` properties.

## Install & run

```bash
cd route_engine
python -m venv .venv
# Windows:  .venv\Scripts\activate      |  macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt          # large (pulls geopandas/scipy); needs internet

# from the project root (folder that CONTAINS route_engine/):
python -m route_engine --lat 32.0810 --lng 34.7800 --distance 5000 --out route.geojson --plot route.html
```

`--plot` writes a folium map you can open in a browser to eyeball the loop.

## Tests

```bash
pytest route_engine/tests        # turn-penalty math; no network/osmnx needed
```

## Caveats (be aware)

- **Approximate distance.** The A\* heuristic is *guidance*, not an admissible
  optimum, so the loop length lands near the target (aim ±~20%), not exactly.
- **Live download.** `osmnx` fetches OSM data on first run (seconds); caching is
  enabled (`ox.settings.use_cache=True`) so repeats are fast.
- **Server-side only.** This needs Python/geopandas and cannot run in a browser.
  To use it from the React app, wrap `generate_loop()` in an HTTP endpoint
  (e.g. FastAPI) and call that instead of OpenRouteService.
