import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useWashroomData } from '../hooks/useWashroomData';
import { formatDistance } from '../utils/geo';
import { CategoryBadge, PrimaryButton } from '../components/ui';
import { Loading } from '../components/Status';

export default function SavedScreen({ t }) {
  const navigate = useNavigate();
  const saved = useStore((s) => s.saved);
  const units = useStore((s) => s.units);
  const { allDecorated, loading } = useWashroomData();
  const savedList = allDecorated.filter((w) => saved.includes(w.id));

  return (
    <div className="screen" style={{ background: t.bg }}>
      <div
        className="scroll enter"
        style={{
          padding: '8px 20px 0', paddingTop: 'calc(8px + var(--safe-t))',
          paddingBottom: 'var(--scroll-pad-b)', display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', color: t.text }}>
          Saved places
        </h2>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, borderRadius: 14,
          background: t.card, border: `1px solid ${t.line}`, padding: '13px 15px',
        }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2">
            <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
          </svg>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.text }}>
            Kept on this device
          </span>
          <span style={{ fontSize: 13, color: t.sub }}>
            {savedList.length} {savedList.length === 1 ? 'place' : 'places'}
          </span>
        </div>

        {loading && <Loading t={t} />}

        {!loading && savedList.length === 0 && (
          <div style={{
            marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 14, textAlign: 'center', padding: '0 20px',
          }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 20, background: t.chip,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8">
                <path d="M6 3h12v18l-6-4.6L6 21Z" />
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Nothing saved yet</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: t.body }}>
              Save the stops you trust and they’ll be one tap away next time you’re on that road.
            </div>
            <PrimaryButton t={t} onClick={() => navigate('/stops')} style={{ maxWidth: 220, marginTop: 4 }}>
              Find a stop
            </PrimaryButton>
          </div>
        )}

        {savedList.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => navigate(`/washroom/${w.id}`)}
            style={{
              width: '100%', textAlign: 'left', borderRadius: 18, background: t.card,
              border: `1px solid ${t.line}`, padding: 15, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12, cursor: 'pointer', minHeight: 70,
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{w.name}</span>
              <span style={{ fontSize: 13, color: t.body }}>
                {w.neighbourhood} · {formatDistance(w.dist, units)}
              </span>
            </span>
            <CategoryBadge category={w.category} label={w.categoryLabel} t={t} />
          </button>
        ))}
      </div>
    </div>
  );
}
