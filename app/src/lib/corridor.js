// Geometry for the 3D drive: turns an OSRM route into a strip of ground with
// the road running down the middle of it.
//
// The three constraints here are the ones the Leg Work notes call out, and
// they are not guessable from the rendering code:
//
//  1. The corridor's normals must come from a SMOOTHED spine, not from the
//     road itself. Anywhere the road turns tighter than the corridor is wide,
//     adjacent columns cross and the mesh turns inside out.
//  2. The spine must be PROJECTED onto the road — spine[i] is the nearest
//     point on the smooth curve to path[i] — not paired by index. A smoothed
//     curve cuts corners, so index-pairing lets the ground drift along the
//     route and the terrain under the camera belongs somewhere else.
//  3. That projection must never stall or walk backwards. A repeated spine
//     point gives its row a zero-length tangent, whose normal collapses to
//     (0,0) and implodes the row into a fan across the scene.
//
// Everything works in local metres: +x east, +z south, +y up.

const KM_PER_DEG = 111.32;

export const makeProjection = (lat0, lon0) => {
  const cos0 = Math.cos((lat0 * Math.PI) / 180);
  return {
    lat0,
    lon0,
    toLocal: (lat, lng) => ({
      x: (lng - lon0) * KM_PER_DEG * 1000 * cos0,
      z: -(lat - lat0) * KM_PER_DEG * 1000,
    }),
    toLatLng: (x, z) => ({
      lat: lat0 - z / (KM_PER_DEG * 1000),
      lng: lon0 + x / (KM_PER_DEG * 1000 * cos0),
    }),
  };
};

const haversineM = (a, b) => {
  const R = 6371008.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
};

// Equal-arclength resample of a lat/lng polyline to n points.
export function resample(path, n) {
  if (path.length < 2) return { points: path.slice(), totalM: 0 };
  const cum = [0];
  for (let i = 1; i < path.length; i += 1) cum.push(cum[i - 1] + haversineM(path[i - 1], path[i]));
  const total = cum[cum.length - 1];
  const points = [];
  let j = 1;
  for (let i = 0; i < n; i += 1) {
    const want = (i / (n - 1)) * total;
    while (j < cum.length - 1 && cum[j] < want) j += 1;
    const span = cum[j] - cum[j - 1] || 1;
    const f = (want - cum[j - 1]) / span;
    points.push({
      lat: path[j - 1].lat + (path[j].lat - path[j - 1].lat) * f,
      lng: path[j - 1].lng + (path[j].lng - path[j - 1].lng) * f,
    });
  }
  return { points, totalM: total };
}

// Gaussian smoothing along the line's own length, endpoints pinned.
function smooth(pts, sigmaPts) {
  const n = pts.length;
  const sigma = Math.max(0.6, sigmaPts);
  const half = Math.ceil(sigma * 3);
  const k = [];
  let sum = 0;
  for (let i = -half; i <= half; i += 1) {
    const v = Math.exp(-0.5 * (i / sigma) ** 2);
    k.push(v);
    sum += v;
  }
  const out = [];
  for (let i = 0; i < n; i += 1) {
    let x = 0;
    let z = 0;
    for (let d = -half; d <= half; d += 1) {
      const idx = Math.min(n - 1, Math.max(0, i + d));
      const w = k[d + half] / sum;
      x += pts[idx].x * w;
      z += pts[idx].z * w;
    }
    out.push({ x, z });
  }
  out[0] = pts[0];
  out[n - 1] = pts[n - 1];
  return out;
}

// Constraint 2 and 3: the smooth curve, reparameterised so spine[i] sits
// beside path[i], advancing strictly monotonically.
function projectedSpine(local, sigmaPts) {
  const smoothed = smooth(local, sigmaPts);

  // Densify the smooth curve so a projection has somewhere precise to land.
  const DENSE = 6;
  const dense = [];
  for (let i = 0; i < smoothed.length - 1; i += 1) {
    for (let d = 0; d < DENSE; d += 1) {
      const f = d / DENSE;
      dense.push({
        x: smoothed[i].x + (smoothed[i + 1].x - smoothed[i].x) * f,
        z: smoothed[i].z + (smoothed[i + 1].z - smoothed[i].z) * f,
      });
    }
  }
  dense.push(smoothed[smoothed.length - 1]);

  // Nearest dense index for each road point, searched in a forward window so
  // the walk stays cheap and cannot jump backwards on a switchback.
  const idx = new Array(local.length);
  let cursor = 0;
  for (let i = 0; i < local.length; i += 1) {
    let best = cursor;
    let bestD = Infinity;
    const limit = Math.min(dense.length - 1, cursor + DENSE * 40);
    for (let j = cursor; j <= limit; j += 1) {
      const dx = local[i].x - dense[j].x;
      const dz = local[i].z - dense[j].z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = j; }
    }
    idx[i] = best;
    cursor = best;
  }

  // Never stall: a repeated index would give that row a zero-length tangent.
  for (let i = 1; i < idx.length; i += 1) {
    if (idx[i] <= idx[i - 1]) idx[i] = idx[i - 1] + 1;
  }
  for (let i = idx.length - 1; i >= 0; i -= 1) {
    if (idx[i] > dense.length - 1) idx[i] = dense.length - 1;
  }
  for (let i = idx.length - 2; i >= 0; i -= 1) {
    if (idx[i] >= idx[i + 1]) idx[i] = idx[i + 1] - 1;
  }

  return idx.map((j) => dense[Math.max(0, Math.min(dense.length - 1, j))]);
}

