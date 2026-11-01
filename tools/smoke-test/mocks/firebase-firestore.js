const db = {}; const subs = {};
const col = (n) => (db[n] ||= new Map());
const fire = (n) => (subs[n] || []).forEach((f) => f());
export const getFirestore = (app) => ({ app });
export const collection = (d, name) => ({ __col: name });
export const doc = (d, c, id) => ({ __col: c, __id: id });
export const query = (c, ...clauses) => ({ __col: c.__col, __clauses: clauses });
export const where = (field, op, value) => ({ field, op, value });
export const orderBy = (field, dir) => ({ __order: { field, dir } });
export const limit = (n) => ({ __limit: n });
export const arrayUnion = (...items) => ({ __arrayUnion: items });
export async function getDoc(ref) { const data = col(ref.__col).get(ref.__id); return { exists: () => !!data, data: () => data, id: ref.__id }; }
export async function setDoc(ref, data, opts) { const c = col(ref.__col); c.set(ref.__id, opts && opts.merge && c.has(ref.__id) ? { ...c.get(ref.__id), ...data } : data); fire(ref.__col); }
export async function addDoc(cref, data) { const id = 'mock-' + Math.random().toString(36).slice(2, 10); col(cref.__col).set(id, data); fire(cref.__col); return { id }; }
export async function updateDoc(ref, patch) { const c = col(ref.__col); const cur = c.get(ref.__id) || {}; const m = { ...cur }; for (const k in patch) m[k] = patch[k] && patch[k].__arrayUnion ? [...(cur[k] || []), ...patch[k].__arrayUnion] : patch[k]; c.set(ref.__id, m); fire(ref.__col); }
export async function deleteDoc(ref) { col(ref.__col).delete(ref.__id); fire(ref.__col); }
function run(q) {
  let e = [...col(q.__col).entries()];
  (q.__clauses || []).forEach((c) => { if (c.op) e = e.filter(([, d]) => c.op === 'in' ? c.value.includes(d[c.field]) : d[c.field] === c.value); });
  const ord = (q.__clauses || []).find((c) => c.__order);
  if (ord) { const { field, dir } = ord.__order; e.sort((a, b) => (a[1][field] > b[1][field] ? 1 : -1) * (dir === 'desc' ? -1 : 1)); }
  const lim = (q.__clauses || []).find((c) => c.__limit); if (lim) e = e.slice(0, lim.__limit);
  return e;
}
export async function getDocs(cref) { return { docs: run(cref).map(([id, data]) => ({ id, data: () => data })) }; }
export function onSnapshot(q, next) {
  const n = q.__col; (subs[n] ||= []);
  const run = () => { let e = [...col(n).entries()]; (q.__clauses || []).forEach((c) => { e = e.filter(([, d]) => c.op === 'in' ? c.value.includes(d[c.field]) : d[c.field] === c.value); }); next({ size: e.length, docs: e.map(([id, data]) => ({ id, data: () => data })) }); };
  subs[n].push(run); setTimeout(run, 0);
  return () => { subs[n] = subs[n].filter((f) => f !== run); };
}
window.__mockGet = (c, id) => col(c).get(id);
window.__mockAll = (c) => [...col(c).entries()].map(([id, d]) => ({ id, ...d }));
window.__mockSeed = (c, id, data) => { col(c).set(id, data); fire(c); };
