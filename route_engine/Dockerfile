# route_engine — container image for the FastAPI route engine.
#
# Build context is the REPO ROOT (the folder containing route_engine/), because
# the app is imported as `route_engine.api:app` and needs the package directory
# on the path. On Render this is wired via render.yaml (dockerContext: ".",
# dockerfilePath: "route_engine/Dockerfile").
#
# Local sanity build/run from the repo root:
#   docker build -f route_engine/Dockerfile -t runroute-engine .
#   docker run -p 8000:8000 runroute-engine
#   curl http://localhost:8000/health
#
# No system GDAL/GEOS is installed: shapely, pyproj, pyogrio and geopandas all
# ship self-contained binary wheels, so a slim base is enough.

FROM python:3.13.3-slim

# Faster, quieter, predictable Python in containers.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install deps first so this layer is cached unless requirements.txt changes.
COPY route_engine/requirements.txt route_engine/requirements.txt
RUN pip install --no-cache-dir -r route_engine/requirements.txt

# Then the source + precomputed regions (regions/*.pkl ship in the image so the
# covered cities are instant on first request). _cache/ is excluded via
# .dockerignore — on-demand tiles rebuild at runtime onto the ephemeral disk.
COPY route_engine/ route_engine/

# Run as non-root for a smaller blast radius.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

# Render injects $PORT; default to 8000 for local runs. Shell form so $PORT expands.
EXPOSE 8000
CMD uvicorn route_engine.api:app --host 0.0.0.0 --port ${PORT:-8000}
