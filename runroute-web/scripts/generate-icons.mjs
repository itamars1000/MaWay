// Generates PWA / Apple icons from the wide MaWay wordmark by centering it on a
// white square canvas. Re-run after changing the logo:  npm run gen:icons
//
// Outputs into public/icons/:
//   pwa-192.png, pwa-512.png            — standard ("any") icons
//   maskable-512.png                    — extra padding for Android maskable mask
//   apple-touch-icon.png (180)          — iOS home screen (opaque, no alpha)
//   favicon-32.png, favicon-16.png      — browser tab
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'public', 'maway-logo.png');
const OUT = join(root, 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// Render the logo onto a `size` square, scaled to `coverage` of the width.
async function icon(size, coverage, outName, { flatten = false } = {}) {
  const logo = await sharp(SRC)
    .resize({ width: Math.round(size * coverage), fit: 'inside' })
    .toBuffer();
  let img = sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  }).composite([{ input: logo, gravity: 'center' }]);
  // Apple icons must be fully opaque (iOS fills alpha with black otherwise).
  if (flatten) img = img.flatten({ background: WHITE });
  await img.png().toFile(join(OUT, outName));
  console.log('wrote', outName);
}

await icon(192, 0.82, 'pwa-192.png');
await icon(512, 0.82, 'pwa-512.png');
// Maskable: keep the mark inside the ~80% safe zone, so use less coverage.
await icon(512, 0.6, 'maskable-512.png');
await icon(180, 0.82, 'apple-touch-icon.png', { flatten: true });
await icon(32, 0.92, 'favicon-32.png');
await icon(16, 0.95, 'favicon-16.png');
console.log('done');
