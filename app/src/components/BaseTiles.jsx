import { useEffect, useRef, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import { PROVIDERS, BASEMAP_MAX_ZOOM, TILE_ERROR_LIMIT } from '../lib/basemap';

// The basemap layer every map screen draws, with a provider that can fail over.
//
// A tile service that starts refusing requests renders as a grid of broken or
// "API key required" images, which reads as "this app is broken" — and that is
// exactly what happened to the previous provider. So failures are counted, and
// once enough tiles fail with none succeeding, the next provider is tried.
// `onProvider` reports which one is live so the screen can credit it, and
// `onTrouble` fires only when the list is exhausted.
export default function BaseTiles({ dark, onTrouble, onProvider }) {
  const [index, setIndex] = useState(0);
  const failures = useRef(0);
  const everLoaded = useRef(false);

  const provider = PROVIDERS[Math.min(index, PROVIDERS.length - 1)];

  useEffect(() => {
    failures.current = 0;
    everLoaded.current = false;
    onProvider?.(provider);
  }, [provider, onProvider]);

  // A theme flip swaps the URL, so give the current provider a fresh chance
  // rather than judging it on the previous theme's tally.
  useEffect(() => { failures.current = 0; }, [dark]);

  return (
    <TileLayer
      key={`${provider.id}-${dark ? 'dark' : 'light'}`}
      url={provider.url(dark)}
      maxZoom={BASEMAP_MAX_ZOOM}
      maxNativeZoom={provider.maxNativeZoom}
      eventHandlers={{
        tileload: () => { everLoaded.current = true; },
        tileerror: () => {
          failures.current += 1;
          if (everLoaded.current || failures.current < TILE_ERROR_LIMIT) return;
          if (index < PROVIDERS.length - 1) setIndex(index + 1);
          else onTrouble?.();
        },
      }}
    />
  );
}
