// Selectable basemap styles (all free, no API key). Used by MapView (tiles) and
// the settings screen (picker). Keep ids stable — they're persisted.

export const MAP_STYLES = [
  {
    id: 'voyager',
    label: 'צבעוני',
    labelKey: 'mapStyle.voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: 'light',
    label: 'בהיר',
    labelKey: 'mapStyle.light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: 'dark',
    label: 'כהה',
    labelKey: 'mapStyle.dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: 'satellite',
    label: 'לוויין',
    labelKey: 'mapStyle.satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
  },
];

export const DEFAULT_MAP_STYLE = 'voyager';

/** Resolve a style id to its config, falling back to the default. */
export function getStyle(id) {
  return MAP_STYLES.find((s) => s.id === id) || MAP_STYLES[0];
}
