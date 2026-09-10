// The Roadside design's palette and accent logic.
//
// Ported from the design's THEMES object rather than invented here: warm
// off-white surfaces in light, cool near-black in dark, with one accent
// running through both. The accent is still driven by the single `hue` the
// colour wheel in Settings writes, so an existing install keeps the colour it
// picked — but the hex it resolves to now goes through the design's contrast
// rules before anything paints with it.

// One colour per stop kind, verbatim from the design's `badge(type, ac)`.
// Toilets take the app's accent — they are the overwhelming majority of the
// data, so they read as "the app's own colour"; the other three are fixed so
// the categories stay apart from each other whatever accent is picked.
//
// Lives here, not beside a component, because the badges, the flat map's pins
// and the 3D scenes all colour by category and must not drift apart.
export const categoryColor = (category, accent) => ({
  toilet: accent, food: '#B45309', fuel: '#1F5FD0', rest: '#5B7C4A',
}[category] || accent);

export const GREEN = '#166534';
export const AMBER = '#92400E';
export const RED = '#C2334D';

// The design's six accent swatches, as hues so the existing wheel keeps
// working. Names are for the readout under the wheel.
export const PRESETS = [
  { name: 'Teal', hue: 173 },
  { name: 'Blue', hue: 221 },
  { name: 'Orange', hue: 22 },
  { name: 'Violet', hue: 265 },
  { name: 'Magenta', hue: 330 },
  { name: 'Olive', hue: 82 },
];

// ── colour maths, ported from the design ────────────────────────────────────

export const hslToHex = (h, s, l) => {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * v).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const hexToHsl = (hex) => {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const luminance = (hex) => {
  const m = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(m.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

export const ratioOnWhiteText = (hex) => 1.05 / (luminance(hex) + 0.05);

// Darkens an accent until white button text on it clears WCAG AA. The design
// reports the measured ratio in Appearance, so this returns it too.
export const contrastSafe = (hex) => {
  if (ratioOnWhiteText(hex) >= 4.5) return { hex, adjusted: false, ratio: ratioOnWhiteText(hex) };
  const c = hexToHsl(hex);
  for (let l = c.l - 1; l >= 6; l -= 1) {
    const t = hslToHex(c.h, c.s, l);
    if (ratioOnWhiteText(t) >= 4.5) return { hex: t, adjusted: true, ratio: ratioOnWhiteText(t) };
  }
  const t = hslToHex(c.h, c.s, 6);
  return { hex: t, adjusted: true, ratio: ratioOnWhiteText(t) };
};

// The design's six accent swatches, verbatim.
export const SWATCHES = ['#0F6E63', '#1F5FD0', '#C2410C', '#7C3AED', '#B01455', '#3F6212'];

export const swatch = (h) => hslToHex(h, 76, 42);

export const hueName = (h) => {
  let best = PRESETS[0];
  let gap = 999;
  for (const p of PRESETS) {
    const d = Math.min(Math.abs(p.hue - h), 360 - Math.abs(p.hue - h));
    if (d < gap) { gap = d; best = p; }
  }
  return best.name;
};

// ── the two palettes ────────────────────────────────────────────────────────

const LIGHT = {
  bg: '#F7F5F1', card: '#FFFFFF', field: '#FBFAF8', chip: '#F2EFE9', placeholder: '#E4DFD6',
  text: '#16191C', body: '#5A5E64', sub: '#7A7E84', faint: '#9B9EA3',
  line: 'rgba(0,0,0,.08)', line2: 'rgba(0,0,0,.13)', line3: 'rgba(0,0,0,.19)',
  hero: '#16191C',
  scene: 'linear-gradient(#BBD3DE 0%,#DCE6E4 46%,#D8D2C6 46%,#C9C2B4 100%)',
  road: '#4B4F52', dash: '#F4EFE2', sun: '#F2E7CF',
  mapWater: '#DDE3DC', maproad: '#F0EDE6', glass: 'rgba(255,255,255,.93)',
  fadeOut: 'rgba(247,245,241,0)', pinHalo: 'rgba(255,255,255,.92)',
  toastBg: '#16191C', toastFg: '#F7F5F1',
};

const DARK = {
  bg: '#101317', card: '#1B1F25', field: '#23272E', chip: '#262B33', placeholder: '#272C34',
  text: '#F1EFEB', body: '#A9AEB6', sub: '#8B9098', faint: '#6E737B',
  line: 'rgba(255,255,255,.09)', line2: 'rgba(255,255,255,.15)', line3: 'rgba(255,255,255,.24)',
  hero: '#252B34',
  scene: 'linear-gradient(#131A26 0%,#1D2733 46%,#242A2E 46%,#1A1E22 100%)',
  road: '#2B2F34', dash: '#C7C1B2', sun: '#DFE6EE',
  mapWater: '#181C21', maproad: '#2A2F37', glass: 'rgba(20,24,29,.88)',
  fadeOut: 'rgba(16,19,23,0)', pinHalo: 'rgba(16,19,23,.9)',
  toastBg: '#F1EFEB', toastFg: '#101317',
};

// hue/sat/light are exactly what the design's colour wheel writes: angle and
// distance from the centre of the wheel, plus the brightness slider.
export const makeTheme = (h, s, l, dark) => {
  const base = dark ? DARK : LIGHT;

  // The accent the user picked, then made legible: darkened until white text
  // on it clears AA, and in dark mode lifted until it separates from the
  // background too.
  const picked = hslToHex(h, s, l);
  let safe = contrastSafe(picked);
  if (dark) {
    const c = hexToHsl(safe.hex);
    let l = c.l;
    while (l < 62 && (luminance(hslToHex(c.h, c.s, l)) + 0.05) / (luminance(base.bg) + 0.05) < 3.2) l += 1;
    if (l !== c.l) {
      const lifted = hslToHex(c.h, c.s, l);
      safe = { hex: lifted, adjusted: true, ratio: ratioOnWhiteText(lifted) };
    }
  }

  const accent = safe.hex;

  return {
    ...base,
    accent,
    // `ink` is the older name the screens use for the pressable accent tone;
    // in this design that is simply the accent.
    ink: accent,
    onInk: ratioOnWhiteText(accent) >= 4.5 ? '#FFFFFF' : '#10131A',
    tagBg: base.chip,
    trackBg: base.line2,
    accentRatio: safe.ratio,
    accentAdjusted: safe.adjusted,
    picked,
    dark: !!dark,
  };
};

// Applies the theme as CSS custom properties on :root so plain CSS (and
// Leaflet's DOM, which lives outside React) can read them too.
export const applyThemeVars = (theme, accent) => {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme)) {
    if (typeof value === 'string') root.style.setProperty(`--t-${key}`, value);
  }
  root.style.setProperty('--accent', accent);
  root.style.setProperty('color-scheme', theme.dark ? 'dark' : 'light');
};

export const scoreColor = (v) => (
  v >= 4.3 ? { bg: '#DCFCE7', fg: GREEN }
    : v >= 3.6 ? { bg: '#FEF3C7', fg: AMBER }
      : { bg: 'rgba(194,51,77,.14)', fg: RED }
);

export const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
