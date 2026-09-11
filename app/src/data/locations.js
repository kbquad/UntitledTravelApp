// Reference points and the demo-mode washroom fixture.
//
// The live app's washrooms come from OpenStreetMap, imported into Firestore by
// `npm run import:osm` and fetched a region at a time — see utils/region.js.
// The list further down is only used in demo mode, when no Firebase config is
// present, so a fresh clone still has something on the map.

// The chips along the top of the map. Canada's largest metros, plus enough
// spread that the list is useful east of Ontario and north of the border belt.
export const CITIES = [
  { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
  { name: 'Montréal', lat: 45.5019, lng: -73.5674 },
  { name: 'Vancouver', lat: 49.2827, lng: -123.1207 },
  { name: 'Calgary', lat: 51.0447, lng: -114.0719 },
  { name: 'Edmonton', lat: 53.5461, lng: -113.4938 },
  { name: 'Ottawa', lat: 45.4215, lng: -75.6972 },
  { name: 'Winnipeg', lat: 49.8951, lng: -97.1384 },
  { name: 'Québec City', lat: 46.8139, lng: -71.2080 },
  { name: 'Hamilton', lat: 43.2557, lng: -79.8711 },
  { name: 'Halifax', lat: 44.6488, lng: -63.5752 },
  { name: 'Victoria', lat: 48.4284, lng: -123.3656 },
  { name: 'Saskatoon', lat: 52.1332, lng: -106.6700 },
  { name: 'Regina', lat: 50.4452, lng: -104.6189 },
  { name: "St John's", lat: 47.5615, lng: -52.7126 },
  { name: 'Whitehorse', lat: 60.7212, lng: -135.0568 },
  { name: 'Yellowknife', lat: 62.4540, lng: -114.3718 },
];

// Where the map opens when we have no idea where the user is: the whole
// country, rather than pretending to know.
export const CANADA_VIEW = { lat: 56.1304, lng: -106.3468, zoom: 4 };

// Distances need an origin even before location is granted. This one is
// labelled honestly wherever it is shown, so nobody reads "2 km away" as a
// measurement from where they actually are.
export const FALLBACK_LOCATION = { lat: 43.6532, lng: -79.3832, label: 'downtown Toronto' };

// openFrom / openTo are decimal hours (9.5 = 9:30 AM). openTo may run past 24
// for places closing after midnight (25 = 1 AM). 0–24 means always open.
//
// `category` is the road-trip-companion generalisation on top of the
// original washroom-only model: 'toilet' | 'food' | 'fuel' | 'rest'. It
// defaults to 'toilet' so every one of the calls below that predates it —
// all real OSM-derived washrooms — needs no change.
const w = (
  id, name, type, neighbourhood, lat, lng,
  fee, needsKey, wheelchair, babyChange, genderNeutral, openFrom, openTo,
  category = 'toilet',
) => ({
  id, name, type, neighbourhood, lat, lng,
  fee, needsKey, wheelchair, babyChange, genderNeutral, openFrom, openTo,
  category,
});

export const WASHROOMS = [
  // ── Downtown ──
  w('eauclaire', 'Eau Claire Market Plaza', 'Waterfront', 'Downtown', 51.0509, -114.0658, 'Free', false, true, true, true, 0, 24),
  w('princesisland', "Prince's Island Park Pavilion", 'Park', 'Downtown', 51.0528, -114.0605, 'Free', false, true, true, false, 7, 21),
  w('centrallib', 'Central Library, Level 2', 'Library', 'Downtown', 51.0466, -114.0524, 'Free', false, true, true, true, 9.5, 20),
  w('stephenave', 'Stephen Avenue Walk', 'Plaza', 'Downtown', 51.0470, -114.0672, '25¢', false, true, false, false, 7, 21),
  w('calgarytower', 'Calgary Tower Base', 'Landmark', 'Downtown', 51.0447, -114.0631, 'Free', false, true, true, true, 9, 21),
  w('bowvalleysq', 'Bow Valley Square Food Court', 'Mall', 'Downtown', 51.0479, -114.0660, 'Free', false, true, false, true, 7, 18),
  w('chinatown', 'Chinatown Cultural Centre', 'Community centre', 'Downtown', 51.0523, -114.0644, 'Free', false, true, false, true, 9, 20),
  w('devonian', 'Devonian Gardens, CORE', 'Mall', 'Downtown', 51.0463, -114.0688, 'Free', false, true, true, true, 9, 21),
  w('municipal', 'Municipal Building Atrium', 'Civic', 'Downtown', 51.0452, -114.0578, 'Free', false, true, true, true, 8, 16.75),
  w('olympicplaza', 'Olympic Plaza', 'Plaza', 'Downtown', 51.0455, -114.0611, 'Free', false, true, false, false, 6, 23),
  w('shawmillennium', 'Shaw Millennium Park', 'Park', 'Downtown', 51.0472, -114.0928, 'Free', false, false, false, false, 7, 22),

  // ── East Village ──
  w('studiobell', 'Studio Bell, National Music Centre', 'Landmark', 'East Village', 51.0450, -114.0524, 'Paid entry', false, true, true, true, 10, 17),
  w('stpatricks', "St. Patrick's Island Park", 'Park', 'East Village', 51.0464, -114.0428, 'Free', false, true, true, false, 6, 23),
  w('riverwalk', 'RiverWalk Plaza', 'Waterfront', 'East Village', 51.0448, -114.0480, 'Free', false, true, false, false, 0, 24),

  // ── Beltline ──
  w('17thave', '17th Ave Uptown', 'Café', 'Beltline', 51.0378, -114.0784, 'Customers only', true, false, false, true, 7, 22),
  w('beltlineaq', 'Beltline Aquatic & Fitness Centre', 'Community centre', 'Beltline', 51.0333, -114.0784, 'Free', false, true, true, true, 6, 21.5),
  w('barbscott', 'Barb Scott Park', 'Park', 'Beltline', 51.0330, -114.0839, 'Free', false, false, false, false, 7, 21),
  w('erltonlrt', 'Erlton / Stampede LRT Station', 'Transit', 'Beltline', 51.0375, -114.0528, 'Free', false, true, false, false, 5, 25),
  w('bmocentre', 'BMO Centre, Stampede Park', 'Landmark', 'Beltline', 51.0365, -114.0545, 'Free', false, true, true, true, 9, 22),
  w('connaught', 'Connaught Park', 'Park', 'Beltline', 51.0400, -114.0845, 'Free', false, false, false, false, 7, 21),

  // ── Kensington ──
  w('kensingtonvillage', 'Kensington Village', 'Market', 'Kensington', 51.0578, -114.0916, 'Free', false, true, true, true, 10, 19),
  w('rileypark', 'Riley Park Fieldhouse', 'Park', 'Kensington', 51.0555, -114.0968, 'Free', false, true, true, false, 7, 21),
  w('peacebridge', 'Peace Bridge Plaza', 'Waterfront', 'Kensington', 51.0524, -114.0723, 'Free', false, false, false, false, 0, 24),
  w('louiseriley', 'Louise Riley Library', 'Library', 'Kensington', 51.0568, -114.0930, 'Free', false, true, true, true, 10, 20),
  w('saitcampus', 'SAIT Campus Centre', 'Community centre', 'Kensington', 51.0645, -114.0885, 'Free', false, true, true, true, 7, 22),

  // ── Bridgeland ──
  w('bridgelandriverside', 'Bridgeland Riverside Park', 'Park', 'Bridgeland', 51.0554, -114.0396, 'Free', false, false, false, false, 7, 21),
  w('murdochpark', 'Murdoch Park', 'Park', 'Bridgeland', 51.0575, -114.0330, 'Free', false, false, false, false, 7, 21),
  w('calgaryzoo', 'Calgary Zoo — Destination Africa', 'Park', 'Bridgeland', 51.0447, -114.0247, 'Paid entry', false, true, true, true, 9, 17),
  w('renfrewaq', 'Renfrew Aquatic Centre', 'Community centre', 'Bridgeland', 51.0585, -114.0430, 'Free', false, true, true, true, 6, 21),

  // ── Inglewood ──
  w('birdsanctuary', 'Inglewood Bird Sanctuary', 'Park', 'Inglewood', 51.0344, -114.0270, 'Free', false, false, false, false, 7, 21),
  w('bowhabitat', 'Pearce Estate Park — Bow Habitat', 'Park', 'Inglewood', 51.0421, -113.9883, 'Free', false, true, true, false, 6, 22),
  w('ninthave', '9th Avenue Inglewood Village', 'Café', 'Inglewood', 51.0392, -114.0323, 'Customers only', true, false, false, true, 7, 18),
  w('ramsayhall', 'Ramsay Community Hall', 'Community centre', 'Inglewood', 51.0360, -114.0450, 'Free', false, true, false, true, 9, 21),

  // ── Mission ──
  w('lindsaypark', 'Lindsay Park — Repsol Sport Centre', 'Community centre', 'Mission', 51.0294, -114.0653, 'Free', false, true, true, true, 5.5, 22),
  w('missionplaza', '4th Street Mission Plaza', 'Café', 'Mission', 51.0349, -114.0755, 'Customers only', true, false, false, true, 7, 21),

  // ── Marda Loop ──
  w('mardaloophall', 'Marda Loop Community Hall', 'Community centre', 'Marda Loop', 51.0192, -114.1013, 'Free', false, true, true, true, 8, 21),
  w('sandybeach', 'River Park — Sandy Beach', 'Park', 'Marda Loop', 51.0128, -114.0946, 'Free', false, false, false, false, 7, 21),
  w('britanniaplaza', 'Britannia Plaza', 'Café', 'Marda Loop', 51.0125, -114.0790, 'Customers only', true, false, false, true, 7, 19),

  // ── University ──
  w('macewanhall', 'MacEwan Hall, University of Calgary', 'Community centre', 'University', 51.0780, -114.1300, 'Free', false, true, true, true, 7, 22),
  w('marketmall', 'Market Mall — Centre Court', 'Mall', 'University', 51.0805, -114.1520, 'Free', false, true, true, true, 10, 21),
  w('foothillshosp', 'Foothills Medical Centre', 'Civic', 'University', 51.0655, -114.1330, 'Free', false, true, true, true, 0, 24),
  w('udistrict', 'University District Plaza', 'Plaza', 'University', 51.0760, -114.1450, 'Free', false, true, true, true, 8, 22),

  // ── North ──
  w('nosehill', 'Nose Hill Park — 64 Ave Lot', 'Park', 'North', 51.1055, -114.1090, 'Free', false, false, false, false, 6, 23),
  w('confedpark', 'Confederation Park', 'Park', 'North', 51.0754, -114.0870, 'Free', false, true, true, false, 7, 21),
  w('crowfoot', 'Crowfoot Crossing', 'Mall', 'North', 51.1180, -114.2050, 'Free', false, true, true, true, 10, 21),

  // ── West ──
  w('bownesspark', 'Bowness Park Pavilion', 'Park', 'West', 51.0813, -114.1926, 'Free', false, true, true, false, 7, 21),
  w('bowmontpark', 'Bowmont Park Trailhead', 'Park', 'West', 51.0866, -114.1571, 'Free', false, false, false, false, 7, 21),
  w('edworthy', 'Edworthy Park', 'Park', 'West', 51.0570, -114.1560, 'Free', false, true, true, false, 6, 23),
  w('winsport', 'WinSport, Canada Olympic Park', 'Landmark', 'West', 51.0850, -114.2140, 'Free', false, true, true, true, 9, 21),
  w('westbrook', 'Westbrook Mall & LRT', 'Transit', 'West', 51.0380, -114.1290, 'Free', false, true, false, false, 5, 25),

  // ── South ──
  w('chinookcentre', 'Chinook Centre — Food Court', 'Mall', 'South', 51.0021, -114.0752, 'Free', false, true, true, true, 10, 21),
  w('heritagepark', 'Heritage Park Main Gate', 'Landmark', 'South', 50.9850, -114.1040, 'Free', false, true, true, true, 9.5, 17),
  w('southcentre', 'Southcentre Mall', 'Mall', 'South', 50.9585, -114.0655, 'Free', false, true, true, true, 10, 21),
  w('fishcreek', 'Fish Creek Park — Bow Valley Ranch', 'Park', 'South', 50.9200, -114.0250, 'Free', false, true, true, false, 6, 23),
  w('glenmore', 'Glenmore Reservoir — Weaselhead', 'Park', 'South', 50.9850, -114.1300, 'Free', false, false, false, false, 6, 23),
  w('deerfootmeadows', 'Deerfoot Meadows', 'Mall', 'South', 50.9720, -114.0300, 'Free', false, true, true, false, 10, 21),

  // ── Northeast ──
  w('marlborough', 'Marlborough Mall', 'Mall', 'Northeast', 51.0570, -113.9760, 'Free', false, true, true, false, 10, 21),
  w('elliston', 'Elliston Park', 'Park', 'Northeast', 51.0360, -113.9550, 'Free', false, false, false, false, 7, 22),
  w('internationalave', 'International Avenue (17 Ave SE)', 'Plaza', 'Northeast', 51.0410, -113.9750, 'Free', false, true, false, false, 8, 20),
  w('yyc', 'YYC Calgary International Airport', 'Transit', 'Northeast', 51.1225, -114.0130, 'Free', false, true, true, true, 0, 24),

  // ── Food, fuel and rest areas — demo fixture for the road-trip companion
  //    screens (route planning, drive simulation). Real data for these
  //    categories isn't imported yet; user-submitted places land here too.
  w('gordanofarm', 'Gordano Farm Kitchen', 'Café', 'Marda Loop', 51.0210, -114.1050, 'Customers only', true, true, true, true, 7, 21, 'food'),
  w('betwscoffee', 'Betws Coffee Halt', 'Café', 'West', 51.0790, -114.1750, 'Customers only', true, true, true, false, 6.5, 18, 'food'),
  w('newportfilling', 'Newport West Filling Stn', 'Gas station', 'South', 50.9700, -114.0500, 'Customers only', false, true, false, false, 0, 24, 'fuel'),
  w('macleodfuel', 'Macleod Trail Fuel & Go', 'Gas station', 'South', 50.9950, -114.0700, 'Customers only', false, true, false, false, 0, 24, 'fuel'),
  w('brenigpicnic', 'Llyn Brenig Picnic Area', 'Rest area', 'North', 51.1300, -114.1500, 'Free', false, false, false, false, 0, 24, 'rest'),
  w('deerfootrest', 'Deerfoot Trail Rest Stop', 'Rest area', 'Northeast', 51.0900, -113.9700, 'Free', false, true, false, false, 0, 24, 'rest'),
];

// The road-trip companion's "kind of stop" — toilets stay the historical
// default; the rest are what the design's Stops layer and Add-a-stop flow
// add on top.
export const CATEGORIES = [
  { id: 'toilet', label: 'Toilets' },
  { id: 'food', label: 'Eatery' },
  { id: 'fuel', label: 'Gas station' },
  { id: 'rest', label: 'Rest area' },
];

export const categoryLabel = (id) => (CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]).label;

