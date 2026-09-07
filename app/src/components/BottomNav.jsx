import { useLocation, useNavigate } from 'react-router-dom';

// The design's four tabs and their icon paths, verbatim.
const TABS = [
  { id: 'home', path: '/', label: 'Trip', d: 'M4 11l8-7 8 7v8a2 2 0 0 1-2 2h-4v-6H10v6H6a2 2 0 0 1-2-2Z' },
  { id: 'stops', path: '/stops', label: 'Stops', d: 'M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0Z' },
  { id: 'saved', path: '/saved', label: 'Saved', d: 'M6 3h12v18l-6-4-6 4Z' },
  { id: 'settings', path: '/settings', label: 'You', d: 'M4 20a8 8 0 0 1 16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' },
];

// Which tab lights up for screens that live underneath one, matching the
// design's own mapping: planning and history belong to Trip, a stop's detail
// belongs to Stops, appearance belongs to You.
const OWNED_BY = {
  home: ['/plan', '/history', '/drive'],
  stops: ['/map', '/list', '/add', '/washroom'],
  settings: ['/appearance', '/profile'],
};

export const BottomNav = ({ t }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const isActive = (tab) => path === tab.path
    || (OWNED_BY[tab.id] ?? []).some((p) => path === p || path.startsWith(`${p}/`));

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: 86,
      background: t.bg, backdropFilter: 'blur(14px)', borderTop: `1px solid ${t.line}`,
      display: 'flex', alignItems: 'flex-start', padding: '8px 12px 0',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 1100,
    }}
    >
      {TABS.map((tab) => {
        const on = isActive(tab);
        return (
          <button
            key={tab.id}
            type="button"
            aria-label={tab.label}
            aria-current={on ? 'page' : undefined}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1, minHeight: 56, border: 0, background: 'transparent', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 4, padding: 0,
            }}
          >
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
            }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke={on ? t.accent : t.sub}
                strokeWidth={on ? 2.3 : 1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={tab.d} />
              </svg>
            </span>
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 600, color: on ? t.accent : t.sub }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
