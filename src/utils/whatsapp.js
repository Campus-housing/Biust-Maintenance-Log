import { parseLine, findBlockInText, guessCategory, padFloorCode, CATEGORY_KEYWORDS } from './parseIssues';

// ---------------------------------------------------------------------------------------------------------
// Reads a WhatsApp "Export chat" text file (Android or iPhone) and pulls out probable maintenance reports.
// Everything happens in the browser; nothing is uploaded. Heuristic by nature — every row is reviewed by a
// person before anything is saved.
// ---------------------------------------------------------------------------------------------------------

const CONTROL = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const DATE = '(\\d{4}[/.\\-]\\d{1,2}[/.\\-]\\d{1,2}|\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{2,4})';
const TIME = '(\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s?[AaPp]\\.?[Mm]\\.?)?)';
const IOS_MSG = new RegExp('^\\[' + DATE + ',?\\s+' + TIME + '\\]\\s+([^:\\n]+?):\\s?([\\s\\S]*)$');
const AND_MSG = new RegExp('^' + DATE + ',?\\s+' + TIME + '\\s+-\\s+([^:\\n]+?):\\s?([\\s\\S]*)$');
const IOS_SYS = new RegExp('^\\[' + DATE + ',?\\s+' + TIME + '\\]\\s+([\\s\\S]*)$');
const AND_SYS = new RegExp('^' + DATE + ',?\\s+' + TIME + '\\s+-\\s+([\\s\\S]*)$');

const NOISE_MESSAGE = /^(<media omitted>|image omitted|video omitted|audio omitted|sticker omitted|document omitted|gif omitted|this message was deleted|you deleted this message|null)$/i;

function stamp(dateStr, timeStr, monthFirst) {
  const parts = dateStr.split(/[/.-]/).map(Number);
  const yearFirst = String(dateStr).split(/[/.-]/)[0].length === 4;
  const [a, b, yRaw] = yearFirst ? [parts[2], parts[1], parts[0]] : parts; // year-first files are day-last: yyyy/mm/dd
  const y = yRaw < 100 ? 2000 + yRaw : yRaw;
  const [day, month] = yearFirst ? [a, b] : monthFirst ? [b, a] : [a, b];
  const t = timeStr.trim();
  let [hh, mm, ss] = t.replace(/\s?[AaPp]\.?[Mm]\.?$/, '').split(':').map(Number);
  ss = ss || 0;
  if (/[Pp]\.?[Mm]\.?$/.test(t) && hh < 12) hh += 12;
  if (/[Aa]\.?[Mm]\.?$/.test(t) && hh === 12) hh = 0;
  const d = new Date(y, month - 1, day, hh, mm, ss);
  return Number.isNaN(d.getTime()) ? null : d;
}

// -> { messages: [{ at: ISO, sender, text }] } oldest first. Dates are read day-first unless the file proves
// month-first (a "second number" above 12) or monthFirst is forced.
export function parseWhatsAppChat(raw, { monthFirst } = {}) {
  const lines = String(raw || '').replace(CONTROL, '').replace(/\u202f/g, ' ').split(/\r?\n/);
  const found = []; // { dateStr, timeStr, sender, text }
  for (const line of lines) {
    let m = IOS_MSG.exec(line) || AND_MSG.exec(line);
    if (m) { found.push({ dateStr: m[1], timeStr: m[2], sender: m[3].replace(/^~\s*/, '').trim(), text: m[4] }); continue; }
    m = IOS_SYS.exec(line) || AND_SYS.exec(line);
    if (m) { found.push({ dateStr: m[1], timeStr: m[2], sender: '', text: m[3] }); continue; }
    if (found.length) found[found.length - 1].text += '\n' + line;
  }
  let mf = !!monthFirst;
  if (monthFirst === undefined) {
    const nums = found.filter((f) => f.dateStr.split(/[/.-]/)[0].length !== 4).map((f) => f.dateStr.split(/[/.-]/).map(Number));
    mf = !nums.some((n) => n[0] > 12) && nums.some((n) => n[1] > 12);
  }
  const messages = found
    .filter((f) => f.sender && !NOISE_MESSAGE.test(f.text.trim()))
    .map((f) => ({ d: stamp(f.dateStr, f.timeStr, mf), sender: f.sender, text: f.text.trim() }))
    .filter((m) => m.d && m.text)
    .map((m) => ({ at: m.d.toISOString(), sender: m.sender, text: m.text }))
    .sort((x, y) => (x.at < y.at ? -1 : 1));
  return { messages, monthFirst: mf };
}