// What a stop can have.
//
// The first ten are the design's vocabulary, in its order — this app started
// as a washroom finder and inherited a washroom's idea of a facility, which
// is why showers, van-height parking and EV charging were missing. A road
// trip asks different questions.
//
// The last two are kept on the end because the imported OpenStreetMap data
// genuinely answers them: dropping them to match the design exactly would
// throw away information the app already holds.
export const FACILITIES = [
  { key: 'wheelchair', label: 'Step-free access', short: 'Step-free', sub: 'Level entry and a wide door' },
  { key: 'babyChange', label: 'Baby changing', short: 'Changing', sub: 'A proper fold-down table' },
  { key: 'familyRoom', label: 'Family room', short: 'Family room', sub: 'Room enough to go in together' },
  { key: 'open24', label: 'Open 24h', short: '24h', sub: 'Any hour, not just office hours' },
  { key: 'isFree', label: 'Free to use', short: 'Free', sub: 'No fee, no purchase needed' },
  { key: 'vanParking', label: 'Van-height parking', short: 'Van parking', sub: 'No height barrier on the way in' },
  { key: 'showers', label: 'Showers', short: 'Showers', sub: 'For the long hauls' },
  { key: 'dogFriendly', label: 'Dog friendly', short: 'Dogs', sub: 'Somewhere to walk them' },
  { key: 'water', label: 'Drinking water', short: 'Water', sub: 'A tap you can fill from' },
  { key: 'evCharging', label: 'EV charging', short: 'EV', sub: 'Chargers on site' },
  { key: 'genderNeutral', label: 'Gender-neutral', short: 'Gender-neutral', sub: 'At least one all-gender room' },
  { key: 'noKey', label: 'No key needed', short: 'No key', sub: 'Walk straight in' },
];

