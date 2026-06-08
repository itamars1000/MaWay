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
