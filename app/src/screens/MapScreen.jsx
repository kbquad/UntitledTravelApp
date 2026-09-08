import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, Marker } from 'react-leaflet';
import MapReady from '../components/MapReady';
import BaseTiles from '../components/BaseTiles';
import { useStore } from '../store';
import { useToastStore } from '../toastStore';
import { useWashroomData, useCurrentLocation } from '../hooks/useWashroomData';
import { useDataStore } from '../dataStore';
import { requestLocation } from '../lib/geolocation';
import { CITIES, CANADA_VIEW, CATEGORIES, FEATURES } from '../data/locations';
import { distanceMetres, formatDistance } from '../utils/geo';
import { pinIcon, youAreHereIcon } from '../utils/mapIcons';
import { Pill, CategoryBadge, RoundButton } from '../components/ui';

// The full map. Filtering by facility happens here rather than behind a
// modal, because "a washroom with a changing table, near me" is the whole
// question this screen exists to answer — and tapping a pin now says what
// that stop actually has.
export default function MapScreen({ t }) {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const flash = useToastStore((s) => s.flash);
  const dark = useStore((s) => s.dark);
  const saved = useStore((s) => s.saved);
  const units = useStore((s) => s.units);
  const categoryFilter = useStore((s) => s.categoryFilter);
  const setCategoryFilter = useStore((s) => s.setCategoryFilter);
  const filters = useStore((s) => s.filters);
  const toggleFilter = useStore((s) => s.toggleFilter);

  const { mapPool } = useWashroomData();
  const here = useCurrentLocation();
  const loadRegion = useDataStore((s) => s.loadRegion);

  const [map, setMap] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tileTrouble, setTileTrouble] = useState(false);
  const [credit, setCredit] = useState('');
  const [following, setFollowing] = useState(true);
  const [recentring, setRecentring] = useState(false);
  const onReady = useCallback((m) => setMap(m), []);
  const flownForState = useRef(false);
  const followedFrom = useRef(null);

  useEffect(() => {
    if (!map || flownForState.current) return;
    flownForState.current = true;
    const flyTo = routerLocation.state?.flyTo;
    if (flyTo) {
      setFollowing(false);
      map.flyTo([flyTo.lat, flyTo.lng], 13, { duration: 1 });
    }
  }, [map, routerLocation.state]);

  useEffect(() => {
    if (!map || !following || !here.fromDevice) return;
    const last = followedFrom.current;
    const moved = !last || distanceMetres(last.lat, last.lng, here.lat, here.lng) > 25;
    if (!moved) return;
    followedFrom.current = { lat: here.lat, lng: here.lng };
    map.flyTo([here.lat, here.lng], last ? map.getZoom() : 15, { duration: last ? 0.6 : 1.2 });
  }, [map, following, here.fromDevice, here.lat, here.lng]);

  useEffect(() => {
    if (!map) return undefined;
    const onDragged = () => setFollowing(false);
    map.on('dragstart', onDragged);
    return () => { map.off('dragstart', onDragged); };
  }, [map]);

  useEffect(() => {
    if (!map) return undefined;
    const onMoved = () => { const c = map.getCenter(); loadRegion(c.lat, c.lng); };
    map.on('moveend', onMoved);
    onMoved();
    return () => { map.off('moveend', onMoved); };
  }, [map, loadRegion]);

  const recentre = async () => {
    if (recentring) return;
    setRecentring(true);
    const fix = await requestLocation();
    setRecentring(false);
    const target = fix ?? here;
    followedFrom.current = { lat: target.lat, lng: target.lng };
    setFollowing(true);
    map?.flyTo([target.lat, target.lng], 15, { duration: 1 });
    if (!fix) flash(`Couldn’t get a fix — centred on ${here.label}.`);
  };

  const activeFacilities = FEATURES.filter((f) => filters[f.key]);

  return (
    <div className="screen" style={{ background: t.mapWater }}>
      <MapContainer
        center={here.fromDevice ? [here.lat, here.lng] : [CANADA_VIEW.lat, CANADA_VIEW.lng]}
        zoom={here.fromDevice ? 14 : CANADA_VIEW.zoom}
        zoomControl={false}
        attributionControl={false}
        style={{ position: 'absolute', inset: 0 }}
      >
        <MapReady onReady={onReady} />
        <BaseTiles
          dark={dark}
          onTrouble={() => setTileTrouble(true)}
          onProvider={(p) => setCredit(p.attribution)}
        />
        {here.fromDevice && (
          <Marker position={[here.lat, here.lng]} icon={youAreHereIcon(t.accent)} opacity={here.live ? 1 : 0.45} />
        )}
        {mapPool.map((w) => (
          <Marker
            key={`${w.id}-${dark}-${saved.includes(w.id)}-${w.scoreText}`}
            position={[w.lat, w.lng]}
            icon={pinIcon(w, { saved: saved.includes(w.id), cardColor: t.card, unratedColor: t.sub })}
            eventHandlers={{ click: () => setSelected(w) }}
          />
        ))}
      </MapContainer>

      {/* Filters live over the map, so their effect on the pins is visible */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, zIndex: 1000, pointerEvents: 'none',
        padding: '14px 16px 18px', paddingTop: 'calc(14px + var(--safe-t))',
        background: `linear-gradient(${t.bg} 0%, ${t.fadeOut} 100%)`,
      }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
          <RoundButton onClick={() => navigate(-1)} t={t} label="Back">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.2"><path d="M15 5l-7 7 7 7" /></svg>
          </RoundButton>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', color: t.text }}>
            {mapPool.length} {mapPool.length === 1 ? 'stop' : 'stops'} here
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 11, overflowX: 'auto', pointerEvents: 'auto' }}>
          <Pill label="All" active={categoryFilter === 'all'} t={t} onClick={() => setCategoryFilter('all')} />
          {CATEGORIES.map((c) => (
            <Pill key={c.id} label={c.label} active={categoryFilter === c.id} t={t} onClick={() => setCategoryFilter(c.id)} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto', pointerEvents: 'auto' }}>
          {FEATURES.map((f) => (
            <Pill key={f.key} label={f.label} active={!!filters[f.key]} t={t} onClick={() => toggleFilter(f.key)} />
          ))}
        </div>
      </div>

      <div style={{
        position: 'absolute', right: 16, bottom: selected ? 260 : 150, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      >
        <div style={{
          borderRadius: 14, overflow: 'hidden', background: t.card,
          border: `1px solid ${t.line}`, boxShadow: '0 6px 18px rgba(0,0,0,.14)',
        }}
        >
          <button type="button" aria-label="Zoom in" onClick={() => map?.zoomIn()} style={zoomBtn(t, true)}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => map?.zoomOut()} style={zoomBtn(t, false)}>−</button>
        </div>
        <RoundButton
          onClick={recentre}
          t={t}
          label={following ? 'Following your location' : 'Recentre on my location'}
          style={{ background: following ? t.accent : t.card, border: `1px solid ${following ? t.accent : t.line2}` }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={following ? t.onInk : t.text} strokeWidth="1.9">
            <circle cx="12" cy="12" r="3.4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </RoundButton>
        <RoundButton onClick={() => navigate('/add')} t={t} label="Add a stop" style={{ background: t.accent, border: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.onInk} strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </RoundButton>
      </div>

      {/* Tapping a pin says what that stop actually has */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1000,
        borderRadius: '22px 22px 0 0', background: t.card, borderTop: `1px solid ${t.line}`,
        boxShadow: '0 -12px 34px rgba(0,0,0,.16)', padding: '12px 20px 18px',
        paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
        animation: 'looRise .22s ease',
      }}
      >
        <div style={{ width: 42, height: 4, borderRadius: 2, background: t.line2, margin: '0 auto 12px' }} />

        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: t.text }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: t.body, marginTop: 3 }}>
                  {selected.neighbourhood} · {formatDistance(selected.dist, units)}
                  {selected.rated ? ` · ${selected.scoreText}/5` : ' · New'}
                </div>
              </div>
              <CategoryBadge category={selected.category} label={selected.categoryLabel} t={t} />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selected.facilities.map((f) => (
                <span
                  key={f.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                    borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: f.has ? `color-mix(in oklab, ${t.accent} 12%, ${t.card})` : t.chip,
                    color: f.has ? t.text : t.faint,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={f.has ? t.accent : t.faint} strokeWidth="3.4" strokeLinecap="round">
                    {f.has ? <path d="M5 13l4 4 10-10" /> : <path d="M6 6l12 12M18 6L6 18" />}
                  </svg>
                  {f.short}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => navigate(`/washroom/${selected.id}`)}
                style={{
                  flex: 1, minHeight: 46, borderRadius: 14, border: 0, background: t.accent,
                  color: t.onInk, fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{
                  minHeight: 46, padding: '0 18px', borderRadius: 14,
                  border: `1.5px solid ${t.line2}`, background: t.card, color: t.text,
                  fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13.5, color: t.body }}>
              {activeFacilities.length === 0
                ? 'Tap a pin to see what it has, or filter by facility above.'
                : `Showing stops with ${activeFacilities.map((f) => f.label.toLowerCase()).join(', ')}.`}
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
              {CITIES.slice(0, 8).map((c) => (
                <Pill
                  key={c.name}
                  label={c.name}
                  t={t}
                  onClick={() => { setFollowing(false); map?.flyTo([c.lat, c.lng], 13, { duration: 1 }); }}
                />
              ))}
            </div>
            {tileTrouble && (
              <div style={{
                padding: '10px 13px', borderRadius: 12, background: t.chip,
                fontSize: 12, lineHeight: 1.45, color: t.body,
              }}
              >
                Map tiles aren’t loading right now — the stops themselves are unaffected.
              </div>
            )}
            <div style={{ fontSize: 9.5, color: t.sub, opacity: 0.75 }}>{credit}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const zoomBtn = (t, top) => ({
  display: 'block', width: 44, height: 40, border: 0,
  borderBottom: top ? `1px solid ${t.line}` : 0,
  background: 'transparent', cursor: 'pointer', color: t.text, fontSize: 17, lineHeight: 1,
});
