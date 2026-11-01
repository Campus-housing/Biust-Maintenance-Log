import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db, submissionsCol } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORY_COLORS } from '../utils/constants';
import { formatDate, blockLabel, roomLabel, statusMeta } from '../utils/helpers';
import { CategoryIcon } from './icons';

// What a signed-in student sees: a big "Report an issue" button and the progress of everything they've reported.
export default function StudentHome({ onReport }) {
  const { currentUser, name, emailVerified, resendVerification, refreshVerification } = useAuth();
  const [subs, setSubs] = useState(null); // null = loading
  const [ticketInfo, setTicketInfo] = useState({});
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!currentUser) return undefined;
    const q = query(submissionsCol, where('submittedByUid', '==', currentUser.uid));
    return onSnapshot(
      q,
      (snap) => setSubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))),
      (err) => { console.error(err); setSubs([]); }
    );
  }, [currentUser]);

  // Once a report is accepted it becomes a ticket; its progress comes from the public status board (no private data).
  const loadTicketInfo = useCallback(async (list) => {
    const ids = list.filter((s) => s.status === 'accepted' && s.linkedTicketId).map((s) => s.linkedTicketId);
    const results = await Promise.all(ids.map((id) =>
      getDoc(doc(db, 'publicBoard', id)).then((snap) => [id, snap.exists() ? snap.data() : null]).catch(() => [id, null])));
    setTicketInfo(Object.fromEntries(results.filter(([, v]) => v)));
  }, []);
  useEffect(() => { if (subs) loadTicketInfo(subs); }, [subs, loadTicketInfo]);

  async function handleResend() {
    try { await resendVerification(); setNote('Verification email sent — check your inbox (and spam).'); }
    catch (e) { console.error(e); setNote('Could not send the email just now. Try again in a minute.'); }
  }
  async function handleRefresh() {
    try { setNote((await refreshVerification()) ? 'Thanks — your email is verified.' : 'Not verified yet. Open the link in the email, then tap this again.'); }
    catch (e) { console.error(e); setNote('Could not check just now. Try again.'); }
  }

  function progressOf(s) {
    if (s.status === 'declined') return { label: 'Not actioned', color: '#8B96AD', detail: 'Your RA reviewed this and did not take it further.' };
    if (s.status === 'accepted') {
      const t = ticketInfo[s.linkedTicketId];
      if (t) { const m = statusMeta(t.status); return { label: m.label, color: m.color, detail: t.code ? 'Ticket ' + t.code : '' }; }
      return { label: 'Accepted', color: '#4FB477', detail: 'Your RA accepted it and passed it to maintenance.' };
    }
    return { label: 'Waiting for review', color: '#F2A93C', detail: 'Your RA will review this soon.' };
  }

  const reviewedCount = subs ? subs.filter((s) => s.status === 'accepted' || s.status === 'declined').length : 0;
  const activeCount = subs ? subs.filter((s) => s.status !== 'declined').length : 0;

  return (
    <div className="student-home">
      <section className="student-hero">
        <div className="student-hero-copy">
          <p className="page-eyebrow"><span className="live-dot"></span>PERSONAL SPACE</p>
          <h2>Hi {(name || '').split(' ')[0] || 'there'} <span aria-hidden="true">👋</span></h2>
          <p>Report a problem in a few taps and keep an eye on what happens next.</p>
        </div>
        <button type="button" className="student-hero-action" onClick={onReport}><span>+</span> Report an issue</button>
        <div className="student-quick-stats" aria-label="Report summary">
          <div><strong>{subs ? activeCount : '—'}</strong><span>open reports</span></div>
          <div><strong>{subs ? reviewedCount : '—'}</strong><span>reviewed</span></div>
        </div>
      </section>

      {!emailVerified && (
        <div className="empty-card" style={{ textAlign: 'left', marginBottom: 14, padding: 16 }}>
          <strong style={{ fontSize: 13 }}>Verify your email</strong>
          <p style={{ fontSize: 12, margin: '6px 0 10px', color: 'var(--muted)' }}>
            We sent a link to {currentUser.email}. Verifying lets us contact you about your reports.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="badge-btn" onClick={handleResend}>Resend email</button>
            <button type="button" className="badge-btn" onClick={handleRefresh}>I've verified it</button>
          </div>
          {note && <p className="dim" style={{ fontSize: 11, margin: '8px 0 0' }}>{note}</p>}
        </div>
      )}

      <label className="section-kicker reports-kicker">My reports</label>
      <div style={{ marginTop: 8 }}>
        {subs === null ? (
          <div className="loading-wrap"><div className="spinner"></div></div>
        ) : subs.length === 0 ? (
          <div className="empty-card">You haven't reported anything yet. Tap <strong>Report an issue</strong> to start.</div>
        ) : (
          subs.map((s) => {
            const p = progressOf(s);
            return (
              <div key={s.id} className="block-group" style={{ marginBottom: 10 }}>
                <div className="block-group-header" style={{ cursor: 'default', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: CATEGORY_COLORS[s.category] || 'var(--muted)', display: 'inline-flex', paddingTop: 2 }}><CategoryIcon id={s.category} size={18} /></span>
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <strong style={{ fontSize: 14 }}>{blockLabel(s.block)} · {roomLabel(s.room)}</strong>
                    <br /><span style={{ fontSize: 13 }}>{s.description}</span>
                    <br /><span className="dim" style={{ fontSize: 11 }}>{formatDate(s.submittedAt)}{p.detail ? ' · ' + p.detail : ''}</span>
                  </span>
                  <span className="mono status-pill" style={{ background: p.color + '22', color: p.color, whiteSpace: 'nowrap' }}>{p.label.toUpperCase()}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
