import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useToastStore } from '../toastStore';
import { routeOptions as fetchRouteOptions, describeOptions } from '../lib/routing';
import { formatDistance, formatDuration } from '../utils/geo';
import { CATEGORIES } from '../data/locations';
import {
  Pill, PrimaryButton, SecondaryButton, Toggle,
} from '../components/ui';
import PlaceInput from '../components/PlaceInput';

// Plans a real route between two places — geocoded through Nominatim, routed
// through OSRM — laid out as the design's timeline card.
export default function RouteScreen({ t }) {
  const navigate = useNavigate();
  const flash = useToastStore((s) => s.flash);
  const units = useStore((s) => s.units);

  const tripFrom = useStore((s) => s.tripFrom);
  const tripTo = useStore((s) => s.tripTo);
  const tripVia = useStore((s) => s.tripVia);
  const tripCategories = useStore((s) => s.tripCategories);
  const activeRoute = useStore((s) => s.activeRoute);

  const setTripFrom = useStore((s) => s.setTripFrom);
  const setTripTo = useStore((s) => s.setTripTo);
  const swapTripEnds = useStore((s) => s.swapTripEnds);
  const removeTripVia = useStore((s) => s.removeTripVia);
  const toggleTripCategory = useStore((s) => s.toggleTripCategory);
  const setActiveRoute = useStore((s) => s.setActiveRoute);
  const addTrip = useStore((s) => s.addTrip);

  const [addingVia, setAddingVia] = useState(false);
  const [loading, setLoading] = useState(false);
  const [share, setShare] = useState(false);
  const [options, setOptions] = useState([]);

  const ready = !!(tripFrom && tripTo);

  useEffect(() => {
    if (!ready) { setActiveRoute(null); setOptions([]); return undefined; }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    fetchRouteOptions([tripFrom, ...tripVia, tripTo], { signal: controller.signal }).then((rs) => {
      if (cancelled) return;
      const described = describeOptions(rs, units === 'Metric' ? 'km' : 'mi');
      setOptions(described);
      setActiveRoute(described[0]);
      setLoading(false);
      if (described[0].source === 'fallback') {
        flash('Couldn’t reach the live router — showing an estimated straight-line distance.');
      }
    });
    return () => { cancelled = true; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tripFrom, tripTo, tripVia, units]);

  const startDrive = () => {
    if (!ready) { flash('Add a starting point and destination first.'); return; }
    // Saying "add a destination" while the router is mid-flight sends people
    // looking at fields they have already filled in.
    if (!activeRoute) { flash('Still working out the route — one moment.'); return; }
    addTrip({
      fromLabel: tripFrom.label,
      toLabel: tripTo.label,
      from: { lat: tripFrom.lat, lng: tripFrom.lng },
      to: { lat: tripTo.lat, lng: tripTo.lng },
      via: tripVia.map((v) => ({ lat: v.lat, lng: v.lng, label: v.label })),
      distanceM: activeRoute.distanceM,
      durationS: activeRoute.durationS,
    });
    navigate('/drive');
  };

  return (
    <div className="screen" style={{ background: t.bg }}>
      <div
        className="scroll enter"
        style={{
          padding: '8px 20px 0', paddingTop: 'calc(8px + var(--safe-t))',
          paddingBottom: 'var(--scroll-pad-b)', display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', color: t.text }}>
          Plan your route
        </h2>

        <div style={{
          borderRadius: 20, background: t.card, border: `1px solid ${t.line}`,
          padding: 16, display: 'flex', gap: 14,
        }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 22 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', border: `3px solid ${t.accent}` }} />
            <span style={{
              flex: 1, width: 2, minHeight: 30,
              background: `repeating-linear-gradient(180deg, ${t.line3} 0 4px, transparent 4px 8px)`,
            }}
            />
            <span style={{ width: 11, height: 11, borderRadius: 2, background: t.hero }} />
            <span style={{ height: 22 }} />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
                textTransform: 'uppercase', color: t.sub,
              }}
              >
                Starting point
              </span>
              <PlaceInput t={t} value={tripFrom} placeholder="Enter a starting point" ariaLabel="Starting point" onSelect={setTripFrom} />
            </label>

            {tripVia.map((v, i) => (
              <div key={`${v.lat}-${v.lng}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1, minHeight: 40, borderRadius: 11, background: t.field,
                  border: `1px solid ${t.line}`, display: 'flex', alignItems: 'center',
                  padding: '0 12px', fontSize: 12.5, color: t.text, overflow: 'hidden',
                  whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}
                >
                  {v.label}
                </div>
                <button
                  type="button"
                  aria-label="Remove via stop"
                  onClick={() => removeTripVia(i)}
                  style={{
                    width: 32, height: 32, flex: 'none', borderRadius: 10,
                    border: `1px solid ${t.line2}`, background: t.card, cursor: 'pointer',
                    color: t.sub, fontSize: 15, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
                textTransform: 'uppercase', color: t.sub,
              }}
              >
                Destination
              </span>
              <PlaceInput t={t} value={tripTo} placeholder="Where are you heading?" ariaLabel="Destination" onSelect={setTripTo} />
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SecondaryButton t={t} onClick={swapTripEnds}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2" strokeLinecap="round">
                  <path d="M7 4v13M7 20l-3-3M7 20l3-3M17 20V7M17 4l-3 3M17 4l3 3" />
                </svg>
                Swap
              </SecondaryButton>
              <SecondaryButton t={t} onClick={() => setAddingVia((v) => !v)}>
                + Add a via stop
              </SecondaryButton>
            </div>

            {addingVia && (
              <PlaceInput
                t={t}
                placeholder="Search a place to route through"
                ariaLabel="Via stop"
                autoFocus
                onSelect={(r) => { useStore.getState().addTripVia(r); setAddingVia(false); }}
              />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.sub }}>Stops to plan in</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => (
              <Pill
                key={c.id}
                label={c.label}
                active={tripCategories.includes(c.id)}
                t={t}
                onClick={() => toggleTripCategory(c.id)}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.sub }}>
            {options.length > 1 ? 'Route options' : 'Route'}
          </span>

          {!ready && (
            <div style={{
              borderRadius: 16, background: t.card, border: `1px solid ${t.line}`,
              padding: '15px 16px', minHeight: 72, display: 'flex', alignItems: 'center',
            }}
            >
              <span style={{ fontSize: 13, lineHeight: 1.5, color: t.body }}>
                Pick a starting point and a destination to see the route.
              </span>
            </div>
          )}

          {ready && loading && (
            <div style={{
              borderRadius: 16, background: t.card, border: `1px solid ${t.line}`,
              padding: '15px 16px', minHeight: 72, display: 'flex', alignItems: 'center',
            }}
            >
              <span style={{ fontSize: 13, color: t.body }}>Routing…</span>
            </div>
          )}

          {/* One card per route the router offered, the way the design lays
              them out. Names and details come from comparing the options to
              each other — OSRM returns geometry and numbers, not labels. */}
          {ready && !loading && options.map((o) => {
            const on = activeRoute?.id === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setActiveRoute(o)}
                aria-pressed={on}
                style={{
                  width: '100%', minHeight: 72, padding: '15px 16px', borderRadius: 16,
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12, textAlign: 'left',
                  background: t.card, border: `1.5px solid ${on ? t.accent : t.line}`,
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{o.name}</span>
                  <span style={{ fontSize: 13, color: t.body }}>
                    {formatDistance(o.distanceM, units)}
                    {o.detail ? ` · ${o.detail}` : ''}
                  </span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: t.accent, flex: 'none' }}>
                  {formatDuration(o.durationS)}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderRadius: 16, background: t.card, border: `1px solid ${t.line}`, padding: '14px 16px',
        }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Share with co-driver</span>
            <span style={{ fontSize: 13, color: t.body }}>
              {share ? 'Anyone with the link can see this route' : 'Off'}
            </span>
          </div>
          <Toggle
            on={share}
            onClick={() => {
              setShare((v) => !v);
              flash(share ? 'Sharing off.' : 'Sharing isn’t wired up yet — nothing has been shared.');
            }}
            t={t}
            label="Share with co-driver"
          />
        </div>

        <PrimaryButton t={t} onClick={startDrive} disabled={!ready || !activeRoute || loading}>
          {ready && loading ? 'Routing…' : 'Preview the drive'}
        </PrimaryButton>
      </div>
    </div>
  );
}
