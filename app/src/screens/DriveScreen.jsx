import {
  lazy, Suspense, useEffect, useMemo, useRef, useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useDataStore } from '../dataStore';
import { useToastStore } from '../toastStore';
import {
  cumulativeDistances, pointAtFraction, distanceToPath, fractionOfNearestPoint,
} from '../lib/routing';
import { formatDistance, formatDuration } from '../utils/geo';
import { decorateWashroom } from '../utils/decorate';

// Inlined rather than imported from lib/imagery so that module stays inside
// the lazily-loaded 3D chunk.
const IMAGERY_CREDIT = 'Imagery © Esri, Maxar, Earthstar Geographics';
import { RoundButton, PrimaryButton } from '../components/ui';
// three.js is most of a megabyte; nobody should download it to look at a list
// of washrooms. It arrives when the drive preview does.
const DriveScene3D = lazy(() => import('../components/DriveScene3D'));

// How close a known stop has to be to the route line to count as "along the
// way" rather than a detour worth mentioning separately.
const CORRIDOR_M = 4000;
// The whole route plays out over this many real seconds, however long the
// drive actually is — a preview, like the design's, not a real-time sim.
const SIM_SECONDS = 75;

export default function DriveScreen({ t }) {
  const navigate = useNavigate();
  const flash = useToastStore((s) => s.flash);
  const units = useStore((s) => s.units);
  const activeRoute = useStore((s) => s.activeRoute);
  const tripFrom = useStore((s) => s.tripFrom);
  const tripTo = useStore((s) => s.tripTo);
  const tripCategories = useStore((s) => s.tripCategories);

  const washrooms = useDataStore((s) => s.washrooms);
  const loadRegion = useDataStore((s) => s.loadRegion);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sceneStatus, setSceneStatus] = useState(null);
  const arrivedRef = useRef(false);

  const path = activeRoute?.path ?? null;
  const cum = useMemo(() => (path ? cumulativeDistances(path) : null), [path]);

  // Cover the corridor by loading the regions around several points spread
  // along the route, reusing the same per-cell cache the rest of the app fills.
  useEffect(() => {
    if (!path || !cum) return;
    const SAMPLES = 6;
    for (let i = 0; i <= SAMPLES; i += 1) {
      const p = pointAtFraction(path, cum, i / SAMPLES);
      loadRegion(p.lat, p.lng);
    }
  }, [path, cum, loadRegion]);

  useEffect(() => {
    if (!playing) return undefined;
    const stepMs = 200;
    const stepFrac = stepMs / (SIM_SECONDS * 1000);
    const id = setInterval(() => setProgress((p) => Math.min(1, p + stepFrac)), stepMs);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (progress >= 1 && !arrivedRef.current) {
      arrivedRef.current = true;
      setPlaying(false);
      flash(`Arrived at ${tripTo?.label?.split(',')[0] ?? 'your destination'}.`);
    }
    if (progress < 1) arrivedRef.current = false;
  }, [progress, tripTo, flash]);

  const routeStops = useMemo(() => {
    if (!path || !cum || !activeRoute) return [];
    return washrooms
      .filter((w) => tripCategories.includes(w.category || 'toilet'))
      .map((w) => ({ w, offRouteM: distanceToPath(w, path), frac: fractionOfNearestPoint(w, path, cum) }))
      .filter((x) => x.offRouteM <= CORRIDOR_M)
      .sort((a, b) => a.frac - b.frac)
      .slice(0, 8)
      .map(({ w, offRouteM, frac }) => ({
        ...decorateWashroom(w, offRouteM, units),
        atFraction: frac,
        etaS: frac * (activeRoute.durationS || 0),
      }));
  }, [washrooms, path, cum, tripCategories, units, activeRoute]);

  if (!activeRoute || !path) {
    return (
      <div
        className="screen"
        style={{
          background: t.bg, alignItems: 'center', justifyContent: 'center',
          gap: 14, padding: 30, textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>No route to preview yet</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: t.body, maxWidth: 260 }}>
          Plan a route with a starting point and a destination first.
        </div>
        <PrimaryButton t={t} onClick={() => navigate('/plan')} style={{ maxWidth: 220, marginTop: 6 }}>
          Plan a route
        </PrimaryButton>
      </div>
    );
  }

  const doneM = progress * activeRoute.distanceM;
  const remainingS = (1 - progress) * activeRoute.durationS;
  const etaLabel = new Date(Date.now() + remainingS * 1000)
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fuelPct = Math.max(12, Math.round(100 - progress * 68));
  const nextStop = routeStops.find((s) => s.atFraction > progress);

  return (
    <div className="screen enter" style={{ background: t.bg }}>
      {/* The road ahead, in 3D: the real routed line on real ground. */}
      <div style={{ position: 'relative', height: 296, flex: 'none', overflow: 'hidden', background: t.scene }}>
        <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: t.scene }} />}>
          <DriveScene3D path={path} progress={progress} stops={routeStops} t={t} onStatus={setSceneStatus} />
        </Suspense>

        {sceneStatus?.source === 'flat' && (
          <span style={{
            position: 'absolute', left: 16, bottom: 62, fontSize: 10.5, fontWeight: 600,
            letterSpacing: '.04em', color: '#fff', opacity: 0.75, textShadow: '0 1px 3px rgba(0,0,0,.6)',
          }}
          >
            Flat ground — elevation data unavailable
          </span>
        )}
        {/* Esri's terms require the credit wherever the imagery is shown. */}
        {sceneStatus?.imagery && (
          <span style={{
            position: 'absolute', right: 10, bottom: 4, fontSize: 8.5, fontWeight: 500,
            color: '#fff', opacity: 0.6, textShadow: '0 1px 2px rgba(0,0,0,.7)',
          }}
          >
            {IMAGERY_CREDIT}
          </span>
        )}
        {sceneStatus?.source === 'points' && (
          <span style={{
            position: 'absolute', left: 16, bottom: 62, fontSize: 10.5, fontWeight: 600,
            letterSpacing: '.04em', color: '#fff', opacity: 0.75, textShadow: '0 1px 3px rgba(0,0,0,.6)',
          }}
          >
            Low-detail terrain — elevation tiles unavailable
          </span>
        )}

        <div style={{
          position: 'absolute', top: 'calc(14px + var(--safe-t))', left: 16, right: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
        >
          <RoundButton onClick={() => navigate(-1)} t={t} label="Back" style={{ border: 0, background: t.glass }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.2"><path d="M15 5l-7 7 7 7" /></svg>
          </RoundButton>
          <span style={{
            padding: '9px 14px', borderRadius: 12, background: 'rgba(11,13,16,.78)',
            color: '#fff', fontSize: 13, fontWeight: 700,
          }}
          >
            ETA {etaLabel} · {formatDuration(remainingS)} left
          </span>
        </div>

        <div style={{ position: 'absolute', left: 16, bottom: 14, right: 16, display: 'flex', gap: 8 }}>
          <div style={{
            flex: 1, borderRadius: 14, background: t.glass, padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0,
          }}
          >
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
              textTransform: 'uppercase', color: t.sub,
            }}
            >
              Next stop
            </span>
            <span style={{
              fontSize: 14, fontWeight: 700, color: t.text, overflow: 'hidden',
              whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}
            >
              {nextStop ? nextStop.name : tripTo?.label?.split(',')[0] ?? 'Destination'}
            </span>
          </div>
          <div style={{
            borderRadius: 14, background: t.glass, padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 1, minWidth: 86,
          }}
          >
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
              textTransform: 'uppercase', color: t.sub,
            }}
            >
              Fuel
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{fuelPct}%</span>
          </div>
        </div>
      </div>

      <div
        className="scroll"
        style={{ padding: '18px 20px 30px', display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            aria-label={playing ? 'Pause simulation' : 'Play simulation'}
            onClick={() => setPlaying((p) => !p)}
            style={{
              width: 52, height: 52, flex: 'none', borderRadius: '50%', border: 0,
              background: t.accent, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}
          >
            {playing ? (
              <span style={{ display: 'flex', gap: 5 }}>
                <span style={{ width: 5, height: 16, background: t.onInk, display: 'block' }} />
                <span style={{ width: 5, height: 16, background: t.onInk, display: 'block' }} />
              </span>
            ) : (
              <span style={{
                width: 0, height: 0, marginLeft: 4, display: 'block',
                borderLeft: `15px solid ${t.onInk}`,
                borderTop: '10px solid transparent', borderBottom: '10px solid transparent',
              }}
              />
            )}
          </button>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ height: 8, borderRadius: 4, background: t.line2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, background: t.accent,
                width: `${(progress * 100).toFixed(1)}%`, transition: 'width .18s linear',
              }}
              />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 12,
              fontWeight: 600, color: t.body,
            }}
            >
              <span>{formatDistance(doneM, units)} done</span>
              <span>{formatDistance(activeRoute.distanceM, units)} total</span>
            </div>
          </div>
        </div>

        {activeRoute.source !== 'osrm' && (
          <div style={{
            fontSize: 12.5, lineHeight: 1.5, color: t.body, padding: '11px 14px',
            borderRadius: 13, background: t.chip,
          }}
          >
            Showing an estimated straight-line route — the live router couldn’t be reached.
          </div>
        )}

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.sub, marginBottom: 12 }}>Route strip</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <StripRow
              t={t}
              name={tripFrom?.label?.split(',')[0] ?? 'Start'}
              meta="Departure"
              at="now"
              passed
              last={routeStops.length === 0}
            />
            {routeStops.map((s) => (
              <StripRow
                key={s.id}
                t={t}
                name={s.name}
                meta={`${s.categoryLabel} · ${s.rated ? s.scoreText : 'New'} · ${formatDistance(s.dist, units)} off route`}
                passed={progress >= s.atFraction}
                at={new Date(Date.now() + s.etaS * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                onOpen={() => navigate(`/washroom/${s.id}`)}
              />
            ))}
            <StripRow
              t={t}
              name={tripTo?.label?.split(',')[0] ?? 'Destination'}
              meta={`Arrival · ${formatDistance(activeRoute.distanceM, units)} total`}
              passed={progress >= 1}
              at={etaLabel}
              last
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StripRow({
  t, name, meta, passed, at, onOpen, last,
}) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flex: 'none' }}>
        <span style={{
          width: 14, height: 14, flex: 'none', borderRadius: '50%',
          border: `3px solid ${passed ? t.accent : t.line3}`,
          background: passed ? t.accent : t.bg,
        }}
        />
        {!last && (
          <span style={{ flex: 1, width: 2, minHeight: 40, background: passed ? t.accent : t.line2 }} />
        )}
      </div>
      <div style={{ flex: 1, paddingBottom: 20, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{name}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.sub, whiteSpace: 'nowrap' }}>{at}</span>
        </div>
        <span style={{ fontSize: 13, color: t.body }}>{meta}</span>
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            style={{
              alignSelf: 'flex-start', minHeight: 38, padding: '0 14px', borderRadius: 11,
              border: `1.5px solid ${t.line2}`, background: t.card, fontSize: 13,
              fontWeight: 600, color: t.text, cursor: 'pointer', marginTop: 2,
            }}
          >
            View facilities
          </button>
        )}
      </div>
    </div>
  );
}
