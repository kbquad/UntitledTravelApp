// The design's shared controls. Sizes, radii and weights are taken from
// Roadside.dc.html rather than re-invented, so screens composed from these
// come out matching the mock without each one restating the numbers.

// Filter / selection pill — the design's `pill(active, ac)`.
export const Pill = ({
  label, active, onClick, t, style,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flex: 'none', minHeight: 40, padding: '0 14px', borderRadius: 11, cursor: 'pointer',
      whiteSpace: 'nowrap', fontSize: 13.5, fontWeight: 600,
      border: `1.5px solid ${active ? t.accent : t.line2}`,
      background: active ? t.accent : t.card,
      color: active ? t.onInk : t.body,
      ...style,
    }}
  >
    {label}
  </button>
);

// Kept as an alias while older screens still import Chip.
export const Chip = Pill;

// The design's toggle: 54×32 track, 26px knob, justify-content doing the work.
export const Toggle = ({ on, onClick, t, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-pressed={!!on}
    style={{
      width: 54, height: 32, flex: 'none', borderRadius: 16, border: 0, cursor: 'pointer',
      padding: 3, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
      background: on ? t.accent : t.line3, transition: 'background .2s',
    }}
  >
    <span style={{
      width: 26, height: 26, borderRadius: '50%', background: '#FCFCFD',
      boxShadow: '0 1px 3px rgba(0,0,0,.3)', display: 'block',
    }}
    />
  </button>
);

// Non-interactive version, for rows where the whole row is the button.
export const ToggleTrack = ({ on, t }) => (
  <span style={{
    width: 54, height: 32, flex: 'none', borderRadius: 16, padding: 3, display: 'flex',
    justifyContent: on ? 'flex-end' : 'flex-start',
    background: on ? t.accent : t.line3, transition: 'background .2s',
  }}
  >
    <span style={{
      width: 26, height: 26, borderRadius: '50%', background: '#FCFCFD',
      boxShadow: '0 1px 3px rgba(0,0,0,.3)', display: 'block',
    }}
    />
  </span>
);

// One colour per stop kind, from the design's `badge(type, ac)`. Toilets take
// the app's accent; the rest are fixed so the categories stay distinguishable
// whatever accent is picked.
export const categoryColor = (category, accent) => ({
  toilet: accent, food: '#B45309', fuel: '#1F5FD0', rest: '#5B7C4A',
}[category] || accent);

export const CategoryBadge = ({ category, label, t, style }) => {
  const c = categoryColor(category, t.accent);
  return (
    <span style={{
      padding: '5px 10px', borderRadius: 9, fontSize: 11.5, fontWeight: 700,
      letterSpacing: '.03em', whiteSpace: 'nowrap', color: c,
      background: `color-mix(in oklab, ${c} 13%, ${t.card})`,
      ...style,
    }}
    >
      {label}
    </span>
  );
};

// The design's segmented control: a chip-coloured trough with the selected
// item lifted out of it on a card.
export const Segmented = ({
  options, value, onPick, t, style,
}) => (
  <div style={{
    display: 'flex', gap: 6, padding: 5, borderRadius: 14, background: t.chip, ...style,
  }}
  >
    {options.map((o) => {
      const on = value === o.id;
      return (
        <button
          key={o.id}
          type="button"
          onClick={() => onPick(o.id)}
          style={{
            flex: 1, minHeight: 44, borderRadius: 11, border: 0, cursor: 'pointer',
            fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: on ? t.card : 'transparent',
            color: on ? t.text : t.body,
            boxShadow: on ? '0 1px 4px rgba(0,0,0,.16)' : 'none',
          }}
        >
          {o.icon}
          {o.label}
        </button>
      );
    })}
  </div>
);

// Round 44px control used for back / settings / save throughout the design.
export const RoundButton = ({
  children, onClick, t, label, style,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    style={{
      width: 44, height: 44, flex: 'none', borderRadius: '50%', cursor: 'pointer',
      border: `1px solid ${t.line2}`, background: t.card,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}
  >
    {children}
  </button>
);

// Back chevron + title, the header every secondary screen in the design uses.
export const ScreenHeader = ({
  title, onBack, t, right,
}) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px 4px',
    paddingTop: 'calc(8px + var(--safe-t))',
  }}
  >
    {onBack && (
      <RoundButton onClick={onBack} t={t} label="Back">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.2"><path d="M15 5l-7 7 7 7" /></svg>
      </RoundButton>
    )}
    <h2 style={{
      margin: 0, flex: 1, fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', color: t.text,
    }}
    >
      {title}
    </h2>
    {right}
  </div>
);

// The design's primary action: full width, 54 tall, accent, 16px radius.
export const PrimaryButton = ({
  children, onClick, t, disabled, style,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      width: '100%', minHeight: 54, borderRadius: 16, border: 0,
      background: disabled ? t.line2 : t.accent,
      color: disabled ? t.sub : t.onInk,
      fontSize: 16, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      ...style,
    }}
  >
    {children}
  </button>
);

// Bordered secondary action.
export const SecondaryButton = ({
  children, onClick, t, style,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      minHeight: 40, padding: '0 13px', borderRadius: 11, cursor: 'pointer',
      border: `1.5px solid ${t.line2}`, background: t.card,
      fontSize: 13, fontWeight: 600, color: t.text,
      display: 'flex', alignItems: 'center', gap: 7,
      ...style,
    }}
  >
    {children}
  </button>
);

// One of the three figures on the stop detail screen.
export const StatCard = ({
  value, label, t, accent,
}) => (
  <div style={{
    flex: 1, borderRadius: 16, background: t.card, border: `1px solid ${t.line}`,
    padding: 14, display: 'flex', flexDirection: 'column', gap: 3,
  }}
  >
    <span style={{ fontSize: 22, fontWeight: 800, color: accent ? t.accent : t.text }}>{value}</span>
    <span style={{ fontSize: 12, fontWeight: 600, color: t.sub }}>{label}</span>
  </div>
);

// An unreviewed stop shows "New" rather than a score, so nothing unrated ever
// reads as badly rated.
export const ScoreBadge = ({ washroom, t, size = 44 }) => (
  <span style={{
    flex: 'none', width: size, height: size, borderRadius: size * 0.32,
    background: washroom.rated ? washroom.scoreBg : t.chip,
    color: washroom.rated ? washroom.scoreFg : t.sub,
    fontSize: washroom.rated ? size * 0.34 : size * 0.24,
    fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}
  >
    {washroom.rated ? washroom.scoreText : 'New'}
  </span>
);

export const IconButton = ({
  children, onClick, t, size = 44, style,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: size, height: size, borderRadius: '50%', background: t.card,
      border: `1px solid ${t.line2}`, cursor: 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center', flex: 'none',
      ...style,
    }}
  >
    {children}
  </button>
);
