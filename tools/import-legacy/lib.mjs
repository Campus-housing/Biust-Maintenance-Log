// Shared helpers for reading a legacy tracker spreadsheet and mapping its rows onto this app's ticket shape.
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { BLOCKS, CATEGORIES, SEMESTERS } from '../../src/utils/constants.js';

// Header aliases (lower-cased, punctuation stripped). Extend freely if a different sheet uses other names.
export const FIELD_ALIASES = {
  legacyId: ['call id', 'id', 'ref', 'reference', 'ticket', 'ticket id', 'call no', 'call number'],
  location: ['block', 'location', 'residence', 'hall', 'area', 'building', 'house'],
  room: ['room', 'room no', 'room number', 'rm', 'room #', 'unit'],
  category: ['category', 'type', 'issue type', 'maintenance type', 'item', 'trade', 'department'],
  description: ['description', 'issue', 'problem', 'fault', 'details', 'nature of issue', 'nature of fault', 'defect', 'complaint'],
  contact: ['contact', 'phone', 'tel', 'cell', 'access contact', 'phone number', 'contact number'],
  reportedBy: ['reported by', 'reporter', 'ra', 'resident', 'student', 'name', 'logged by'],
  reportedAt: ['date reported', 'reported', 'date', 'date logged', 'date of report', 'reported on', 'logged', 'date received'],
  resolvedAt: ['date resolved', 'resolved', 'date fixed', 'date completed', 'completed', 'fixed on', 'date closed', 'closed', 'date attended'],
  status: ['status', 'state', 'progress', 'outcome'],
  urgent: ['urgent', 'priority'],
  notes: ['notes', 'remarks', 'action taken', 'comments', 'comment', 'closing notes', 'maintainer comment', 'feedback'],
};

const clean = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9# ]+/g, ' ').replace(/\s+/g, ' ').trim();
const compact = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function readWorkbook(file) {
  return XLSX.read(fs.readFileSync(file), { type: 'buffer', cellDates: true });
}
export function sheetRows(wb, name) {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false, raw: true });
}

// Finds the header row (within the first 15 rows) and maps canonical field -> column index.
export function detectHeader(rows) {
  let best = null;
  rows.slice(0, 15).forEach((row, i) => {
    const map = {};
    row.forEach((cell, c) => {
      const h = clean(cell);
      if (!h) return;
      for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        if (map[field] === undefined && aliases.includes(h)) { map[field] = c; break; }
      }
    });
    const score = Object.keys(map).length;
    if (!best || score > best.score) best = { index: i, map, score };
  });
  return best && best.score >= 2 && (best.map.description !== undefined || best.map.room !== undefined) ? best : null;
}

// ----- normalisers -----
export function normalizeBlock(raw, aliases = {}) {
  const r = String(raw ?? '').trim();
  if (!r) return null;
  if (aliases[r]) return aliases[r];
  const key = compact(r.replace(/^(block|blk)\s+/i, '')).replace(/^old(?=sekgoma)/, '');
  return BLOCKS.find((b) => compact(b) === key) || null;
}

const CAT_WORDS = {
  electricity: ['electric', 'light', 'socket', 'power', 'switch', 'bulb', 'plug', 'wiring', 'trip', 'fan', 'fuse', 'heater'],
  plumbing: ['plumb', 'tap', 'leak', 'pipe', 'toilet', 'shower', 'drain', 'geyser', 'water', 'flush', 'sink'],
  furniture: ['carpent', 'furniture', 'chair', 'table', 'wardrobe', 'door', 'bed', 'desk', 'hinge', 'lock', 'handle', 'window'],
  wifi: ['wifi', 'wi fi', 'internet', 'router', 'network'],
  transport: ['transport', 'bus', 'shuttle', 'vehicle'],
  inventory: ['inventory', 'stock', 'missing', 'shortage'],
};
export function normalizeCategory(raw, description = '') {
  const direct = CATEGORIES.find((c) => clean(c.label) === clean(raw) || c.id === clean(raw));
  if (direct) return direct.id;
  const text = clean(raw) + ' | ' + clean(description);
  for (const [cat, words] of Object.entries(CAT_WORDS)) if (words.some((w) => text.includes(w))) return cat;
  return 'access';
}

