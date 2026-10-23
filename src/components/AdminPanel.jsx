import { useEffect, useState } from 'react';
import { doc, setDoc, updateDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth, secondaryAuth, usersCol, auditCol, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SPECIALTIES, ROLE_OPTIONS, RESIDENTIAL_BLOCKS } from '../utils/constants';
import { specialtyLabel, friendlyAuthError, blockLabel, validatePassword, generatePassword, formatDate } from '../utils/helpers';
import { logAudit } from '../utils/audit';

const ROLE_LABEL_MAP = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.id, r.label]));
const ROLE_ICON = { student: '🎓', reporter: '🏠', maintainer: '🔧', supervisor: '👁️', admin: '🛡️' };
const LOGIN_URL = 'https://yunghit.github.io/Biust-Maintenance-Log/';

function roleBlurb(role, specialty) {
  if (role === 'maintainer') {
    return specialty && specialty !== 'all'
      ? "You'll see and update maintenance tickets for " + specialtyLabel(specialty) + ' issues only.'
      : "You'll see and update maintenance tickets across all categories.";
  }
  if (role === 'supervisor') return "You'll see every ticket for oversight, plus the Summary panel — you can't change ticket statuses.";
  if (role === 'reporter') return "You'll review reports sent in by students for your block(s) and raise tickets for them.";
  if (role === 'admin') return "You'll have full access, including managing accounts.";
  return 'You can report issues and follow their progress.';
}
function roleLabelFor(role, specialty) {
  if (role === 'maintainer') return 'Maintainer' + (specialty && specialty !== 'all' ? ' (' + specialtyLabel(specialty) + ')' : ' (all categories)');
  return ROLE_LABEL_MAP[role] || role;
}
function buildTempMessage(name, email, password, role, specialty) {
  return (
    'Hi ' + name + ", you've been added to the BIUST Maintenance & Facilities Log as: " + roleLabelFor(role, specialty) + '.\n' +
    'Sign in (use the ' + (role === 'student' ? 'Student' : 'Staff') + ' tab): ' + LOGIN_URL + '\n' +
    'Email: ' + email + '\n' +
    'Temporary password: ' + password + '\n' +
    roleBlurb(role, specialty) + '\n' +
    "You'll be asked to choose your own password the first time you sign in."
  );
}
function buildInviteMessage(name, email, role, specialty) {
  return (
    'Hi ' + name + ", you've been added to the BIUST Maintenance & Facilities Log as: " + roleLabelFor(role, specialty) + '.\n' +
    "We've emailed " + email + ' a link to choose your password — check your inbox (and spam).\n' +
    'Then sign in (use the ' + (role === 'student' ? 'Student' : 'Staff') + ' tab): ' + LOGIN_URL + '\n' +
    roleBlurb(role, specialty)
  );
}

