import {
  lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, Marker } from 'react-leaflet';
import MapReady from '../components/MapReady';
import BaseTiles from '../components/BaseTiles';
import { MAP3D_CREDIT } from '../lib/mosaic';
import { useStore } from '../store';
import { useToastStore } from '../toastStore';
import { useWashroomData, useCurrentLocation } from '../hooks/useWashroomData';
import { useDataStore } from '../dataStore';
import { requestLocation } from '../lib/geolocation';
import { CITIES, CANADA_VIEW, CATEGORIES, FEATURES } from '../data/locations';
import { distanceMetres, formatDistance } from '../utils/geo';
import { pinIcon, youAreHereIcon } from '../utils/mapIcons';
import { Pill, CategoryBadge, RoundButton } from '../components/ui';

// three.js is a large dependency and only the 3D view needs it, so it is
// fetched when that view is actually shown.
const MapScene3D = lazy(() => import('../components/MapScene3D'));

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
  const map3d = useStore((s) => s.map3d);
  const setMap3d = useStore((s) => s.setMap3d);

  const { mapPool } = useWashroomData();
  const here = useCurrentLocation();
  const loadRegion = useDataStore((s) => s.loadRegion);

  const [map, setMap] = useState(null);
  const scene = useRef(null);
  const [selected, setSelected] = useState(null);
  // Where the 3D view is looking. Null means "wherever you are", so the
  // scene follows the location fix exactly as the flat map does.
  const [centre3d, setCentre3d] = useState(null);
  const [tileTrouble, setTileTrouble] = useState(false);
  // null | 'webgl' | 'tiles'. WebGL missing is permanent for this device;
  // tiles not arriving is a network moment, so that one stays retryable.
  const [threeDFailed, setThreeDFailed] = useState(null);
  const [credit, setCredit] = useState('');
  const [following, setFollowing] = useState(true);
  const [recentring, setRecentring] = useState(false);
  const onReady = useCallback((m) => setMap(m), []);
  const flownForState = useRef(false);
  const followedFrom = useRef(null);

  // "Show on map" from a stop card. In 3D there is no Leaflet instance to
  // fly, so the same intent moves the scene's centre instead.
  useEffect(() => {
    const flyTo = routerLocation.state?.flyTo;
    if (!flyTo || flownForState.current) return;
    if (!map && !map3d) return;         // wait for whichever view is coming up
    flownForState.current = true;
    setFollowing(false);
    if (map) map.flyTo([flyTo.lat, flyTo.lng], 13, { duration: 1 });
    else setCentre3d({ lat: flyTo.lat, lng: flyTo.lng });
  }, [map, map3d, routerLocation.state]);

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
    setCentre3d(null);
    scene.current?.resetView();
    map?.flyTo([target.lat, target.lng], 15, { duration: 1 });
    if (!fix) flash(`Couldn’t get a fix — centred on ${here.label}.`);
  };

  const activeFacilities = FEATURES.filter((f) => filters[f.key]);

  // Stable identity: a fresh object every render would rebuild the scene's
  // markers on every render.
  const meDot = useMemo(
    () => (here.fromDevice ? { lat: here.lat, lng: here.lng } : null),
    [here.fromDevice, here.lat, here.lng],
  );

  // 3D is the default, but it needs WebGL and terrain tiles. If either is
  // missing the flat map takes over automatically rather than leaving an
  // empty rectangle, and the toggle still lets anyone choose.
  const show3d = map3d && !threeDFailed;

  // One set of controls drives whichever view is on screen: Leaflet pans and
  // zooms itself, the scene pulls its camera in and moves its terrain.
  const view = {
    zoomIn: () => (show3d ? scene.current?.zoomIn() : map?.zoomIn()),
    zoomOut: () => (show3d ? scene.current?.zoomOut() : map?.zoomOut()),
    goTo: (lat, lng, zoom = 13) => {
      setFollowing(false);
      if (show3d) { setCentre3d({ lat, lng }); scene.current?.resetView(); } else {
        map?.flyTo([lat, lng], zoom, { duration: 1 });
      }
    },
  };

  const chrome = (
    <>
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
        <button
          type="button"
          onClick={() => {
            if (show3d) { setMap3d(false); return; }
            setThreeDFailed(null);   // pressing 3D is a request to try again
            setMap3d(true);
          }}
          disabled={threeDFailed === 'webgl'}
          aria-pressed={show3d}
          title={threeDFailed === 'webgl'
            ? 'This device can\u2019t draw the 3D map'
            : 'Switch between 3D terrain and the flat map'}
          style={{
            minHeight: 36, padding: '0 13px', borderRadius: 11, flex: 'none',
            cursor: threeDFailed === 'webgl' ? 'not-allowed' : 'pointer',
            border: `1.5px solid ${show3d ? t.accent : t.line2}`,
            background: show3d ? t.accent : t.card,
            color: show3d ? t.onInk : t.text,
            fontSize: 12.5, fontWeight: 700, opacity: threeDFailed === 'webgl' ? 0.5 : 1,
          }}
        >
          3D
        </button>
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
        <button type="button" aria-label="Zoom in" onClick={view.zoomIn} style={zoomBtn(t, true)}>+</button>
        <button type="button" aria-label="Zoom out" onClick={view.zoomOut} style={zoomBtn(t, false)}>−</button>
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
                onClick={() => view.goTo(c.lat, c.lng)}
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
          <div style={{ fontSize: 9.5, color: t.sub, opacity: 0.75 }}>{show3d ? MAP3D_CREDIT : credit}</div>
        </div>
      )}
    </div>    </>
  );


  if (show3d) {
    return (
      <div className="screen" style={{ background: t.mapWater }}>
        <Suspense fallback={null}>
        <MapScene3D
          centre={centre3d ?? { lat: here.lat, lng: here.lng }}
          spanM={5000}
          stops={mapPool}
          me={meDot}
          selectedId={selected?.id}
          onSelect={setSelected}
          onStatus={(s) => {
            // No WebGL, or neither terrain nor imagery arrived — a bare
            // coloured plane is worse than the flat map, so hand back to it.
            if (!s.ok) setThreeDFailed('webgl');
            else if (!s.terrain && !s.imagery) { setThreeDFailed('tiles'); setTileTrouble(true); }
          }}
          sceneApi={scene}
          t={t}
        />
        </Suspense>
        {chrome}
      </div>
    );
  }

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
            icon={pinIcon(w, {
              saved: saved.includes(w.id), cardColor: t.card, unratedColor: t.sub, accent: t.accent,
            })}
            eventHandlers={{ click: () => setSelected(w) }}
          />
        ))}
      </MapContainer>

      {chrome}

    </div>
  );
}

const zoomBtn = (t, top) => ({
  display: 'block', width: 44, height: 40, border: 0,
  borderBottom: top ? `1px solid ${t.line}` : 0,
  background: 'transparent', cursor: 'pointer', color: t.text, fontSize: 17, lineHeight: 1,
});
