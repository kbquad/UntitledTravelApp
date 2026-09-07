import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import MapReady from '../components/MapReady';
import { useStore } from '../store';
import { useWashroomData, useCurrentLocation } from '../hooks/useWashroomData';
import { useDataStore } from '../dataStore';
import { CATEGORIES, FEATURES, CANADA_VIEW } from '../data/locations';
import { pinIcon, youAreHereIcon } from '../utils/mapIcons';
import { Pill, CategoryBadge } from '../components/ui';
import { Loading, ErrorNote } from '../components/Status';

// The design's Stops screen: a map across the top, two rows of filters, then
// the list. The map is the real one rather than the mock's placeholder, at the
// design's 250px height.
export default function StopsScreen({ t }) {
  const navigate = useNavigate();
  const dark = useStore((s) => s.dark);
  const saved = useStore((s) => s.saved);
  const categoryFilter = useStore((s) => s.categoryFilter);
  const setCategoryFilter = useStore((s) => s.setCategoryFilter);
  const filters = useStore((s) => s.filters);
  const toggleFilter = useStore((s) => s.toggleFilter);

  const {
    sorted, mapPool, status, error, loading,
  } = useWashroomData();
  const here = useCurrentLocation();
  const loadRegion = useDataStore((s) => s.loadRegion);

  const [map, setMap] = useState(null);
  const onReady = useCallback((m) => setMap(m), []);

  useEffect(() => {
    if (!map) return undefined;
    const onMoved = () => { const c = map.getCenter(); loadRegion(c.lat, c.lng); };
    map.on('moveend', onMoved);
    onMoved();
    return () => { map.off('moveend', onMoved); };
  }, [map, loadRegion]);

  useEffect(() => {
    if (map && here.fromDevice) map.setView([here.lat, here.lng], 14, { animate: false });
    // Only when a first real fix lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, here.fromDevice]);

  return (
    <div className="screen enter" style={{ background: t.bg }}>
      {/* Map header */}
      <div style={{
        position: 'relative', height: 250, flex: 'none', background: t.mapWater, overflow: 'hidden',
      }}
      >
        <MapContainer
          center={here.fromDevice ? [here.lat, here.lng] : [CANADA_VIEW.lat, CANADA_VIEW.lng]}
          zoom={here.fromDevice ? 14 : CANADA_VIEW.zoom}
          zoomControl={false}
          attributionControl={false}
          style={{ position: 'absolute', inset: 0 }}
        >
          <MapReady onReady={onReady} />
          <TileLayer
            key={dark ? 'dark' : 'light'}
            detectRetina
            maxZoom={20}
            maxNativeZoom={20}
            url={dark
              ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'}
          />
          {here.fromDevice && (
            <Marker position={[here.lat, here.lng]} icon={youAreHereIcon(t.accent)} opacity={here.live ? 1 : 0.45} />
          )}
          {mapPool.slice(0, 60).map((w) => (
            <Marker
              key={`${w.id}-${dark}-${saved.includes(w.id)}-${w.scoreText}`}
              position={[w.lat, w.lng]}
              icon={pinIcon(w, { saved: saved.includes(w.id), cardColor: t.card, unratedColor: t.sub })}
              eventHandlers={{ click: () => navigate(`/washroom/${w.id}`) }}
            />
          ))}
        </MapContainer>

        <div style={{
          position: 'absolute', top: 'calc(14px + var(--safe-t))', left: 16, right: 16,
          display: 'flex', gap: 8, zIndex: 1000,
        }}
        >
          <button
            type="button"
            onClick={() => navigate('/map')}
            style={{
              flex: 1, minHeight: 46, borderRadius: 14, background: t.card, border: 0,
              boxShadow: '0 3px 12px rgba(0,0,0,.12)', display: 'flex', alignItems: 'center',
              gap: 10, padding: '0 14px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: t.sub }}>Open the full map</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        flex: 'none', padding: '14px 20px 10px', display: 'flex', flexDirection: 'column',
        gap: 10, borderBottom: `1px solid ${t.line}`,
      }}
      >
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          <Pill label="All" active={categoryFilter === 'all'} t={t} onClick={() => setCategoryFilter('all')} />
          {CATEGORIES.map((c) => (
            <Pill
              key={c.id}
              label={c.label}
              active={categoryFilter === c.id}
              t={t}
              onClick={() => setCategoryFilter(c.id)}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
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
      </div>

      {/* List */}
      <div
        className="scroll"
        style={{
          padding: '14px 20px 0', paddingBottom: 'var(--scroll-pad-b)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        {status === 'error' && (
          <ErrorNote t={t} message={error} onRetry={() => loadRegion(here.lat, here.lng, { force: true })} />
        )}
        {loading && <Loading t={t} label="Finding stops near you…" />}

        {status === 'ready' && (
          <span style={{ fontSize: 13, fontWeight: 700, color: t.sub }}>
            {sorted.length} {sorted.length === 1 ? 'place' : 'places'} nearby
          </span>
        )}

        {sorted.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => navigate(`/washroom/${w.id}`)}
            style={{
              width: '100%', textAlign: 'left', borderRadius: 20, border: `1px solid ${t.line}`,
              background: t.card, padding: 16, display: 'flex', flexDirection: 'column',
              gap: 11, cursor: 'pointer',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              gap: 12, width: '100%',
            }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{
                  fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: t.text,
                }}
                >
                  {w.name}
                </span>
                <span style={{ fontSize: 13, color: t.body }}>{w.metaLabel}</span>
              </div>
              <CategoryBadge category={w.category} label={w.categoryLabel} t={t} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
                fontWeight: 700, color: t.text,
              }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={t.accent}>
                  <path d="M12 2l2.9 6.2 6.6.9-4.8 4.6 1.2 6.6L12 17.2 6.1 20.3l1.2-6.6L2.5 9.1l6.6-.9Z" />
                </svg>
                {w.rated ? w.scoreText : 'New'}
              </span>
              <span style={{ fontSize: 13, color: t.sub }}>
                {w.reviewCount} {w.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
              {w.cleanPct != null && (
                <span style={{
                  padding: '4px 9px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  color: w.cleanPct >= 85 ? '#166534' : '#92400E',
                  background: w.cleanPct >= 85 ? '#DCFCE7' : '#FEF3C7',
                }}
                >
                  {w.cleanLabel}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {w.tags.map((tag) => (
                <span
                  key={tag.label}
                  style={{
                    padding: '5px 10px', borderRadius: 8, background: t.chip,
                    fontSize: 12, fontWeight: 600, color: t.body,
                  }}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </button>
        ))}

        {status === 'ready' && sorted.length === 0 && (
          <div style={{
            marginTop: 30, padding: '22px 18px', borderRadius: 18, background: t.card,
            border: `1px dashed ${t.line2}`, textAlign: 'center',
          }}
          >
            <div style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>Nothing matches those filters</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: t.body, marginTop: 6 }}>
              Clear a filter, or move the map somewhere else.
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/add')}
        style={{
          position: 'absolute', bottom: 'calc(var(--nav-h) + 16px + env(safe-area-inset-bottom, 0px))',
          right: 18, minHeight: 52, padding: '0 20px', borderRadius: 26, border: 0,
          background: t.accent, color: t.onInk, fontSize: 15, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 9,
          boxShadow: '0 8px 22px rgba(0,0,0,.28)', zIndex: 1050,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.onInk} strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add a stop
      </button>
    </div>
  );
}
