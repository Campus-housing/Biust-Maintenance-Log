import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ROLE_META } from '../utils/constants';
import { friendlyAuthError, validatePassword } from '../utils/helpers';

export default function AccountPanel({ onClose }) {
  const { currentUser, name, role, emailVerified, resendVerification, refreshVerification, changePassword, logout } = useAuth();
  const showToast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifyNote, setVerifyNote] = useState('');
  const rm = ROLE_META[role] || { label: role, color: '#8B96AD' };

  async function handleResend() {
    try { await resendVerification(); setVerifyNote('Verification email sent — check your inbox (and spam).'); }
    catch (e) { console.error(e); setVerifyNote(friendlyAuthError(e)); }
  }
  async function handleRefresh() {
    try { setVerifyNote((await refreshVerification()) ? 'Thanks — your email is verified.' : 'Not verified yet. Open the link in the email, then tap this again.'); }
    catch (e) { console.error(e); setVerifyNote(friendlyAuthError(e)); }
  }
  async function handleChange() {
    if (!current) { setError('Enter your current password.'); return; }
    const problem = validatePassword(next);
    if (problem) { setError(problem); return; }
    if (next !== confirm) { setError('The two new passwords don\u2019t match.'); return; }
    setError(''); setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      showToast('Password changed');
    } catch (e) {
      console.error(e);
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="display">Account</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <p style={{ margin: '0 0 2px', fontWeight: 600 }}>{name || currentUser.email}</p>
        <p className="dim" style={{ margin: '0 0 10px', fontSize: 12 }}>
          {currentUser.email} · <span className="role-pill" style={{ background: rm.color + '22', color: rm.color, border: '1px solid ' + rm.color + '55' }}>{rm.label}</span>
        </p>

        <div className="dash" style={{ margin: '10px 0' }}></div>
        <label className="field-label">Email</label>
        {emailVerified ? (
          <p style={{ color: '#4FB477', fontSize: 13, margin: '6px 0 14px' }}>✓ Verified</p>
        ) : (
          <div style={{ margin: '6px 0 14px' }}>
            <p style={{ fontSize: 12, margin: '0 0 8px', color: 'var(--muted)' }}>Not verified yet. Verifying lets us reach you about your reports.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="badge-btn" onClick={handleResend}>Send verification email</button>
              <button type="button" className="badge-btn" onClick={handleRefresh}>I've verified it</button>
            </div>
            {verifyNote && <p className="dim" style={{ fontSize: 11, margin: '8px 0 0' }}>{verifyNote}</p>}
          </div>
        )}

        <div className="dash" style={{ margin: '10px 0' }}></div>
        <label className="field-label">Change password</label>
        <input className="input" type="password" placeholder="Current password" autoComplete="current-password" style={{ margin: '6px 0' }} value={current} onChange={(e) => setCurrent(e.target.value)} />
        <input className="input" type="password" placeholder="New password (8+ characters, a letter and a number)" autoComplete="new-password" style={{ marginBottom: 6 }} value={next} onChange={(e) => setNext(e.target.value)} />
        <input className="input" type="password" placeholder="Confirm new password" autoComplete="new-password" style={{ marginBottom: 8 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="form-error">{error}</p>}
        <button type="button" className="submit-btn" style={{ background: '#5B9BD5', marginBottom: 14 }} disabled={busy} onClick={handleChange}>{busy ? 'Saving...' : 'Change password'}</button>

        <button type="button" className="delete-btn" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}
