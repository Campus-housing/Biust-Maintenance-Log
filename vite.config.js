import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// IMPORTANT: base must match your GitHub repo name exactly, wrapped in slashes.
// Your repo is yunghit/Biust-Maintenance-Log, so it's set below.
// If you ever rename the repo, update this to match.
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const buildId = (process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) + '-' : '') + stamp;

// Stamps every production build so a browser can tell when a newer version has been deployed:
// the id is baked into the app, into sw.js (so each deploy has its own cache) and into dist/version.json.
function buildStamp() {
  let outDir = 'dist';
  return {
    name: 'build-stamp',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js');
      if (fs.existsSync(swPath)) fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replaceAll('__BUILD_ID__', buildId));
      fs.writeFileSync(path.join(outDir, 'version.json'), JSON.stringify({ id: buildId, builtAt: new Date().toISOString() }));
    },
  };
}

export default defineConfig({
  plugins: [react(), buildStamp()],
  base: '/Biust-Maintenance-Log/',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
})
