import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useDataStore } from '../dataStore';
import { stars } from '../theme';
import { relativeTime } from '../utils/time';
import { FEATURES } from '../data/locations';
import { Pill, PrimaryButton } from '../components/ui';
import { DemoBanner } from '../components/Status';

const TRAVEL_PRESETS = [
  { id: 'family', label: 'Family', hint: 'Kids on board — changing tables, family rooms' },
  { id: 'van', label: 'Van life', hint: 'Long hauls — showers, height-safe parking' },
  { id: 'access', label: 'Accessible', hint: 'Step-free, wide doors, grab rails' },
];

// The design's "Your travel profile". Reached from onboarding and from
// Settings, so it doubles as the edit screen.
export default function ProfileScreen({ t }) {
  const navigate = useNavigate();
  const displayName = useStore((s) => s.displayName);
  const setDisplayName = useStore((s) => s.setDisplayName);
  const travelPreset = useStore((s) => s.travelPreset);
  const setTravelPreset = useStore((s) => s.setTravelPreset);
  const filters = useStore((s) => s.filters);
  const toggleFilter = useStore((s) => s.toggleFilter);

  const myReviews = useDataStore((s) => s.myReviews);
  const loadProfile = useDataStore((s) => s.loadProfile);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  return (
    <div className="screen" style={{ background: t.bg }}>
      <div
        className="scroll enter"
        style={{
          padding: '8px 20px 0', paddingTop: 'calc(8px + var(--safe-t))',
          paddingBottom: 'var(--scroll-pad-b)', display: 'flex', flexDirection: 'column', gap: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: t.accent,
          }}
          >
            Your profile
          </span>
          <h2 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em', color: t.text }}>
            Your travel profile
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: t.body }}>
            We use this to rank stops and pre-tick the filters that matter to you.
          </p>
        </div>

        <DemoBanner t={t} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 76, height: 76, borderRadius: '50%', background: t.accent, color: t.onInk,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800, flex: 'none',
          }}
          >
            {initials(displayName || 'A local')}
          </div>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: t.body }}>
            Your initials stand in for a photo — nothing is uploaded anywhere.
          </span>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
            placeholder="Maya Ellison"
            style={{
              minHeight: 52, borderRadius: 14, border: `1.5px solid ${t.line2}`,
              background: t.card, padding: '0 16px', fontSize: 16, fontWeight: 500,
              color: t.text, outline: 'none',
            }}
          />
          <span style={{ fontSize: 12, color: t.sub }}>
            Only attached to reviews you post. Leave it blank to stay anonymous.
          </span>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>How do you travel?</span>
          {TRAVEL_PRESETS.map((p) => {
            const on = travelPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setTravelPreset(on ? null : p.id)}
                style={{
                  width: '100%', minHeight: 66, padding: '14px 16px', borderRadius: 16,
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12, background: t.card,
                  border: `1.5px solid ${on ? t.accent : t.line}`, textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{p.label}</span>
                  <span style={{ fontSize: 13, color: t.body }}>{p.hint}</span>
                </span>
                <span style={{
                  width: 22, height: 22, flex: 'none', borderRadius: '50%',
                  border: `2px solid ${on ? t.accent : t.line3}`,
                  background: on ? `radial-gradient(circle, ${t.accent} 0 5px, ${t.card} 5px)` : t.card,
                }}
                />
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Facilities that matter to you</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FEATURES.map((f) => (
              <Pill
                key={f.key}
                label={f.label}
                active={!!filters[f.key]}
                t={t}
                onClick={() => toggleFilter(f.key)}
              />
            ))}
          </div>
          <span style={{ fontSize: 12, lineHeight: 1.5, color: t.sub }}>
            These are the same filters the Stops list uses, so anything ticked here follows you there.
          </span>
        </div>

        <PrimaryButton t={t} onClick={() => navigate('/')}>Continue</PrimaryButton>

        {myReviews.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Your reviews</span>
            {myReviews.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(`/washroom/${r.washroomId}`)}
                style={{
                  textAlign: 'left', padding: '15px 16px', borderRadius: 16, background: t.card,
                  border: `1px solid ${t.line}`, cursor: 'pointer', display: 'flex',
                  flexDirection: 'column', gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{r.washroomName}</span>
                  <span style={{ fontSize: 12.5, color: t.accent, flex: 'none' }}>{stars(r.rating)}</span>
                </div>
                {r.body && <span style={{ fontSize: 13, lineHeight: 1.5, color: t.body }}>{r.body}</span>}
                <span style={{ fontSize: 11.5, color: t.sub }}>{relativeTime(r.createdAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const initials = (name) => (
  name === 'A local'
    ? 'AL'
    : name.split(' ').filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase() || 'A'
);
