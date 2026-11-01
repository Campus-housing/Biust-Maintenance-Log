import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { friendlyAuthError, validatePassword } from '../utils/helpers';
import ThemeToggle from './ThemeToggle';
import SubmissionForm from './SubmissionForm';
import { WrenchIcon } from './icons';

export default function AuthScreen() {
  const { signIn, signUp, forgotPassword, enterPublicMode, authError, setAuthError } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [audience, setAudience] = useState('student'); // 'student' | 'staff'
  const [mode, setMode] = useState('login');           // 'login' | 'signup' (students only)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const isSignup = audience === 'student' && mode === 'signup';

  function clearMessages() { setError(''); setInfo(''); setAuthError(''); }
  function switchAudience(next) { setAudience(next); setMode('login'); clearMessages(); }

  async function handleSubmit() {
    if (!email.trim() || !password || (isSignup && !name.trim())) {
      setError('Please fill in all fields.');
      return;
    }
    if (isSignup) {
      const pwProblem = validatePassword(password);
      if (pwProblem) { setError(pwProblem); return; }
      if (password !== confirm) { setError('The two passwords don\u2019t match.'); return; }
    }
    clearMessages(); setBusy(true);
    try {
      if (isSignup) await signUp(email.trim(), password, name.trim());
      else await signIn(email.trim(), password, audience);
    } catch (e) {
      console.error(e);
      setError(friendlyAuthError(e));
      setBusy(false);
    }
  }

  async function handleForgot() {
    if (!email.trim()) { setError('Enter your email above first, then tap Forgot password.'); return; }
    try {
      await forgotPassword(email.trim());
      clearMessages();
      setInfo('If that email has an account, a password reset link is on its way — check your inbox (and spam).');
    } catch (e) {
      console.error(e);
      setError(friendlyAuthError(e));
    }
  }

  const shownError = error || authError;
  return (
    <div className="center-screen auth-screen" style={{ padding: 24 }}>
      <div className="auth-shell">
        <div className="auth-brand-lockup">
          <span className="brand-mark"><WrenchIcon size={20} stroke={2.2} /></span>
          <span className="display">BIUST M&amp;F Log</span>
        </div>
        <div className="auth-theme-toggle">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <div className="auth-intro">
          <p className="page-eyebrow"><span className="live-dot"></span>CAMPUS OPERATIONS</p>
          <h1 className="display">Maintenance, made visible.</h1>
          <p className="dim">Report an issue, follow the progress, and help keep BIUST moving.</p>
        </div>

        <div className="audience-tabs" role="tablist" aria-label="Sign in as">
          <button type="button" role="tab" aria-selected={audience === 'student'} className={'cat-btn' + (audience === 'student' ? ' cat-btn-active' : '')} onClick={() => switchAudience('student')}>
            <span className="cat-btn-label">🎓 Student</span>
          </button>
          <button type="button" role="tab" aria-selected={audience === 'staff'} className={'cat-btn' + (audience === 'staff' ? ' cat-btn-active' : '')} onClick={() => switchAudience('staff')}>
            <span className="cat-btn-label">🛠️ Staff</span>
          </button>
        </div>

        <div className="auth-card">
          {isSignup && (
            <input className="input" placeholder="Full name" autoComplete="name" style={{ marginBottom: 10 }} value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className="input" placeholder="Email" type="email" autoComplete="email" style={{ marginBottom: 10 }} value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            className="input" placeholder="Password" type="password" style={{ marginBottom: isSignup ? 6 : 10 }}
            autoComplete={isSignup ? 'new-password' : 'current-password'} value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !isSignup) handleSubmit(); }}
          />
          {isSignup && (
            <>
              <p className="dim" style={{ fontSize: 11, margin: '0 0 8px' }}>At least 8 characters, with a letter and a number.</p>
              <input className="input" placeholder="Confirm password" type="password" autoComplete="new-password" style={{ marginBottom: 10 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </>
          )}
          {shownError && <p className="form-error">{shownError}</p>}
          {info && <p style={{ color: '#4FB477', fontSize: 12 }}>{info}</p>}
          <button type="button" className="submit-btn" style={{ marginBottom: 10 }} disabled={busy} onClick={handleSubmit}>
            {busy ? 'Please wait...' : isSignup ? 'Create student account' : 'Log in'}
          </button>
          {!isSignup && (
            <button type="button" className="link-btn" style={{ display: 'block', margin: '0 auto' }} onClick={handleForgot}>
              Forgot password?
            </button>
          )}
          {audience === 'student' ? (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', margin: '14px 0 0' }}>
              {isSignup ? 'Already have an account? ' : 'New here? '}
              <button type="button" className="link-btn" onClick={() => { setMode(isSignup ? 'login' : 'signup'); clearMessages(); }}>
                {isSignup ? 'Log in' : 'Create a student account'}
              </button>
            </p>
          ) : (
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--dim)', margin: '14px 0 0', lineHeight: 1.5 }}>
              Staff accounts are created by an administrator. Ask them for an invite — the email lets you choose your own password.
            </p>
          )}
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