export const facilityByKey = (key) => FACILITIES.find((f) => f.key === key);
const pick = (keys) => keys.map(facilityByKey);

// The design's three subsets, each exactly as it lists them. They differ on
// purpose: you filter on fewer things than you can record, and a reviewer can
// confirm things you wouldn't filter a map by.
export const FILTER_FACILITIES = pick([
  'wheelchair', 'babyChange', 'familyRoom', 'open24', 'isFree', 'dogFriendly',
]);
export const NEED_FACILITIES = pick([
  'wheelchair', 'babyChange', 'familyRoom', 'open24', 'isFree', 'vanParking', 'showers', 'dogFriendly',
]);
export const REVIEW_FACILITIES = pick([
  'wheelchair', 'babyChange', 'familyRoom', 'open24', 'isFree', 'water', 'vanParking', 'dogFriendly',
]);

// "Open right now" is not a facility — it is a question about the clock, and
// it is the one filter people reach for most, so it sits beside them.
export const OPEN_NOW = { key: 'openNow', label: 'Open right now', sub: 'Based on posted hours' };

// The design's travel presets, and what each one actually means in filters.
export const TRAVEL_PRESETS = [
  {
    id: 'family',
    label: 'Family',
    hint: 'Kids on board — changing tables, family rooms',
    needs: ['babyChange', 'familyRoom'],
  },
  {
    id: 'van',
    label: 'Van life',
    hint: 'Long hauls — showers, height-safe parking',
    needs: ['showers', 'vanParking'],
  },
  {
    id: 'access',
    label: 'Accessible',
    hint: 'Step-free, wide doors, grab rails',
    needs: ['wheelchair'],
  },
];

export const REVIEW_TAGS = ['Spotless', 'Well stocked', 'No smell', 'Short wait', 'Dry floor', 'Needs attention'];
export const TYPES = ['Park', 'Mall', 'Café', 'Transit', 'Library', 'Community centre'];
export const REVIEW_FILTERS = ['Most recent', 'Most helpful', 'Good reviews', 'Bad reviews', 'Highest rated'];

// Which "type" chips make sense once you've also picked a category — the
// toilet list above is unchanged, the rest are new for the road-trip flow.
export const TYPES_BY_CATEGORY = {
  toilet: TYPES,
  food: ['Café', 'Restaurant', 'Food truck', 'Bakery', 'Diner'],
  fuel: ['Gas station', 'Truck stop', 'EV charging', 'Service station'],
  rest: ['Rest area', 'Picnic area', 'Lay-by', 'Scenic lookout'],
};
