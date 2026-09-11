// Imports Canada's public toilets from OpenStreetMap into Firestore.
//
//   npm run import:osm                      # every province and territory
//   npm run import:osm -- --regions=ON,BC   # just these
//   npm run import:osm -- --dry-run         # fetch and map, write nothing
//   npm run import:osm -- --emulator        # against the local emulator
//
// Data comes from Overpass, which queries live OSM. It is community-maintained
// and uneven — dense in city centres, thin in rural areas, and occasionally
// wrong. That is the honest state of open washroom data in Canada; there is no
// authoritative national registry to use instead.
//
// OSM data is ODbL-licensed. The attribution already under the map covers it.
//
// Provinces are fetched one at a time rather than as one national query:
// Overpass times out on country-wide extracts of a common tag, and a failure
// half-way through then costs you everything.
import { FieldValue } from 'firebase-admin/firestore';
import { resolveProjectId, connect, commitInBatches } from './lib/firestore-admin.mjs';

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const REGIONS = [
  ['ON', 'CA-ON', 'Ontario'],
  ['QC', 'CA-QC', 'Québec'],
  ['BC', 'CA-BC', 'British Columbia'],
  ['AB', 'CA-AB', 'Alberta'],
  ['MB', 'CA-MB', 'Manitoba'],
  ['SK', 'CA-SK', 'Saskatchewan'],
  ['NS', 'CA-NS', 'Nova Scotia'],
  ['NB', 'CA-NB', 'New Brunswick'],
  ['NL', 'CA-NL', 'Newfoundland and Labrador'],
  ['PE', 'CA-PE', 'Prince Edward Island'],
  ['YT', 'CA-YT', 'Yukon'],
  ['NT', 'CA-NT', 'Northwest Territories'],
  ['NU', 'CA-NU', 'Nunavut'],
];

const argv = process.argv.slice(2);
const useEmulator = argv.includes('--emulator');
const dryRun = argv.includes('--dry-run');
const only = argv.find((a) => a.startsWith('--regions='))?.split('=')[1]
  ?.split(',').map((r) => r.trim().toUpperCase());

const chosen = only ? REGIONS.filter(([code]) => only.includes(code)) : REGIONS;
if (!chosen.length) {
  console.error(`No matching regions. Known: ${REGIONS.map(([c]) => c).join(', ')}`);
  process.exit(1);
}

// map_to_area rather than a bare area{} lookup: the area index is built
// separately and does not always carry a province under the tags you expect,
// whereas the relation always exists. `out center;` is body mode, which
// already includes tags — `out center tags;` mixes the geometry and verbosity
// modifiers and some instances reject it.
const query = (iso) => `
[out:json][timeout:540];
rel["ISO3166-2"="${iso}"]["admin_level"="4"];
map_to_area->.region;
(
  node["amenity"="toilets"](area.region);
  way["amenity"="toilets"](area.region);
  relation["amenity"="toilets"](area.region);
);
out center;`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Overpass instances sit behind filters that reject requests with no
// User-Agent — often as a 406, which reads like a syntax error and is not one.
// Identifying the client is both the fix and the courtesy: it gives their
// admins someone to contact if this ever misbehaves.
const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'application/json',
  'User-Agent': 'Loo washroom finder (+https://github.com/kbquad/UntitledToiletApp)',
};

