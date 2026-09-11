import { scoreColor } from '../theme';
import { formatDistance, formatWalk } from './geo';
import { formatStatus, formatHoursRange, isOpenNow } from './hours';
import { categoryLabel, FACILITIES } from '../data/locations';

// Resolves the facility list for one stop, in one place, so the map, the list
// and the detail screen cannot drift apart on what a stop is said to have.
//
// Most of these are plain stored booleans. Three are derived, because the
// underlying record answers them a different way: the fee is a string, the
// key is stored as its opposite, and "open 24h" falls out of the hours. A
// stop whose hours are unknown is not claimed to be open around the clock.
// `has` is true, false, or undefined for "nobody has said". The third state
// is the point: a stop imported before showers were a field has not told us
// it lacks showers, and a cross beside "Showers" would be us inventing that.
export const facilitiesOf = (w) => {
  const derived = {
    isFree: w.fee === 'Free',
    noKey: !w.needsKey,
    // Unknown hours cannot answer this either way.
    open24: w.hoursKnown === false
      ? undefined
      : Number(w.openFrom) === 0 && Number(w.openTo) >= 24,
  };
  return FACILITIES.map((f) => ({
    ...f,
    has: f.key in derived ? derived[f.key] : (f.key in w ? !!w[f.key] : undefined),
  }));
};

// Only the ones the data can actually answer — what a stop's own page shows.
export const knownFacilities = (w) => facilitiesOf(w).filter((f) => f.has !== undefined);

// Attaches display-ready labels to a washroom.
//
// A washroom nobody has reviewed has avgRating === null. That is a real state,
// not a zero: it renders as "New" / "No ratings yet" rather than a bad score.
export const decorateWashroom = (w, distMetres, units) => {
  const rated = w.avgRating != null;
  const c = rated ? scoreColor(w.avgRating) : null;

  const tags = [];
  if (w.wheelchair) tags.push({ label: 'Accessible' });
  if (w.babyChange) tags.push({ label: 'Change table' });
  if (w.genderNeutral) tags.push({ label: 'Gender-neutral' });
  tags.push({ label: w.fee });

  const distLabel = formatDistance(distMetres, units);
  const hoursKnown = w.hoursKnown !== false;
  const hoursToday = hoursKnown ? formatStatus(w.openFrom, w.openTo) : 'Hours not known';

  const category = w.category || 'toilet';

  // The design shows a cleanliness percentage on every stop card. This is the
  // share of reviewers who rated it clean (4+) — a real tally, not a score
  // invented to fill the slot — and it is null until somebody has reviewed it.
  const cleanPct = w.reviewCount ? Math.round((w.cleanVotes / w.reviewCount) * 100) : null;

  return {
    ...w,
    dist: distMetres,
    rated,
    category,
    categoryLabel: categoryLabel(category),
    cleanPct,
    cleanLabel: cleanPct == null ? 'Not rated' : `${cleanPct}% clean`,
    // Only what the data can answer. Cards and detail pages show ticks and
    // crosses, and there is nothing to draw for a facility nobody recorded.
    facilities: knownFacilities(w),
    openNow: isOpenNow(w.openFrom, w.openTo),
    hoursKnown,
    hoursToday,
    hours: hoursKnown ? formatHoursRange(w.openFrom, w.openTo) : 'Not known',
    scoreText: rated ? w.avgRating.toFixed(1) : '–',
    scoreBg: rated ? c.bg : 'transparent',
    scoreFg: rated ? c.fg : null, // caller substitutes a theme colour
    distLabel: `${distLabel} · ${formatWalk(distMetres)}`,
    metaLabel: `${w.neighbourhood} · ${distLabel} · ${hoursToday}`,
    typeLine: `${w.type} · ${w.neighbourhood}`,
    reviewLabel: w.reviewCount === 0
      ? 'No reviews yet — be the first'
      : `${w.cleanVotes} of ${w.reviewCount} ${w.reviewCount === 1 ? 'person' : 'people'} found this clean`,
    tags,
  };
};
