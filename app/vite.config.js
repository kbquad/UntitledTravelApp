import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One id per build. Baked into the bundle as __BUILD_ID__ and also written to
// /version.json, so a tab that has been open for a week can ask "is there a
// newer build than the one I am?" instead of guessing from asset URLs.
const BUILD_ID = Date.now().toString(36);

const versionFile = () => ({
  name: 'roadside-version-file',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ build: BUILD_ID }),
    });
  },
});

// base: './' keeps asset URLs relative, so the built site works whether it's
// served from a domain root (Netlify/Vercel) or a subpath (GitHub Pages).
// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), versionFile()],
});
