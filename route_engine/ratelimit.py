"""
Lightweight in-memory per-IP rate limiting (no extra dependency).

A sliding-window counter keyed by client IP, exposed as a FastAPI dependency.
NOTE: the window lives in process memory, so on Cloud Run (which may run several
instances) the limit is enforced PER INSTANCE, not globally. That still blunts a
single-source flood hitting one instance; the global $ ceiling comes from the
on-demand build cap (world_store) plus Cloud Run --max-instances. A shared store
(Redis/Memorystore) would make it strictly global — a future upgrade.
"""
from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_WINDOW_S = 60.0
# A unique-IP flood would grow the dict unboundedly; sweep idle IPs periodically.
_SWEEP_EVERY_S = 300.0


class Limiter:
    """Sliding-window limiter: at most `max_per_min` hits per IP per 60 s."""

    def __init__(self, max_per_min: int):
        self.max = max_per_min
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def _sweep(self, now: float) -> None:
        # Drop IPs with no recent hits so the dict can't grow without bound.
        for ip in [ip for ip, dq in self._hits.items()
                   if not dq or now - dq[-1] > _WINDOW_S]:
            del self._hits[ip]
        self._last_sweep = now

    def check(self, ip: str, now: float | None = None) -> bool:
        """True if the hit is allowed; records it. False if over the limit."""
        if self.max <= 0:            # 0/negative disables limiting
            return True
        now = time.monotonic() if now is None else now
        with self._lock:
            if now - self._last_sweep > _SWEEP_EVERY_S:
                self._sweep(now)
            dq = self._hits[ip]
            cutoff = now - _WINDOW_S
            while dq and dq[0] <= cutoff:
                dq.popleft()
            if len(dq) >= self.max:
                return False
            dq.append(now)
            return True


def _client_ip(request: Request) -> str:
    """Best-effort client IP. Behind Cloud Run / a proxy, the real client is the
    FIRST hop of X-Forwarded-For; fall back to the socket peer."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def limit(name: str, env_var: str, default_per_min: int):
    """Build a FastAPI dependency enforcing `env_var` (default `default_per_min`)
    requests/min per IP for the named route. Raises 429 when exceeded."""
    try:
        max_per_min = int(os.getenv(env_var, str(default_per_min)))
    except ValueError:
        max_per_min = default_per_min
    limiter = Limiter(max_per_min)

    def dependency(request: Request) -> None:
        if not limiter.check(_client_ip(request)):
            raise HTTPException(
                status_code=429,
                detail="rate_limited: too many requests, slow down",
                headers={"Retry-After": "30"},
            )

    return dependency
