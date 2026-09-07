// Real ground heights from "terrarium" DEM tiles.
//
// The elevation endpoint in lib/elevation.js is fine for a few hundred points,
// but the 3D drive needs ground detail at roughly the scale the camera can
// see — a few tens of metres, not a few kilometres — and asking a JSON API for
// that many points is hopeless. Tiles solve it: one z11 tile covers about
// 19 km at ~40 m per pixel, so an entire corridor is a few dozen requests and
// then every sample is a local lookup.
//
// Encoding (Mapzen/AWS terrarium): height = R*256 + G + B/256 - 32768.
// The bucket is public, needs no key, and sends CORS headers.

const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const TILE_PX = 256;

const lngToTileX = (lng, z) => ((lng + 180) / 360) * 2 ** z;
const latToTileY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

async function loadTile(x, y, z, signal) {
  const url = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  const res = await fetch(url, { signal, mode: 'cors' });
  if (!res.ok) throw new Error(`dem: HTTP ${res.status}`);
  const blob = await res.blob();
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, TILE_PX, TILE_PX);
  bmp.close?.();
  const { data } = ctx.getImageData(0, 0, TILE_PX, TILE_PX);

  // Decode once, so sampling is a plain array read afterwards.
  const heights = new Float32Array(TILE_PX * TILE_PX);
  for (let i = 0; i < heights.length; i += 1) {
    const o = i * 4;
    heights[i] = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768;
  }
  return heights;
}

/**
 * Fetches every tile covering `points` and returns a sampler.
 * Resolves to null if the tiles can't be had at all, so callers can fall back.
 */
export async function demSampler(points, { zoom = 11, signal, maxTiles = 80 } = {}) {
  try {
    const needed = new Map();
    for (const p of points) {
      const tx = Math.floor(lngToTileX(p.lng, zoom));
      const ty = Math.floor(latToTileY(p.lat, zoom));
      needed.set(`${tx}/${ty}`, { tx, ty });
    }
    if (needed.size === 0) return null;
    if (needed.size > maxTiles) {
      // A corridor this big would be a lot of requests; drop a zoom level,
      // which quarters the count.
      return demSampler(points, { zoom: zoom - 1, signal, maxTiles });
    }

    const tiles = new Map();
    const entries = [...needed.values()];
    const CONCURRENCY = 6;
    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      // eslint-disable-next-line no-await-in-loop
      const batch = await Promise.all(entries.slice(i, i + CONCURRENCY).map(async ({ tx, ty }) => {
        try {
          return { key: `${tx}/${ty}`, heights: await loadTile(tx, ty, zoom, signal) };
        } catch {
          return null;   // a missing tile reads as sea level rather than failing the lot
        }
      }));
      for (const r of batch) if (r) tiles.set(r.key, r.heights);
    }

    if (tiles.size === 0) return null;

    return (lat, lng) => {
      const fx = lngToTileX(lng, zoom);
      const fy = latToTileY(lat, zoom);
      const tx = Math.floor(fx);
      const ty = Math.floor(fy);
      const heights = tiles.get(`${tx}/${ty}`);
      if (!heights) return 0;
      const px = Math.min(TILE_PX - 1, Math.max(0, Math.floor((fx - tx) * TILE_PX)));
      const py = Math.min(TILE_PX - 1, Math.max(0, Math.floor((fy - ty) * TILE_PX)));
      return heights[py * TILE_PX + px];
    };
  } catch {
    return null;
  }
}
