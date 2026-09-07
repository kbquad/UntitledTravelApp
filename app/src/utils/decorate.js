import { scoreColor } from '../theme';
import { formatDistance, formatWalk } from './geo';
import { formatStatus, formatHoursRange, isOpenNow } from './hours';
import { categoryLabel } from '../data/locations';

// One accent per stop category, independent of the app's own accent colour —
// these badges need to stay legible and tell categories apart no matter what
// hue the user has picked in Appearance.
const CATEGORY_COLOR = {
  toilet: '#4C8DFF', food: '#C99A5B', fuel: '#5C9A78', rest: '#9A7FD6',
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
    categoryColor: CATEGORY_COLOR[category] || CATEGORY_COLOR.toilet,
    cleanPct,
    cleanLabel: cleanPct == null ? 'Not rated' : `${cleanPct}% clean`,
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
