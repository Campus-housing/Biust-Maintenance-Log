import { useEffect, useState } from 'react';
import { getDocs, query, where } from 'firebase/firestore';
import { publicBoardCol } from '../firebase';

// Uses the public board (readable by everyone, including students and anonymous reporters) so the warning
// works for every kind of reporter. One query per location, cached for a minute.
const cache = new Map();
async function boardFor(block) {
  const hit = cache.get(block);
  if (hit && Date.now() - hit.at < 60000) return hit.rows;
  const snap = await getDocs(query(publicBoardCol, where('block', '==', block)));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  cache.set(block, { at: Date.now(), rows });
  return rows;
}

// Open reports for the same location + room + category (a blank room never matches — two unrelated
// "common area" faults would otherwise trigger false warnings).
export function useSimilarReports({ block, room, category }) {
  const [matches, setMatches] = useState([]);
  useEffect(() => {
    const r = String(room || '').trim().toLowerCase();
    if (!block || !r) { setMatches([]); return undefined; }
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const rows = await boardFor(block);
        if (!alive) return;
        setMatches(
          rows
            .filter((x) => String(x.room || '').trim().toLowerCase() === r && x.category === category && x.status !== 'done')
            .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))
            .slice(0, 2)
        );
      } catch {
        if (alive) setMatches([]);
      }
    }, 450);
    return () => { alive = false; clearTimeout(timer); };
  }, [block, room, category]);
  return matches;
}
