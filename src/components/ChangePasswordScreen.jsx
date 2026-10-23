import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { friendlyAuthError, validatePassword } from '../utils/helpers';

// Shown instead of the app when an admin created the account with a temporary password.
export default function ChangePasswordScreen() {
  const { changePassword, logout, name } = useAuth();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const problem = validatePassword(next);
    if (problem) { setError(problem); return; }
    if (next !== confirm) { setError('The two passwords don\u2019t match.'); return; }
    setError(''); setBusy(true);
    try {
      await changePassword('', next);
    } catch (e) {
      console.error(e);
      setError(friendlyAuthError(e));
      setBusy(false);
    }
  }

  return (
    <div className="center-screen" style={{ padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 className="display" style={{ fontSize: 23, margin: '0 0 6px' }}>Set a new password</h1>
          <p className="dim" style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            {name ? 'Welcome, ' + name.split(' ')[0] + '. ' : ''}Your account was set up with a temporary password. Choose your own to continue.
          </p>
        </div>
        <div className="auth-card">
          <input className="input" placeholder="New password" type="password" autoComplete="new-password" style={{ marginBottom: 6 }} value={next} onChange={(e) => setNext(e.target.value)} />
          <p className="dim" style={{ fontSize: 11, margin: '0 0 8px' }}>At least 8 characters, with a letter and a number.</p>
          <input className="input" placeholder="Confirm new password" type="password" autoComplete="new-password" style={{ marginBottom: 10 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="submit-btn" disabled={busy} onClick={submit}>{busy ? 'Saving...' : 'Save and continue'}</button>
          <button type="button" className="link-btn" style={{ display: 'block', margin: '12px auto 0' }} onClick={logout}>Log out</button>
        </div>
      </div>
    </div>
  );
}
