import { useState } from 'react';
import { doc, updateDoc, deleteDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { STATUSES } from '../utils/constants';
import { categoryMeta, statusMeta, formatDate, blockLabel, roomLabel, openAgeMs, formatAge } from '../utils/helpers';

export default function TicketDetailModal({ ticket, onClose, onOpenPhoto }) {
  const { currentUser, name, role, canManageTickets } = useAuth();
  const showToast = useToast();
  const [pendingStatus, setPendingStatus] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteError, setNoteError] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!ticket) return null;
  const cat = categoryMeta(ticket.category);
  const st = statusMeta(ticket.status);
  const urgentActive = ticket.urgent && ticket.status !== 'done';
  const canInteract = !!currentUser;
  const isOwner = currentUser && ticket.reportedByUid === currentUser.uid;
  const canDelete = !canManageTickets && isOwner && ticket.status === 'pending';

  async function confirmStatus() {
    if (!pendingStatus) return;
    const resolvedAt = pendingStatus === 'done' ? new Date().toISOString() : null;
    setStatusSaving(true);
    const historyNote = {
      text: 'Status changed to ' + statusMeta(pendingStatus).label + '.',
      byName: name || (currentUser && currentUser.email) || 'Someone',
      byRole: role || 'staff',
      at: new Date().toISOString(),
      isSystem: true,
    };
    try {
      await updateDoc(doc(db, 'tickets', ticket.id), { status: pendingStatus, resolvedAt, notes: arrayUnion(historyNote) });
      setDoc(doc(db, 'publicBoard', ticket.id), { status: pendingStatus, resolvedAt }, { merge: true }).catch((e) => console.error('public mirror update failed', e));
      showToast('Status updated to ' + statusMeta(pendingStatus).label);
      setPendingStatus(null);
    } catch (e) {
      console.error(e);
      setStatusError('Status change did not save. Try again.');
    } finally {
      setStatusSaving(false);
    }
  }

  async function postNote() {
    const text = noteText.trim();
    if (!text) return;
    setNoteSaving(true); setNoteError('');
    const note = { text, byName: name || (currentUser && currentUser.email) || 'Someone', byRole: role || 'reporter', at: new Date().toISOString() };
    try {
      await updateDoc(doc(db, 'tickets', ticket.id), { notes: arrayUnion(note) });
      setNoteText('');
      showToast('Note posted');
    } catch (e) {
      console.error(e);
      setNoteError('Could not post that note. Try again.');
    } finally {
      setNoteSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'tickets', ticket.id));
      deleteDoc(doc(db, 'publicBoard', ticket.id)).catch((e) => console.error('public mirror delete failed', e));
      showToast('Report deleted');
      onClose();
    } catch (e) {
      console.error(e);
      setDeleteError('Could not delete. Try again.');
      setPendingDelete(false);
      setDeleting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="display mono" style={{ fontSize: 15 }}>{ticket.code || ''}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {urgentActive && <div className="urgent-tag" style={{ marginBottom: 8 }}>🚩 URGENT</div>}
        <div className="ticket-title display" style={{ padding: '0 0 8px' }}>{blockLabel(ticket.block)} · {roomLabel(ticket.room)}{openAgeMs(ticket) != null && <span className="dim mono" style={{ fontSize: 11, marginLeft: 8 }}>open {formatAge(openAgeMs(ticket))}</span>}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
          {cat.icon} {cat.label}
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: '0 0 12px' }}>{ticket.description}</p>
        {ticket.photo && (
          <img
            src={ticket.photo} alt="issue"
            style={{ width: '100%', borderRadius: 10, marginBottom: 12, cursor: 'pointer', display: 'block' }}
            onClick={() => onOpenPhoto(ticket.photo)}
          />
        )}
        <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 4 }}>
          {ticket.reportedBy ? ticket.reportedBy + ' · ' : ''}{formatDate(ticket.reportedAt)}
        </div>
        {ticket.contact && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
            Access contact: <a href={'tel:' + ticket.contact} style={{ color: '#5B9BD5' }}>{ticket.contact}</a>
          </div>
        )}

        <div className="dash" style={{ margin: '14px 0 4px' }}></div>

        {canManageTickets ? (
          <>
            <label className="field-label">Update status</label>
            <div className="status-opt-grid">
              {STATUSES.map((s) => {
                const isCurrent = ticket.status === s.id;
                const isPending = pendingStatus === s.id;
                const style = isPending
                  ? { borderColor: s.color, background: s.color, color: '#0B1220' }
                  : isCurrent
                  ? { borderColor: s.color, background: s.color + '22', color: s.color }
                  : { borderColor: 'var(--border-soft)', background: 'transparent', color: 'var(--muted)' };
                return (
                  <button
                    key={s.id} type="button" className="status-opt-btn" style={style}
                    onClick={() => setPendingStatus(s.id === ticket.status ? null : s.id)}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            {pendingStatus && (
              <div className="confirm-bar">
                <span>Mark as <strong style={{ color: statusMeta(pendingStatus).color }}>{statusMeta(pendingStatus).label}</strong>?</span>
                <div className="confirm-actions">
                  <button type="button" className="confirm-cancel" onClick={() => setPendingStatus(null)}>Cancel</button>
                  <button type="button" className="confirm-ok" disabled={statusSaving} onClick={confirmStatus}>
                    {statusSaving ? 'Saving...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
            {statusError && <p className="form-error" style={{ marginTop: 6 }}>{statusError}</p>}
          </>
        ) : (
          <>
            <label className="field-label">Status</label>
            <div style={{ marginTop: 6 }}>
              <span className="mono status-pill" style={{ background: st.color + '22', color: st.color, padding: '4px 10px', fontSize: 11 }}>
                {st.label.toUpperCase()}
              </span>
            </div>
          </>
        )}

        {canInteract && (
          <>
            <div className="dash" style={{ margin: '14px 0 8px' }}></div>
            <label className="field-label">Notes</label>
            <div style={{ marginTop: 4 }}>
              {(!ticket.notes || ticket.notes.length === 0) ? (
                <p className="dim" style={{ fontSize: 12, margin: '4px 0 8px' }}>No notes yet.</p>
              ) : (
                ticket.notes.map((n, i) => (
                  <div key={i} className="note-row">
                    <div className="note-meta">
                      {n.isSystem ? (
                        <span className="dim">🔄 {n.byName || 'Someone'} · {formatDate(n.at)}</span>
                      ) : (
                        <><strong>{n.byName || 'Someone'}</strong> <span className="dim"> · {n.byRole} · {formatDate(n.at)}</span></>
                      )}
                    </div>
                    <p className="note-text" style={n.isSystem ? { fontStyle: 'italic', color: 'var(--dim)' } : undefined}>{n.text}</p>
                  </div>
                ))
              )}
            </div>
            <textarea className="input" rows={2} placeholder="Add a note..." style={{ marginTop: 8 }} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            {noteError && <p className="form-error">{noteError}</p>}
            <button type="button" className="submit-btn" style={{ marginTop: 6, background: '#5B9BD5' }} disabled={noteSaving} onClick={postNote}>
              {noteSaving ? 'Posting...' : 'Post note'}
            </button>
          </>
        )}

        {canDelete && (
          <>
            <div className="dash" style={{ margin: '16px 0 10px' }}></div>
            <button type="button" className="delete-btn" onClick={() => setPendingDelete(true)}>Delete this report</button>
            {pendingDelete && (
              <div className="confirm-bar">
                <span>Delete this report?</span>
                <div className="confirm-actions">
                  <button type="button" className="confirm-cancel" onClick={() => setPendingDelete(false)}>Cancel</button>
                  <button type="button" className="confirm-ok" style={{ background: '#E15554' }} disabled={deleting} onClick={confirmDelete}>
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
            {deleteError && <p className="form-error">{deleteError}</p>}
          </>
        )}
      </div>
    </div>
  );
}