// ---------- reading messages for reports ----------
const ISSUE_WORDS = /(not working|doesn'?t work|isn'?t working|broken|leak|faulty|damaged|jammed|blocked|loose|burst|missing|cracked|stuck|no (water|power|light|electricity|network|wifi)|flicker|spark|drip|overflow|fallen|detached|bereke|come off|came off|short.?circuit)/i;
const RES_WORDS = /\b(done|fixed|attended|resolved|completed|sorted|replaced|repaired|working now|ok now|cleared|installed|solved)\b/i;
const HEADER_CATEGORY = [
  [/electric(al|ity)?\b/i, 'electricity'], [/plumbing/i, 'plumbing'], [/carpentry|furniture/i, 'furniture'],
  [/inventory/i, 'inventory'], [/wi-?fi|internet|network/i, 'wifi'], [/transport/i, 'transport'],
];
const hasCategoryWord = (t) => Object.values(CATEGORY_KEYWORDS).some((words) => words.some((w) => t.toLowerCase().includes(w)));

// A header line names a location and/or a category for the lines that follow it, e.g.
// "OLD MAIN BOYS ISSUES" / "ELECTRICITY". Returns { location, category } or null.
function headerOf(line) {
  const t = line.replace(/[*_~:\-–—=•]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 70 || t.split(' ').length > 9) return null;
  if (/\d{6,}/.test(t) || ISSUE_WORDS.test(t) || RES_WORDS.test(t)) return null;
  const block = findBlockInText(t);
  const cat = HEADER_CATEGORY.find(([re]) => re.test(t));
  if (/\b[A-Za-z]\d{1,3}\b/.test(t) && !block) return null; // a bare room code means it's a report, not a header
  if (!block && !cat) return null;
  return { location: block ? block.block : '', category: cat ? cat[1] : '' };
}

function roomsMentioned(line) {
  const out = new Set();
  for (const m of line.matchAll(/\b([A-Za-z]\d{1,3}[A-Za-z]?|\d{1,3}[A-Za-z])\b/g)) out.add(padFloorCode(m[1].toUpperCase()));
  if (line.length <= 20) for (const m of line.matchAll(/\b(\d{1,3})\b/g)) out.add(m[1]);
  return [...out];
}

function keyOf(msg, line) {
  let h = 5381;
  const s = msg.at + '|' + msg.sender + '|' + line;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'wa-' + (h >>> 0).toString(36) + '-' + s.length;
}

// -> { drafts, skipped } — drafts are shaped like the bulk-import drafts plus sender/original date/flags.
export function extractReports(messages) {
  const drafts = [];
  const resolutions = [];
  let skipped = 0;
  for (const msg of messages) {
    const ctx = { location: '', category: '' };
    for (const rawLine of msg.text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.length > 400) continue;
      const header = headerOf(line);
      if (header) {
        if (header.location) ctx.location = header.location;
        if (header.category) ctx.category = header.category;
        continue;
      }
      const parsed = parseLine(line);
      if (!parsed) continue;
      if (RES_WORDS.test(line) && !ISSUE_WORDS.test(line)) {
        resolutions.push({ at: msg.at, text: line, rooms: roomsMentioned(line) });
        continue;
      }
      if (!(parsed.room || parsed.contact || ISSUE_WORDS.test(line) || hasCategoryWord(line))) { skipped++; continue; }
      const lineCat = hasCategoryWord(line) ? guessCategory(line) : '';
      drafts.push({
        ...parsed,
        location: parsed.location || ctx.location,
        category: lineCat || ctx.category || parsed.category,
        sender: msg.sender, originalReportedAt: msg.at, source: 'whatsapp', sourceKey: keyOf(msg, line),
        include: true, probablyResolved: false,
      });
    }
  }
  // A later "F27 done" from anyone marks earlier reports for that room as probably already fixed.
  for (const r of resolutions) {
    for (const d of drafts) {
      if (!d.probablyResolved && d.room && r.rooms.includes(d.room.toUpperCase()) && d.originalReportedAt <= r.at) {
        d.probablyResolved = true; d.include = false; d.resolvedAt = r.at; d.resolutionText = r.text.slice(0, 80);
      }
    }
  }
  return { drafts, skipped, resolutionLines: resolutions.length };
}
