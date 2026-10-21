import * as XLSX from 'xlsx';
import { categoryMeta, statusMeta, semesterOf, resolutionMs, openAgeMs } from './helpers';

export function downloadWorkbook(list, filenameHint) {
  const headers = ['Code', 'Location', 'Room', 'Category', 'Description', 'Status', 'Urgent', 'Reported By', 'Reported At', 'Resolved At', 'Resolution (hours)', 'Days Open', 'Semester', 'Notes'];
  const rows = list.map((t) => [
    t.code || '', t.block || '', t.room || '', categoryMeta(t.category).label, t.description || '',
    statusMeta(t.status).label, t.urgent ? 'Yes' : 'No', t.reportedBy || '', t.reportedAt || '', t.resolvedAt || '',
    resolutionMs(t) != null ? Math.round((resolutionMs(t) / 3600000) * 10) / 10 : '', openAgeMs(t) != null ? Math.floor(openAgeMs(t) / 86400000) : '', semesterOf(t).label,
    Array.isArray(t.notes) ? t.notes.map((n) => n.byName + ': ' + n.text).join(' | ') : '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 36 }, { wch: 12 }, { wch: 7 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tickets');
  XLSX.writeFile(wb, 'bmf-log-' + String(filenameHint).replace(/\s+/g, '-').toLowerCase() + '-' + new Date().toISOString().slice(0, 10) + '.xlsx');
}
