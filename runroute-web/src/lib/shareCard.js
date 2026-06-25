// Render a generated route into a transparent PNG "sticker" — no background card,
// just the route shape, its stats, and MaWay branding floating on transparency,
// so it can be dropped onto a story/photo. The text carries a soft dark shadow and
// the route line a dark contour, so both stay readable on any (light or dark)
// background. Handed to the Web Share API (mobile → Instagram/WhatsApp) or
// downloaded where sharing files isn't supported.
//
// No map tiles → no cross-origin canvas tainting, works fully offline.

const W = 1080;
const H = 1410;

// Brand palette (mirrors src/index.css tokens).
const MINT = '#bde8d2'; // light mint — the route line
const MINT_DEEP = '#3e9b76';
const AMBER = '#e0a85a';

const FONT = '"Rubik", "Quicksand", system-ui, sans-serif';
const BRAND_FONT = '"Quicksand", "Rubik", system-ui, sans-serif';

/** Best-effort: make sure the web fonts are ready before we measure/draw text. */
async function ensureFonts() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('800 196px Rubik'),
      document.fonts.load('700 62px Rubik'),
      document.fonts.load('600 54px Rubik'),
      document.fonts.load('500 34px Rubik'),
      document.fonts.load('700 64px Quicksand'),
    ]);
    await document.fonts.ready;
  } catch {
    /* fall back to system font */
  }
}

/**
 * Project [lat,lng] coordinates into a w×h box (panel-local pixels), preserving
 * aspect ratio with `pad` inset. Longitude is compressed by cos(lat) so the
 * shape isn't horizontally stretched; y is flipped (north = up).
 */
function projectCoords(coords, w, h, pad) {
  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  const latMean = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((latMean * Math.PI) / 180) || 1;

  const xs = lngs.map((lng) => lng * k);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;

  const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
  const offX = (w - spanX * scale) / 2;
  const offY = (h - spanY * scale) / 2;

  return coords.map(([lat, lng]) => [
    offX + (lng * k - minX) * scale,
    offY + (maxY - lat) * scale, // flip
  ]);
}

function tracePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}

function dot(ctx, x, y, color) {
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(15,23,28,0.5)'; // dark ring → visible on light backgrounds
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 9.5, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw the share card and return it as a PNG Blob.
 *
 * @param {object}   route   generatedRoute: { coords, distanceKm, ascentM, descentM, turnsPerKm }
 * @param {object}   labels  resolved strings { appName, tagline, km, ascent, descent, turns }
 * @param {boolean}  rtl     true for Hebrew (affects text shaping only)
 */
export async function renderStoryCard({ route, labels, rtl = true }) {
  const coords = route?.coords ?? [];
  if (coords.length < 2) throw new Error('route has no geometry');

  await ensureFonts();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // No background: every element floats on transparency. Text gets a soft dark
  // shadow and the route line a dark contour so both read on any photo.
  ctx.textAlign = 'center';
  ctx.direction = rtl ? 'rtl' : 'ltr';

  // White text with a crisp dark outline (+ a faint drop shadow) — readable on
  // any background without a card behind it. Outline width scales with font size.
  const drawText = (str, x, y, font, fill, baseline = 'alphabetic') => {
    const px = parseInt((font.match(/(\d+)px/) || [])[1] || '40', 10);
    ctx.save();
    ctx.textBaseline = baseline;
    ctx.font = font;
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.38)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = Math.max(2.5, px * 0.07);
    ctx.strokeText(str, x, y);
    ctx.shadowColor = 'transparent'; // don't double-shadow the fill
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
    ctx.restore();
  };

  // ---- brand (wordmark + tagline) ----
  // The logo PNG is a light-background mark (low contrast here), so we render the
  // wordmark in the brand font instead — crisp and on-theme.
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
  drawText(labels.appName, W / 2, 104, `700 60px ${BRAND_FONT}`, '#fff', 'middle');
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  drawText(labels.tagline, W / 2, 160, `500 30px ${FONT}`, 'rgba(255,255,255,0.88)', 'middle');

  // ---- route shape ----
  const panelX = 110;
  const panelY = 220;
  const panelW = 860;
  const panelH = 700;
  const pts = projectCoords(coords, panelW, panelH, 64).map(([x, y]) => [
    x + panelX,
    y + panelY,
  ]);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // dark contour under the line → keeps the shape visible on light backgrounds
  ctx.save();
  ctx.strokeStyle = 'rgba(15,23,28,0.55)';
  ctx.lineWidth = 28;
  tracePath(ctx, pts);
  ctx.stroke();
  ctx.restore();

  // mint line with a soft coloured glow
  ctx.save();
  ctx.shadowColor = 'rgba(62,155,118,0.5)';
  ctx.shadowBlur = 22;
  ctx.strokeStyle = MINT;
  ctx.lineWidth = 15;
  tracePath(ctx, pts);
  ctx.stroke();
  ctx.restore();

  // start (and end, for A→B) markers — dark shadow so the white dot reads on light bg
  const start = pts[0];
  const end = pts[pts.length - 1];
  const isLoop = Math.hypot(end[0] - start[0], end[1] - start[1]) < 24;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  if (!isLoop) dot(ctx, end[0], end[1], AMBER);
  dot(ctx, start[0], start[1], MINT_DEEP);
  ctx.restore();

  // ---- distance hero ----
  drawText(route.distanceKm.toFixed(1), W / 2, 1095, `800 180px ${FONT}`, '#fff');
  drawText(labels.km, W / 2, 1158, `600 50px ${FONT}`, 'rgba(255,255,255,0.92)');

  // ---- stat row ----
  const cols = [
    { value: String(route.ascentM ?? '—'), label: labels.ascent },
    { value: route.turnsPerKm.toFixed(1), label: labels.turns },
    { value: String(route.descentM ?? '—'), label: labels.descent },
  ];
  const colX = [W / 2 - 270, W / 2, W / 2 + 270];
  cols.forEach((c, i) => {
    drawText(c.value, colX[i], 1290, `700 58px ${FONT}`, '#fff');
    drawText(c.label, colX[i], 1342, `500 30px ${FONT}`, 'rgba(255,255,255,0.85)');
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      'image/png',
    );
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Render the card and share it. Uses navigator.share with the file on mobile;
 * falls back to a PNG download elsewhere. Returns 'shared' | 'downloaded' |
 * 'cancelled'.
 */
export async function shareRouteStory({ route, labels, caption, rtl = true }) {
  const blob = await renderStoryCard({ route, labels, rtl });
  const filename = `maway-${route.distanceKm.toFixed(1)}km.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: labels.appName, text: caption });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // any other failure → fall through to a download
    }
  }

  downloadBlob(blob, filename);
  return 'downloaded';
}
