// Builds the app against fake Firebase modules so the UI can be exercised without a
// real project. Run from the repo root:  npx vite build --config tools/smoke-test/vite.config.smoke.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: path.resolve(here, '../..'),
  plugins: [react()],
  base: '/',
  define: { __BUILD_ID__: JSON.stringify('smoke') },
  resolve: {
    alias: [
      { find: 'firebase/app', replacement: path.join(here, 'mocks/firebase-app.js') },
      { find: 'firebase/firestore', replacement: path.join(here, 'mocks/firebase-firestore.js') },
      { find: 'firebase/auth', replacement: path.join(here, 'mocks/firebase-auth.js') },
      { find: /^\.\/firebaseConfig$/, replacement: path.join(here, 'mocks/firebaseConfig.js') },
    ],
  },
  build: { outDir: 'dist-smoke', emptyOutDir: true },
});
