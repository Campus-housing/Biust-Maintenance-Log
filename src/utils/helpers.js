import { CATEGORIES, STATUSES, SPECIALTIES, ARCHIVE_MS, RESIDENTIAL_BLOCKS, SEMESTERS } from './constants';

export function categoryMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[3];
}
export function statusMeta(id) {
  return STATUSES.find((s) => s.id === id) || STATUSES[0];
}
export function specialtyLabel(id) {
  const s = SPECIALTIES.find((x) => x.id === id);
  return s ? s.label : 'All categories';
}
export function isArchived(t) {
  return t.status === 'done' && t.resolvedAt && Date.now() - new Date(t.resolvedAt).getTime() > ARCHIVE_MS;
}
export function isResidentialBlock(b) {
  return RESIDENTIAL_BLOCKS.includes(b);
}
export function formatDate(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}
export function friendlyAuthError(e) {
  const code = e && e.code ? e.code : '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Incorrect email or password.';
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists — try logging in instead.';
  if (code === 'auth/weak-password') return 'Password should be at least 6 characters.';
  if (code === 'auth/invalid-email') return 'That email address looks invalid.';
  if (code === 'auth/too-many-requests') return 'Too many attempts — wait a moment and try again.';
  if (code === 'auth/configuration-not-found') return 'That sign-in method isn\u2019t turned on yet in Firebase — check Authentication > Sign-in method.';
  return (e && e.message) || 'Something went wrong. Try again.';
}
export function makeTicketCode(block, room) {
  return (
    block.replace(/\s+/g, '').slice(0, 3).toUpperCase() +
    '-' + room + '-' +
    Date.now().toString(36).toUpperCase().slice(-4)
  );
}
export function publicMirror(ticket) {
  return {
    code: ticket.code, block: ticket.block, room: ticket.room, category: ticket.category,
    description: ticket.description, status: ticket.status, urgent: !!ticket.urgent,
    reportedAt: ticket.reportedAt, resolvedAt: ticket.resolvedAt || null,
  };
}

// Natural search: strips filler words ("room", "block", etc.) and matches each
// remaining word separately, so "room 20" or "block f room 20" find a ticket
// even though the stored data never literally contains the word "room".
const SEARCH_NOISE_WORDS = new Set(['room', 'rm', 'block', 'blk', 'the', 'in', 'at', 'no', 'number']);

export function ticketMatchesSearch(t, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter((tok) => tok && !SEARCH_NOISE_WORDS.has(tok));
  if (tokens.length === 0) return true;
  const blockLower = (t.block || '').toLowerCase();
  const roomLower = (t.room || '').toLowerCase();
  const freeText = [t.description, t.reportedBy, t.code].filter(Boolean).join(' ').toLowerCase();
  return tokens.every((tok) =>
    blockLower === tok ||
    blockLower.startsWith(tok) ||
    roomLower === tok ||
    roomLower.includes(tok) ||
    freeText.includes(tok)
  );
}


// ---------- Semesters ----------
export function semesterForDate(iso) {
  const t = iso ? new Date(iso).getTime() : Date.now();
  let found = SEMESTERS[0];
  for (const sem of SEMESTERS) {
    if (t >= new Date(sem.start).getTime()) found = sem;
  }
  return found;
}
export function currentSemester() {
  return semesterForDate(new Date().toISOString());
}
export function semesterOf(ticket) {
  return SEMESTERS.find((s) => s.id === ticket.semester) || semesterForDate(ticket.reportedAt);
}

// Returns the tickets that belong in a semester's view: everything created during
// it, plus anything created earlier that was still unresolved when it began
// (tagged with _carriedFrom so the card can say so). 'all' returns everything.
export function scopeToSemester(tickets, semesterId) {
  if (semesterId === 'all') return tickets;
  const idx = SEMESTERS.findIndex((s) => s.id === semesterId);
  if (idx === -1) return tickets;
  const start = new Date(SEMESTERS[idx].start).getTime();
  const end = idx + 1 < SEMESTERS.length ? new Date(SEMESTERS[idx + 1].start).getTime() : Infinity;
  const out = [];
  tickets.forEach((t) => {
    const created = new Date(t.reportedAt).getTime();
    const sem = semesterOf(t);
    if (sem.id === semesterId) {
      out.push(t);
    } else if (idx > 0 && created < start) {
      const stillOpen = t.status !== 'done' || !t.resolvedAt || new Date(t.resolvedAt).getTime() >= start;
      if (stillOpen && created < end) out.push({ ...t, _carriedFrom: sem.short });
    }
  });
  return out;
}

// ---------- Resolution time ----------
// Milliseconds from reported to resolved, or null if it isn't resolved (or the
// dates don't make sense).
export function resolutionMs(t) {
  if (t.status !== 'done' || !t.resolvedAt || !t.reportedAt) return null;
  const ms = new Date(t.resolvedAt).getTime() - new Date(t.reportedAt).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}
export function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return mins + 'm';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ' + (mins % 60) + 'm';
  const days = Math.floor(hours / 24);
  return days + 'd ' + (hours % 24) + 'h';
}
export function average(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
export function median(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
