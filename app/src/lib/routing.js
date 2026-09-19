// Real driving directions for route planning and the drive simulation.
//
// Both calls hit public services directly from the browser — OSRM's demo
// router for the route itself, Nominatim for turning place names into
// coordinates. Neither needs an API key. Whoever is running this code (a
// real browser) can reach them fine; the sandbox this was written in
// cannot (its egress policy blocks both hosts), so this file has not been
// exercised against the live network — only read against each service's
// documented request/response shape. If either call fails for any reason
// (offline, rate-limited, blocked), route() falls back to a straight line
// at a plausible highway speed rather than leaving the screen with nothing.
import { distanceMetres } from '../utils/geo';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const FALLBACK_SPEED_MPS = (90 * 1000) / 3600; // 90 km/h, for the straight-line fallback only

// Turns free text into a short list of place candidates, closest match first.
// Nominatim's usage policy asks for at most ~1 request/second — callers
// should debounce keystrokes rather than firing on every one.
export async function geocode(text, { limit = 5, signal } = {}) {
  const q = text.trim();
  if (!q) return [];
  const url = `${NOMINATIM_URL}?format=jsonv2&addressdetails=0&limit=${limit}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const rows = await res.json();
  return rows.map((r) => ({
    label: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}

// Real road geometry, distance and duration through an ordered list of
// {lat,lng} points (start, any via stops, destination). Falls back to a
// straight line between the same points — still useful for the drive
// simulation and the route strip, just not real road distance — if OSRM is
// unreachable or refuses the request.
export async function route(points, { signal } = {}) {
  const all = await routeOptions(points, { signal });
  return all[0];
}

// Every route OSRM will offer for these points, fastest first.
//
// `alternatives` only applies to a plain A-to-B request: OSRM does not offer
// alternatives once there are via points, and asking anyway is not an error,
// it just comes back with one route. Either way the first is the one the
// router considers best, and the caller picks from whatever it gets.
export async function routeOptions(points, { signal } = {}) {
  if (!points || points.length < 2) throw new Error('route() needs at least two points');
  try {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const alt = points.length === 2 ? '&alternatives=2' : '';
    const url = `${OSRM_URL}${coords}?overview=full&geometries=geojson&steps=false${alt}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const doc = await res.json();
    if (doc.code !== 'Ok' || !doc.routes?.length) throw new Error(doc.message || 'OSRM found no route');

    return doc.routes.map((r, i) => ({
      source: 'osrm',
      id: `osrm-${i}`,
      distanceM: r.distance,
      durationS: r.duration,
      path: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      legs: r.legs ?? null,
    }));
  } catch (e) {
    return [straightLineRoute(points, e)];
  }
}

function straightLineRoute(points, cause) {
  let distanceM = 0;
  for (let i = 1; i < points.length; i++) {
    distanceM += distanceMetres(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return {
    source: 'fallback',
    id: 'fallback',
    distanceM,
    durationS: distanceM / FALLBACK_SPEED_MPS,
    path: points,
    legs: null,
    error: cause?.message ?? String(cause),
  };
}

// Names a set of alternatives the way a person would describe them: the
// quickest one, and then whatever is actually different about the others.
// OSRM hands back geometry and numbers, not labels, so this is derived from
// the numbers rather than invented.
export function describeOptions(options, unitsLabel) {
  const quickest = Math.min(...options.map((o) => o.durationS));
  const shortest = Math.min(...options.map((o) => o.distanceM));
  const lone = options.length === 1;

  return options.map((o) => {
    if (o.source === 'fallback') {
      return { ...o, name: 'Estimated', detail: 'Router unreachable — straight-line distance' };
    }
    // With nothing to compare against — a route through via stops, which
    // OSRM does not offer alternatives for — a superlative is meaningless.
    if (lone) return { ...o, name: 'Driving route', detail: '' };
    const isQuickest = o.durationS === quickest;
    const isShortest = o.distanceM === shortest;
    if (isQuickest) return { ...o, name: 'Fastest', detail: isShortest ? 'Shortest too' : 'Quickest by the clock' };
    if (isShortest) return { ...o, name: 'Shortest', detail: `${Math.round((o.durationS - quickest) / 60)} min slower` };
    return {
      ...o,
      name: 'Alternative',
      detail: `${Math.round((o.durationS - quickest) / 60)} min slower · ${
        Math.round(Math.abs(o.distanceM - shortest) / 1000)} ${unitsLabel} further`,
    };
  });
}

// Cumulative distance (metres) at each vertex of a path — the along-route
// "ruler" that pointAtFraction and the route strip measure against.
export function cumulativeDistances(path) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + distanceMetres(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng));
  }
  return cum;
}

// The {lat,lng} at fraction t (0..1) of the way along path, measured by
// arc length rather than by vertex index — so the drive simulation moves at
// a constant speed even though OSRM's vertices are unevenly spaced.
export function pointAtFraction(path, cum, t) {
  const total = cum[cum.length - 1] || 0;
  const target = Math.max(0, Math.min(1, t)) * total;
  let i = 1;
  while (i < cum.length && cum[i] < target) i++;
  if (i >= cum.length) return path[path.length - 1];
  const segLen = cum[i] - cum[i - 1];
  const segT = segLen > 0 ? (target - cum[i - 1]) / segLen : 0;
  const a = path[i - 1];
  const b = path[i];
  return { lat: a.lat + (b.lat - a.lat) * segT, lng: a.lng + (b.lng - a.lng) * segT };
}

// How far a point sits from the nearest vertex of a path. OSRM samples the
// geometry every couple of hundred metres on a highway, so nearest-vertex is
// close enough to decide "is this stop along the route" without doing full
// point-to-segment projection.
export function distanceToPath(point, path) {
  let best = Infinity;
  for (const p of path) {
    const d = distanceMetres(point.lat, point.lng, p.lat, p.lng);
    if (d < best) best = d;
  }
  return best;
}

// Where along the route (0..1) a point's nearest vertex falls — used to put
// stops in visiting order on the route strip.
export function fractionOfNearestPoint(point, path, cum) {
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = distanceMetres(point.lat, point.lng, path[i].lat, path[i].lng);
    if (d < bestD) { bestD = d; bestI = i; }
  }
  const total = cum[cum.length - 1] || 1;
  return cum[bestI] / total;
}
