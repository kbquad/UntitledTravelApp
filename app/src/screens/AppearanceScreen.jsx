import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import {
  SWATCHES, hexToHsl, hslToHex, contrastSafe,
} from '../theme';
import { ScreenHeader, Segmented } from '../components/ui';

// The design's colour wheel: angle is hue, distance from the centre is
// saturation, and the slider underneath is brightness. Everything the wheel
// writes lands in the store, so the whole app recolours live.
export default function AppearanceScreen({ t }) {
  const navigate = useNavigate();
  const hue = useStore((s) => s.hue);
  const sat = useStore((s) => s.sat);
  const light = useStore((s) => s.light);
  const dark = useStore((s) => s.dark);
  const setDark = useStore((s) => s.setDark);
  const setLight = useStore((s) => s.setLight);
  const setAccentHsl = useStore((s) => s.setAccentHsl);

  const dragging = useRef(false);

  // The exact shade the user picked, before the contrast rules adjust it. The
  // knob sits on this, so the wheel keeps showing their choice even when the
  // app paints with a darkened version.
  const picked = hslToHex(hue, sat, light);
  const safe = contrastSafe(picked);

  const pickFrom = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.width / 2;
    const cy = r.height / 2;
    const dx = e.clientX - r.left - cx;
    const dy = e.clientY - r.top - cy;
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (ang < 0) ang += 360;
    const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy) / cx);
    setAccentHsl({ hue: Math.round(ang), sat: Math.round(Math.min(100, dist * 118)) });
  };

  const knobRad = ((hue - 90) * Math.PI) / 180;
  const knobD = Math.min(1, sat / 118) * 50;

  return (
    <div className="screen" style={{ background: t.bg }}>
      <ScreenHeader title="Appearance" onBack={() => navigate('/settings')} t={t} />

      <div
        className="scroll enter"
        style={{
          padding: '10px 20px 0', paddingBottom: 'var(--scroll-pad-b)',
          display: 'flex', flexDirection: 'column', gap: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.sub }}>Mode</span>
          <Segmented
            t={t}
            value={dark ? 'dark' : 'light'}
            onPick={(v) => setDark(v === 'dark')}
            style={{ borderRadius: 16, border: `1px solid ${t.line}` }}
            options={[
              {
                id: 'light',
                label: 'Light',
                icon: (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={dark ? t.sub : t.accent} strokeWidth="2" strokeLinecap="round">
                    <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
                  </svg>
                ),
              },
              {
                id: 'dark',
                label: 'Dark',
                icon: (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={dark ? t.accent : t.sub} strokeWidth="2" strokeLinecap="round">
                    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
                  </svg>
                ),
              },
            ]}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.sub }}>Accent colour</span>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {SWATCHES.map((c) => {
              const on = picked.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={`Accent ${c}`}
                  onClick={() => { const h = hexToHsl(c); setAccentHsl({ hue: h.h, sat: h.s, light: h.l }); }}
                  style={{
                    width: 52, height: 52, borderRadius: 15, cursor: 'pointer', background: c,
                    border: `3px solid ${on ? t.text : 'transparent'}`,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)',
                  }}
                />
              );
            })}
          </div>

          <div style={{
            borderRadius: 20, background: t.card, border: `1px solid ${t.line}`, padding: 18,
            display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center',
          }}
          >
            <div
              onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); pickFrom(e); }}
              onPointerMove={(e) => { if (dragging.current) pickFrom(e); }}
              onPointerUp={() => { dragging.current = false; }}
              onPointerLeave={() => { dragging.current = false; }}
              role="slider"
              tabIndex={0}
              aria-label="Accent colour wheel"
              aria-valuenow={hue}
              aria-valuemin={0}
              aria-valuemax={359}
              style={{
                position: 'relative', width: 214, height: 214, borderRadius: '50%',
                cursor: 'crosshair', touchAction: 'none',
                background: 'conic-gradient(from 90deg,hsl(0 100% 50%),hsl(60 100% 50%),hsl(120 100% 50%),hsl(180 100% 50%),hsl(240 100% 50%),hsl(300 100% 50%),hsl(360 100% 50%))',
                boxShadow: '0 2px 14px rgba(0,0,0,.14)',
              }}
            >
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
                background: `radial-gradient(circle at 50% 50%, ${t.card} 0%, rgba(255,255,255,0) 68%)`,
              }}
              />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
                background: '#000', opacity: Math.max(0, (50 - light) / 100),
              }}
              />
              <div style={{
                position: 'absolute',
                left: `${(50 + Math.cos(knobRad) * knobD).toFixed(1)}%`,
                top: `${(50 + Math.sin(knobRad) * knobD).toFixed(1)}%`,
                width: 30, height: 30, margin: '-15px 0 0 -15px', borderRadius: '50%',
                pointerEvents: 'none', background: picked, border: '4px solid #fff',
                boxShadow: '0 2px 8px rgba(0,0,0,.35)',
              }}
              />
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Brightness</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.sub }}>{light}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={65}
                step={1}
                value={light}
                onChange={(e) => setLight(Number(e.target.value))}
                aria-label="Brightness"
                style={{ width: '100%', height: 34, accentColor: t.accent }}
              />
            </div>

            <div style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              paddingTop: 14, borderTop: `1px solid ${t.line}`,
            }}
            >
              <span style={{
                width: 46, height: 46, flex: 'none', borderRadius: 14, background: t.accent,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)',
              }}
              />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Custom colour</span>
                <span style={{ fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace', color: t.body }}>
                  {t.accent.toUpperCase()}
                </span>
              </span>
              <input
                type="color"
                value={picked}
                onChange={(e) => { const h = hexToHsl(e.target.value); setAccentHsl({ hue: h.h, sat: h.s, light: h.l }); }}
                aria-label="Enter an exact colour"
                style={{ width: 44, height: 44, border: 0, background: 'none', padding: 0, cursor: 'pointer' }}
              />
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: t.sub }}>
            {safe.adjusted || t.accentAdjusted
              ? `Adjusted to ${t.accent.toUpperCase()} so button text and the accent itself clear WCAG AA (${t.accentRatio.toFixed(1)}:1). Your picked shade stays on the wheel.`
              : `White text on this accent measures ${t.accentRatio.toFixed(1)}:1 — clears WCAG AA.`}
          </p>
        </div>
      </div>
    </div>
  );
}
