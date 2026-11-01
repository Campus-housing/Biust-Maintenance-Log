// Imports a legacy tracker spreadsheet into Firestore as tickets. DRY-RUN BY DEFAULT — nothing is written unless --commit.
//
//   node tools/import-legacy/import.mjs <file.xlsx> [options]
//     --sheet <name>            only this sheet (default: every sheet that has a header AND a reported-date column)
//     --aliases <file.json>     extra location aliases { "raw text": "App location" } (default: aliases.tracker.json if present)
//     --default-date YYYY-MM-DD used for rows with no reported date
//     --month-first             read 03/09/2026 as March 9 (default is day-first)
//     --show N                  print N example documents that would be written
//     --commit --service-account <key.json> --admin-uid <uid>    actually write (needs: npm install firebase-admin, in this folder)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWorkbook, sheetRows, detectHeader, buildTicket, publicMirror } from './lib.mjs';
import { BLOCKS, SEMESTERS } from '../../src/utils/constants.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && /\.xlsx?$|\.csv$/i.test(a));
const opt = (name) => { const i = args.indexOf('--' + name); return i === -1 ? undefined : args[i + 1]; };
const flag = (name) => args.includes('--' + name);
if (!file) { console.error('usage: node import.mjs <file.xlsx> [--sheet NAME] [--commit ...]  (see header of this file)'); process.exit(1); }

const aliasFile = opt('aliases') || (fs.existsSync(path.join(here, 'aliases.tracker.json')) ? path.join(here, 'aliases.tracker.json') : null);
const aliases = aliasFile ? JSON.parse(fs.readFileSync(aliasFile, 'utf8')) : {};
const baseCtx = { aliases, defaultDate: opt('default-date'), monthFirst: flag('month-first'), adminUid: opt('admin-uid') };

const wb = readWorkbook(file);
const built = [];
const skipped = {}; const skipExamples = {}; const unmappedLocations = {}; const flagged = [];
const notes = [];

for (const name of wb.SheetNames) {
  if (opt('sheet') && opt('sheet') !== name) continue;
  const rows = sheetRows(wb, name);
  const h = detectHeader(rows);
  if (!h) { notes.push(`Sheet "${name}": skipped (no recognisable header row)`); continue; }
  if (h.map.reportedAt === undefined && !baseCtx.defaultDate && !opt('sheet')) { notes.push(`Sheet "${name}": skipped (no reported-date column — looks like a dashboard, not data)`); continue; }
  let count = 0;
  rows.slice(h.index + 1).forEach((row, i) => {
    const ctx = { ...baseCtx, sheet: name, rowNumber: h.index + 2 + i };
    const r = buildTicket(row, h.map, ctx);
    if (r.skip) {
      skipped[r.skip] = (skipped[r.skip] || 0) + 1;
      (skipExamples[r.skip] ||= []).length < 3 && skipExamples[r.skip].push(`${name} row ${ctx.rowNumber}`);
      if (r.skip === 'unmapped location') unmappedLocations[r.raw] = (unmappedLocations[r.raw] || 0) + 1;
      return;
    }
    (r.flags || []).forEach((f) => flagged.push(`${r.doc.code}: ${f}`));
    built.push(r); count++;
  });
  notes.push(`Sheet "${name}": ${count} tickets built`);
}

// ---------- report ----------
const tally = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const docs = built.map((b) => b.doc);
const ms = (d) => new Date(d).getTime();
const closed = docs.filter((d) => d.status === 'done' && d.resolvedAt);
const hours = closed.map((d) => (ms(d.resolvedAt) - ms(d.reportedAt)) / 3600000).sort((a, b) => a - b);
const avg = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null;
const med = hours.length ? hours[Math.floor(hours.length / 2)] : null;
const dayFmt = (h) => (h == null ? '—' : h >= 48 ? (h / 24).toFixed(1) + ' days' : h.toFixed(1) + ' h');
const openDocs = docs.filter((d) => d.status !== 'done');
const now = Date.now();
const oldest = openDocs.sort((a, b) => ms(a.reportedAt) - ms(b.reportedAt)).slice(0, 5);

