# Deploy the engine to Google Cloud Run

Alternative to Render (see [DEPLOY.md](DEPLOY.md)). Cloud Run runs the same
`route_engine/Dockerfile`, scales to zero (you pay only while serving), and
gives 2GiB/1CPU comfortably — a good fit for nationwide coverage.

**Project:** `maway-498818`  ·  **Region:** `europe-west4`  ·  **Service:** `runroute-engine`
(change the region everywhere if you picked a different one.)

Prerequisites (done in the Cloud Console): project created, **Billing enabled**,
and these APIs enabled — **Cloud Run Admin**, **Cloud Build**, **Artifact Registry**.

---

## Path A — Console, deploy from GitHub (recommended, no CLI)

Mirrors the Render/Vercel flow.

1. [console.cloud.google.com/run](https://console.cloud.google.com/run) → make sure
   project **maway-498818** is selected (top bar).
2. **Create Service** → choose **“Continuously deploy from a repository”** →
   **Set up with Cloud Build**.
3. **Connect** GitHub → authorize → pick repo **`itamars1000/MaWay`**, branch **`main`**.
4. Build configuration:
   - **Build Type: Dockerfile**
   - **Source location / Dockerfile path:** `Dockerfile`  ← at the repo root
     (the Console uses the Dockerfile's directory as the build context, so it
     must be at the root, where the Dockerfile expects `route_engine/...`).
5. Service settings:
   - **Region:** `europe-west4`
   - **Authentication:** **Allow unauthenticated invocations** (it's a public API)
   - **CPU allocation:** “CPU is only allocated during request processing” (cheapest)
   - Under **Containers → Edit**:
     - **Memory:** `2 GiB`   ·   **CPU:** `1`
     - **Startup CPU boost:** ON (faster cold start)
     - **Min instances:** `0`   ·   **Max instances:** `4`
     - **Variables → Add:** `ALLOWED_ORIGINS = https://ma-way.vercel.app`
   - Leave **Container port** at `8080` (the app reads `$PORT`).
6. **Create.** First build takes a few minutes.
7. Copy the service URL (`https://runroute-engine-XXXX.europe-west4.run.app`) and
   verify: `…/health` → `{"ok": true, ...}`.

Every push to `main` now rebuilds and redeploys automatically.

---

## Path B — CLI (`gcloud`)

Needs the [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed.

```bash
gcloud auth login
gcloud config set project maway-498818

# One-time: create the Artifact Registry repo the build pushes to.
gcloud artifacts repositories create runroute \
  --repository-format=docker --location=europe-west4

# Build + push + deploy (uses cloudbuild.yaml at the repo root).
gcloud builds submit --config cloudbuild.yaml

# Verify:
curl https://<service-url>/health
```

Tweak resources/region via substitutions, e.g.:
`gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=europe-west1`

---

## After it's live (either path)

1. Test from the Vercel origin (CORS already locked via `ALLOWED_ORIGINS`):
   `curl -H "Origin: https://ma-way.vercel.app" "https://<url>/loop?lat=32.081&lng=34.78&distance=3000"`
2. In **Vercel** → project → Settings → Environment Variables → set
   `VITE_ENGINE_URL = https://<cloud-run-url>` (no trailing slash) → **Redeploy**.
3. Once happy, the Render service can be paused/deleted.

## Notes / gotchas
- **Cold start:** with min-instances 0, the first request after idle pulls the
  image + loads regions (~seconds). The web client already auto-retries, so it's
  hidden. Set min-instances 1 to eliminate it (≈always-on cost).
- **On-demand tile cache:** Cloud Run's filesystem is in-memory, so `_cache/`
  tiles count against the 2GiB. Fine for precomputed cities; for heavy on-demand
  use, mount a GCS bucket instead.
- **Cost:** scale-to-zero + the free tier (~2M req/mo) means low traffic ≈ $0.
  Set a Billing **Budget alert** ($1–5) for peace of mind.

---

## Worldwide on-demand coverage (async build Job)

Routes **anywhere on earth**, built **automatically on first request**, at
**zero idle cost**. When a request lands outside every precomputed region, the
serving service triggers a separate **Cloud Run Job** that builds that area's
tile from a Geofabrik extract (no Overpass — works from cloud IPs), uploads it to
the regions bucket, and the service serves it from then on. While it builds, the
API returns **HTTP 425 `building`** and the web app shows *"מכינים את האזור…"* and
polls until ready.

The Job runs the **same image** as the service — only the command differs
(`python -m route_engine.build_job`) — so there's nothing extra to build.

Set these once (replace the caps placeholders with your real values; `REGION`
must match the service's region, e.g. `us-west1`):

```bash
PROJECT=maway-498818
REGION=us-west1                 # same region as the service + bucket
BUCKET=maway-regions            # the regions bucket (REGIONS_BUCKET)
SERVICE=runroute-engine1        # your Cloud Run service name

gcloud config set project "$PROJECT"

# The image the service currently runs (the Job reuses it verbatim).
IMAGE=$(gcloud run services describe "$SERVICE" --region "$REGION" \
  --format='value(spec.template.spec.containers[0].image)')

# Runtime SA both the service and the Job use (Compute default unless you set one).
SA=$(gcloud run services describe "$SERVICE" --region "$REGION" \
  --format='value(spec.template.spec.serviceAccountName)')
SA=${SA:-$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com}

# 1) Create the build Job: same image, builder entrypoint, bigger box + long timeout
#    (first build of a big country downloads a large extract).
gcloud run jobs create runroute-build \
  --image "$IMAGE" --region "$REGION" \
  --command python --args=-m,route_engine.build_job \
  --memory 4Gi --cpu 2 --task-timeout 1800s --max-retries 1 \
  --service-account "$SA" \
  --set-env-vars "REGIONS_BUCKET=$BUCKET"

# 2) Let the Job write tiles+markers, and let the service trigger the Job.
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member "serviceAccount:$SA" --role roles/storage.objectAdmin
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member "serviceAccount:$SA" --role roles/run.developer
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --member "serviceAccount:$SA" --role roles/iam.serviceAccountUser

# 3) Point the SERVICE at the Job (this is what flips on-demand from local-only
#    Overpass to the cloud async build). ADMIN_TOKEN is optional (enables /admin/reload).
gcloud run services update "$SERVICE" --region "$REGION" \
  --update-env-vars "BUILD_JOB=runroute-build,BUILD_JOB_REGION=$REGION,GCP_PROJECT=$PROJECT,ADMIN_TOKEN=<pick-a-secret>"
```

**Verify end-to-end** — pick an uncovered city (e.g. Berlin):

```bash
URL=https://<service-url>
# First call → 425 building (a Job execution starts):
curl -i "$URL/loop?lat=52.52&lng=13.405&distance=5000"     # HTTP/1.1 425, detail "building:…"
gcloud run jobs executions list --job runroute-build --region "$REGION"  # one Running
# After it finishes (watch the execution; tens of seconds to a few minutes):
curl -s "$URL/loop?lat=52.52&lng=13.405&distance=5000" | head -c 200      # real GeoJSON
```

Confirm the tile + marker landed in the bucket (`gs://$BUCKET/ondemand/…`), and
that the service RAM stays bounded (regions load lazily into the LRU). Idle cost
stays ≈ $0 — the Job scales to zero between builds.

### Adding a precomputed base city in one command (no console, no redeploy)

The same entrypoint, run locally with `--base`, builds a generous city and writes
it straight to the live bucket; `POST /admin/reload` makes it live without a
redeploy:

```bash
REGIONS_BUCKET=maway-regions \
  route_engine/.venv/Scripts/python -m route_engine.build_job \
  --base --lat 52.52 --lng 13.405 --name "Berlin, Germany" --slug berlin --radius 8000
curl -X POST "https://<service-url>/admin/reload?token=<ADMIN_TOKEN>"
```

### Tunables (service env)
- `BUILD_TIMEOUT_S` (default 1200) — a `building` marker older than this is
  treated as stale and the build is retriggered.
- `REGIONS_LRU_MAX` (default 10) — how many regions/tiles stay resident in RAM.
