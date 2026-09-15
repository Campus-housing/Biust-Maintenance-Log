import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { friendlyAuthError } from '../utils/helpers';
import ThemeToggle from './ThemeToggle';
import SubmissionForm from './SubmissionForm';

export default function AuthScreen() {
  const { signIn, signUp, forgotPassword, enterPublicMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const isSignup = mode === 'signup';

  async function handleSubmit() {
    if (!email || !password || (isSignup && !name)) {
      setError('Please fill in all fields.');
      return;
    }
    setError(''); setInfo(''); setBusy(true);
    try {
      if (isSignup) await signUp(email, password, name);
      else await signIn(email, password);
    } catch (e) {
      console.error(e);
      setError(friendlyAuthError(e));
      setBusy(false);
    }
  }

  async function handleForgot() {
    if (!email) { setError('Enter your email above first, then tap Forgot password.'); return; }
    try {
      await forgotPassword(email);
      setError('');
      setInfo('Password reset email sent — check your inbox.');
    } catch (e) {
      console.error(e);
      setError(friendlyAuthError(e));
    }
  }

  return (
    <div className="center-screen" style={{ padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 className="display" style={{ fontSize: 23, margin: '0 0 4px' }}>BIUST Maintenance &amp; Facilities Log</h1>
          <p className="dim" style={{ fontSize: 13, margin: 0 }}>{isSignup ? 'Create an account to report issues' : 'Log in to continue'}</p>
        </div>
        <div className="auth-card">
          {isSignup && (
            <input className="input" placeholder="Full name" style={{ marginBottom: 10 }} value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className="input" placeholder="Email" type="email" style={{ marginBottom: 10 }} value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Password" type="password" style={{ marginBottom: 10 }} value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="form-error">{error}</p>}
          {info && <p style={{ color: '#4FB477', fontSize: 12 }}>{info}</p>}
          <button type="button" className="submit-btn" style={{ marginBottom: 10 }} disabled={busy} onClick={handleSubmit}>
            {busy ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
          </button>
          {!isSignup && (
            <button type="button" className="link-btn" style={{ display: 'block', margin: '0 auto' }} onClick={handleForgot}>
              Forgot password?
            </button>
          )}
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', margin: '14px 0 0' }}>
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <button type="button" className="link-btn" onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(''); setInfo(''); }}>
              {isSignup ? 'Log in' : 'Sign up'}
            </button>
          </p>
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, margin: '14px 0 0' }}>
          <button type="button" className="link-btn" style={{ color: 'var(--muted)', textDecoration: 'underline' }} onClick={enterPublicMode}>
            View status board without logging in
          </button>
        </p>
        <p style={{ textAlign: 'center', fontSize: 12, margin: '8px 0 0' }}>
          <button type="button" className="link-btn" style={{ color: 'var(--muted)', textDecoration: 'underline' }} onClick={() => setReportOpen(true)}>
            Report an issue without logging in
          </button>
        </p>
      </div>
      {reportOpen && <SubmissionForm onClose={() => setReportOpen(false)} />}
    </div>
  );
}
