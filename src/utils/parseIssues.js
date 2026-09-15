import * as XLSX from 'xlsx';

// Lightweight keyword guesses — always editable by whoever reviews the draft,
// this just saves them from starting with every field blank.
const CATEGORY_KEYWORDS = {
  electricity: ['light', 'socket', 'power', 'switch', 'electric', 'bulb', 'plug', 'trip', 'spark'],
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
  let room = '';
  const codeMatch = rest.match(/^([A-Za-z]{1,4})\s*-?\s*(\d{1,4})\b\s*(.*)$/);
  if (codeMatch) {
    location = codeMatch[1].toUpperCase();
    room = codeMatch[2];
    rest = codeMatch[3].trim();
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
        location: get('location', 'block'),
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
