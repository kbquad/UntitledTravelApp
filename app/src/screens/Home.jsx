import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useDataStore } from '../dataStore';
import { useWashroomData } from '../hooks/useWashroomData';
import { formatDistance, formatDuration } from '../utils/geo';
import { RoundButton } from '../components/ui';
import { ErrorNote, DemoBanner } from '../components/Status';

// The four squares under the trip card. `d` is the design's icon path.
const ACTIONS = [
  { label: 'Find a stop', path: '/stops', d: 'M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0Z', extra: 'circle' },
  { label: 'Plan a route', path: '/plan', d: 'M4 19V7a3 3 0 0 1 3-3h6a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h11' },
  { label: 'Saved places', path: '/saved', d: 'M6 3h12v18l-6-4-6 4Z' },
  { label: 'Trip history', path: '/history', d: 'M12 7v5l3 2' , extra: 'clock' },
];

export default function Home({ t }) {
  const navigate = useNavigate();
  const units = useStore((s) => s.units);
  const displayName = useStore((s) => s.displayName);
  const tripFrom = useStore((s) => s.tripFrom);
  const tripTo = useStore((s) => s.tripTo);
  const activeRoute = useStore((s) => s.activeRoute);
  const trips = useStore((s) => s.trips);
  const breaksOn = useStore((s) => s.breaksOn);
  const breakHours = useStore((s) => s.breakHours);
  const loadRegion = useDataStore((s) => s.loadRegion);
  const {
    nearby, location, status, error,
  } = useWashroomData();

  const firstName = (displayName || 'traveller').split(' ')[0];

  // The hero shows the route being planned if there is one, else the last trip
  // planned, else an invitation to plan one. Nothing here is invented: a trip
  // card only appears once there is a real route behind it.
  const trip = useMemo(() => {
    if (tripFrom && tripTo && activeRoute) {
      return {
        title: `${tripFrom.label.split(',')[0]} → ${tripTo.label.split(',')[0]}`,
        distanceM: activeRoute.distanceM,
        durationS: activeRoute.durationS,
        stops: (useStore.getState().tripVia ?? []).length,
        live: true,
      };
    }
    const last = trips[0];
    if (last) {
      return {
        title: `${last.fromLabel?.split(',')[0]} → ${last.toLabel?.split(',')[0]}`,
        distanceM: last.distanceM,
        durationS: last.durationS,
        stops: last.via?.length ?? 0,
        live: false,
      };
    }
    return null;
  }, [tripFrom, tripTo, activeRoute, trips]);

  return (
    <div className="screen" style={{ background: t.bg }}>
      <div
        className="scroll enter"
        style={{
          padding: '8px 20px 0', paddingTop: 'calc(8px + var(--safe-t))',
          paddingBottom: 'var(--scroll-pad-b)', display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.sub }}>{greeting()}</span>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', color: t.text }}>
              {firstName}
            </span>
          </div>
          <RoundButton onClick={() => navigate('/settings')} t={t} label="Settings">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
            </svg>
          </RoundButton>
        </div>

        <DemoBanner t={t} />
        {status === 'error' && (
          <ErrorNote t={t} message={error} onRetry={() => loadRegion(location.lat, location.lng, { force: true })} />
        )}

        {/* Next trip */}
        <div style={{
          borderRadius: 22, background: t.hero, padding: 20, display: 'flex',
          flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden',
        }}
        >
          <div style={{
            position: 'absolute', right: -40, top: -40, width: 160, height: 160,
            borderRadius: '50%', background: t.accent, opacity: 0.35, filter: 'blur(6px)',
          }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent }} />
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,.65)',
            }}
            >
              {trip?.live ? 'Next trip' : trip ? 'Last trip' : 'No trip planned'}
            </span>
          </div>

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.02em', color: '#fff' }}>
              {trip ? trip.title : 'Where to next?'}
            </span>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,.6)' }}>
              {trip ? 'Tap preview to drive it' : 'Plan a route to see it here'}
            </span>
          </div>

          {trip && (
            <div style={{
              position: 'relative', display: 'flex', gap: 22, paddingTop: 4,
              borderTop: '1px solid rgba(255,255,255,.12)',
            }}
            >
              {[
                [formatDuration(trip.durationS), 'Drive time'],
                [formatDistance(trip.distanceM, units), 'Distance'],
                [String(trip.stops), 'Via stops'],
              ].map(([value, label]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 12 }}>
                  <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>{value}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ position: 'relative', display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate(trip?.live ? '/drive' : '/plan')}
              style={{
                flex: 1, minHeight: 48, border: 0, borderRadius: 14, background: t.accent,
                color: t.onInk, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {trip?.live ? 'Preview drive' : 'Plan a route'}
            </button>
            {trip && (
              <button
                type="button"
                onClick={() => navigate('/plan')}
                style={{
                  minHeight: 48, padding: '0 18px', borderRadius: 14,
                  border: '1.5px solid rgba(255,255,255,.22)', background: 'transparent',
                  color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.sub }}>Quick actions</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ACTIONS.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => navigate(a.path)}
                style={{
                  minHeight: 88, borderRadius: 18, border: `1px solid ${t.line}`, background: t.card,
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  justifyContent: 'space-between', padding: 14, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 34, height: 34, borderRadius: 10, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: `color-mix(in oklab, ${t.accent} 14%, ${t.card})`,
                }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2">
                    <path d={a.d} />
                    {a.extra === 'circle' && <circle cx="12" cy="10" r="3" />}
                    {a.extra === 'clock' && <circle cx="12" cy="12" r="9" />}
                  </svg>
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {breaksOn && (
          <div style={{
            borderRadius: 18, border: `1.5px solid color-mix(in oklab, ${t.accent} 30%, ${t.card})`,
            background: `color-mix(in oklab, ${t.accent} 8%, ${t.card})`, padding: 16,
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}
          >
            <span style={{
              width: 32, height: 32, flex: 'none', borderRadius: '50%', background: t.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.onInk} strokeWidth="2.2">
                <path d="M12 8v4l2.5 2" /><circle cx="12" cy="12" r="9" />
              </svg>
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Break reminder is on</span>
              <span style={{ fontSize: 13, lineHeight: 1.45, color: t.body }}>
                We’ll suggest a stop every {breakHours} hours, matched to your facilities.
              </span>
            </div>
          </div>
        )}

        {nearby.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/stops')}
            style={{
              padding: '14px 16px', borderRadius: 16, background: t.card,
              border: `1px solid ${t.line}`, cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
              {nearby.length} stop{nearby.length === 1 ? '' : 's'} near {location.label}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
