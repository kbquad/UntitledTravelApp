// One place for the basemap, because three screens draw one.
//
// This used to be a single hard-coded provider: CARTO's basemaps.cartocdn.com,
// keyless for years and no longer so. The tiles now come back as an "API key
// required" placeholder, which to everyone using the app just looks like the
// map is broken.
//
// Replacing one hard-coded provider with another only moves that risk, so the
// basemap is a LIST. If the first provider fails outright, the next is tried;
// only when all of them fail does the screen admit the map is down. Each entry
// carries its own attribution, because the credit has to match whichever tiles
// are actually on screen.

export const PROVIDERS = [
  {
    id: 'esri-canvas',
    // Esri's Canvas basemaps are open and need no key, and their muted styling
    // is the right backdrop for coloured stop pins.
    url: (dark) => (dark
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'),
    // The Canvas services publish to z16; Leaflet upscales past that only if
    // it is told where the real tiles stop.
    maxNativeZoom: 16,
    attribution: 'Tiles © Esri · Data © OpenStreetMap contributors',
  },
  {
    id: 'osm',
    // The standard OSM tiles: no key, no styling variants. Kept as the
    // backstop precisely because it is the least likely to start asking for
    // credentials.
    url: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 19,
    attribution: '© OpenStreetMap contributors',
  },
];

export const BASEMAP_MAX_ZOOM = 20;

// How many failed tiles before we stop assuming it is one bad tile and move
// on. A screenful is roughly a dozen.
export const TILE_ERROR_LIMIT = 8;