// Tangents and left-hand normals for a 2D line.
function frames(line) {
  const n = line.length;
  return line.map((_, i) => {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    return { tx: dx, tz: dz, nx: -dz, nz: dx };
  });
}

// Smallest radius of curvature along the line, in metres — the corridor
// cannot be wider than this without folding (constraint 1).
function minTurnRadius(line, percentile = 2) {
  const f = frames(line);
  const radii = [];
  for (let i = 1; i < line.length; i += 1) {
    const step = Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z);
    const dot = Math.max(-1, Math.min(1, f[i - 1].tx * f[i].tx + f[i - 1].tz * f[i].tz));
    const ang = Math.acos(dot);
    radii.push(ang > 1e-9 ? step / ang : 1e9);
  }
  radii.sort((a, b) => a - b);
  const k = Math.floor((percentile / 100) * radii.length);
  return radii[Math.min(radii.length - 1, k)] ?? 1e9;
}

/**
 * Builds the drive corridor.
 *
 * Returns the road line in local metres, the spine the ground is framed on,
 * the lateral offsets, and the flat list of lat/lngs whose elevation the
 * caller should fetch (row-major: along × across).
 */
export function buildCorridor(path, { along = 160, across = 17, halfKm = 6 } = {}) {
  const { points, totalM } = resample(path, along);
  const proj = makeProjection(points[0].lat, points[0].lng);
  const local = points.map((p) => proj.toLocal(p.lat, p.lng));

  // Denoise the road itself just a little, then frame the ground on a much
  // smoother spine.
  const road = smooth(local, 1.2);

  // Two pulls in opposite directions, and both matter:
  //   • the corridor must be WIDE enough to contain the real road, or the
  //     ribbon hangs off the side of its own ground;
  //   • it must be NARROW enough not to fold on the spine's tightest bend.
  // A straighter spine raises the fold limit, so widen the smoothing until
  // both fit. If nothing satisfies both, containing the road wins — a road
  // in mid-air reads as broken, a little folding at the far edge does not.
  const want = halfKm * 1000;
  let spine = null;
  let half = want;
  let fallback = null;

  for (const sigma of [6, 10, 16, 24, 34, 48]) {
    const candidate = projectedSpine(road, sigma);
    const cf = frames(candidate);
    const radius = minTurnRadius(candidate);

    let maxOff = 0;
    for (let i = 0; i < road.length; i += 1) {
      const off = (road[i].x - candidate[i].x) * cf[i].nx + (road[i].z - candidate[i].z) * cf[i].nz;
      maxOff = Math.max(maxOff, Math.abs(off));
    }

    const needed = Math.max(want, maxOff * 1.15);
    if (needed <= radius * 0.9) { spine = candidate; half = needed; fallback = null; break; }
    // Keep the widest-radius attempt in case none of them fit.
    if (!fallback || radius > fallback.radius) fallback = { candidate, radius, needed };
  }

  if (!spine) {
    spine = fallback.candidate;
    half = fallback.needed;
  }

  const f = frames(spine);

  // Columns are packed towards the road rather than spread evenly. Almost
  // everything the camera can resolve is within a few hundred metres of the
  // carriageway, and an even spread at this width puts the nearest vertex
  // hundreds of metres away — too coarse for the road to sit in the ground
  // properly, however the carve is tuned.
  const offsets = [];
  for (let j = 0; j < across; j += 1) {
    const s = (j / (across - 1)) * 2 - 1;          // -1 … 1
    offsets.push(Math.sign(s) * (s * s) * half);
  }

  // Sample points for elevation, row-major.
  const samples = [];
  for (let i = 0; i < spine.length; i += 1) {
    for (let j = 0; j < across; j += 1) {
      const x = spine[i].x + f[i].nx * offsets[j];
      const z = spine[i].z + f[i].nz * offsets[j];
      samples.push(proj.toLatLng(x, z));
    }
  }

  return {
    proj,
    road,          // the real road, in local metres
    roadLatLng: points,
    spine,
    frames: f,
    offsets,
    along: spine.length,
    across,
    halfM: half,
    totalM,
    samples,       // along × across lat/lngs, row-major
  };
}
