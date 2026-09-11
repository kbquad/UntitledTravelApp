import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer } from 'react-leaflet';
import MapReady from '../components/MapReady';
import BaseTiles from '../components/BaseTiles';
import { useStore } from '../store';
import { useDataStore } from '../dataStore';
import { useToastStore } from '../toastStore';
import { useCurrentLocation } from '../hooks/useWashroomData';
import { requestLocation } from '../lib/geolocation';
import { FACILITIES, TYPES_BY_CATEGORY, CATEGORIES } from '../data/locations';
import {
  Pill, ScreenHeader, PrimaryButton, SecondaryButton, Segmented,
} from '../components/ui';
import { ProtectedNote } from '../components/ProtectedNote';

// What a new stop starts out claiming. Free to use and walk-straight-in are
// the common case and are pre-ticked; every other facility is something the
// person adding it has to actually assert.
const defaultFeatures = { isFree: true, noKey: true };

// Icon path per stop kind, from the design's KINDS list.
const KIND_ICON = {
  toilet: 'M6 3v6M6 21v-8M6 13a3 3 0 0 0 0-6M17 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM15 21v-6h4v6M15 15l-1-6h6l-1 6',
  food: 'M6 3v8a2 2 0 0 0 4 0V3M8 11v10M17 3c-1.5 2-2 4-2 6a2 2 0 0 0 4 0c0-2-.5-4-2-6ZM17 11v10',
  fuel: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h13M7 8h4M14 9h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-2-3',
  rest: 'M3 20V9l9-5 9 5v11M3 20h18M8 20v-6h8v6M12 4v5',
};

