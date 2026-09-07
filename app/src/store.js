import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Personal preferences only — these are genuinely per-device and stay in this
// browser. Shared content (washrooms, reviews, scores) lives in the database;
// see dataStore.js.
const defaultFilters = {
  wheelchair: false, babyChange: false, genderNeutral: false,
  free: false, openNow: false, noKey: false,
};

// The look the app ships with. Named so the initial state and the migration
// that brings existing installs onto it cannot drift apart.
// The design's default accent is #0F6E63 — teal, which is hue 173 at 76%
// saturation and 25% lightness — on the light theme.
export const DEFAULT_HUE = 173;
export const DEFAULT_SAT = 76;
export const DEFAULT_LIGHT = 25;
export const DEFAULT_DARK = false;

// How long a fix counts as "where you are" rather than "where you last were".
// The watcher in lib/geolocation.js re-stamps a standing-still fix well inside
// this, so the only way to go stale is to genuinely stop receiving positions.
export const LOCATION_FRESH_MS = 2 * 60 * 1000;

export const useStore = create(
  persist(
    (set) => ({
      onboarded: false,

      // { lat, lng, accuracy, at } — `at` is when the browser gave us the fix.
      //
      // Deliberately NOT persisted. Where someone was is not ours to keep
      // between visits: the app asks again each time it opens and the fix dies
      // with the tab. See lib/geolocation.js.
      userLocation: null,

      // idle | locating | tracking | denied | unavailable.
      // Deliberately NOT persisted: permission can be changed in browser
      // settings between visits, so it has to be re-established each load.
      locationStatus: 'idle',

      displayName: '',      // optional; blank posts as "A local"

      hue: DEFAULT_HUE,
      sat: DEFAULT_SAT,
      light: DEFAULT_LIGHT,
      dark: DEFAULT_DARK,
      bigText: false,
      units: 'Metric',

      // 'Exact' measures from the fix the browser gives; 'General' rounds it to
      // roughly a neighbourhood first. The design offers the choice, and it is
      // a real one — a rounded position is still useful for "what's nearby"
      // while being a good deal less revealing.
      locationAccuracy: 'Exact',
      notify: true,

      saved: [],            // your own shortlist

      sort: 'Closest',
      filters: defaultFilters,
      radius: 5000,
      minClean: 0,
      reviewFilter: 'Most recent',
      categoryFilter: 'all', // 'all' | 'toilet' | 'food' | 'fuel' | 'rest' — the map/list stop-kind filter

      // Road-trip companion additions -----------------------------------
      // How you travel — shown on the profile and used only to pre-tick
      // facility filters when planning a route; not enforced anywhere.
      travelPreset: null,           // 'family' | 'van' | 'access' | null

      breaksOn: true,
      breakHours: 2,

      // The route currently being planned or driven. Deliberately NOT
      // persisted: `path` can be thousands of points for a long drive, and
      // it is cheap to ask OSRM again next time rather than carrying that in
      // localStorage. from/to/via carry a `label` plus {lat,lng}.
      tripFrom: null,
      tripTo: null,
      tripVia: [],
      tripCategories: ['toilet', 'food', 'fuel'], // which stop categories the drive sim looks for
      activeRoute: null,            // { source, distanceM, durationS, path } | null

      // Past trips, kept lightweight on purpose — coordinates only, no
      // geometry — so "Drive it again" re-asks OSRM rather than this store
      // growing without bound.
      trips: [],

      setOnboarded: (v) => set({ onboarded: v }),
      setUserLocation: (loc) => set({ userLocation: loc }),
      setLocationStatus: (locationStatus) => set({ locationStatus }),
      forgetLocation: () => set({ userLocation: null, locationStatus: 'idle' }),
      setDisplayName: (displayName) => set({ displayName }),

      setHue: (hue) => set({ hue }),
      setSat: (sat) => set({ sat }),
      setLight: (light) => set({ light }),
      // What the colour wheel writes: angle and distance in one go.
      setAccentHsl: ({ hue, sat, light }) => set((s) => ({
        hue: hue ?? s.hue, sat: sat ?? s.sat, light: light ?? s.light,
      })),
      toggleDark: () => set((s) => ({ dark: !s.dark })),
      setDark: (dark) => set({ dark }),
      toggleBigText: () => set((s) => ({ bigText: !s.bigText })),
      setUnits: (units) => set({ units }),
      setLocationAccuracy: (locationAccuracy) => set({ locationAccuracy }),
      toggleNotify: () => set((s) => ({ notify: !s.notify })),

      toggleSaved: (id) => set((s) => ({
        saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id],
      })),

      setSort: (sort) => set({ sort }),
      toggleFilter: (key) => set((s) => ({ filters: { ...s.filters, [key]: !s.filters[key] } })),
      setRadius: (radius) => set({ radius }),
      setMinClean: (minClean) => set({ minClean }),
      clearFilters: () => set({ filters: defaultFilters, radius: 5000, minClean: 0, categoryFilter: 'all' }),
      setReviewFilter: (reviewFilter) => set({ reviewFilter }),
      setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

      // Road-trip companion additions -----------------------------------
      setTravelPreset: (travelPreset) => set({ travelPreset }),
      toggleBreaks: () => set((s) => ({ breaksOn: !s.breaksOn })),
      setBreakHours: (breakHours) => set({ breakHours }),

      setTripFrom: (tripFrom) => set({ tripFrom }),
      setTripTo: (tripTo) => set({ tripTo }),
      swapTripEnds: () => set((s) => ({ tripFrom: s.tripTo, tripTo: s.tripFrom })),
      addTripVia: (stop) => set((s) => ({ tripVia: [...s.tripVia, stop] })),
      removeTripVia: (index) => set((s) => ({ tripVia: s.tripVia.filter((_, i) => i !== index) })),
      clearTripVia: () => set({ tripVia: [] }),
      toggleTripCategory: (id) => set((s) => ({
        tripCategories: s.tripCategories.includes(id)
          ? s.tripCategories.filter((x) => x !== id)
          : [...s.tripCategories, id],
      })),
      setActiveRoute: (activeRoute) => set({ activeRoute }),

      addTrip: (trip) => set((s) => ({
        trips: [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...trip }, ...s.trips].slice(0, 30),
      })),
    }),
    {
      name: 'loo-preferences',
      version: 7,
      partialize: (s) => ({
        onboarded: s.onboarded,
        displayName: s.displayName,
        hue: s.hue,
        sat: s.sat,
        light: s.light,
        dark: s.dark,
        bigText: s.bigText,
        units: s.units,
        locationAccuracy: s.locationAccuracy,
        notify: s.notify,
        saved: s.saved,
        sort: s.sort,
        filters: s.filters,
        radius: s.radius,
        minClean: s.minClean,
        reviewFilter: s.reviewFilter,
        categoryFilter: s.categoryFilter,
        travelPreset: s.travelPreset,
        breaksOn: s.breaksOn,
        breakHours: s.breakHours,
        // tripFrom/tripTo/tripVia/activeRoute are the in-progress planner —
        // session state, not a preference, and activeRoute in particular can
        // hold a multi-thousand-point path. None of the four are persisted.
        trips: s.trips,
      }),
      // v2 captured one position during onboarding and kept it forever; v3
      // timestamped it; v4 stopped storing it at all. v5 moves everyone onto
      // the black-and-accent look — the app shipped in blush, so devices that
      // saw it are still carrying that palette, and the point of a default
      // nobody sees is nil. The wheel in Settings puts it back in one tap.
      // v6 adds the road-trip companion fields (travel preset, break
      // reminders, trip history) — plain new keys, so existing installs just
      // pick up their defaults.
      //
      // Only the two appearance keys are touched at v5. Saved washrooms,
      // display name, units, filters and everything else carry over untouched.
      // v7 is the Roadside redesign. The accent used to be a hue alone; it is
      // now hue + saturation + brightness, so there is no sensible way to
      // carry the old value forward — everyone moves onto the design's teal.
      // Light/dark is left exactly as it was: that one is a deliberate choice
      // people make, unlike an accent nobody picked.
      migrate: (state, version) => {
        if (!state) return state;
        const { userLocation: _dropped, ...rest } = state;
        const withV5 = version >= 5 ? rest : { ...rest, hue: DEFAULT_HUE, dark: DEFAULT_DARK };
        const withV6 = version >= 6
          ? withV5
          : { ...withV5, travelPreset: null, breaksOn: true, breakHours: 2, trips: [] };
        if (version >= 7) return withV6;
        return {
          ...withV6, hue: DEFAULT_HUE, sat: DEFAULT_SAT, light: DEFAULT_LIGHT, bigText: false,
        };
      },
    },
  ),
);
