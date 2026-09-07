import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { useDataStore } from '../dataStore';
import { useToastStore } from '../toastStore';
import { useWashroom, useReviews } from '../hooks/useWashroomData';
import { REVIEW_TAGS } from '../data/locations';
import { Pill, ScreenHeader, PrimaryButton } from '../components/ui';
import { ProtectedNote } from '../components/ProtectedNote';
import { Loading } from '../components/Status';

const WORDS = ['', 'Grim', 'Rough', 'Okay', 'Clean', 'Spotless'];

export default function ReviewScreen({ t }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const flash = useToastStore((s) => s.flash);
  const submitReview = useDataStore((s) => s.submitReview);
  const displayName = useStore((s) => s.displayName);
  const setDisplayName = useStore((s) => s.setDisplayName);

  const cur = useWashroom(id);
  const { reviews, loading } = useReviews(id);
  const mine = reviews.find((r) => r.isMine);

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [pickedTags, setPickedTags] = useState([]);
  const [anon, setAnon] = useState(!displayName);
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loading || loaded) return;
    if (mine) {
      setRating(mine.rating);
      setText(mine.body);
      setAnon(mine.authorName === 'A local');
    }
    setLoaded(true);
  }, [loading, loaded, mine]);

  if (!cur || loading) return <div className="screen" style={{ background: t.bg }}><Loading t={t} /></div>;

  const toggleTag = (tag) => setPickedTags((p) => (p.includes(tag) ? p.filter((x) => x !== tag) : [...p, tag]));

  const submit = async () => {
    if (rating === 0 || saving) return;
    setSaving(true);
    const tagLine = pickedTags.length ? `${pickedTags.join(' · ')}.` : '';
    const body = [text.trim(), tagLine].filter(Boolean).join(' ');
    const authorName = anon ? 'A local' : (name.trim() || 'A local');

    try {
      if (!anon && name.trim()) setDisplayName(name.trim());
      await submitReview(id, { rating, body, authorName });
      navigate(`/washroom/${id}`, { replace: true });
      flash(mine ? 'Review updated. Thanks!' : 'Review posted — thanks!');
    } catch (e) {
      setSaving(false);
      flash(e?.message ?? 'Couldn’t post that review. Try again.');
    }
  };

  return (
    <div className="screen" style={{ background: t.bg }}>
      <ScreenHeader title="Rate this stop" onBack={() => navigate(-1)} t={t} />

      <div
        className="scroll enter"
        style={{ padding: '4px 20px 30px', display: 'flex', flexDirection: 'column', gap: 22 }}
      >
        <span style={{ fontSize: 14, color: t.body }}>{cur.name}</span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Overall</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                onClick={() => setRating(n)}
                style={{
                  width: 48, height: 48, borderRadius: 12, border: 0, background: 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill={n <= rating ? t.accent : t.line3}>
                  <path d="M12 2l2.9 6.2 6.6.9-4.8 4.6 1.2 6.6L12 17.2 6.1 20.3l1.2-6.6L2.5 9.1l6.6-.9Z" />
                </svg>
              </button>
            ))}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: rating ? t.accent : t.sub, minHeight: 19 }}>
            {WORDS[rating] || 'Tap a star'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>What stood out?</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {REVIEW_TAGS.map((tag) => (
              <Pill key={tag} label={tag} active={pickedTags.includes(tag)} t={t} onClick={() => toggleTag(tag)} />
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Tell other travellers</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 600))}
            placeholder="Clean, well lit, easy to park a van outside…"
            style={{
              minHeight: 120, borderRadius: 14, border: `1.5px solid ${t.line2}`, background: t.card,
              padding: 14, fontSize: 15, lineHeight: 1.5, color: t.text, outline: 'none',
              resize: 'none', fontWeight: 500,
            }}
          />
        </label>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '13px 15px',
          borderRadius: 14, background: t.chip, cursor: 'pointer',
        }}
        >
          <input
            type="checkbox"
            checked={anon}
            onChange={() => setAnon((a) => !a)}
            style={{ width: 17, height: 17, accentColor: t.accent }}
          />
          <span style={{ fontSize: 13.5, color: t.body }}>Post as “A local”</span>
        </label>
        {!anon && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            placeholder="Name to show, e.g. Mira K."
            style={{
              minHeight: 52, borderRadius: 14, border: `1.5px solid ${t.line2}`, background: t.card,
              padding: '0 16px', fontSize: 15, color: t.text, outline: 'none',
            }}
          />
        )}

        <PrimaryButton t={t} onClick={submit} disabled={rating === 0 || saving}>
          {saving ? 'Posting…' : rating === 0 ? 'Pick a rating to post' : mine ? 'Update review' : 'Post review'}
        </PrimaryButton>

        <ProtectedNote t={t} style={{ marginTop: -6 }} />
      </div>
    </div>
  );
}
