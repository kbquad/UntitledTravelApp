import { isLive } from '../lib/db';

export const Spinner = ({ t, size = 22 }) => (
  <span
    style={{
      width: size, height: size, borderRadius: '50%', display: 'inline-block',
      border: `2.5px solid ${t.line2}`, borderTopColor: t.ink,
      animation: 'looSpin .7s linear infinite',
    }}
  />
);

export const Loading = ({ t, label = 'Loading…' }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: '48px 24px', color: t.sub, fontSize: 12.5,
  }}
  >
    <Spinner t={t} />
    {label}
  </div>
);

export const ErrorNote = ({ t, message, onRetry }) => (
  <div style={{
    padding: '18px 16px', borderRadius: 18, background: t.card,
    border: `1px solid ${t.line2}`, display: 'flex', flexDirection: 'column', gap: 10,
  }}
  >
    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Couldn’t load that</div>
    <div style={{ fontSize: 12, lineHeight: 1.55, color: t.sub }}>{message}</div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        style={{
          alignSelf: 'flex-start', marginTop: 2, height: 38, padding: '0 16px', borderRadius: 12,
          border: 0, background: t.ink, color: t.onInk, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Try again
      </button>
    )}
  </div>
);

// Shown only when the app is running without database credentials, so nobody
// mistakes a private demo for the shared, live site.
export const DemoBanner = ({ t }) => {
  if (isLive) return null;
  return (
    <div style={{
      padding: '10px 13px', borderRadius: 12, background: t.tagBg,
      border: `1px dashed ${t.line2}`, fontSize: 11, lineHeight: 1.5, color: t.body,
    }}
    >
      <strong style={{ color: t.text }}>Demo mode.</strong> Not connected to a database, so
      reviews stay in this browser only. Add your Firebase config to go live.
    </div>
  );
};
