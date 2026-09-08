// Imagery for the 3D map.
//
// The drive corridor has to RESAMPLE imagery, because its ground follows a
// bending road and no rectangle of pixels lines up with it. A map does not:
// the area is an axis-aligned box in Web Mercator, so the tiles can simply be
// drawn into one canvas at their natural positions and the terrain's UVs
// interpolated linearly across it. That is both sharper and far cheaper than
// resampling — no per-texel work at all.

const TILE_PX = 256;

// Lives here rather than beside the scene so a screen can print the credit
// without pulling three.js into its bundle.
export const MAP3D_CREDIT = 'Imagery © Esri, Maxar, Earthstar Geographics';

export const lngToGlobalX = (lng, z) => ((lng + 180) / 360) * 2 ** z * TILE_PX;
export const latToGlobalY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z * TILE_PX;
};
export const globalXToLng = (x, z) => (x / (2 ** z * TILE_PX)) * 360 - 180;
export const globalYToLat = (y, z) => {
  const n = Math.PI - 2 * Math.PI * (y / (2 ** z * TILE_PX));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

/**
 * Draws every tile covering `box` into one canvas.
 *
 * Returns the canvas plus the global-mercator pixel bounds it spans, so a
 * caller can turn any lat/lng into a UV with two subtractions. Resolves to
 * null if nothing could be fetched, so the caller can fall back rather than
 * drape a blank texture.
 */
export async function tileMosaic({
  box, zoom, urlFor, signal, maxTiles = 64,
}) {
  const x0 = Math.floor(lngToGlobalX(box.minLng, zoom) / TILE_PX);
  const x1 = Math.floor(lngToGlobalX(box.maxLng, zoom) / TILE_PX);
  const y0 = Math.floor(latToGlobalY(box.maxLat, zoom) / TILE_PX);
  const y1 = Math.floor(latToGlobalY(box.minLat, zoom) / TILE_PX);

  const wide = x1 - x0 + 1;
  const tall = y1 - y0 + 1;
  if (wide * tall > maxTiles && zoom > 3) {
    return tileMosaic({
      box, zoom: zoom - 1, urlFor, signal, maxTiles,
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = wide * TILE_PX;
  canvas.height = tall * TILE_PX;
  const ctx = canvas.getContext('2d');

  let drawn = 0;
  const jobs = [];
  for (let tx = x0; tx <= x1; tx += 1) {
    for (let ty = y0; ty <= y1; ty += 1) {
      jobs.push({ tx, ty });
    }
  }

  const CONCURRENCY = 6;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(jobs.slice(i, i + CONCURRENCY).map(async ({ tx, ty }) => {
      try {
        const res = await fetch(urlFor(tx, ty, zoom), { signal, mode: 'cors' });
        if (!res.ok) return;
        const bmp = await createImageBitmap(await res.blob());
        ctx.drawImage(bmp, (tx - x0) * TILE_PX, (ty - y0) * TILE_PX, TILE_PX, TILE_PX);
        bmp.close?.();
        drawn += 1;
      } catch {
        // A missing tile leaves a gap rather than failing the whole mosaic.
      }
    }));
  }

  if (!drawn) return null;

  return {
    canvas,
    zoom,
    minX: x0 * TILE_PX,
    minY: y0 * TILE_PX,
    maxX: (x1 + 1) * TILE_PX,
    maxY: (y1 + 1) * TILE_PX,
  };
}

// A square-ish box of the given span, centred on a point.
export const boxAround = (lat, lng, spanM) => {
  const dLat = spanM / 2 / 110540;
  const dLng = spanM / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng,
  };
};
