// "A new version is available" detection. Two independent signals, so it works even where service workers don't:
//  1. the service worker finds a new sw.js (every build changes it), and
//  2. dist/version.json is fetched periodically and compared with the id baked into this running copy.
const BASE = import.meta.env.BASE_URL;
const CURRENT = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'; // eslint-disable-line no-undef
let waitingWorker = null;
let registration = null;

function announce(worker) {
  if (worker) waitingWorker = worker;
  window.dispatchEvent(new CustomEvent('bmf:update-ready'));
}

async function checkVersion() {
  if (CURRENT === 'dev') return;
  try {
    const res = await fetch(BASE + 'version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const { id } = await res.json();
    if (id && id !== CURRENT) announce();
  } catch {
    // offline — try again later
  }
}

function checkNow() {
  checkVersion();
  if (registration) registration.update().catch(() => {});
}

export function registerUpdates() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        registration = await navigator.serviceWorker.register(`${BASE}sw.js`);
        if (registration.waiting && navigator.serviceWorker.controller) announce(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const incoming = registration.installing;
          if (!incoming) return;
          incoming.addEventListener('statechange', () => {
            if (incoming.state === 'installed' && navigator.serviceWorker.controller) announce(incoming);
          });
        });
      } catch (e) {
        console.error('SW registration failed', e);
      }
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkNow(); });
  setInterval(checkNow, 30 * 60 * 1000);
  setTimeout(checkNow, 15000);
}

// Switch to the new version. With a waiting service worker we hand over to it first, then reload.
export function applyUpdate() {
  if (waitingWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}
