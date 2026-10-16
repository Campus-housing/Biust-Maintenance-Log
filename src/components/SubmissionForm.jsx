import { useRef, useState } from 'react';
import { addDoc } from 'firebase/firestore';
import { submissionsCol } from '../firebase';
import { BLOCK_GROUPS, CATEGORIES } from '../utils/constants';
import { parseIssueText, parseIssueFile } from '../utils/parseIssues';

function newSubmissionBase() {
  return { submittedAt: new Date().toISOString(), status: 'pending' };
}

export default function SubmissionForm({ onClose }) {
  const [mode, setMode] = useState('single');

  // single-issue fields
  const [block, setBlock] = useState(BLOCK_GROUPS[0].options[0]);
  const [room, setRoom] = useState('');
  const [category, setCategory] = useState('electricity');
  const [description, setDescription] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [contact, setContact] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [photo, setPhoto] = useState(null);
  const fileInputRef = useRef(null);

  // bulk fields
  const [bulkText, setBulkText] = useState('');
  const [drafts, setDrafts] = useState(null);
  const csvInputRef = useRef(null);
  const [parseError, setParseError] = useState('');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(0);

  function handlePhotoFile(file) {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 700;
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height >= width && height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        setPhoto(canvas.toDataURL('image/jpeg', 0.5));
      } catch (e) {
        console.error(e);
        setError('Could not process that photo — try a different one.');
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); setError('Could not read that photo — try a different one.'); };
    img.src = objectUrl;
  }

  async function submitSingle() {
    if (!block || !room.trim() || !description.trim()) {
      setError('Please add a location, room number, and a description.');
      return;
    }
    setError(''); setSaving(true);
    try {
      await addDoc(submissionsCol, {
        ...newSubmissionBase(),
        block, room: room.trim(), category, description: description.trim(),
        reportedBy: reportedBy.trim(), contact: contact.trim(), urgent: !!urgent, photo: photo || null,
      });
      setDone(1);
    } catch (e) {
      console.error(e);
      setError('Could not submit. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  function runTextParse() {
    setParseError('');
    const parsed = parseIssueText(bulkText);
    if (parsed.length === 0) { setParseError('No lines found to parse.'); return; }
    setDrafts(parsed);
  }

  async function runFileParse(file) {
    setParseError('');
    try {
      const parsed = await parseIssueFile(file);
      if (parsed.length === 0) { setParseError('Could not find any rows with a description or room number in that file.'); return; }
      setDrafts(parsed);
    } catch (e) {
      console.error(e);
      setParseError('Could not read that file. Make sure it\'s a .csv or .xlsx.');
    }
  }

  function updateDraft(i, patch) {
    setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function removeDraft(i) {
    setDrafts((ds) => ds.filter((_, idx) => idx !== i));
  }

  async function submitAllDrafts() {
    if (!drafts || drafts.length === 0) return;
    setError(''); setSaving(true);
    let count = 0;
    try {
      for (const d of drafts) {
        if (!d.location || !d.room || !d.description) continue; // skip incomplete rows silently, they stay in the list
        // eslint-disable-next-line no-await-in-loop
        await addDoc(submissionsCol, {
          ...newSubmissionBase(),
          block: d.location, room: d.room, category: d.category || 'access', description: d.description,
          reportedBy: '', contact: d.contact || '', urgent: !!d.urgent, photo: null, rawText: d.rawText || '',
        });
        count++;
      }
      setDone(count);
    } catch (e) {
      console.error(e);
      setError('Some reports may not have saved — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (done > 0) {
    return (
      <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-card">
          <div className="modal-header">
            <h2 className="display">Thanks!</h2>
            <button type="button" className="icon-btn" onClick={onClose}>✕</button>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            {done === 1 ? 'Your report has' : done + ' reports have'} been sent to the RA for that block to review. No account needed on your end.
          </p>
          <button type="button" className="submit-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="display">Report an issue</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <p className="dim" style={{ fontSize: 12, marginTop: -8, marginBottom: 14 }}>
          No login needed — this goes to the RA for that block to review before it's actioned.
        </p>

        <div className="cat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 14 }}>
          <button type="button" className={'cat-btn' + (mode === 'single' ? ' cat-btn-active' : '')} onClick={() => setMode('single')}>
            <span className="cat-btn-label">One issue</span>
          </button>
          <button type="button" className={'cat-btn' + (mode === 'bulk' ? ' cat-btn-active' : '')} onClick={() => setMode('bulk')}>
            <span className="cat-btn-label">Multiple issues</span>
          </button>
        </div>

        {mode === 'single' ? (
          <>
            <div className="form-grid-2">
              <div>
                <label className="field-label">Location</label>
                <select className="input" value={block} onChange={(e) => setBlock(e.target.value)}>
                  {BLOCK_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map((b) => <option key={b} value={b}>{b}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Room</label>
                <input className="input" placeholder="e.g. 17" value={room} onChange={(e) => setRoom(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label">Category</label>
              <div className="cat-grid">
                {CATEGORIES.map((c) => (
                  <button
                    type="button" key={c.id}
                    className={'cat-btn' + (category === c.id ? ' cat-btn-active' : '')}
                    onClick={() => setCategory(c.id)}
                  >
                    <span>{c.icon}</span>
                    <span className="cat-btn-label">{c.label.split('/')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">What's wrong?</label>
              <textarea className="input" rows={2} placeholder="e.g. sockets not working" value={description} onChange={(e) => setDescription(e.target.value)} style={{ marginBottom: 12 }} />
            </div>
            <div className="form-grid-2">
              <div>
                <label className="field-label">Your name (optional)</label>
                <input className="input" placeholder="Name" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Contact (optional)</label>
                <input className="input" placeholder="Phone" value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
            </div>
            <div className="form-row-flex">
              <input
                ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) handlePhotoFile(f); e.target.value = ''; }}
              />
              {photo ? (
                <div className="photo-preview">
                  <img src={photo} alt="attached" />
                  <button type="button" className="photo-remove" onClick={() => setPhoto(null)}>&times;</button>
                </div>
              ) : (
                <button type="button" className="photo-add-btn" onClick={() => fileInputRef.current?.click()}>📷 Add photo (optional)</button>
              )}
              <button type="button" className={'urgent-btn' + (urgent ? ' urgent-btn-active' : '')} onClick={() => setUrgent((u) => !u)}>
                🚩 Urgent
              </button>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button type="button" className="submit-btn" disabled={saving} onClick={submitSingle}>
              {saving ? 'Sending...' : 'Send for review'}
            </button>
          </>
        ) : (
          <>
            {!drafts ? (
              <>
                <label className="field-label">Paste multiple issues, one per line</label>
                <textarea
                  className="input" rows={6} style={{ marginBottom: 8 }}
                  placeholder={'F27 lights not working 71441150\nS18 socket not working\nG27 fan not working'}
                  value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                />
                <button type="button" className="submit-btn" style={{ marginBottom: 14 }} onClick={runTextParse} disabled={!bulkText.trim()}>
                  Scan text
                </button>
                <div className="divider-row"><span className="line"></span><span>or</span><span className="line"></span></div>
                <input
                  ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) runFileParse(f); e.target.value = ''; }}
                />
                <button type="button" className="photo-add-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => csvInputRef.current?.click()}>
                  📄 Upload a CSV or Excel file instead
                </button>
                {parseError && <p className="form-error" style={{ marginTop: 8 }}>{parseError}</p>}
              </>
            ) : (
              <>
                <p className="dim" style={{ fontSize: 12, marginBottom: 10 }}>
                  Found {drafts.length} possible {drafts.length === 1 ? 'issue' : 'issues'}. Check the location on each — it's just a guess from the text and needs confirming. Remove any that aren't real issues.
                </p>
                {drafts.map((d, i) => (
                  <div key={i} className="user-editor" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
                    {d.rawText && <p className="dim mono" style={{ fontSize: 10, marginBottom: 6 }}>"{d.rawText}"</p>}
                    <div className="form-grid-2" style={{ marginBottom: 8 }}>
                      <div>
                        <label className="field-label">Location</label>
                        <select className="input" value={d.location} onChange={(e) => updateDraft(i, { location: e.target.value })}>
                          <option value="">Choose...</option>
                          {BLOCK_GROUPS.map((g) => (
                            <optgroup key={g.label} label={g.label}>
                              {g.options.map((b) => <option key={b} value={b}>{b}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Room</label>
                        <input className="input" value={d.room} onChange={(e) => updateDraft(i, { room: e.target.value })} />
                      </div>
                    </div>
                    <label className="field-label">Description</label>
                    <textarea className="input" rows={2} style={{ marginBottom: 8 }} value={d.description} onChange={(e) => updateDraft(i, { description: e.target.value })} />
                    <label className="field-label">Access contact (optional)</label>
                    <input className="input" placeholder="Phone" style={{ marginBottom: 8 }} value={d.contact || ''} onChange={(e) => updateDraft(i, { contact: e.target.value })} />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select className="input" style={{ width: 'auto', flex: 1 }} value={d.category} onChange={(e) => updateDraft(i, { category: e.target.value })}>
                        {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                      </select>
                      <button
                        type="button" className={'urgent-btn' + (d.urgent ? ' urgent-btn-active' : '')}
                        onClick={() => updateDraft(i, { urgent: !d.urgent })}
                      >🚩</button>
                      <button type="button" className="icon-btn" onClick={() => removeDraft(i)} aria-label="Remove">🗑️</button>
                    </div>
                  </div>
                ))}
                {drafts.length === 0 ? (
                  <p className="dim" style={{ fontSize: 13 }}>Nothing left to submit.</p>
                ) : (
                  <>
                    {error && <p className="form-error">{error}</p>}
                    <button type="button" className="submit-btn" disabled={saving} onClick={submitAllDrafts}>
                      {saving ? 'Sending...' : `Send ${drafts.length} report${drafts.length === 1 ? '' : 's'} for review`}
                    </button>
                    <button type="button" className="link-btn" style={{ display: 'block', margin: '10px auto 0' }} onClick={() => setDrafts(null)}>
                      Start over
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
