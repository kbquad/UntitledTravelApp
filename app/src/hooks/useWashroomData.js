import { useEffect, useMemo } from 'react';
import { useStore, LOCATION_FRESH_MS } from '../store';
import { useDataStore } from '../dataStore';
import { cellKeyFor } from '../utils/region';
import { FALLBACK_LOCATION } from '../data/locations';
import { decorateWashroom, facilitiesOf } from '../utils/decorate';
import { distanceMetres } from '../utils/geo';
import { isOpenNow } from '../utils/hours';

// The one place that answers "where are we measuring from?". It also says how
// much that answer is worth: a position from the device that arrived seconds
// ago is not the same thing as one left over from yesterday's session, and
// screens that pin data to a coordinate (Add a washroom) need to tell them
// apart.
// About 1 km at Canadian latitudes — a neighbourhood, not a doorstep.
const COARSE_STEP = 0.01;
const coarsen = (v) => Math.round(v / COARSE_STEP) * COARSE_STEP;

export const useCurrentLocation = () => {
  const userLocation = useStore((s) => s.userLocation);
  const locationStatus = useStore((s) => s.locationStatus);
  const locationAccuracy = useStore((s) => s.locationAccuracy);

  return useMemo(() => {
    if (!userLocation) {
      return {
        lat: FALLBACK_LOCATION.lat,
        lng: FALLBACK_LOCATION.lng,
        label: FALLBACK_LOCATION.label,
        accuracy: null,
        at: null,
        fromDevice: false,
        live: false,
      };
    }

    const at = userLocation.at ?? 0;
    const live = locationStatus !== 'denied' && Date.now() - at <= LOCATION_FRESH_MS;

    // Rounding happens here, at the single point every screen reads from, so
    // no feature can accidentally use the precise fix when the user asked for
    // the coarse one.
    const coarse = locationAccuracy === 'General';

    return {
      lat: coarse ? coarsen(userLocation.lat) : userLocation.lat,
      lng: coarse ? coarsen(userLocation.lng) : userLocation.lng,
      coarse,
      label: live ? (coarse ? 'your area' : 'your current location') : 'where you last were',
      accuracy: userLocation.accuracy ?? null,
      at: at || null,
      fromDevice: true,
      live,
    };
  }, [userLocation, locationStatus, locationAccuracy]);
};

const featureOk = (w, filters, minClean, categoryFilter) => {
  if (categoryFilter && categoryFilter !== 'all' && (w.category || 'toilet') !== categoryFilter) return false;
  // An unrated washroom is unknown, not bad — but a minimum-rating filter is
  // an explicit request for proven-clean ones, so unrated drops out.
  if (minClean && (w.avgRating == null || w.avgRating < minClean)) return false;
  // Facilities are resolved the same way the detail screen resolves them, so
  // a filter and a stop's own facility list can never disagree about what it
  // has. A ticked filter the stop doesn't record drops it: asking for showers
  // means showers, not "showers, or nobody checked".
  for (const f of facilitiesOf(w)) {
    if (filters[f.key] && !f.has) return false;
  }
  // "Open right now" is a request for places that are provably open. A
  // washroom whose hours nobody has recorded cannot make that claim, so it
  // drops out — the same reasoning as the minimum-rating filter above.
  if (filters.openNow && (w.hoursKnown === false || !isOpenNow(w.openFrom, w.openTo))) return false;
  return true;
};

// Loads the region around the user — and reloads when they move into a new
// one — then derives the filtered/sorted views.
export const useWashroomData = () => {
  const units = useStore((s) => s.units);
  const filters = useStore((s) => s.filters);
  const minClean = useStore((s) => s.minClean);
  const categoryFilter = useStore((s) => s.categoryFilter);
  const radius = useStore((s) => s.radius);
  const sort = useStore((s) => s.sort);
  const location = useCurrentLocation();

  const washrooms = useDataStore((s) => s.washrooms);
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const loadRegion = useDataStore((s) => s.loadRegion);

  // Keyed on the grid cell rather than the raw coordinates, so walking down
  // the street doesn't re-run this on every GPS reading.
  const cell = cellKeyFor(location.lat, location.lng);
  useEffect(() => {
    loadRegion(location.lat, location.lng);
    // location.lat/lng are intentionally absent: the cell is what should
    // trigger a fetch, and it is derived from them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, loadRegion]);

  const derived = useMemo(() => {
    const withDist = washrooms.map((w) => ({
      w, dist: distanceMetres(location.lat, location.lng, w.lat, w.lng),
    }));

    const mapPool = withDist
      .filter(({ w }) => featureOk(w, filters, minClean, categoryFilter))
      .map(({ w, dist }) => decorateWashroom(w, dist, units));

    const nearby = mapPool.filter((w) => w.dist <= radius);

    const sorted = [...nearby].sort((a, b) => {
      if (sort === 'Cleanest') {
        // Unrated sink below rated, rather than counting as zero.
        if (a.rated !== b.rated) return a.rated ? -1 : 1;
        if (a.rated) return b.avgRating - a.avgRating;
        return a.dist - b.dist;
      }
      if (sort === 'Most reviewed') return b.reviewCount - a.reviewCount || a.dist - b.dist;
      return a.dist - b.dist;
    });

    const allDecorated = withDist.map(({ w, dist }) => decorateWashroom(w, dist, units));

    return { mapPool, nearby, sorted, allDecorated, location };
  }, [washrooms, units, filters, minClean, categoryFilter, radius, sort, location]);

  return { ...derived, status, error, loading: status === 'loading' || status === 'idle' };
};

export const useWashroom = (id) => {
  const units = useStore((s) => s.units);
  const location = useCurrentLocation();
  const washrooms = useDataStore((s) => s.washrooms);
  const loadRegion = useDataStore((s) => s.loadRegion);

  // Opening a link to a washroom directly — from a bookmark or a shared URL —
  // means the region around the user may not contain it. Fetching around the
  // user is still the right first move: it covers the ordinary case of
  // tapping a pin, and costs one query.
  const cell = cellKeyFor(location.lat, location.lng);
  useEffect(() => {
    loadRegion(location.lat, location.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, loadRegion]);

  return useMemo(() => {
    const w = washrooms.find((x) => x.id === id);
    if (!w) return null;
    return decorateWashroom(w, distanceMetres(location.lat, location.lng, w.lat, w.lng), units);
  }, [id, washrooms, units, location]);
};

export const useReviews = (washroomId) => {
  const reviews = useDataStore((s) => s.reviewsByWashroom[washroomId]);
  const status = useDataStore((s) => s.reviewStatus[washroomId]);
  const loadReviews = useDataStore((s) => s.loadReviews);

  useEffect(() => {
    if (washroomId) loadReviews(washroomId);
  }, [washroomId, loadReviews]);

  return {
    reviews: reviews ?? [],
    loading: status === 'loading' || status === undefined,
    error: status === 'error',
  };
};
