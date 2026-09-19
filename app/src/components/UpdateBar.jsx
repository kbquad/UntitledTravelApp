import { useAppVersion, reloadForUpdate } from '../hooks/useAppVersion';

// Sits above the tab bar when a newer build has shipped. Deliberately not a
// forced reload: someone mid-review or mid-drive should finish first, and an
// app that reloads itself out from under you is worse than one a day old.
export function UpdateBar({ t }) {
  const stale = useAppVersion();
  if (!stale) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 12, right: 12, zIndex: 3000,
        bottom: 'calc(var(--nav-h) + 12px)',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 12px 12px 16px', borderRadius: 16,
        background: t.toastBg, color: t.toastFg,
        boxShadow: '0 10px 30px rgba(0,0,0,.24)',
        animation: 'looRise .24s ease',
      }}
    >
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>
        A new version of Roadside is ready.
      </span>
      <button
        type="button"
        onClick={reloadForUpdate}
        style={{
          flex: 'none', minHeight: 38, padding: '0 16px', borderRadius: 11, border: 0,
          background: t.toastFg, color: t.toastBg,
          fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Reload
      </button>
    </div>
  );
}
