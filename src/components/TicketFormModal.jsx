import { useEffect, useRef, useState } from 'react';
import { addDoc, doc, setDoc } from 'firebase/firestore';
import { ticketsCol, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { BLOCK_GROUPS, FACILITIES_GROUP, CATEGORIES } from '../utils/constants';
import { makeTicketCode, publicMirror, currentSemester } from '../utils/helpers';
import RoomField from './RoomField';
import AreaChips from './AreaChips';
import IssueChips from './IssueChips';

function visibleBlockGroups({ canManageTickets, canSeeOversight, assignedBlocks }) {
  if (canManageTickets || canSeeOversight) return BLOCK_GROUPS;
  const groups = [];
  if (assignedBlocks.length) groups.push({ label: 'Your Block(s)', options: assignedBlocks });
  if (FACILITIES_GROUP) groups.push(FACILITIES_GROUP);
  return groups;
}

export default function TicketFormModal({ onClose }) {
  const { currentUser, name, canManageTickets, canSeeOversight, assignedBlocks } = useAuth();
  const showToast = useToast();
  const groups = visibleBlockGroups({ canManageTickets, canSeeOversight, assignedBlocks });

  const [block, setBlock] = useState(groups[0]?.options[0] || '');
  const [room, setRoom] = useState('');
  const [category, setCategory] = useState('electricity');
  const [description, setDescription] = useState('');
  const [reportedBy, setReportedBy] = useState(name || '');
  const [contact, setContact] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { setReportedBy(name || ''); }, [name]);

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
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('Could not read that photo — try a different one.');
    };
    img.src = objectUrl;
  }

  async function submit() {
    if (!block || !description.trim()) {
      setError('Please add a location and a description (room can be left blank for general areas).');
      return;
    }
    setError(''); setSaving(true);
    const code = makeTicketCode(block, room.trim());
    const ticket = {
      code, block, room: room.trim(), category, description: description.trim(),
      reportedBy: reportedBy.trim(), contact: contact.trim(),
      urgent: !!urgent, photo: photo || null,
      status: 'pending', reportedAt: new Date().toISOString(), resolvedAt: null, semester: currentSemester().id,
      reportedByUid: currentUser.uid, notes: [],
    };
    try {
      const ref = await addDoc(ticketsCol, ticket);
      setDoc(doc(db, 'publicBoard', ref.id), publicMirror(ticket)).catch((e) => console.error('public mirror write failed', e));
      showToast('Ticket submitted');
      onClose();
    } catch (e) {
      console.error(e);
      setError("Could not save that. If it was for a residential block, check you're the RA for it — otherwise check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="display">Report an issue</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {groups.length === 0 ? (
          <p className="form-error">You're not set up as an RA for any block yet, so there's nowhere for you to report a residential issue. Ask your admin to assign you, or report a campus facility issue instead once one is available.</p>
        ) : (
          <>
            <div className="form-grid-2">
              <div>
                <label className="field-label">Location</label>
                <select className="input" value={block} onChange={(e) => setBlock(e.target.value)}>
                  {groups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map((b) => <option key={b} value={b}>{b}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <RoomField block={block} value={room} onChange={setRoom} />
            </div>
            <AreaChips value={room} onPick={setRoom} />

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
              <IssueChips category={category} onPick={(t) => setDescription((d) => (!d.trim() ? t : d.includes(t) ? d : d.replace(/[;\s]+$/, '') + '; ' + t))} />
              <textarea className="input" rows={2} placeholder="e.g. sockets not working" value={description} onChange={(e) => setDescription(e.target.value)} style={{ marginBottom: 12 }} />
            </div>

            <div className="form-grid-2">
              <div>
                <label className="field-label">Reported by</label>
                <input className="input" placeholder="Name" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Access contact</label>
                <input className="input" placeholder="Phone (optional)" value={contact} onChange={(e) => setContact(e.target.value)} />
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
            <button type="button" className="submit-btn" disabled={saving} onClick={submit}>
              {saving ? 'Saving...' : 'Submit ticket'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