// Overpass is a free, shared, frequently-busy service. 429 and 504 are normal
// operation, not failure — back off and come back rather than hammering it.
const fetchRegion = async (iso, label) => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const endpoint = OVERPASS[attempt % OVERPASS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: HEADERS,
        body: new URLSearchParams({ data: query(iso) }),
      });
      if (!res.ok) {
        // Overpass explains itself in the body. Without this the caller is
        // left guessing whether a 4xx is the query, the headers or the load.
        const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
        throw new Error(`HTTP ${res.status} from ${new URL(endpoint).host}${detail ? ` — ${detail}` : ''}`);
      }
      const json = await res.json();
      return json.elements ?? [];
    } catch (e) {
      const wait = 15000 * (attempt + 1);
      console.log(`  ${label}: ${e.message}`);
      console.log(`  retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw new Error(`${label}: Overpass would not answer after 6 attempts`);
};

// ── OSM tags → this app's shape ─────────────────────────────────────────────

const yes = (v) => v === 'yes' || v === 'designated' || v === 'only';

// "24/7" is the one opening_hours value worth parsing: it is common, it is
// unambiguous, and it is the difference between "open now" being useful and
// being a guess. Anything else is left as unknown, which the app renders
// honestly rather than inventing hours for.
const hours = (tags) => (tags['opening_hours'] === '24/7'
  ? { openFrom: 0, openTo: 24, hoursKnown: true }
  // Unknown hours are stored as always-open so nothing is wrongly hidden, and
  // flagged so the app can say "hours unknown" instead of claiming 24/7.
  : { openFrom: 0, openTo: 24, hoursKnown: false });

// `maxheight` is the height limit on the way in, in metres unless it says
// otherwise. A tall van is around 2.8 m, so anything at or above 3 clears one
// — and a barrier tagged with no number tells us nothing, so it stays false.
const clearsAVan = (raw) => {
  if (!raw) return false;
  const m = String(raw).match(/^\s*(\d+(?:\.\d+)?)\s*(m|ft)?/i);
  if (!m) return false;
  const metres = m[2]?.toLowerCase() === 'ft' ? parseFloat(m[1]) * 0.3048 : parseFloat(m[1]);
  return metres >= 3;
};

const fee = (tags) => {
  if (tags.fee === 'no') return 'Free';
  if (tags.fee === 'yes') return tags.charge ? `Costs ${tags.charge}` : 'Costs money';
  return 'Check on site';
};

const kind = (tags) => {
  const t = `${tags.building ?? ''} ${tags.amenity ?? ''} ${tags.name ?? ''}`.toLowerCase();
  if (tags.leisure === 'park' || /park|trail|beach/.test(t)) return 'Park';
  if (/mall|centre|center|shopping/.test(t)) return 'Mall';
  if (/station|transit|terminal|platform/.test(t)) return 'Transit';
  if (/librar/.test(t)) return 'Library';
  if (/caf|coffee|restaurant/.test(t)) return 'Café';
  if (/communit|rec|arena|pool/.test(t)) return 'Community centre';
  return 'Public washroom';
};

const nameFor = (tags) => (
  tags.name
  ?? tags['name:en']
  ?? tags.operator
  ?? (tags['toilets:position'] ? 'Public toilet' : 'Public washroom')
).slice(0, 120);

const toDoc = (el, provinceName) => {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (lat < 41 || lat > 84 || lng < -142 || lng > -52) return null; // outside Canada

  const tags = el.tags ?? {};
  return {
    // OSM ids are stable and unique per element type, which makes re-running
    // the import an update rather than a duplicate.
    id: `osm-${el.type}-${el.id}`,
    name: nameFor(tags),
    type: kind(tags),
    area: provinceName,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    fee: fee(tags),
    needsKey: tags.access === 'private' || tags.access === 'customers' || !!tags['toilets:access'],
    wheelchair: yes(tags.wheelchair),
    babyChange: yes(tags.changing_table),
    genderNeutral: yes(tags.unisex) || tags['toilets:gender'] === 'unisex',
    // The road-trip facilities. Each maps onto a tag OpenStreetMap actually
    // uses; anything untagged comes through false, which the app reads as
    // "not recorded" rather than "hasn't got one". Without this the six new
    // filters would match nothing on imported data, permanently.
    familyRoom: yes(tags['toilets:family']) || yes(tags.family)
      || tags['changing_table:location'] === 'room',
    vanParking: yes(tags.hgv) || clearsAVan(tags.maxheight),
    showers: yes(tags.shower) || tags.amenity === 'shower',
    dogFriendly: yes(tags.dog) || yes(tags.dogs),
    water: yes(tags.drinking_water) || tags.amenity === 'drinking_water',
    evCharging: tags.amenity === 'charging_station'
      || Object.keys(tags).some((k) => k.startsWith('socket:')),
    ...hours(tags),
    status: 'published',
    source: 'openstreetmap',
    osmType: el.type,
    osmId: String(el.id),
  };
};

// ── run ─────────────────────────────────────────────────────────────────────

const projectId = resolveProjectId(argv);
if (!projectId && !dryRun) {
  console.error('Could not work out which Firebase project to import into. Pass --project=your-project-id');
  process.exit(1);
}

const db = dryRun ? null : await connect({ projectId, useEmulator });

let total = 0;
let skipped = 0;

for (const [code, iso, provinceName] of chosen) {
  console.log(`\n${provinceName} (${code})`);
  const elements = await fetchRegion(iso, provinceName);
  console.log(`  ${elements.length} elements from OpenStreetMap`);

  const docs = [];
  for (const el of elements) {
    const doc = toDoc(el, provinceName);
    if (doc) docs.push(doc); else skipped += 1;
  }
  console.log(`  ${docs.length} usable`);

  if (dryRun) {
    for (const d of docs.slice(0, 3)) console.log(`    e.g. ${d.name} — ${d.type}, ${d.fee}`);
    total += docs.length;
    continue;
  }

  // One write per washroom, not two: the free tier allows 20,000 document
  // writes a day and a national import is the same order of magnitude.
  //
  // merge:true updates the descriptive fields of a washroom already there and
  // leaves the scores it has earned alone. increment(0) is the trick that
  // initialises a counter on a new document without resetting an existing one.
  await commitInBatches(db, docs, (batch, d) => {
    const { id, ...fields } = d;
    batch.set(db.collection('washrooms').doc(id), {
      ...fields,
      reviewCount: FieldValue.increment(0),
      ratingSum: FieldValue.increment(0),
      cleanVotes: FieldValue.increment(0),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  total += docs.length;
  console.log(`  ${provinceName} done — ${total} imported so far`);
}

console.log(`\n${dryRun ? 'Would import' : 'Imported'} ${total} washrooms${skipped ? ` (${skipped} skipped: no usable coordinates)` : ''}.`);
console.log('No ratings or reviews were added — those only come from real people.\n');
process.exit(0);
