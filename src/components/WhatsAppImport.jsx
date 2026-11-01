import { useRef, useState } from 'react';
import { addDoc, getDocs, query, where } from 'firebase/firestore';
import { submissionsCol, ticketsCol } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { BLOCK_GROUPS, BLOCKS, CATEGORIES } from '../utils/constants';
import { formatDate, blockLabel } from '../utils/helpers';
import { parseWhatsAppChat, extractReports } from '../utils/whatsapp';
import RoomField from './RoomField';

// Turns a WhatsApp "Export chat" file into reports waiting in the Inbox, keeping each message's original date.
export default function WhatsAppImport({ onClose }) {
  const { currentUser, isAdmin, assignedBlocks } = useAuth();
  const showToast = useToast();
  const fileRef = useRef(null);
  const [stage, setStage] = useState('pick'); // pick | review | done
  const [monthFirst, setMonthFirst] = useState(false);
  const [defaultBlock, setDefaultBlock] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);

  const allowed = isAdmin ? BLOCKS : assignedBlocks;
  const groups = isAdmin ? BLOCK_GROUPS : [{ label: 'Your blocks', options: assignedBlocks }];

  // Keys of WhatsApp reports already in the system, so importing the same chat twice never duplicates.
  async function knownKeys() {
    const keys = new Set();
    try {
      const subs = isAdmin ? query(submissionsCol, where('source', '==', 'whatsapp')) : query(submissionsCol, where('block', 'in', assignedBlocks.slice(0, 10)));
      (await getDocs(subs)).docs.forEach((d) => { const k = d.data().sourceKey; if (k) keys.add(k); });
      const tix = isAdmin ? query(ticketsCol, where('source', '==', 'whatsapp')) : query(ticketsCol, where('reportedByUid', '==', currentUser.uid));
      (await getDocs(tix)).docs.forEach((d) => { const k = d.data().sourceKey; if (k) keys.add(k); });
    } catch (e) {
      console.error('could not check for earlier imports', e);
    }
    return keys;
  }

  async function handleFile(file) {
    setError(''); setBusy(true);
    try {
      let text;
      if (/\.zip$/i.test(file.name)) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const entry = Object.values(zip.files).find((f) => !f.dir && /\.txt$/i.test(f.name));
        if (!entry) throw new Error('That zip has no chat (.txt) file inside.');
        text = await entry.async('string');
      } else {
        text = await file.text();
      }
      const { messages } = parseWhatsAppChat(text, monthFirst ? { monthFirst: true } : {});
      if (!messages.length) { setError("That doesn't look like a WhatsApp chat export. Export the chat \"Without media\" and choose the .txt (or .zip) file."); setBusy(false); return; }
      const { drafts } = extractReports(messages);
      const known = await knownKeys();
      const prepared = drafts.map((d) => ({
        ...d,
        location: d.location && allowed.includes(d.location) ? d.location : (defaultBlock && allowed.includes(defaultBlock) ? defaultBlock : ''),
        duplicate: known.has(d.sourceKey),
        include: !d.probablyResolved && !known.has(d.sourceKey),
      }));
      setRows(prepared);
      setSummary({
        messages: messages.length, people: new Set(messages.map((m) => m.sender)).size, reports: prepared.length,
        fixed: prepared.filter((r) => r.probablyResolved).length, dupes: prepared.filter((r) => r.duplicate).length,
        from: messages[0].at, to: messages[messages.length - 1].at,
      });
      setStage('review');
    } catch (e) {
      console.error(e);
      setError(e.message || 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }

  const update = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.include);

  async function send() {
    const bad = chosen.filter((r) => !r.location || !(r.description || '').trim());
    if (bad.length) { setError(bad.length + (bad.length === 1 ? ' ticked report still needs' : ' ticked reports still need') + ' a location (choose one, or untick it). Nothing has been sent.'); return; }
    setError(''); setBusy(true);
    const now = new Date().toISOString();
    const done = new Set();
    try {
      for (let i = 0; i < chosen.length; i += 20) {
        await Promise.all(chosen.slice(i, i + 20).map(async (r) => {
          await addDoc(submissionsCol, {
            block: r.location, room: (r.room || '').trim(), category: r.category || 'access', description: r.description.trim(),
            reportedBy: r.sender || '', contact: r.contact || '', urgent: !!r.urgent, photo: null, rawText: r.rawText || '',
            status: 'pending', submittedAt: now, originalReportedAt: r.originalReportedAt, source: 'whatsapp', sourceKey: r.sourceKey,
            importedByUid: currentUser.uid,
          });
          done.add(r.sourceKey);
        }));
      }
      setSent(done.size); setStage('done');
      showToast(done.size + ' reports sent to the Inbox');
    } catch (e) {
      console.error(e);
      setRows((rs) => rs.filter((r) => !done.has(r.sourceKey))); // only what did NOT go through stays, so a retry can't duplicate
      setError(done.size + ' of ' + chosen.length + ' were sent. The rest are still listed — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const visible = rows.map((r, i) => ({ r, i })).filter(({ r }) => showHidden || (!r.probablyResolved && !r.duplicate));

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="display">Import from WhatsApp</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {stage === 'pick' && (
          <>
            <p style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 10px' }}>
              Bring the reports from a WhatsApp group into the app, with their original dates. The file is read <strong>on your device</strong> — nothing is uploaded except the reports you choose to send.
            </p>
            <div className="empty-card" style={{ textAlign: 'left', padding: 14, marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
              <strong>On your phone:</strong> open the group → ⋮ (menu) → <em>More</em> → <em>Export chat</em> → <strong>Without media</strong>. Save or share the file to this device, then choose it below. (.txt or .zip both work.)
            </div>
            <label className="field-label">Default location for reports that don't name one</label>
            <select className="input" style={{ margin: '6px 0 10px' }} value={defaultBlock} onChange={(e) => setDefaultBlock(e.target.value)}>
              <option value="">None — I'll choose per report</option>
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>{g.options.map((b) => <option key={b} value={b}>{blockLabel(b)}</option>)}</optgroup>
              ))}
            </select>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, margin: '0 0 14px', color: 'var(--muted)' }}>
              <input type="checkbox" checked={monthFirst} onChange={(e) => setMonthFirst(e.target.checked)} />
              Dates are month-first (e.g. 03/13/2026) — leave unticked for day-first
            </label>
            <input
              ref={fileRef} type="file" accept=".txt,.zip,text/plain,application/zip" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) handleFile(f); e.target.value = ''; }}
            />
            {error && <p className="form-error">{error}</p>}
            <button type="button" className="submit-btn" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>
              {busy ? 'Reading…' : 'Choose the exported chat file'}
            </button>
          </>
        )}

        {stage === 'review' && summary && (
          <>
            <p style={{ fontSize: 12, lineHeight: 1.6, margin: '0 0 10px', color: 'var(--muted)' }}>
              Read {summary.messages} messages from {summary.people} {summary.people === 1 ? 'person' : 'people'} ({formatDate(summary.from)} → {formatDate(summary.to)}).
              Found <strong style={{ color: 'var(--text)' }}>{summary.reports} possible reports</strong>
              {summary.fixed ? ' — ' + summary.fixed + ' look already fixed (someone replied "done")' : ''}{summary.dupes ? ', ' + summary.dupes + ' already imported' : ''}.
              Tick the ones that are still outstanding and fix anything that's wrong.
            </p>
            {(summary.fixed > 0 || summary.dupes > 0) && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 10 }}>
                <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show the already-fixed / already-imported ones too
              </label>
            )}
            {visible.length === 0 && <p className="dim" style={{ fontSize: 13 }}>Nothing outstanding to import.</p>}
            {visible.map(({ r, i }) => (
              <div key={r.sourceKey} className="user-editor" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12, opacity: r.include ? 1 : 0.6 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                  <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} style={{ marginTop: 2 }} />
                  <span>
                    {formatDate(r.originalReportedAt)} · {r.sender}
                    {r.probablyResolved && <span style={{ color: '#4FB477' }}> · ✓ looks fixed ("{r.resolutionText}")</span>}
                    {r.duplicate && <span style={{ color: '#F2A93C' }}> · already imported</span>}
                  </span>
                </label>
                <div className="form-grid-2" style={{ marginBottom: 8 }}>
                  <div>
                    <label className="field-label">Location</label>
                    <select className="input" value={r.location} onChange={(e) => update(i, { location: e.target.value })}>
                      <option value="">Choose…</option>
                      {groups.map((g) => (
                        <optgroup key={g.label} label={g.label}>{g.options.map((b) => <option key={b} value={b}>{blockLabel(b)}</option>)}</optgroup>
                      ))}
                    </select>
                  </div>
                  <RoomField block={r.location} value={r.room || ''} onChange={(v) => update(i, { room: v })} />
                </div>
                <textarea className="input" rows={2} style={{ marginBottom: 8 }} value={r.description} onChange={(e) => update(i, { description: e.target.value })} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select className="input" style={{ width: 'auto', flex: 1 }} value={r.category} onChange={(e) => update(i, { category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <input className="input" style={{ width: 120 }} placeholder="Contact" value={r.contact || ''} onChange={(e) => update(i, { contact: e.target.value })} />
                  <button type="button" className={'urgent-btn' + (r.urgent ? ' urgent-btn-active' : '')} onClick={() => update(i, { urgent: !r.urgent })}>Urgent</button>
                </div>
              </div>
            ))}
            {error && <p className="form-error">{error}</p>}
            <button type="button" className="submit-btn" disabled={busy || chosen.length === 0} onClick={send}>
              {busy ? 'Sending…' : 'Send ' + chosen.length + ' report' + (chosen.length === 1 ? '' : 's') + ' to the Inbox'}
            </button>
            <button type="button" className="link-btn" style={{ display: 'block', margin: '10px auto 0' }} onClick={() => { setStage('pick'); setRows([]); setError(''); }}>Start over</button>
          </>
        )}

        {stage === 'done' && (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              <strong>{sent}</strong> {sent === 1 ? 'report is' : 'reports are'} now waiting in the Inbox, dated as in the chat. Review and accept them there{isAdmin ? ' — or use “Accept all” to turn them into tickets in one go' : ''}.
            </p>
            <button type="button" className="submit-btn" onClick={onClose}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}
