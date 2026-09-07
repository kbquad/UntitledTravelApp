// Real ground heights for the 3D drive.
//
// Open-Meteo's elevation endpoint is open, needs no key, and takes up to 100
// coordinates per call, so a corridor of a few hundred sample points costs a
// handful of requests. It rate-limits, so calls are made in sequence and a 429
// is retried with the backoff the response asks for.
//
// Every caller must cope with this returning nothing: the sandbox this was
// written in cannot reach the host at all, and a real phone can be offline.
// `elevationGrid` resolves to null rather than throwing, and the scene falls
// back to flat ground.

const URL_BASE = 'https://api.open-meteo.com/v1/elevation';
const BATCH = 100;

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function fetchBatch(points, { signal, tries = 3 } = {}) {
  const lats = points.map((p) => p.lat.toFixed(5)).join(',');
  const lngs = points.map((p) => p.lng.toFixed(5)).join(',');
  const url = `${URL_BASE}?latitude=${lats}&longitude=${lngs}`;

  for (let attempt = 0; attempt < tries; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(url, { signal });
    if (res.ok) {
      // eslint-disable-next-line no-await-in-loop
      const doc = await res.json();
      if (!Array.isArray(doc.elevation)) throw new Error('elevation: unexpected response');
      return doc.elevation;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After')) || (attempt + 1);
      // eslint-disable-next-line no-await-in-loop
      await sleep(retryAfter * 1000);
    } else {
      throw new Error(`elevation: HTTP ${res.status}`);
    }
  }
  throw new Error('elevation: rate-limited');
}

// Heights in metres for an arbitrary list of {lat,lng}, in the same order.
// Returns null if the service can't be reached at all.
export async function elevations(points, { signal } = {}) {
  if (!points.length) return [];
  try {
    const out = [];
    for (let i = 0; i < points.length; i += BATCH) {
      // Sequential on purpose — this endpoint rate-limits, and a corridor is
      // only a few batches.
      // eslint-disable-next-line no-await-in-loop
      const chunk = await fetchBatch(points.slice(i, i + BATCH), { signal });
      out.push(...chunk);
    }
    return out;
  } catch {
    return null;
  }
}
