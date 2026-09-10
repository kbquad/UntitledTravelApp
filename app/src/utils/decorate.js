import { scoreColor } from '../theme';
import { formatDistance, formatWalk } from './geo';
import { formatStatus, formatHoursRange, isOpenNow } from './hours';
import { categoryLabel } from '../data/locations';

// The facilities the data can actually answer yes or no to. Anything not
// recorded is absent from this list rather than shown as a "no" — claiming a
// stop lacks a changing table when nobody ever recorded one is a different
// statement from "it hasn't got one".
export const FACILITY_FIELDS = [
  { key: 'wheelchair', label: 'Step-free access', short: 'Accessible' },
  { key: 'babyChange', label: 'Baby changing', short: 'Change table' },
  { key: 'genderNeutral', label: 'Gender-neutral', short: 'Gender-neutral' },
  { key: 'isFree', label: 'Free to use', short: 'Free' },
  { key: 'noKey', label: 'No key needed', short: 'No key' },
  { key: 'open24', label: 'Open 24h', short: '24h' },
];

// Resolves those fields for one stop, in one place, so the map, the list and
// the detail screen cannot drift apart on what a stop is said to have.
export const facilitiesOf = (w) => {
  const has = {
    wheelchair: !!w.wheelchair,
    babyChange: !!w.babyChange,
    genderNeutral: !!w.genderNeutral,
    isFree: w.fee === 'Free',
    noKey: !w.needsKey,
    open24: w.hoursKnown !== false && Number(w.openFrom) === 0 && Number(w.openTo) >= 24,
  };
  return FACILITY_FIELDS.map((f) => ({ ...f, has: has[f.key] }));
};

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
    facilities: facilitiesOf(w),
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
