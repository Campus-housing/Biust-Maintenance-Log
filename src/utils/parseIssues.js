import * as XLSX from 'xlsx';
import { BLOCKS } from './constants';

// Lightweight keyword guesses — always editable by whoever reviews the draft,
// this just saves them from starting with every field blank.
const CATEGORY_KEYWORDS = {
  electricity: ['light', 'socket', 'power', 'switch', 'electric', 'bulb', 'plug', 'trip', 'spark', 'fan', 'fuse', 'heater', 'lamp', 'extension'],
  plumbing: ['tap', 'leak', 'pipe', 'toilet', 'shower', 'drain', 'geyser', 'water', 'flush', 'sink'],
  furniture: ['chair', 'table', 'wardrobe', 'door', 'bed', 'desk', 'hinge', 'lock', 'handle', 'window'],
  wifi: ['wifi', 'wi-fi', 'internet', 'router', 'network', 'connection'],
  transport: ['bus', 'shuttle', 'transport', 'van'],
  inventory: ['missing', 'shortage', 'stock', 'need more', 'inventory'],
};

function guessCategory(text) {
  const lower = (text || '').toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) return cat;
  }
  return 'access';
}


const compact = (str) => String(str).toLowerCase().replace(/[^a-z0-9]+/g, '');

// Maps a spreadsheet's location text to one of this app's locations ("Block 4" -> "4", "Old Sekgoma 3" -> "Sekgoma 3").
export function normalizeBlock(raw) {
  const r = String(raw == null ? '' : raw).trim();
  if (!r) return '';
  const key = compact(r.replace(/^(block|blk)\s+/i, '')).replace(/^old(?=sekgoma)/, '');
  return BLOCKS.find((b) => compact(b) === key) || '';
}

// Only an EXPLICIT location in the text counts ("BPC", "Fengyue 3", "block 4"). A bare code such as "F27" is a
// room/floor code (e.g. inside Old Main Boys), never a location — guessing it would misfile reports.
const NAMED_BLOCKS = BLOCKS.filter((b) => !/^[1-6A-F]$/.test(b)).sort((a, b) => b.length - a.length);
function findBlockInText(text) {
  const withoutOld = text.replace(/\bold\s+(?=sekgoma)/i, '');
  for (const name of NAMED_BLOCKS) {
    const re = new RegExp('\\b' + name.replace(/\s+/g, '\\s*') + '\\b', 'i');
    const m = withoutOld.match(re);
    if (m) return { block: name, rest: (withoutOld.slice(0, m.index) + ' ' + withoutOld.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() };
  }
  const m = withoutOld.match(/\bblock\s*([1-6a-f])\b/i);
  if (m) return { block: m[1].toUpperCase(), rest: (withoutOld.slice(0, m.index) + ' ' + withoutOld.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() };
  return null;
}
const padFloorCode = (code) => (/^[FGS]\d$/.test(code) ? code[0] + '0' + code[1] : code);

function emptyDraft(rawText) {
  return { rawText, location: '', room: '', description: rawText, contact: '', category: 'access', urgent: false };
}

// Parses one free-text line like "F27 lights not working 71441150" into a
// best-guess draft. The leading code (e.g. "F27") is NOT assumed to match a
// real block in this app's location list — it's shown to the reviewer as a
// hint, and they pick the actual location themselves before accepting.
function parseLine(line) {
  const raw = line.trim();
  if (!raw) return null;

  let rest = raw;
  let contact = '';
  const phoneMatch = rest.match(/(\+?\d[\d\s-]{6,}\d)\s*$/);
  if (phoneMatch) {
    contact = phoneMatch[1].replace(/\s+/g, '').trim();
    rest = rest.slice(0, phoneMatch.index).trim();
  }

  let location = '';
  const found = findBlockInText(rest);
  if (found) { location = found.block; rest = found.rest; }

  let room = '';
  const roomWord = rest.match(/\b(?:room|rm)\.?\s*([A-Za-z]{0,2}\d{1,3}[A-Za-z]?)\b/i);
  if (roomWord) {
    room = padFloorCode(roomWord[1].toUpperCase());
    rest = (rest.slice(0, roomWord.index) + ' ' + rest.slice(roomWord.index + roomWord[0].length)).replace(/\s+/g, ' ').trim();
  } else {
    const codeMatch = rest.match(/^([A-Za-z])\s*-?\s*(\d{1,3})([A-Za-z]?)\b[\s:,-]*(.*)$/);
    const numMatch = rest.match(/^(\d{1,3}[A-Za-z]?)\b[\s:,-]*(.*)$/);
    if (codeMatch) {
      room = padFloorCode(codeMatch[1].toUpperCase() + codeMatch[2] + codeMatch[3].toUpperCase());
      rest = codeMatch[4].trim();
    } else if (numMatch) {
      room = numMatch[1].toUpperCase();
      rest = numMatch[2].trim();
    }
  }

  const description = rest || raw;
  return {
    rawText: raw,
    location,
    room,
    description,
    contact,
    category: guessCategory(description),
    urgent: /urgent|asap|emergency/i.test(raw),
  };
}

export function parseIssueText(text) {
  return (text || '')
    .split('\n')
    .map(parseLine)
    .filter(Boolean);
}

// Reads an uploaded CSV/XLSX file. Recognized column headers (case-insensitive,
// any of these names): Location/Block, Room, Category, Description/Issue,
// Contact/Phone, Urgent. Unrecognized columns are ignored, missing ones are
// left blank for the reviewer to fill in.
export async function parseIssueFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows
    .map((row) => {
      const get = (...keys) => {
        for (const k of keys) {
          const foundKey = Object.keys(row).find((rk) => rk.toLowerCase().trim() === k);
          if (foundKey && String(row[foundKey]).trim() !== '') return String(row[foundKey]).trim();
        }
        return '';
      };
      const description = get('description', 'issue', 'desc', 'what\'s wrong');
      if (!description && !get('room', 'room number', 'rm')) return null;
      return {
        rawText: Object.values(row).join(' ').trim(),
        location: normalizeBlock(get('location', 'block')),
        room: get('room', 'room number', 'rm'),
        description: description || '(no description given)',
        contact: get('contact', 'phone', 'access contact'),
        category: get('category').toLowerCase() || guessCategory(description),
        urgent: /^(y|yes|true|1)$/i.test(get('urgent')),
      };
    })
    .filter(Boolean);
}

export { emptyDraft };