function UserRow({ u, isSelf, isEditing, onToggleEdit, onSave, onResetPassword, onSetActive }) {
  const [draft, setDraft] = useState({ role: u.role, specialty: u.specialty || 'all', assignedBlocks: u.assignedBlocks || [] });
  const [saving, setSaving] = useState(false);
  const disabled = u.active === false;

  useEffect(() => {
    if (isEditing) setDraft({ role: u.role, specialty: u.specialty || 'all', assignedBlocks: u.assignedBlocks || [] });
  }, [isEditing, u]);

  const extra = u.role === 'maintainer'
    ? specialtyLabel(u.specialty || 'all')
    : u.role === 'reporter' && Array.isArray(u.assignedBlocks) && u.assignedBlocks.length
    ? 'RA: ' + u.assignedBlocks.join(', ')
    : '';

  async function handleSave() {
    setSaving(true);
    const update = { role: draft.role };
    if (draft.role === 'maintainer') update.specialty = draft.specialty || 'all';
    if (draft.role === 'reporter') update.assignedBlocks = draft.assignedBlocks;
    await onSave(u.id, update, u);
    setSaving(false);
  }

  function toggleBlock(b) {
    setDraft((d) => ({
      ...d,
      assignedBlocks: d.assignedBlocks.includes(b) ? d.assignedBlocks.filter((x) => x !== b) : [...d.assignedBlocks, b],
    }));
  }

  return (
    <div className="user-row-wrap" style={disabled ? { opacity: 0.65 } : undefined}>
      <button type="button" className="user-row" onClick={() => onToggleEdit(u.id)}>
        <span>{u.name || u.email}<br /><span className="dim" style={{ fontSize: 11 }}>{u.email}{extra ? ' · ' + extra : ''}{disabled ? ' · deactivated' : ''}{u.mustChangePassword ? ' · temp password' : ''}</span></span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{ROLE_LABEL_MAP[u.role] || u.role}{isEditing ? ' ▾' : ' ▸'}</span>
      </button>
      {isEditing && (
        <div className="user-editor">
          <label className="field-label">Role</label>
          <div className="cat-grid">
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r.id} type="button" disabled={isSelf}
                className={'cat-btn' + (draft.role === r.id ? ' cat-btn-active' : '')}
                onClick={() => setDraft((d) => ({ ...d, role: r.id }))}
              >
                <span className="cat-btn-label">{r.label}</span>
              </button>
            ))}
          </div>
          {isSelf && <p className="dim" style={{ fontSize: 11, margin: '6px 0 0' }}>You can't change your own role or deactivate yourself — ask another admin.</p>}
          {draft.role === 'maintainer' && (
            <>
              <label className="field-label" style={{ marginTop: 8 }}>Specialty</label>
              <div className="cat-grid">
                {SPECIALTIES.map((s) => (
                  <button
                    key={s.id} type="button"
                    className={'cat-btn' + (draft.specialty === s.id ? ' cat-btn-active' : '')}
                    onClick={() => setDraft((d) => ({ ...d, specialty: s.id }))}
                  >
                    <span className="cat-btn-label">{s.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {draft.role === 'reporter' && (
            <>
              <label className="field-label" style={{ marginTop: 8 }}>RA for which residential block(s)?</label>
              <div className="block-check-grid">
                {RESIDENTIAL_BLOCKS.map((b) => (
                  <label key={b} className="block-check">
                    <input type="checkbox" checked={draft.assignedBlocks.includes(b)} onChange={() => toggleBlock(b)} /> {b}
                  </label>
                ))}
              </div>
            </>
          )}
          <button type="button" className="submit-btn" style={{ marginTop: 8, background: '#5B9BD5' }} disabled={saving || isSelf} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" className="badge-btn" onClick={() => onResetPassword(u)}>Send password reset email</button>
            {!isSelf && (
              <button
                type="button" className="badge-btn"
                style={disabled ? undefined : { color: '#E15554', borderColor: '#E1555555' }}
                onClick={() => onSetActive(u, disabled)}
              >{disabled ? 'Reactivate account' : 'Deactivate account'}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPanel({ onClose }) {
  const { currentUser, name: adminName } = useAuth();
  const showToast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState('maintainer');
  const [newSpecialty, setNewSpecialty] = useState('all');
  const [accessMode, setAccessMode] = useState('invite'); // 'invite' | 'temp'
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null); // { message, mode, inviteSent }
  const [copyLabel, setCopyLabel] = useState('Copy message');

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState(null);
  const [auditRows, setAuditRows] = useState(null);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const snap = await getDocs(usersCol);
      const rankOf = { admin: 0, supervisor: 1, maintainer: 2, reporter: 3, student: 4 };
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (rankOf[a.role] ?? 5) - (rankOf[b.role] ?? 5));
      setUsers(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setUsersLoading(false);
    }
  }
  useEffect(() => { loadUsers(); }, []);

  async function loadAudit() {
    try {
      const snap = await getDocs(query(auditCol, orderBy('at', 'desc'), limit(25)));
      setAuditRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      setAuditRows([]);
    }
  }

  async function handleCreateAccount() {
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim() || !cleanEmail) { setError('Fill in a name and an email.'); return; }
    if (accessMode === 'temp' && password) {
      const problem = validatePassword(password);
      if (problem) { setError('Temporary password: ' + problem); return; }
    }
    if (newRole === 'admin' && !window.confirm('Admins can see and change everything, including other accounts. Create an admin account for ' + name.trim() + '?')) return;
    setError(''); setBusy(true);
    try {
      // Always created with a strong password; in invite mode nobody ever sees it (the person sets their own via the email link).
      const pw = accessMode === 'temp' ? (password || generatePassword()) : generatePassword();
      const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, pw);
      await updateProfile(cred.user, { displayName: name.trim() });
      const userDoc = {
        email: cleanEmail, name: name.trim(), role: newRole, active: true, mustChangePassword: accessMode === 'temp',
        createdAt: new Date().toISOString(), createdBy: currentUser.uid,
      };
      if (newRole === 'maintainer') userDoc.specialty = newSpecialty;
      if (newRole === 'reporter') userDoc.assignedBlocks = [];
      await setDoc(doc(db, 'users', cred.user.uid), userDoc);
      await signOut(secondaryAuth);

      let inviteSent = false;
      if (accessMode === 'invite') {
        try { await sendPasswordResetEmail(auth, cleanEmail); inviteSent = true; } catch (e) { console.error('invite email failed', e); }
      }
      logAudit(currentUser, adminName, 'account.create', { targetEmail: cleanEmail, role: newRole, access: accessMode });
      setCreated({
        mode: accessMode, inviteSent,
        message: accessMode === 'temp'
          ? buildTempMessage(name.trim(), cleanEmail, pw, newRole, newSpecialty)
          : buildInviteMessage(name.trim(), cleanEmail, newRole, newSpecialty),
      });
      setCopyLabel('Copy message');
      setName(''); setEmail(''); setPassword('');
      showToast('Account created');
      loadUsers();
    } catch (e) {
      console.error(e);
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(created.message);
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy message'), 1500);
    } catch {
      // clipboard API unavailable — the textarea itself is selectable/readable
    }
  }

  async function handleSaveUser(uid, update, before) {
    try {
      await updateDoc(doc(db, 'users', uid), update);
      logAudit(currentUser, adminName, 'account.update', { targetEmail: before.email, from: before.role, to: update.role });
      setEditingUserId(null);
      showToast('Changes saved');
      loadUsers();
    } catch (e) {
      console.error(e);
      setError('Could not save changes. Try again.');
    }
  }

  async function handleResetPassword(u) {
    try {
      await sendPasswordResetEmail(auth, u.email);
      logAudit(currentUser, adminName, 'account.reset-password', { targetEmail: u.email });
      showToast('Reset email sent to ' + u.email);
    } catch (e) {
      console.error(e);
      setError(friendlyAuthError(e));
    }
  }

  async function handleSetActive(u, active) {
    if (!active && !window.confirm('Deactivate ' + (u.name || u.email) + '? They will be signed out and unable to use the app until reactivated.')) return;
    try {
      await updateDoc(doc(db, 'users', u.id), { active });
      logAudit(currentUser, adminName, active ? 'account.reactivate' : 'account.deactivate', { targetEmail: u.email });
      showToast(active ? 'Account reactivated' : 'Account deactivated');
      loadUsers();
    } catch (e) {
      console.error(e);
      setError('Could not update that account. Try again.');
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="display">Manage</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <label className="field-label">Add a new account — student, RA, maintainer, supervisor or admin</label>
        <input className="input" placeholder="Full name" style={{ margin: '6px 0' }} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Email" type="email" style={{ marginBottom: 8 }} value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="field-label">Role</label>
        <div className="cat-grid" style={{ marginBottom: 8 }}>
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.id} type="button"
              className={'cat-btn' + (newRole === r.id ? ' cat-btn-active' : '')}
              onClick={() => setNewRole(r.id)}
            >
              <span>{ROLE_ICON[r.id]}</span>
              <span className="cat-btn-label">{r.label}</span>
            </button>
          ))}
        </div>

        {newRole === 'maintainer' && (
          <>
            <label className="field-label">Specialty</label>
            <div className="cat-grid" style={{ marginBottom: 8 }}>
              {SPECIALTIES.map((s) => (
                <button
                  key={s.id} type="button"
                  className={'cat-btn' + (newSpecialty === s.id ? ' cat-btn-active' : '')}
                  onClick={() => setNewSpecialty(s.id)}
                >
                  <span className="cat-btn-label">{s.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {newRole === 'reporter' && <p className="dim" style={{ fontSize: 11, margin: '0 0 8px' }}>Choose the RA's block(s) from the account list below once it's created.</p>}

        <label className="field-label">How do they get access?</label>
        <div className="cat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 8 }}>
          <button type="button" className={'cat-btn' + (accessMode === 'invite' ? ' cat-btn-active' : '')} onClick={() => setAccessMode('invite')}>
            <span>✉️</span><span className="cat-btn-label">Email invite</span>
          </button>
          <button type="button" className={'cat-btn' + (accessMode === 'temp' ? ' cat-btn-active' : '')} onClick={() => setAccessMode('temp')}>
            <span>🔑</span><span className="cat-btn-label">Temporary password</span>
          </button>
        </div>
        {accessMode === 'invite' ? (
          <p className="dim" style={{ fontSize: 11, margin: '0 0 10px', lineHeight: 1.5 }}>
            Recommended. They get an email with a link to choose their own password — no password is ever shared.
          </p>
        ) : (
          <>
            <input className="input" placeholder="Temporary password (leave blank to generate one)" style={{ marginBottom: 6 }} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="dim" style={{ fontSize: 11, margin: '0 0 10px', lineHeight: 1.5 }}>
              You'll get a message to send them. They must choose their own password the first time they sign in.
            </p>
          </>
        )}

        {error && <p className="form-error">{error}</p>}
        <button type="button" className="submit-btn" style={{ marginBottom: 12 }} disabled={busy} onClick={handleCreateAccount}>
          {busy ? 'Creating...' : 'Create account'}
        </button>

        {created && (
          <div style={{ marginBottom: 16 }}>
            {created.mode === 'invite' && (
              <p style={{ fontSize: 12, margin: '0 0 8px', color: created.inviteSent ? '#4FB477' : '#F2A93C' }}>
                {created.inviteSent
                  ? '✓ Invite email sent. If it doesn\'t arrive, open their account below and tap "Send password reset email".'
                  : 'Account created, but the invite email could not be sent. Open their account below and tap "Send password reset email" to try again.'}
              </p>
            )}
            <textarea className="input" rows={6} readOnly style={{ marginBottom: 8, fontSize: 12 }} value={created.message} />
            <button type="button" className="submit-btn" style={{ background: '#5B9BD5' }} onClick={handleCopy}>{copyLabel}</button>
          </div>
        )}

        <div className="dash" style={{ marginBottom: 12 }}></div>
        <label className="field-label">RA coverage — who looks after each residence</label>
        {(() => {
          const ras = users.filter((u) => u.role === 'reporter' && Array.isArray(u.assignedBlocks) && u.active !== false);
          const rows = RESIDENTIAL_BLOCKS.map((b) => ({ b, names: ras.filter((u) => u.assignedBlocks.includes(b)).map((u) => u.name || u.email) }));
          const uncovered = rows.filter((r) => !r.names.length);
          return (
            <div style={{ marginTop: 8, marginBottom: 16 }}>
              {usersLoading ? <span className="dim" style={{ fontSize: 12 }}>Loading…</span> : (
                <>
                  <p style={{ fontSize: 12, margin: '0 0 8px', color: uncovered.length ? '#F2A93C' : '#4FB477' }}>
                    {RESIDENTIAL_BLOCKS.length - uncovered.length} of {RESIDENTIAL_BLOCKS.length} residences have an RA
                    {uncovered.length ? ' — without one: ' + uncovered.map((r) => blockLabel(r.b)).join(', ') : ''}
                  </p>
                  <details>
                    <summary className="dim" style={{ fontSize: 11, cursor: 'pointer' }}>Show every residence</summary>
                    <div style={{ marginTop: 6 }}>
                      {rows.map((r) => (
                        <div key={r.b} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                          <strong>{blockLabel(r.b)}</strong>
                          <span style={{ textAlign: 'right', color: r.names.length ? 'var(--muted)' : '#E15554' }}>{r.names.length ? r.names.join(', ') : 'no RA yet'}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </div>
          );
        })()}

        <div className="dash" style={{ marginBottom: 12 }}></div>
        <label className="field-label">All accounts — tap one to change its role, reset its password, or deactivate it</label>
        <div style={{ marginTop: 8 }}>
          {usersLoading ? 'Loading…' : users.length === 0 ? (
            <p className="dim" style={{ fontSize: 12 }}>No accounts yet.</p>
          ) : (
            users.map((u) => (
              <UserRow
                key={u.id} u={u} isSelf={u.id === currentUser.uid}
                isEditing={editingUserId === u.id}
                onToggleEdit={(id) => setEditingUserId((cur) => (cur === id ? null : id))}
                onSave={handleSaveUser} onResetPassword={handleResetPassword} onSetActive={handleSetActive}
              />
            ))
          )}
        </div>

        <div className="dash" style={{ margin: '16px 0 12px' }}></div>
        <details onToggle={(e) => { if (e.target.open && auditRows === null) loadAudit(); }}>
          <summary className="field-label" style={{ cursor: 'pointer' }}>Activity log — recent admin actions</summary>
          <div style={{ marginTop: 8 }}>
            {auditRows === null ? <span className="dim" style={{ fontSize: 12 }}>Loading…</span> : auditRows.length === 0 ? (
              <span className="dim" style={{ fontSize: 12 }}>Nothing recorded yet.</span>
            ) : auditRows.map((r) => (
              <div key={r.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <strong>{r.byName || 'Admin'}</strong> · {r.action}{r.targetEmail ? ' · ' + r.targetEmail : ''}{r.role ? ' (' + r.role + ')' : ''}
                <br /><span className="dim" style={{ fontSize: 10 }}>{formatDate(r.at)}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
