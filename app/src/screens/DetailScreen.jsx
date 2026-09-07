import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { useDataStore } from '../dataStore';
import { useToastStore } from '../toastStore';
import { useWashroom, useReviews, useWashroomData } from '../hooks/useWashroomData';
import { stars } from '../theme';
import { formatDistance } from '../utils/geo';
import { openInMaps } from '../utils/openInMaps';
import { relativeTime } from '../utils/time';
import { CategoryBadge, StatCard, RoundButton } from '../components/ui';
import { Loading } from '../components/Status';

export default function DetailScreen({ t }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const flash = useToastStore((s) => s.flash);
  const units = useStore((s) => s.units);
  const saved = useStore((s) => s.saved);
  const toggleSaved = useStore((s) => s.toggleSaved);
  const toggleHelpful = useDataStore((s) => s.toggleHelpful);

  const cur = useWashroom(id);
  const { reviews, loading: reviewsLoading } = useReviews(id);
  const { allDecorated } = useWashroomData();

  const isSaved = saved.includes(id);

  // Decorated stops already carry this, resolved in one place.
  const facilities = cur?.facilities ?? [];

  const nearby = useMemo(() => allDecorated
    .filter((w) => w.id !== id)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3), [allDecorated, id]);

  if (!cur) return <div className="screen" style={{ background: t.bg }}><Loading t={t} /></div>;

  const myReview = reviews.find((r) => r.isMine);

  return (
    <div className="screen enter" style={{ background: t.bg }}>
      <div className="scroll" style={{ paddingBottom: 26 }}>
        {/* Photo placeholder — the app has no imagery for stops, and the
            design's own header is a placeholder too. */}
        <div style={{
          position: 'relative', height: 186, flex: 'none', background: t.placeholder,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        >
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '.09em', textTransform: 'uppercase',
            color: t.faint,
          }}
          >
            no photo yet
          </span>
          <RoundButton
            onClick={() => navigate(-1)}
            t={t}
            label="Back"
            style={{
              position: 'absolute', top: 'calc(14px + var(--safe-t))', left: 16,
              border: 0, background: t.glass,
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.2"><path d="M15 5l-7 7 7 7" /></svg>
          </RoundButton>
          <RoundButton
            onClick={() => { toggleSaved(id); flash(isSaved ? 'Removed from saved' : 'Saved for offline'); }}
            t={t}
            label={isSaved ? 'Remove from saved' : 'Save this stop'}
            style={{
              position: 'absolute', top: 'calc(14px + var(--safe-t))', right: 16,
              border: 0, background: t.glass,
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill={isSaved ? t.accent : 'none'} stroke={isSaved ? t.accent : t.text} strokeWidth="2">
              <path d="M6 3h12v18l-6-4-6 4Z" />
            </svg>
          </RoundButton>
        </div>

        <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CategoryBadge category={cur.category} label={cur.categoryLabel} t={t} style={{ alignSelf: 'flex-start' }} />
            <h2 style={{
              margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', color: t.text,
            }}
            >
              {cur.name}
            </h2>
            <span style={{ fontSize: 14, color: t.body }}>{cur.metaLabel}</span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <StatCard t={t} value={cur.rated ? cur.scoreText : 'New'} label={`${cur.reviewCount} ${cur.reviewCount === 1 ? 'review' : 'reviews'}`} />
            <StatCard t={t} accent value={cur.cleanPct == null ? '—' : `${cur.cleanPct}%`} label="Cleanliness" />
            <StatCard t={t} value={formatDistance(cur.dist, units)} label="Away" />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate(`/washroom/${id}/review`)}
              style={{
                flex: 1, minHeight: 48, borderRadius: 14, border: 0, background: t.accent,
                color: t.onInk, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {myReview ? 'Edit your review' : 'Add review'}
            </button>
            <button
              type="button"
              onClick={() => { flash('Opening your maps app…'); openInMaps(cur.lat, cur.lng, cur.name); }}
              style={{
                flex: 1, minHeight: 48, borderRadius: 14, border: `1.5px solid ${t.line2}`,
                background: t.card, color: t.text, fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Directions
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Facilities</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {facilities.map((f) => (
                <div
                  key={f.label}
                  style={{
                    minHeight: 56, padding: 12, borderRadius: 14, display: 'flex',
                    alignItems: 'center', gap: 9, border: `1px solid ${t.line}`,
                    background: f.has ? t.card : 'transparent',
                    color: f.has ? t.text : t.faint,
                  }}
                >
                  <span style={{
                    width: 20, height: 20, flex: 'none', borderRadius: '50%',
                    background: f.has ? t.accent : t.line2, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={f.has ? t.onInk : t.faint} strokeWidth="3" strokeLinecap="round">
                      {f.has ? <path d="M5 13l4 4 10-10" /> : <path d="M6 6l12 12M18 6L6 18" />}
                    </svg>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Reviews</span>
            </div>

            {reviewsLoading && <Loading t={t} label="Loading reviews…" />}

            {!reviewsLoading && reviews.length === 0 && (
              <div style={{
                borderRadius: 16, background: t.card, border: `1px dashed ${t.line2}`,
                padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 4,
                alignItems: 'center', textAlign: 'center',
              }}
              >
                <span style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>No reviews yet</span>
                <span style={{ fontSize: 13, lineHeight: 1.45, color: t.body }}>
                  Be the first to tell other travellers what this stop is like.
                </span>
              </div>
            )}

            {!reviewsLoading && reviews.map((r) => (
              <div
                key={r.id}
                style={{
                  borderRadius: 16, background: t.card, border: `1px solid ${t.line}`,
                  padding: 15, display: 'flex', flexDirection: 'column', gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: '50%', background: t.chip,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: t.body,
                  }}
                  >
                    {initials(r.authorName)}
                  </span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                      {r.authorName}{r.isMine && <span style={{ color: t.sub, fontWeight: 500 }}> · you</span>}
                    </span>
                    <span style={{ fontSize: 12, color: t.sub }}>{relativeTime(r.createdAt)}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{stars(r.rating)}</span>
                </div>
                {r.body && (
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: t.body }}>{r.body}</p>
                )}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10, paddingTop: 9, borderTop: `1px solid ${t.line}`,
                }}
                >
                  <span style={{ fontSize: 11.5, color: t.sub }}>
                    {r.helpfulCount === 0
                      ? 'No votes yet'
                      : `${r.helpfulCount} found this helpful`}
                  </span>
                  {r.isMine ? (
                    <button type="button" onClick={() => navigate(`/washroom/${id}/review`)} style={smallBtn(t, false)}>Edit</button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleHelpful(id, r.id).catch(() => flash('Couldn’t save that vote. Try again.'))}
                      style={smallBtn(t, r.votedByMe)}
                    >
                      {r.votedByMe ? 'Marked helpful' : 'Helpful'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {nearby.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Nearby alternatives</span>
              {nearby.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => navigate(`/washroom/${n.id}`)}
                  style={{
                    width: '100%', textAlign: 'left', borderRadius: 14, background: t.card,
                    border: `1px solid ${t.line}`, padding: '13px 15px', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    cursor: 'pointer', minHeight: 56,
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{n.name}</span>
                    <span style={{ fontSize: 12.5, color: t.body }}>
                      {n.categoryLabel} · {formatDistance(n.dist, units)}
                    </span>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: t.accent, flex: 'none' }}>
                    {n.rated ? n.scoreText : 'New'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const smallBtn = (t, on) => ({
  padding: '7px 12px', borderRadius: 10, cursor: 'pointer',
  background: on ? t.chip : 'transparent',
  border: `1px solid ${on ? t.accent : t.line2}`,
  fontSize: 11.5, fontWeight: 600, color: t.text,
});

const initials = (name) => (
  name === 'A local'
    ? 'AL'
    : name.split(' ').filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase() || 'A'
);
