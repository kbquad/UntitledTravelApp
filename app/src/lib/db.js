// One data interface, two backings:
//   • Firestore — the real thing: shared, everyone sees everyone's reviews.
//   • local     — a labelled demo fallback used when no Firebase config is
//                 set, so the app still runs on a fresh clone.
//
// Screens only call the functions exported at the bottom; they never need to
// know which backing is live.
//
// Firestore shape:
//   washrooms/{id}                       ← aggregate counters live here
//     └─ reviews/{authorUid}             ← doc id IS the author's uid
//          └─ helpful/{voterUid}         ← doc id IS the voter's uid
//
// Scores are kept as reviewCount / ratingSum / cleanVotes on the washroom doc
// and updated in the same transaction as the review, so the map can render 60
// washrooms from 60 documents instead of reading every review.
import {
  collection, collectionGroup, doc, getDoc, getDocs, limit, query, where,
  runTransaction, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { firestore, isConfigured, ensureSession, currentUserId } from './firebase';
import { WASHROOMS as SEED_LOCATIONS, CITIES } from '../data/locations';
import { inBox } from '../utils/region';
import { distanceMetres } from '../utils/geo';

// A ceiling on one region's worth of documents. Downtown Toronto will not come
// close; without it, a bad box could try to stream the country.
const REGION_LIMIT = 600;

// Facility flags a stop record can carry, as stored booleans. The derived
// ones — free, no key, open 24h — are not here: they fall out of the fee,
// the key flag and the hours.
const FACILITY_KEYS = [
  'wheelchair', 'babyChange', 'genderNeutral', 'familyRoom',
  'vanParking', 'showers', 'dogFriendly', 'water', 'evCharging',
];

// Copies across only the flags the record actually has.
//
// Coercing a missing field to false would turn "nobody has said whether this
// place has showers" into "this place has no showers", which is a claim we
// have no basis for and would put a cross next to it on the detail screen.
// Left absent, it reads as unknown all the way through.
const facilityFlags = (d) => {
  const out = {};
  for (const key of FACILITY_KEYS) {
    if (key in d && d[key] != null) out[key] = !!d[key];
  }
  return out;
};

const toWashroom = (id, d) => ({
  id,
  name: d.name,
  type: d.type,
  // Every washroom imported before this field existed is a toilet — this is
  // the default that keeps them showing up exactly where they used to.
  category: d.category || 'toilet',
  neighbourhood: d.area,
  lat: d.lat,
  lng: d.lng,
  fee: d.fee,
  needsKey: !!d.needsKey,
  ...facilityFlags(d),
  openFrom: Number(d.openFrom),
  openTo: Number(d.openTo),
  // Imported washrooms usually have no opening hours in OpenStreetMap. They
  // are stored as always-open so nothing is wrongly filtered out, and flagged
  // here so the UI can say it doesn't know rather than claiming 24 hours.
  hoursKnown: d.hoursKnown !== false,
  reviewCount: d.reviewCount ?? 0,
  // null (not 0) when nobody has reviewed it — the UI shows "New"
  avgRating: d.reviewCount ? Math.round((d.ratingSum / d.reviewCount) * 10) / 10 : null,
  cleanVotes: d.cleanVotes ?? 0,
});

const isoDate = (value) => {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return String(value);
};

const slugify = (name) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'washroom'}-${Math.random().toString(36).slice(2, 8)}`;

const cleanBonus = (rating) => (rating >= 4 ? 1 : 0);

// A submitted washroom needs an area label. Nothing here knows Canadian
// geography, so name the nearest city we do know — and admit it when the
// nearest one is hundreds of kilometres away.
const nearestCity = (lat, lng) => {
  let best = null;
  let bestDist = Infinity;
  for (const c of CITIES) {
    const d = distanceMetres(lat, lng, c.lat, c.lng);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return bestDist <= 60000 ? best.name : 'Canada';
};

// ── Firestore backing ────────────────────────────────────────────────────────

const remote = {
  // Only the washrooms inside this box. Firestore allows range filters on two
  // different fields in one query, so the box needs no geohash scheme — just
  // the composite index declared in firestore.indexes.json.
  //
  // The status equality filter is not optional: security rules are not a
  // filter, so an unnarrowed query is rejected outright for *possibly*
  // matching a pending washroom.
  async listWashroomsInBox(box) {
    const snap = await getDocs(query(
      collection(firestore, 'washrooms'),
      where('status', '==', 'published'),
      where('lat', '>=', box.minLat),
      where('lat', '<=', box.maxLat),
      where('lng', '>=', box.minLng),
      where('lng', '<=', box.maxLng),
      limit(REGION_LIMIT),
    ));
    return snap.docs
      .map((d) => toWashroom(d.id, d.data()))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async listReviews(washroomId) {
    const me = await currentUserId();
    const snap = await getDocs(collection(firestore, 'washrooms', washroomId, 'reviews'));

    const reviews = snap.docs.map((d) => {
      const r = d.data();
      return {
        id: d.id,
        rating: r.rating,
        body: r.body ?? '',
        authorName: r.authorName ?? 'A local',
        createdAt: isoDate(r.createdAt),
        isMine: d.id === me,
        helpfulCount: r.helpfulCount ?? 0,
        votedByMe: false,
      };
    });

    // Whether *I* voted is one small read per review on this one washroom.
    if (me) {
      await Promise.all(reviews.map(async (r) => {
        const vote = await getDoc(
          doc(firestore, 'washrooms', washroomId, 'reviews', r.id, 'helpful', me),
        );
        r.votedByMe = vote.exists();
      }));
    }

    return reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async saveReview(washroomId, { rating, body, authorName }) {
    const uid = await currentUserId();
    const washroomRef = doc(firestore, 'washrooms', washroomId);
    const reviewRef = doc(firestore, 'washrooms', washroomId, 'reviews', uid);

    // The review and the washroom's running totals move together, so a score
    // can never drift out of step with the reviews behind it.
    await runTransaction(firestore, async (tx) => {
      const [washroomSnap, existingSnap] = await Promise.all([
        tx.get(washroomRef),
        tx.get(reviewRef),
      ]);
      if (!washroomSnap.exists()) throw new Error('That washroom no longer exists.');

      const w = washroomSnap.data();
      const previous = existingSnap.exists() ? existingSnap.data() : null;

      const countDelta = previous ? 0 : 1;
      const sumDelta = rating - (previous?.rating ?? 0);
      const cleanDelta = cleanBonus(rating) - (previous ? cleanBonus(previous.rating) : 0);

      tx.set(reviewRef, {
        authorId: uid,
        washroomId,
        washroomName: w.name,
        rating,
        body,
        authorName,
        helpfulCount: previous?.helpfulCount ?? 0,
        createdAt: previous?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.update(washroomRef, {
        reviewCount: (w.reviewCount ?? 0) + countDelta,
        ratingSum: (w.ratingSum ?? 0) + sumDelta,
        cleanVotes: (w.cleanVotes ?? 0) + cleanDelta,
      });
    });
  },

  async setHelpful(reviewId, helpful, washroomId) {
    const uid = await currentUserId();
    const reviewRef = doc(firestore, 'washrooms', washroomId, 'reviews', reviewId);
    const voteRef = doc(firestore, 'washrooms', washroomId, 'reviews', reviewId, 'helpful', uid);

    await runTransaction(firestore, async (tx) => {
      const [reviewSnap, voteSnap] = await Promise.all([tx.get(reviewRef), tx.get(voteRef)]);
      if (!reviewSnap.exists()) return;

      const already = voteSnap.exists();
      if (helpful === already) return; // already in the desired state

      const count = reviewSnap.data().helpfulCount ?? 0;
      if (helpful) {
        tx.set(voteRef, { voterId: uid, createdAt: serverTimestamp() });
        tx.update(reviewRef, { helpfulCount: count + 1 });
      } else {
        tx.delete(voteRef);
        tx.update(reviewRef, { helpfulCount: Math.max(0, count - 1) });
      }
    });
  },

  async suggestWashroom({
    name, type, lat, lng, features, category = 'toilet',
  }) {
    const uid = await currentUserId();
    await setDoc(doc(firestore, 'washrooms', slugify(name)), {
      name,
      type,
      category,
      area: nearestCity(lat, lng),
      lat,
      lng,
      fee: features.isFree ? 'Free' : 'Check on site',
      needsKey: !features.noKey,
      wheelchair: !!features.wheelchair,
      babyChange: !!features.babyChange,
      genderNeutral: !!features.genderNeutral,
      familyRoom: !!features.familyRoom,
      vanParking: !!features.vanParking,
      showers: !!features.showers,
      dogFriendly: !!features.dogFriendly,
      water: !!features.water,
      evCharging: !!features.evCharging,
      // The add form asks whether a stop is open around the clock, not what
      // its hours are. Ticking "Open 24h" is a fact about the hours; leaving
      // it means we don't know them, and the app says so rather than claiming
      // the stop never closes.
      openFrom: 0,
      openTo: 24,
      hoursKnown: !!features.open24,
      status: 'pending',
      submittedBy: uid,
      reviewCount: 0,
      ratingSum: 0,
      cleanVotes: 0,
      createdAt: serverTimestamp(),
    });
  },

  async myReviews() {
    const me = await currentUserId();
    if (!me) return [];
    const snap = await getDocs(
      query(collectionGroup(firestore, 'reviews'), where('authorId', '==', me)),
    );
    return snap.docs
      .map((d) => {
        const r = d.data();
        return {
          id: d.ref.path,
          rating: r.rating,
          body: r.body ?? '',
          createdAt: isoDate(r.createdAt),
          washroomId: r.washroomId,
          washroomName: r.washroomName ?? r.washroomId,
          helpfulCount: r.helpfulCount ?? 0,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async myHelpfulReceived() {
    const mine = await remote.myReviews();
    return mine.reduce((sum, r) => sum + r.helpfulCount, 0);
  },
};

// ── local demo backing ───────────────────────────────────────────────────────

const KEY = 'loo-demo-data';
const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? { reviews: [], votes: [], submitted: [] };
  } catch {
    return { reviews: [], votes: [], submitted: [] };
  }
};
const writeLocal = (d) => localStorage.setItem(KEY, JSON.stringify(d));
const LOCAL_USER = 'local-demo-user';

const local = {
  async listWashroomsInBox(box) {
    const { reviews } = readLocal();
    return SEED_LOCATIONS.filter((w) => inBox(w, box)).map((w) => {
      const mine = reviews.filter((r) => r.washroomId === w.id);
      return {
        ...w,
        reviewCount: mine.length,
        avgRating: mine.length
          ? Math.round((mine.reduce((s, r) => s + r.rating, 0) / mine.length) * 10) / 10
          : null,
        cleanVotes: mine.filter((r) => r.rating >= 4).length,
      };
    });
  },

  async listReviews(washroomId) {
    const { reviews, votes } = readLocal();
    return reviews
      .filter((r) => r.washroomId === washroomId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((r) => ({
        ...r,
        isMine: r.authorId === LOCAL_USER,
        helpfulCount: votes.filter((v) => v.reviewId === r.id).length,
        votedByMe: votes.some((v) => v.reviewId === r.id && v.voterId === LOCAL_USER),
      }));
  },

  async saveReview(washroomId, { rating, body, authorName }) {
    const d = readLocal();
    const existing = d.reviews.find((r) => r.washroomId === washroomId && r.authorId === LOCAL_USER);
    if (existing) {
      Object.assign(existing, { rating, body, authorName });
    } else {
      d.reviews.push({
        id: crypto.randomUUID(),
        washroomId,
        washroomName: SEED_LOCATIONS.find((w) => w.id === washroomId)?.name ?? washroomId,
        authorId: LOCAL_USER,
        rating,
        body,
        authorName,
        createdAt: new Date().toISOString(),
      });
    }
    writeLocal(d);
  },

  async setHelpful(reviewId, helpful) {
    const d = readLocal();
    d.votes = d.votes.filter((v) => !(v.reviewId === reviewId && v.voterId === LOCAL_USER));
    if (helpful) d.votes.push({ reviewId, voterId: LOCAL_USER });
    writeLocal(d);
  },

  async suggestWashroom(w) {
    const d = readLocal();
    d.submitted.push({ ...w, id: slugify(w.name), createdAt: new Date().toISOString() });
    writeLocal(d);
  },

  async myReviews() {
    const { reviews, votes } = readLocal();
    return reviews
      .filter((r) => r.authorId === LOCAL_USER)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((r) => ({ ...r, helpfulCount: votes.filter((v) => v.reviewId === r.id).length }));
  },

  async myHelpfulReceived() {
    const mine = await local.myReviews();
    return mine.reduce((sum, r) => sum + r.helpfulCount, 0);
  },
};

// ── public interface ─────────────────────────────────────────────────────────

const backing = isConfigured ? remote : local;

export const isLive = isConfigured;
export const startSession = () => (isConfigured ? ensureSession() : Promise.resolve(null));

export const listWashroomsInBox = (...a) => backing.listWashroomsInBox(...a);
export const listReviews = (...a) => backing.listReviews(...a);
export const saveReview = (...a) => backing.saveReview(...a);
export const setHelpful = (...a) => backing.setHelpful(...a);
export const suggestWashroom = (...a) => backing.suggestWashroom(...a);
export const myReviews = (...a) => backing.myReviews(...a);
export const myHelpfulReceived = (...a) => backing.myHelpfulReceived(...a);
