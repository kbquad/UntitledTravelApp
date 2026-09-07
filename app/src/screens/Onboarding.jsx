import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useToastStore } from '../toastStore';
import { requestLocation } from '../lib/geolocation';

export default function Onboarding({ t }) {
  const navigate = useNavigate();
  const setOnboarded = useStore((s) => s.setOnboarded);
  const flash = useToastStore((s) => s.flash);
  const [locating, setLocating] = useState(false);

  // Granting location here is what makes "what's near me" work at all; the
  // app-wide watcher keeps it current afterwards.
  const start = async () => {
    if (locating) return;
    setLocating(true);
    const fix = await requestLocation();
    setLocating(false);
    setOnboarded(true);
    navigate('/profile');
    if (!fix) flash('No location yet — you can turn it on in Settings.');
  };

  const skip = () => { setOnboarded(true); navigate('/'); };

  return (
    <div className="screen" style={{ background: t.bg }}>
      <div
        className="enter"
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', padding: '0 28px 28px',
          paddingTop: 'var(--safe-t)', overflow: 'auto',
        }}
      >
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28,
        }}
        >
          <div style={{
            width: '100%', aspectRatio: '1 / 1', maxHeight: 300, borderRadius: 28,
            background: `linear-gradient(160deg, color-mix(in oklab, ${t.accent} 18%, ${t.card}), ${t.chip})`,
            border: `1px solid ${t.line}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', position: 'relative', overflow: 'hidden',
          }}
          >
            <div style={{
              position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: '130%', height: '58%', background: t.placeholder,
              clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
            }}
            />
            <div style={{
              position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: 6, height: '58%',
              background: 'repeating-linear-gradient(180deg, #fff 0 18px, transparent 18px 36px)',
            }}
            />
            <div style={{
              position: 'absolute', top: '26%', left: '50%', transform: 'translateX(-50%)',
              width: 64, height: 64, borderRadius: '50%', background: t.accent, opacity: 0.9,
            }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h1 style={{
              margin: 0, fontSize: 34, lineHeight: 1.06, fontWeight: 800,
              letterSpacing: '-.03em', color: t.text,
            }}
            >
              Every stop,<br />sorted before<br />you set off.
            </h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: t.body, maxWidth: 300 }}>
              Preview the whole drive, then find toilets, food and fuel that actually suit your crew.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 7 }}>
            <span style={{ width: 26, height: 6, borderRadius: 3, background: t.accent }} />
            <span style={{ width: 6, height: 6, borderRadius: 3, background: t.line3 }} />
            <span style={{ width: 6, height: 6, borderRadius: 3, background: t.line3 }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={start}
            disabled={locating}
            style={{
              width: '100%', minHeight: 54, border: 0, borderRadius: 16, background: t.accent,
              color: t.onInk, fontSize: 16, fontWeight: 700,
              cursor: locating ? 'progress' : 'pointer', opacity: locating ? 0.75 : 1,
            }}
          >
            {locating ? 'Finding you…' : 'Get started'}
          </button>
          <button
            type="button"
            onClick={skip}
            style={{
              width: '100%', minHeight: 54, border: 0, borderRadius: 16, background: 'transparent',
              color: t.body, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            I already have an account
          </button>
        </div>

        <p style={{
          margin: '4px 0 0', fontSize: 11.5, lineHeight: 1.55, color: t.sub, textAlign: 'center',
        }}
        >
          Your location never leaves your device and is forgotten when you close the app.
        </p>
      </div>
    </div>
  );
}