export function normalizeStatus(raw, hasResolvedDate) {
  const s = clean(raw);
  if (/no access|locked|unavailable|not accessible/.test(s)) return 'no_access';
  if (/done|fixed|complete|resolved|closed|finished|^yes$/.test(s)) return 'done';
  if (/progress|ongoing|working|attended|started|partial/.test(s)) return 'in_progress';
  if (/pending|open|new/.test(s)) return 'pending';
  return hasResolvedDate ? 'done' : 'pending';
}

export function parseDate(v, { monthFirst = false } = {}) {
  if (v === '' || v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000)); // Excel serial
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m; y = +y < 100 ? 2000 + +y : +y;
    const [day, month] = monthFirst ? [+b, +a] : [+a, +b]; // day-first by default (Botswana)
    const d = new Date(Date.UTC(y, month - 1, day, 8, 0, 0));
    return d.getUTCMonth() === month - 1 ? d : null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function semesterForDate(iso) {
  const t = new Date(iso).getTime();
  let found = SEMESTERS[0];
  for (const s of SEMESTERS) if (t >= new Date(s.start).getTime()) found = s;
  return found;
}

// Old Main Boys uses floor codes like F03/S18/G25 (zero-padded); the sheet sometimes has "F3".
const padFloorCode = (c) => (/^[FGS]\d$/i.test(c) ? c[0].toUpperCase() + '0' + c[1] : c);
const isTrue = (v) => /^(y|yes|true|1|urgent|high)$/i.test(String(v ?? '').trim());

// Turns one spreadsheet row into a ticket document (or { skip: reason }).
export function buildTicket(row, map, ctx) {
  const get = (f) => (map[f] === undefined ? '' : row[map[f]]);
  const description = String(get('description') ?? '').trim();
  const roomRaw = padFloorCode(String(get('room') ?? '').trim());
  if (!description && !roomRaw) return { skip: 'empty row' };

  const block = normalizeBlock(get('location'), ctx.aliases);
  if (!block) return { skip: 'unmapped location', raw: String(get('location') ?? '').trim() || '(blank)' };

  const reported = parseDate(get('reportedAt'), ctx) || (ctx.defaultDate ? new Date(ctx.defaultDate + 'T08:00:00Z') : null);
  if (!reported) return { skip: 'no reported date (use --default-date)' };
  const resolved = parseDate(get('resolvedAt'), ctx);
  const status = normalizeStatus(get('status'), !!resolved);
  const flags = [];
  if (!String(get('status') ?? '').trim() && !resolved) flags.push('status blank (treated as open)');
  let resolvedAt = null;
  if (status === 'done') {
    if (resolved) resolvedAt = resolved;
    else { resolvedAt = reported; flags.push('closed with no close date (set to reported date)'); }
    if (resolvedAt < reported) return { skip: 'closed before reported' };
  }

  const reportedAt = reported.toISOString();
  const legacyId = String(get('legacyId') ?? '').trim();
  const noteText = String(get('notes') ?? '').trim();
  const notes = [{ text: 'Imported from the legacy tracker (' + ctx.sheet + ', row ' + ctx.rowNumber + (legacyId ? ', ' + legacyId : '') + ').', byName: 'Import', byRole: 'system', at: new Date().toISOString(), isSystem: true }];
  if (noteText) notes.push({ text: noteText, byName: 'Legacy tracker', byRole: 'imported', at: (resolvedAt || reported).toISOString ? (resolvedAt || reported).toISOString() : reportedAt });

  const description_ = description || '(no description in legacy tracker)';
  const slug = (legacyId || ctx.sheet + '-' + ctx.rowNumber).replace(/[^a-z0-9]+/gi, '').toLowerCase();
  return {
    flags,
    id: 'legacy-' + slug,
    doc: {
      code: legacyId || 'LEG-' + ctx.rowNumber,
      block, room: roomRaw, category: normalizeCategory(get('category'), description_), description: description_,
      reportedBy: String(get('reportedBy') ?? '').trim(), contact: String(get('contact') ?? '').trim(),
      urgent: isTrue(get('urgent')), photo: null, status, reportedAt, resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
      reportedByUid: ctx.adminUid || 'legacy-import', notes, semester: semesterForDate(reportedAt).id,
      importedFrom: 'legacy-tracker', legacyRef: ctx.sheet + '!' + ctx.rowNumber,
    },
  };
}

export function publicMirror(t) {
  return { code: t.code, block: t.block, room: t.room, category: t.category, description: t.description, status: t.status, urgent: !!t.urgent, reportedAt: t.reportedAt, resolvedAt: t.resolvedAt || null };
}
