// Building footprints, so a city in the 3D map reads as a city.
//
// Terrain alone makes prairie cities look like empty fields — Calgary is flat,
// so relief tells you nothing about where the city is. Real footprints from
// OpenStreetMap, extruded to their tagged height, are what put a downtown on
// the map.
//
// Overpass is a shared, rate-limited public service, so this asks for one
// tight box, caps what it takes, and treats any failure as "no buildings"
// rather than an error worth showing anyone.

const OVERPASS = 'https://overpass-api.de/api/interpreter';

// Buildings are only worth drawing close in. Past a couple of kilometres they
// are a few pixels each and cost far more than they show, so the footprint box
// is capped independently of how far the map is zoomed out.
export const BUILDING_SPAN_M = 2600;

const DEFAULT_HEIGHT = 8;      // roughly a two-storey building
const METRES_PER_LEVEL = 3.2;

// "12", "12 m", "12.5" — anything else is not a number we should trust.
const parseHeight = (tags = {}) => {
  const raw = tags.height ?? tags['building:height'];
  if (raw) {
    const m = String(raw).match(/^\s*(\d+(?:\.\d+)?)/);
    if (m) return Math.min(400, Math.max(3, parseFloat(m[1])));
  }
  const levels = parseFloat(tags['building:levels']);
  if (Number.isFinite(levels) && levels > 0) {
    return Math.min(400, Math.max(3, levels * METRES_PER_LEVEL));
  }
  return DEFAULT_HEIGHT;
};

/**
 * Footprints inside `box`, as { ring: [{lat,lng}...], height } — the ring is
 * open (no repeated last point) and in source order.
 *
 * Resolves to null when Overpass is unreachable, slow, or says no, so the
 * caller draws terrain without buildings instead of failing.
 */
export async function fetchBuildings({ box, signal, limit = 1400 }) {
  const bbox = `${box.minLat},${box.minLng},${box.maxLat},${box.maxLng}`;
  const query = `[out:json][timeout:20];way["building"](${bbox});out geom ${limit};`;

  let res;
  try {
    res = await fetch(OVERPASS, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal,
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let json;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  const out = [];
  for (const el of json.elements ?? []) {
    const geom = el.geometry;
    // Needs at least a triangle. Overpass repeats the first node to close the
    // way; the extruder wants it open.
    if (!Array.isArray(geom) || geom.length < 4) continue;
    const ring = geom.slice(0, -1).map((p) => ({ lat: p.lat, lng: p.lon }));
    if (ring.length < 3) continue;
    out.push({ ring, height: parseHeight(el.tags) });
  }
  return out.length ? out : null;
}