console.log(`\n=== ${flag('commit') ? 'COMMIT' : 'DRY RUN'} — ${path.basename(file)} ===`);
notes.forEach((n) => console.log('  ' + n));
console.log(`\nTickets that would be imported: ${docs.length}`);
console.log('  by status  :', JSON.stringify(tally(docs, (d) => d.status)));
console.log('  by category:', JSON.stringify(tally(docs, (d) => d.category)));
console.log('  by semester:', JSON.stringify(tally(docs, (d) => (SEMESTERS.find((s) => s.id === d.semester) || {}).short)));
console.log('  date range :', docs.length ? [docs.map((d) => d.reportedAt).sort()[0], docs.map((d) => d.reportedAt).sort().slice(-1)[0]].map((x) => x.slice(0, 10)).join(' → ') : '—');
console.log('  blank room :', docs.filter((d) => !d.room).length, '(shown as "Common area")');
console.log('\nBy location (most reports first):');
Object.entries(tally(docs, (d) => d.block)).sort((a, b) => b[1] - a[1]).forEach(([b, n]) => console.log('  ' + b.padEnd(16) + n));
console.log('\nLocations in this app with no imported reports:', BLOCKS.filter((b) => !docs.some((d) => d.block === b)).join(', ') || 'none');
console.log(`\nResolved tickets: ${closed.length} — average ${dayFmt(avg)}, median ${dayFmt(med)} (recomputed from the dates; the sheet's own "Resolution Time" column is not used)`);
console.log(`Still open: ${openDocs.length}. Longest-waiting:`);
oldest.forEach((d) => console.log(`  ${d.code}  ${d.block} ${d.room || '(area)'}  ${Math.floor((now - ms(d.reportedAt)) / 86400000)} days  — ${d.description.slice(0, 50)}`));

const skipTotal = Object.values(skipped).reduce((a, b) => a + b, 0);
console.log(`\nSkipped rows: ${skipTotal}`);
Object.entries(skipped).forEach(([r, n]) => console.log(`  ${r}: ${n}   e.g. ${skipExamples[r].join(', ')}`));
if (Object.keys(unmappedLocations).length) { console.log('  UNMAPPED LOCATIONS (add to an aliases file with --aliases):'); Object.entries(unmappedLocations).forEach(([l, n]) => console.log(`    "${l}" × ${n}`)); }
if (flagged.length) { console.log(`\nNeeds a look (${flagged.length}):`); flagged.slice(0, 10).forEach((f) => console.log('  ' + f)); }
const dupes = Object.entries(tally(docs, (d) => [d.block, d.room, d.description.toLowerCase(), d.reportedAt.slice(0, 10)].join('|'))).filter(([, n]) => n > 1);
if (dupes.length) console.log(`\nPossible duplicates (same location+room+description+date): ${dupes.length}`);
const n = parseInt(opt('show') || '0', 10);
if (n) { console.log('\nExample documents:'); built.slice(0, n).forEach((b) => console.log(b.id, JSON.stringify(b.doc, null, 1))); }

// ---------- commit ----------
if (!flag('commit')) { console.log('\nDry run only — nothing was written. Re-run with --commit --service-account <key.json> --admin-uid <uid> to import.'); process.exit(0); }
if (!opt('service-account') || !opt('admin-uid')) { console.error('\n--commit needs --service-account <key.json> and --admin-uid <uid>'); process.exit(1); }
let admin;
try { admin = (await import('firebase-admin')).default; } catch { console.error('\nRun "npm install firebase-admin" inside tools/import-legacy first.'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(opt('service-account'), 'utf8'))) });
const db = admin.firestore();
let written = 0;
for (let i = 0; i < built.length; i += 200) {
  const batch = db.batch();
  built.slice(i, i + 200).forEach((b) => {
    batch.set(db.collection('tickets').doc(b.id), b.doc);
    batch.set(db.collection('publicBoard').doc(b.id), publicMirror(b.doc));
  });
  await batch.commit(); written += Math.min(200, built.length - i);
  console.log(`  wrote ${written}/${built.length}`);
}
console.log('Done. Re-running is safe: documents have fixed ids, so they are overwritten, not duplicated.');
