// Build a standard GPX 1.1 track from a saved route and trigger a download.
// No dependencies — the geometry is a simple [lat,lng] polyline.

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** GPX 1.1 XML string with one <trkpt> per coordinate. */
export function toGpx(item) {
  const name = xmlEscape(item.name || 'MaWay route');
  const pts = (item.coords || [])
    .map(([lat, lng]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MaWay" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${name}</name></metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

function safeFilename(name) {
  const base = String(name || 'route')
    .replace(/[^\p{L}\p{N}\-_ ]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  return `maway-${base || 'route'}.gpx`;
}

/** Download the route as a .gpx file. */
export function downloadGpx(item) {
  const blob = new Blob([toGpx(item)], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename(item.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
