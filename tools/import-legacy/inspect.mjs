// Prints the shape of a spreadsheet so the column/alias mapping can be checked: node inspect.mjs <file.xlsx>
import { readWorkbook, sheetRows, detectHeader } from './lib.mjs';
const file = process.argv[2];
if (!file) { console.error('usage: node inspect.mjs <file.xlsx>'); process.exit(1); }
const wb = readWorkbook(file);
for (const name of wb.SheetNames) {
  const rows = sheetRows(wb, name);
  console.log('\n=== Sheet "' + name + '" — ' + rows.length + ' non-blank rows');
  const h = detectHeader(rows);
  if (!h) { console.log('  (no recognisable header row)'); continue; }
  console.log('  header row #' + (h.index + 1) + ', recognised fields:', JSON.stringify(h.map));
  rows[h.index].forEach((title, c) => {
    if (title === '') return;
    const vals = rows.slice(h.index + 1).map((r) => r[c]).filter((v) => v !== '' && v != null);
    const distinct = [...new Set(vals.map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v))))];
    const field = Object.entries(h.map).find(([, i]) => i === c)?.[0];
    console.log('  col ' + c + ' "' + title + '"' + (field ? '  → ' + field : '  (not imported)') + '  [' + vals.length + ' filled, ' + distinct.length + ' distinct]  e.g. ' + distinct.slice(0, 10).join(' | ').slice(0, 120));
  });
}
