import { useEffect, useState } from 'react';
import { applyUpdate } from '../utils/updates';

export default function UpdateBanner() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const on = () => setReady(true);
    window.addEventListener('bmf:update-ready', on);
    return () => window.removeEventListener('bmf:update-ready', on);
  }, []);
  if (!ready) return null;
  return (
    <div className="update-banner" role="status">
      <span>A new version is available.</span>
      <button type="button" className="update-btn" onClick={applyUpdate}>Refresh</button>
      <button type="button" className="update-x" aria-label="Dismiss" onClick={() => setReady(false)}>✕</button>
    </div>
  );
}
