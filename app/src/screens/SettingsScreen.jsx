import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useToastStore } from '../toastStore';
import { isLive } from '../lib/db';
import { Segmented, Toggle } from '../components/ui';

const PRESET_LABEL = { family: 'Family', van: 'Van life', access: 'Accessible' };

const SectionLabel = ({ t, children }) => (
  <span style={{ fontSize: 13, fontWeight: 700, color: t.sub }}>{children}</span>
);

const Card = ({ t, children, style }) => (
  <div style={{
    borderRadius: 16, background: t.card, border: `1px solid ${t.line}`,
    padding: '14px 16px', ...style,
  }}
  >
    {children}
  </div>
);

const Chevron = ({ t }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
);

export default function SettingsScreen({ t }) {
  const navigate = useNavigate();
  const flash = useToastStore((s) => s.flash);

  const displayName = useStore((s) => s.displayName);
  const travelPreset = useStore((s) => s.travelPreset);
  const units = useStore((s) => s.units);
  const setUnits = useStore((s) => s.setUnits);
  const dark = useStore((s) => s.dark);
  const bigText = useStore((s) => s.bigText);
  const toggleBigText = useStore((s) => s.toggleBigText);
  const breaksOn = useStore((s) => s.breaksOn);
  const toggleBreaks = useStore((s) => s.toggleBreaks);
  const breakHours = useStore((s) => s.breakHours);
  const setBreakHours = useStore((s) => s.setBreakHours);

  const name = displayName || 'A local';
  const presetLabel = travelPreset ? `${PRESET_LABEL[travelPreset]} traveller` : 'No travel profile yet';

  return (
    <div className="screen" style={{ background: t.bg }}>
      <div
        className="scroll enter"
        style={{
          padding: '8px 20px 0', paddingTop: 'calc(8px + var(--safe-t))',
          paddingBottom: 'var(--scroll-pad-b)', display: 'flex', flexDirection: 'column', gap: 22,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', color: t.text }}>
          Settings
        </h2>

        <button
          type="button"
          onClick={() => navigate('/profile')}
          style={{
            width: '100%', borderRadius: 20, background: t.card, border: `1px solid ${t.line}`,
            padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
            minHeight: 88, textAlign: 'left',
          }}
        >
          <span style={{
            width: 56, height: 56, flex: 'none', borderRadius: '50%', background: t.accent,
            color: t.onInk, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700,
          }}
          >
            {initials(name)}
          </span>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', color: t.text }}>{name}</span>
            <span style={{ fontSize: 13, color: t.body }}>{presetLabel} · edit profile</span>
          </span>
          <Chevron t={t} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel t={t}>Units</SectionLabel>
          <Card t={t} style={{ padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Distance</span>
              <span style={{ fontSize: 13, color: t.body }}>
                {units === 'Metric' ? 'Distances shown in kilometres' : 'Distances shown in miles'}
              </span>
            </div>
            <Segmented
              t={t}
              value={units}
              onPick={setUnits}
              options={[{ id: 'Imperial', label: 'Miles' }, { id: 'Metric', label: 'Kilometres' }]}
            />
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel t={t}>Display</SectionLabel>
          <button
            type="button"
            onClick={() => navigate('/appearance')}
            style={{
              width: '100%', minHeight: 64, borderRadius: 16, background: t.card,
              border: `1px solid ${t.line}`, padding: '14px 16px', display: 'flex',
              alignItems: 'center', gap: 13, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{
              width: 38, height: 38, flex: 'none', borderRadius: 11, background: t.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={t.onInk} strokeWidth="2">
                <path d="M12 3a9 9 0 1 0 0 18 3 3 0 0 0 0-6 3 3 0 0 1 0-6 3 3 0 0 0 0-6Z" />
              </svg>
            </span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Appearance</span>
              <span style={{ fontSize: 13, color: t.body }}>
                {dark ? 'Dark' : 'Light'} mode · {t.accent.toUpperCase()}
              </span>
            </span>
            <Chevron t={t} />
          </button>

          <Card t={t} style={{
            minHeight: 64, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12,
          }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Larger text</span>
              <span style={{ fontSize: 13, color: t.body }}>Boosts body copy across the app</span>
            </div>
            <Toggle on={bigText} onClick={toggleBigText} t={t} label="Larger text" />
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel t={t}>Comfort</SectionLabel>
          <Card t={t} style={{
            minHeight: 64, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12,
          }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Break reminders</span>
              <span style={{ fontSize: 13, color: t.body }}>Every {breakHours} hours</span>
            </div>
            <Toggle
              on={breaksOn}
              onClick={() => {
                toggleBreaks();
                flash(breaksOn ? 'Break reminders off.' : `We’ll nudge you every ${breakHours} hours.`);
              }}
              t={t}
              label="Break reminders"
            />
          </Card>

          {breaksOn && (
            <Card t={t} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Reminder interval</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: t.accent }}>{breakHours}h</span>
              </div>
              <input
                type="range"
                min={1}
                max={4}
                step={0.5}
                value={breakHours}
                onChange={(e) => setBreakHours(Number(e.target.value))}
                aria-label="Reminder interval"
                style={{ width: '100%', accentColor: t.accent, height: 32 }}
              />
            </Card>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel t={t}>About</SectionLabel>
          <Card t={t} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row t={t} label="Where stops come from" value="OSM" hint="OpenStreetMap contributors, plus places people add here" />
            <Row t={t} label="Account" value={isLive ? 'Anonymous' : 'Local'} hint={isLive ? 'No signup — this device has an anonymous session' : 'Demo mode — nothing leaves this browser'} />
          </Card>
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            style={{
              minHeight: 48, borderRadius: 14, border: `1.5px solid ${t.line2}`, background: t.card,
              fontSize: 14, fontWeight: 600, color: t.text, cursor: 'pointer',
            }}
          >
            Replay the intro
          </button>
        </div>
      </div>
    </div>
  );
}

const Row = ({ t, label, value, hint }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 14, color: t.text }}>{label}</span>
      {hint && <span style={{ fontSize: 12, lineHeight: 1.4, color: t.sub }}>{hint}</span>}
    </span>
    <span style={{ fontSize: 13, fontWeight: 600, color: t.sub, flex: 'none' }}>{value}</span>
  </div>
);

const initials = (name) => (
  name === 'A local'
    ? 'AL'
    : name.split(' ').filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase() || 'A'
);
