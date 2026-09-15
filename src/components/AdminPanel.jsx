import { useEffect, useState } from 'react';
import { doc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { secondaryAuth, usersCol, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SPECIALTIES, ROLE_OPTIONS, RESIDENTIAL_BLOCKS } from '../utils/constants';
import { specialtyLabel, friendlyAuthError } from '../utils/helpers';

const ROLE_LABEL_MAP = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.id, r.label]));

function roleBlurb(role, specialty) {
  if (role === 'maintainer') {
    return specialty && specialty !== 'all'
      ? "You'll see and update maintenance tickets for " + specialtyLabel(specialty) + ' issues only.'
      : "You'll see and update maintenance tickets across all categories.";
  }
  if (role === 'supervisor') return "You'll see every ticket for oversight, plus the Summary panel — you can't change ticket statuses.";
  return '';
}
function buildStaffMessage(name, email, password, role, specialty) {
  const roleLabel = role === 'maintainer'
    ? 'Maintainer' + (specialty && specialty !== 'all' ? ' (' + specialtyLabel(specialty) + ')' : ' (all categories)')
    : 'Supervisor';
  return (
    'Hi ' + name + ", you've been added to the BIUST Maintenance & Facilities Log as a " + roleLabel + '.\n' +
    'Login: https://yunghit.github.io/Biust-Maintenance-Log/\n' +
    'Email: ' + email + '\n' +
    'Temporary password: ' + password + '\n' +
    roleBlurb(role, specialty) + '\n' +
    'Please change your password after logging in (Forgot password on the login screen works even for a first change).'
  );
}

function UserRow({ u, isEditing, onToggleEdit, onSave }) {
  const [draft, setDraft] = useState({ role: u.role, specialty: u.specialty || 'all', assignedBlocks: u.assignedBlocks || [] });
  const [saving, setSaving] = useState(false);

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
    await onSave(u.id, update);
    setSaving(false);
  }

  function toggleBlock(b) {
    setDraft((d) => ({
      ...d,
      assignedBlocks: d.assignedBlocks.includes(b) ? d.assignedBlocks.filter((x) => x !== b) : [...d.assignedBlocks, b],
    }));
  }

  return (
    <div className="user-row-wrap">
      <button type="button" className="user-row" onClick={() => onToggleEdit(u.id)}>
        <span>{u.name || u.email}<br /><span className="dim" style={{ fontSize: 11 }}>{u.email}{extra ? ' · ' + extra : ''}</span></span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{ROLE_LABEL_MAP[u.role] || u.role}{isEditing ? ' ▾' : ' ▸'}</span>
      </button>
      {isEditing && (
        <div className="user-editor">
          <label className="field-label">Role</label>
          <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r.id} type="button"
                className={'cat-btn' + (draft.role === r.id ? ' cat-btn-active' : '')}
                onClick={() => setDraft((d) => ({ ...d, role: r.id }))}
              >
                <span className="cat-btn-label">{r.label}</span>
              </button>
            ))}
          </div>
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
          <button type="button" className="submit-btn" style={{ marginTop: 8, background: '#5B9BD5' }} disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminPanel({ onClose }) {
  const { currentUser } = useAuth();
  const showToast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffRole, setStaffRole] = useState('maintainer');
  const [staffSpecialty, setStaffSpecialty] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdMessage, setCreatedMessage] = useState('');
  const [copyLabel, setCopyLabel] = useState('Copy message');

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState(null);

  const staffRoleOptions = ROLE_OPTIONS.filter((r) => r.id === 'maintainer' || r.id === 'supervisor');

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const snap = await getDocs(usersCol);
      const rankOf = { admin: 0, supervisor: 1, maintainer: 2, reporter: 3 };
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (rankOf[a.role] ?? 4) - (rankOf[b.role] ?? 4));
      setUsers(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setUsersLoading(false);
    }
  }
  useEffect(() => { loadUsers(); }, []);

  async function handleCreateStaff() {
    if (!name || !email || !password || password.length < 6) {
      setError('Fill in name, email, and a password of at least 6 characters.');
      return;
    }
    setError(''); setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await updateProfile(cred.user, { displayName: name });
      const userDoc = { email, name, role: staffRole, createdAt: new Date().toISOString(), createdBy: currentUser.uid };
      if (staffRole === 'maintainer') userDoc.specialty = staffSpecialty;
      await setDoc(doc(db, 'users', cred.user.uid), userDoc);
      await signOut(secondaryAuth);
      setCreatedMessage(buildStaffMessage(name, email, password, staffRole, staffSpecialty));
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
      await navigator.clipboard.writeText(createdMessage);
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy message'), 1500);
    } catch {
      // clipboard API unavailable — the textarea itself is selectable/readable
    }
  }

  async function handleSaveUser(uid, update) {
    try {
      await updateDoc(doc(db, 'users', uid), update);
      setEditingUserId(null);
      showToast('Changes saved');
      loadUsers();
    } catch (e) {
      console.error(e);
      setError('Could not save changes. Try again.');
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="display">Manage</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <label className="field-label">Add a new staff account</label>
        <input className="input" placeholder="Full name" style={{ margin: '6px 0' }} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Email" style={{ marginBottom: 6 }} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Temporary password (min 6 characters)" style={{ marginBottom: 8 }} value={password} onChange={(e) => setPassword(e.target.value)} />

        <label className="field-label">Role</label>
        <div className="cat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 8 }}>
          {staffRoleOptions.map((r) => (
            <button
              key={r.id} type="button"
              className={'cat-btn' + (staffRole === r.id ? ' cat-btn-active' : '')}
              onClick={() => setStaffRole(r.id)}
            >
              <span>{r.id === 'maintainer' ? '🔧' : '👁️'}</span>
              <span className="cat-btn-label">{r.label}</span>
            </button>
          ))}
        </div>

        {staffRole === 'maintainer' && (
          <>
            <label className="field-label">Specialty</label>
            <div className="cat-grid" style={{ marginBottom: 8 }}>
              {SPECIALTIES.map((s) => (
                <button
                  key={s.id} type="button"
                  className={'cat-btn' + (staffSpecialty === s.id ? ' cat-btn-active' : '')}
                  onClick={() => setStaffSpecialty(s.id)}
                >
                  <span className="cat-btn-label">{s.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {error && <p className="form-error">{error}</p>}
        <button type="button" className="submit-btn" style={{ marginBottom: 12 }} disabled={busy} onClick={handleCreateStaff}>
          {busy ? 'Creating...' : 'Create account'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--dim)', margin: '0 0 12px' }}>
          There's no automatic email — after creating an account, copy the message below and send it yourself (WhatsApp, email, in person).
        </p>
        {createdMessage && (
          <>
            <textarea className="input" rows={6} readOnly style={{ marginBottom: 8, fontSize: 12 }} value={createdMessage} />
            <button type="button" className="submit-btn" style={{ background: '#5B9BD5', marginBottom: 16 }} onClick={handleCopy}>{copyLabel}</button>
          </>
        )}

        <div className="dash" style={{ marginBottom: 12 }}></div>
        <label className="field-label">All accounts — tap any account to change their role, specialty, or RA block(s)</label>
        <div style={{ marginTop: 8 }}>
          {usersLoading ? 'Loading…' : users.length === 0 ? (
            <p className="dim" style={{ fontSize: 12 }}>No accounts yet.</p>
          ) : (
            users.map((u) => (
              <UserRow
                key={u.id} u={u}
                isEditing={editingUserId === u.id}
                onToggleEdit={(id) => setEditingUserId((cur) => (cur === id ? null : id))}
                onSave={handleSaveUser}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
