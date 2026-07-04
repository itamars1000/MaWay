// Generates the social-share preview (Open Graph / Twitter Card) image from
// the logo, so links shared to WhatsApp/Twitter/etc. show a branded card
// instead of a bare URL. Re-run after changing the logo or brand colors:
//   npm run gen:og
//
// Renders "MaWay" / "Find your way" in Latin only (no Hebrew) — SVG-to-raster
// RTL text shaping is unreliable across renderers (verified: garbled/clipped
// output on this toolchain), and a static share-card image doesn't need to
// track the viewer's in-app language anyway.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOGO = join(root, 'public', 'maway-logo.png');
const OUT = join(root, 'public', 'og-image.png');

const W = 1200;
const H = 630;

// Same radial gradient + blob accents as the login screen (index.css
// .login-screen / .login-blob), so the share card matches the app's first
// impression.
const background = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="0%" r="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#e9f6ef"/>
      <stop offset="100%" stop-color="#dff0e8"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${W - 90}" cy="70" r="150" fill="#98d8b8" opacity="0.35"/>
  <circle cx="60" cy="${H - 60}" r="130" fill="#cfe9dd" opacity="0.55"/>
</svg>`;

const logo = await sharp(LOGO).resize({ width: 260, fit: 'inside' }).toBuffer();

// Bold system sans only — no custom webfont, so it renders identically
// regardless of which fonts happen to be installed wherever this runs.
const text = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <text x="600" y="380" font-size="72" font-weight="700"
        font-family="Verdana, Arial, sans-serif" fill="#2f3a45"
        text-anchor="middle">MaWay</text>
  <text x="600" y="430" font-size="30" font-weight="400"
        font-family="Verdana, Arial, sans-serif" fill="#6b7885"
        text-anchor="middle">Find your way</text>
</svg>`;

await sharp(Buffer.from(background))
  .composite([
    { input: logo, left: Math.round((W - 260) / 2), top: 140 },
    { input: Buffer.from(text), left: 0, top: 0 },
  ])
  .png()
  .toFile(OUT);

console.log('wrote', OUT);
