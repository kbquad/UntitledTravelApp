import { useEffect, useState } from 'react';

// Is the running tab out of date?
//
// A single-page app loads its JavaScript once. Deploy a new build and anyone
// with the tab already open — or a phone that restored it from the background
// hours later — keeps running the old one until something forces a reload.
// index.html is served no-cache, so a *fresh* load always gets the new build;
// what was missing was any way for an *old* load to notice.
//
// So each build stamps itself with an id and drops the same id in
// /version.json. This asks that file, occasionally, whether it still matches.
// It is a few dozen bytes and usually answered with a 304.

const CURRENT = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

// Long enough to be invisible, short enough that a deploy reaches an open tab
// the same day. Checks also happen whenever the tab comes back to the front,
// which is what actually catches the phone-in-the-pocket case.
const EVERY_MS = 30 * 60 * 1000;

export function useAppVersion() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    // Nothing to compare against in dev, and no version.json either.
    if (CURRENT === 'dev') return undefined;

    let alive = true;
    const check = async () => {
      if (!alive || document.hidden) return;
      try {
        const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { build } = await res.json();
        if (alive && build && build !== CURRENT) setStale(true);
      } catch {
        // Offline, or the file is not there. Neither means "out of date".
      }
    };

    const onVisible = () => { if (!document.hidden) check(); };
    const timer = setInterval(check, EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    check();

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return stale;
}

// A plain reload is enough: index.html is no-cache and every asset filename
// carries a content hash, so the browser fetches the new build and keeps the
// unchanged parts.
export const reloadForUpdate = () => window.location.reload();