export default function AddScreen({ t }) {
  const navigate = useNavigate();
  const flash = useToastStore((s) => s.flash);
  const submitWashroom = useDataStore((s) => s.submitWashroom);
  const dark = useStore((s) => s.dark);
  const locationStatus = useStore((s) => s.locationStatus);
  const here = useCurrentLocation();

  const [category, setCategory] = useState('toilet');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [type, setType] = useState(TYPES_BY_CATEGORY.toilet[0]);
  const [features, setFeatures] = useState(defaultFeatures);
  const [clean, setClean] = useState('Clean');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const [pin, setPin] = useState(null);
  const [credit, setCredit] = useState('');
  const [map, setMap] = useState(null);
  const onMapReady = useCallback((m) => setMap(m), []);

  useEffect(() => {
    let cancelled = false;
    setLocating(true);
    requestLocation().finally(() => { if (!cancelled) setLocating(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!map) return undefined;
    const sync = () => { const c = map.getCenter(); setPin({ lat: c.lat, lng: c.lng }); };
    map.on('moveend', sync);
    sync();
    return () => { map.off('moveend', sync); };
  }, [map]);

  const [centred, setCentred] = useState(false);
  useEffect(() => {
    if (!map || centred || !here.fromDevice) return;
    setCentred(true);
    map.setView([here.lat, here.lng], 17, { animate: false });
  }, [map, centred, here.fromDevice, here.lat, here.lng]);

  const jumpToMe = async () => {
    if (locating) return;
    setLocating(true);
    const fix = await requestLocation();
    setLocating(false);
    if (fix) {
      map?.setView([fix.lat, fix.lng], 17);
      flash('Pinned your current location.');
    } else {
      flash('Still can’t get a fix — drag the map to place it yourself.');
    }
  };

  const submit = async () => {
    if (saving) return;
    if (!name.trim()) {
      setNameError('Give the stop a name so travellers can find it');
      flash('Give the stop a name first');
      return;
    }
    if (!pin) { flash('Move the map to where the stop is first.'); return; }

    setSaving(true);
    try {
      await submitWashroom({
        name: name.trim(), type, category, lat: pin.lat, lng: pin.lng, features,
      });
      navigate('/stops');
      flash(`${name.trim()} submitted — thanks!`);
    } catch (e) {
      setSaving(false);
      flash(e?.message ?? 'Couldn’t submit that. Try again.');
    }
  };

  return (
    <div className="screen" style={{ background: t.bg }}>
      <ScreenHeader title="Add a stop" onBack={() => navigate(-1)} t={t} />

      <div
        className="scroll enter"
        style={{ padding: '4px 20px 30px', display: 'flex', flexDirection: 'column', gap: 22 }}
      >
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: t.body }}>
          New places are checked by moderators before other travellers see them.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>What kind of stop?</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CATEGORIES.map((c) => {
              const on = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCategory(c.id); setType(TYPES_BY_CATEGORY[c.id][0]); }}
                  style={{
                    minHeight: 74, borderRadius: 16, cursor: 'pointer', display: 'flex',
                    flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center',
                    gap: 8, padding: 14, textAlign: 'left', color: t.text,
                    background: on ? `color-mix(in oklab, ${t.accent} 12%, ${t.card})` : t.card,
                    border: `1.5px solid ${on ? t.accent : t.line}`,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? t.accent : t.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={KIND_ICON[c.id]} />
                  </svg>
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Name</span>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value.slice(0, 120)); setNameError(''); }}
            placeholder="e.g. Brenig Lay-by Toilets"
            aria-label="Name"
            style={{
              minHeight: 52, borderRadius: 14, background: t.field, padding: '0 16px',
              border: `1.5px solid ${nameError ? '#C2334D' : t.line2}`,
              fontSize: 16, fontWeight: 600, color: t.text, outline: 'none',
            }}
          />
          {nameError && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 7, fontSize: 13,
              fontWeight: 600, color: '#C2334D',
            }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C2334D" strokeWidth="2.2">
                <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
              </svg>
              {nameError}
            </span>
          )}
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Where is it?</span>
          <div style={{
            position: 'relative', height: 200, flex: 'none', borderRadius: 18,
            overflow: 'hidden', border: `1px solid ${t.line}`,
          }}
          >
            <MapContainer
              center={[here.lat, here.lng]}
              zoom={here.fromDevice ? 17 : 4}
              zoomControl={false}
              attributionControl={false}
              style={{ position: 'absolute', inset: 0 }}
            >
              <MapReady onReady={onMapReady} />
              <BaseTiles dark={dark} onProvider={(p) => setCredit(p.attribution)} />
            </MapContainer>

            <div style={{
              position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-100%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              pointerEvents: 'none',
            }}
            >
              <div style={{
                padding: '5px 11px', borderRadius: 11, background: t.accent, color: t.onInk,
                fontSize: 11.5, fontWeight: 700, boxShadow: '0 4px 14px rgba(0,0,0,.24)',
              }}
              >
                Drag to place
              </div>
              <div style={{ width: 2, height: 14, background: t.accent }} />
              <div style={{
                width: 9, height: 9, borderRadius: '50%', background: t.accent,
                boxShadow: `0 0 0 3px ${t.pinHalo}`,
              }}
              />
            </div>
          </div>
          <SecondaryButton t={t} onClick={jumpToMe} style={{ alignSelf: 'flex-start', minHeight: 42 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2">
              <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" />
            </svg>
            {locating ? 'Locating…' : 'Use my current location'}
          </SecondaryButton>
          <span style={{ fontSize: 12, lineHeight: 1.5, color: t.sub }}>
            {locationStatus === 'denied' && !here.fromDevice
              ? 'Location is blocked for this site, so the map starts on Canada — drag it to the stop yourself.'
              : 'Drag the map so the pin sits on the stop.'}
          </span>
          <span style={{ fontSize: 9.5, color: t.sub, opacity: 0.75 }}>{credit}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>What kind of place is it?</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TYPES_BY_CATEGORY[category].map((ty) => (
              <Pill key={ty} label={ty} active={type === ty} t={t} onClick={() => setType(ty)} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Facilities it has</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FACILITIES.map((f) => (
              <Pill
                key={f.key}
                label={f.label}
                active={!!features[f.key]}
                t={t}
                onClick={() => setFeatures((p) => ({ ...p, [f.key]: !p[f.key] }))}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>How clean is it?</span>
          <Segmented
            t={t}
            value={clean}
            onPick={setClean}
            options={[{ id: 'Basic', label: 'Basic' }, { id: 'Clean', label: 'Clean' }, { id: 'Spotless', label: 'Spotless' }]}
          />
          <span style={{ fontSize: 12, lineHeight: 1.5, color: t.sub }}>
            This is your first impression — it becomes the first review once the stop is approved.
          </span>
        </div>

        <PrimaryButton t={t} onClick={submit} disabled={saving}>
          {saving ? 'Submitting…' : name.trim() ? `Submit ${name.trim()}` : 'Submit for review'}
        </PrimaryButton>

        <ProtectedNote t={t} style={{ marginTop: -6 }} />
      </div>
    </div>
  );
}
