# Deployment guide — MaWay / RunRoute

The live product is **`runroute-web` (web UI on Vercel)** talking to
**`route_engine` (HTTP API on Render)**. Deploy the engine first, then the web,
then lock CORS to the web domain.

```
Browser / PWA ──HTTPS──► runroute-web (Vercel) ──HTTPS──► route_engine (Render)
```

---

## 1. Engine → Render (free)

Config lives in [`render.yaml`](render.yaml) + [`route_engine/Dockerfile`](route_engine/Dockerfile).

1. [render.com](https://render.com) → sign in with GitHub.
2. **New → Blueprint** → pick `itamars1000/MaWay`. Render reads `render.yaml`.
3. Approve the `runroute-engine` service (plan **free**, region frankfurt).
4. Wait for the first build (a few minutes — installs the heavy geo deps).
5. Verify: `https://<service>.onrender.com/health` →
   `{"ok": true, "regions": ["Be'er Sheva, Israel","Tel Aviv, Israel"], ...}`
6. Note the service URL — you need it for step 2.

**Free-tier tradeoffs:** sleeps after ~15 min idle (first request then cold-starts
~30-60s; the web client times out at 45s so the very first hit after sleep may
need a retry). 512MB RAM fits the two covered cities (~245MB measured); far
on-demand areas can OOM — precompute them with `python -m route_engine.warm`
or upgrade the plan.

---

## 2. Web → Vercel (free)

Config: [`runroute-web/vercel.json`](runroute-web/vercel.json). Only one env var
is needed (`VITE_ENGINE_URL`); the legacy `VITE_ORS_API_KEY` is **not** used
(that code path is dead) and must not be added.

1. [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project**
   → import `itamars1000/MaWay`.
2. **Root Directory: `runroute-web`** (important — the repo is a monorepo).
   Vercel auto-detects Vite (build `npm run build`, output `dist`).
3. **Environment Variables** → add:
   `VITE_ENGINE_URL = https://<service>.onrender.com`  (the URL from step 1, no
   trailing slash). Vite inlines this at **build time**, so set it before deploying.
4. **Deploy.** Open the resulting `https://<project>.vercel.app` and generate a
   route in Tel Aviv / Be'er Sheva to confirm the engine round-trip works.

> Changing `VITE_ENGINE_URL` later requires a **redeploy** (it's baked into the build).

---

## 3. Lock CORS (after the web URL exists)

The engine defaults to `allow_origins = ["*"]`. Once the Vercel URL is known,
restrict it:

1. Render → `runroute-engine` → **Environment** → add
   `ALLOWED_ORIGINS = https://<project>.vercel.app` (comma-separate multiple).
2. Save → Render redeploys. The API now accepts browser calls only from that origin.

(See the `ALLOWED_ORIGINS` handling in [`route_engine/api.py`](route_engine/api.py).)

---

## 4. iOS — later (not set up yet)

Two paths once the web is live, both from this same codebase:

- **PWA** (no Mac, no App Store): add `vite-plugin-pwa` + a manifest + icons, then
  "Add to Home Screen" in Safari.
- **Capacitor** (real App Store app): `npm i @capacitor/core @capacitor/cli`,
  `npx cap init`, `npx cap add ios` (webDir `dist`), add
  `NSLocationWhenInUseUsageDescription` to `Info.plist`, build in Xcode.
  **Requires a Mac + Apple Developer account (~$99/yr).**

Both need the engine on HTTPS (done in step 1) — iOS blocks HTTPS→HTTP calls.
