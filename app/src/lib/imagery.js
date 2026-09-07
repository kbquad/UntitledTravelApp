// Satellite imagery for the 3D drive's ground.
//
// Esri's World Imagery tiles are open and need no key. They are resampled
// into a single CORRIDOR texture — u runs along the route, v runs across it —
// so the image lines up 1:1 with the terrain's UVs no matter how the road
// bends. Draping a bounding-box mosaic instead would spend almost all of its
// pixels on ground the corridor never covers.
//
// Known limit, and it is inherent to one texture over a whole route: detail
// scales inversely with length. A 200 km leg lands around 25 m/px; a
// transcontinental route is far softer. Per-segment textures swapped by
// proximity would fix it, and would be a bigger change than this.

const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TILE_PX = 256;

export const IMAGERY_CREDIT = 'Imagery © Esri, Maxar, Earthstar Geographics';

const lngToTileX = (lng, z) => ((lng + 180) / 360) * 2 ** z;
const latToTileY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

async function loadTile(x, y, z, signal) {
  const url = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  const res = await fetch(url, { signal, mode: 'cors' });
  if (!res.ok) throw new Error(`imagery: HTTP ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, TILE_PX, TILE_PX);
  bmp.close?.();
  return ctx.getImageData(0, 0, TILE_PX, TILE_PX).data;
}

/**
 * Fetches the imagery covering `points` and returns a sampler, or null if the
 * tiles can't be had — the caller then falls back to colouring the ground by
 * elevation instead.
 */
export async function imagerySampler(points, { zoom = 12, signal, maxTiles = 90 } = {}) {
  try {
    const needed = new Map();
    for (const p of points) {
      const tx = Math.floor(lngToTileX(p.lng, zoom));
      const ty = Math.floor(latToTileY(p.lat, zoom));
      needed.set(`${tx}/${ty}`, { tx, ty });
    }
    if (!needed.size) return null;
    if (needed.size > maxTiles && zoom > 6) {
      return imagerySampler(points, { zoom: zoom - 1, signal, maxTiles });
    }

    const tiles = new Map();
    const entries = [...needed.values()];
    const CONCURRENCY = 6;
    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      // eslint-disable-next-line no-await-in-loop
      const batch = await Promise.all(entries.slice(i, i + CONCURRENCY).map(async ({ tx, ty }) => {
        try {
          return { key: `${tx}/${ty}`, px: await loadTile(tx, ty, zoom, signal) };
        } catch {
          return null;      // a missing tile leaves a gap, not a failed drape
        }
      }));
      for (const r of batch) if (r) tiles.set(r.key, r.px);
    }
    if (!tiles.size) return null;

    const sample = (lat, lng, out) => {
      const fx = lngToTileX(lng, zoom);
      const fy = latToTileY(lat, zoom);
      const px = tiles.get(`${Math.floor(fx)}/${Math.floor(fy)}`);
      if (!px) { out[0] = 120; out[1] = 128; out[2] = 112; return; }
      const ix = Math.min(TILE_PX - 1, Math.max(0, ((fx % 1) * TILE_PX) | 0));
      const iy = Math.min(TILE_PX - 1, Math.max(0, ((fy % 1) * TILE_PX) | 0));
      const o = (iy * TILE_PX + ix) * 4;
      out[0] = px[o];
      out[1] = px[o + 1];
      out[2] = px[o + 2];
    };
    sample.zoom = zoom;
    return sample;
  } catch {
    return null;
  }
}

/**
 * Resamples the imagery into a corridor image: x across the texture is
 * distance along the route, y is the offset across it — the same
 * parameterisation the terrain mesh is built on, so UVs are simply
 * (i/along, j/across).
 */
export function corridorTexture(corridor, sample, { width = 2048, height = 192 } = {}) {
  const {
    spine, frames: fr, offsets, across,
  } = corridor;
  const along = spine.length;

  // This loop runs width*height times on the main thread. Calling the
  // projection's toLatLng here would allocate an object per texel — hundreds
  // of thousands of them — and the resulting GC pause freezes the animation
  // for seconds. The same arithmetic is inlined instead.
  const KM_PER_DEG_M = 111320;
  const { lat0, lon0 } = corridor.proj;
  const invLat = 1 / KM_PER_DEG_M;
  const invLng = 1 / (KM_PER_DEG_M * Math.cos((lat0 * Math.PI) / 180));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const data = img.data;
  const rgb = new Uint8Array(3);

  for (let px = 0; px < width; px += 1) {
    // Position along the route, interpolated between spine rows.
    const fi = (px / (width - 1)) * (along - 1);
    const i0 = Math.floor(fi);
    const i1 = Math.min(along - 1, i0 + 1);
    const fa = fi - i0;
    const cx = spine[i0].x + (spine[i1].x - spine[i0].x) * fa;
    const cz = spine[i0].z + (spine[i1].z - spine[i0].z) * fa;
    let nx = fr[i0].nx + (fr[i1].nx - fr[i0].nx) * fa;
    let nz = fr[i0].nz + (fr[i1].nz - fr[i0].nz) * fa;
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;

    for (let py = 0; py < height; py += 1) {
      // Offset across, interpolated through the same packed column spacing
      // the mesh uses, so the image does not slide relative to the geometry.
      const fj = (py / (height - 1)) * (across - 1);
      const j0 = Math.floor(fj);
      const j1 = Math.min(across - 1, j0 + 1);
      const off = offsets[j0] + (offsets[j1] - offsets[j0]) * (fj - j0);

      const lat = lat0 - (cz + nz * off) * invLat;
      const lng = lon0 + (cx + nx * off) * invLng;
      sample(lat, lng, rgb);

      const o = (py * width + px) * 4;
      data[o] = rgb[0];
      data[o + 1] = rgb[1];
      data[o + 2] = rgb[2];
      data[o + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}
