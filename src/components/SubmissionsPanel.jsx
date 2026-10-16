import { useEffect, useState } from 'react';
import { addDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db, submissionsCol, ticketsCol } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { BLOCK_GROUPS, CATEGORIES } from '../utils/constants';
import { categoryMeta, formatDate, makeTicketCode, publicMirror, semesterForDate } from '../utils/helpers';

function SubmissionCard({ s, onAccept, onDecline }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    block: s.block && BLOCK_GROUPS.some((g) => g.options.includes(s.block)) ? s.block : '',
    room: s.room || '', category: s.category || 'access', description: s.description || '',
    contact: s.contact || '', urgent: !!s.urgent,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cat = categoryMeta(s.category);

  async function handleAccept() {
    if (!draft.block || !draft.room.trim() || !draft.description.trim()) {
      setError('Location, room, and description are all required before accepting.');
      return;
    }
    setError(''); setBusy(true);
    try {
      await onAccept(s, draft);
    } catch (e) {
      console.error(e);
      setError('Could not accept this one. Try again.');
      setBusy(false);
    }
  }
  async function handleDecline() {
    setBusy(true);
    try {
      await onDecline(s);
    } catch (e) {
      console.error(e);
      setError('Could not decline this one. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="user-row-wrap">
      <button type="button" className="user-row" onClick={() => setOpen((o) => !o)} style={{ alignItems: 'flex-start' }}>
        <span>
          <strong>{s.block || '(no location given)'}{s.room ? ' · Rm ' + s.room : ''}</strong>
          <br /><span className="dim" style={{ fontSize: 11 }}>{cat.icon} {s.description}</span>
          <br /><span className="dim" style={{ fontSize: 10 }}>{formatDate(s.submittedAt)}{s.reportedBy ? ' · ' + s.reportedBy : ''}{s.contact ? ' · 📞 ' + s.contact : ''}</span>
        </span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{s.urgent ? '🚩 ' : ''}{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="user-editor">
          {s.photo && <img src={s.photo} alt="submitted" style={{ width: '100%', borderRadius: 10, marginBottom: 10 }} />}
          <div className="form-grid-2" style={{ marginBottom: 8 }}>
            <div>
              <label className="field-label">Location</label>
              <select className="input" value={draft.block} onChange={(e) => setDraft((d) => ({ ...d, block: e.target.value }))}>
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
              <input className="input" value={draft.room} onChange={(e) => setDraft((d) => ({ ...d, room: e.target.value }))} />
            </div>
          </div>
          <label className="field-label">Description</label>
          <textarea className="input" rows={2} style={{ marginBottom: 8 }} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          <div className="form-grid-2" style={{ marginBottom: 8 }}>
            <div>
              <label className="field-label">Category</label>
              <select className="input" value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Contact</label>
              <input className="input" value={draft.contact} onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))} />
            </div>
          </div>
          <button
            type="button" className={'urgent-btn' + (draft.urgent ? ' urgent-btn-active' : '')}
            style={{ marginBottom: 10 }}
            onClick={() => setDraft((d) => ({ ...d, urgent: !d.urgent }))}
          >🚩 Urgent</button>
          {error && <p className="form-error">{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="submit-btn" style={{ background: '#4FB477' }} disabled={busy} onClick={handleAccept}>
              {busy ? 'Working...' : 'Accept'}
            </button>
            <button type="button" className="delete-btn" style={{ width: 'auto', padding: '0 16px' }} disabled={busy} onClick={handleDecline}>
              Decline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubmissionsPanel({ onClose }) {
  const { currentUser, name, isAdmin, assignedBlocks } = useAuth();
  const showToast = useToast();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = isAdmin
      ? query(submissionsCol, where('status', '==', 'pending'))
      : query(submissionsCol, where('status', '==', 'pending'), where('block', 'in', assignedBlocks.slice(0, 10)));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)));
        setLoading(false);
      },
      (err) => { console.error(err); setLoading(false); }
    );
    return unsub;
  }, [isAdmin, assignedBlocks]);

  async function handleAccept(submission, draft) {
    const code = makeTicketCode(draft.block, draft.room);
    const ticket = {
      code, block: draft.block, room: draft.room.trim(), category: draft.category,
      description: draft.description.trim(), reportedBy: submission.reportedBy || '', contact: draft.contact.trim(),
      urgent: !!draft.urgent, photo: submission.photo || null,
      status: 'pending', reportedAt: submission.submittedAt || new Date().toISOString(), acceptedAt: new Date().toISOString(),
      resolvedAt: null, semester: semesterForDate(submission.submittedAt).id,
      reportedByUid: currentUser.uid, notes: [{
        text: 'Accepted from a student submission.', byName: name || currentUser.email, byRole: 'system', at: new Date().toISOString(), isSystem: true,
      }],
    };
    const ref = await addDoc(ticketsCol, ticket);
    setDoc(doc(db, 'publicBoard', ref.id), publicMirror(ticket)).catch((e) => console.error('public mirror write failed', e));
    await updateDoc(doc(db, 'submissions', submission.id), {
      status: 'accepted', reviewedBy: currentUser.uid, reviewedByName: name || currentUser.email, reviewedAt: new Date().toISOString(), linkedTicketId: ref.id,
    });
    showToast('Accepted — now a ticket');
  }

  async function handleDecline(submission) {
    await updateDoc(doc(db, 'submissions', submission.id), {
      status: 'declined', reviewedBy: currentUser.uid, reviewedByName: name || currentUser.email, reviewedAt: new Date().toISOString(),
    });
    showToast('Declined');
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="display">Inbox</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <p className="dim" style={{ fontSize: 12, marginTop: -8, marginBottom: 14 }}>
          Reports sent in without logging in. Review, adjust anything that needs fixing, then accept to turn it into a real ticket — or decline if it's not a real issue.
        </p>
        {loading ? (
          <div className="loading-wrap"><div className="spinner"></div></div>
        ) : submissions.length === 0 ? (
          <p className="empty-card">Nothing waiting for review.</p>
        ) : (
          submissions.map((s) => (
            <SubmissionCard key={s.id} s={s} onAccept={handleAccept} onDecline={handleDecline} />
          ))
        )}
      </div>
    </div>
  );
}
