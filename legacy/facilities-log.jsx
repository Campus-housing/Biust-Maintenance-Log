import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Zap, Droplets, Armchair, KeyRound, Plus, X, Search, AlertCircle, Loader2, Camera, Flag } from 'lucide-react';

const BLOCK_GROUPS = [
  { label: 'Numbered Blocks', options: ['1', '2', '3', '4', '5', '6'] },
  { label: 'Lettered Blocks', options: ['A', 'B', 'C', 'D', 'E', 'F'] },
  { label: 'Sekgoma', options: ['Sekgoma 1', 'Sekgoma 2', 'Sekgoma 3', 'Sekgoma 4'] },
  { label: 'Fengyue', options: ['Fengyue 1', 'Fengyue 2', 'Fengyue 3', 'Fengyue 4'] },
  { label: 'Main Halls', options: ['Old Main Boys', 'Old Main Girls', 'New Main Boys', 'New Main Girls'] },
];
const BLOCKS = BLOCK_GROUPS.flatMap(g => g.options);

const CATEGORIES = [
  { id: 'electricity', label: 'Electricity', Icon: Zap },
  { id: 'plumbing', label: 'Plumbing', Icon: Droplets },
  { id: 'furniture', label: 'Furniture', Icon: Armchair },
  { id: 'access', label: 'Access/Other', Icon: KeyRound },
];

const STATUSES = [
  { id: 'pending', label: 'Pending', color: '#F2A93C' },
  { id: 'in_progress', label: 'In progress', color: '#5B9BD5' },
  { id: 'no_access', label: 'No access', color: '#E15554' },
  { id: 'done', label: 'Done', color: '#4FB477' },
];
const STATUS_ORDER = STATUSES.map(s => s.id);
const ARCHIVE_MS = 7 * 24 * 60 * 60 * 1000;

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' \u00b7 ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function categoryMeta(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[3]; }
function statusMeta(id) { return STATUSES.find(s => s.id === id) || STATUSES[0]; }
function isArchived(t) {
  return t.status === 'done' && t.resolvedAt && (Date.now() - new Date(t.resolvedAt).getTime()) > ARCHIVE_MS;
}

export default function FacilitiesLog() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [viewPhoto, setViewPhoto] = useState(null);
  const photoInputRef = useRef(null);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [search, setSearch] = useState('');

  const emptyForm = { block: BLOCKS[0], room: '', category: 'electricity', description: '', reportedBy: '', contact: '', photo: null, urgent: false };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadTickets(); }, []);

  async function loadTickets() {
    setLoading(true);
    setError(null);
    try {
      const listResult = await window.storage.list('tickets:', true);
      const keys = listResult ? listResult.keys : [];
      const results = await Promise.all(keys.map(async (k) => {
        try {
          const r = await window.storage.get(k, true);
          return r ? JSON.parse(r.value) : null;
        } catch (e) { return null; }
      }));
      const data = results.filter(Boolean).sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
      setTickets(data);
    } catch (e) {
      setError('Could not load the log. Try again.');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 900;
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height >= width && height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setForm(f => ({ ...f, photo: dataUrl }));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleAddTicket(e) {
    e.preventDefault();
    if (!form.room.trim() || !form.description.trim()) {
      setFormError('Please add a room number and a description.');
      return;
    }
    setFormError('');
    setSaving(true);
    setError(null);
    const id = `${form.block.replace(/\s+/g, '').slice(0, 3).toUpperCase()}-${form.room.trim()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const ticket = {
      id, block: form.block, room: form.room.trim(), category: form.category,
      description: form.description.trim(), reportedBy: form.reportedBy.trim(), contact: form.contact.trim(),
      urgent: !!form.urgent, photo: form.photo || null,
      status: 'pending', reportedAt: new Date().toISOString(), resolvedAt: null,
    };
    try {
      const result = await window.storage.set(`tickets:${id}`, JSON.stringify(ticket), true);
      if (!result) throw new Error('save failed');
      setTickets(prev => [ticket, ...prev]);
      setForm(emptyForm);
      setFormOpen(false);
    } catch (e) {
      setFormError('Could not save this ticket. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function cycleStatus(ticket) {
    const idx = STATUS_ORDER.indexOf(ticket.status);
    const newStatus = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    const updated = { ...ticket, status: newStatus, resolvedAt: newStatus === 'done' ? new Date().toISOString() : null };
    setTickets(prev => prev.map(t => (t.id === ticket.id ? updated : t)));
    try {
      const result = await window.storage.set(`tickets:${ticket.id}`, JSON.stringify(updated), true);
      if (!result) throw new Error('save failed');
    } catch (e) {
      setError('Status change did not save. Try again.');
      setTickets(prev => prev.map(t => (t.id === ticket.id ? ticket : t)));
    }
  }

  const counts = useMemo(() => {
    const c = { pending: 0, in_progress: 0, no_access: 0, done: 0 };
    tickets.forEach(t => { if (!isArchived(t)) c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [tickets]);
  const archivedCount = useMemo(() => tickets.filter(isArchived).length, [tickets]);
  const urgentCount = useMemo(() => tickets.filter(t => t.urgent && t.status !== 'done' && !isArchived(t)).length, [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      const archived = isArchived(t);
      if (filterStatus === 'archived') return archived;
      if (archived) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;
      if (filterUrgent && !t.urgent) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${t.block} ${t.room} ${t.description} ${t.reportedBy} ${t.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const aUrg = a.urgent && a.status !== 'done';
      const bUrg = b.urgent && b.status !== 'done';
      if (aUrg !== bUrg) return aUrg ? -1 : 1;
      return new Date(b.reportedAt) - new Date(a.reportedAt);
    });
  }, [tickets, filterStatus, filterCategory, filterUrgent, search]);

  return (
    <div style={{ background: '#0B1220', minHeight: '100vh', color: '#E8ECF4', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .fl-display { font-family: 'Space Grotesk', sans-serif; }
        .fl-mono { font-family: 'IBM Plex Mono', monospace; }
        .fl-scroll::-webkit-scrollbar { display: none; }
        .fl-card { background: #131B2E; border: 1px solid #232E48; }
        .fl-card:active { transform: scale(0.99); }
        .fl-punch { width: 9px; height: 9px; border-radius: 9999px; background: #0B1220; border: 2px solid #3A4568; display: inline-block; }
        .fl-dash { border-top: 1px dashed #2A3550; }
        .fl-input { background: #0F1626; border: 1px solid #2A3550; color: #E8ECF4; }
        .fl-input::placeholder { color: #5B6684; }
        .fl-input:focus { outline: none; border-color: #5B9BD5; }
        .fl-fab:active { transform: scale(0.95); }
      `}</style>

      <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="fl-display text-2xl font-bold">Facilities Log</h1>
          <span className="fl-mono" style={{ color: '#5B6684', fontSize: '11px' }}>{tickets.length} total</span>
        </div>
        <p className="text-sm mb-5" style={{ color: '#8B96AD' }}>Report and track block maintenance issues</p>

        <div className="grid grid-cols-4 gap-2 mb-5">
          {STATUSES.map(s => (
            <div key={s.id} className="fl-card rounded-lg py-2 px-1 text-center">
              <div className="fl-mono text-lg font-semibold" style={{ color: s.color }}>{counts[s.id] || 0}</div>
              <div style={{ color: '#8B96AD', fontSize: '9px' }} className="mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-3" style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#5B6684' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search room, block, description..."
            className="fl-input w-full rounded-lg py-2.5 text-sm"
            style={{ paddingLeft: '36px', paddingRight: '12px' }}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto fl-scroll pb-1 mb-2">
          <button type="button" onClick={() => setFilterStatus('all')} className="rounded-full flex-shrink-0"
            style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', border: '1px solid #2A3550', background: filterStatus === 'all' ? '#E8ECF4' : 'transparent', color: filterStatus === 'all' ? '#0B1220' : '#8B96AD' }}
          >All status</button>
          {STATUSES.map(s => (
            <button type="button" key={s.id} onClick={() => setFilterStatus(s.id)} className="rounded-full flex-shrink-0"
              style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', border: `1px solid ${filterStatus === s.id ? s.color : '#2A3550'}`, background: filterStatus === s.id ? s.color : 'transparent', color: filterStatus === s.id ? '#0B1220' : '#8B96AD' }}
            >{s.label}</button>
          ))}
          <button type="button" onClick={() => setFilterStatus('archived')} className="rounded-full flex-shrink-0"
            style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', border: `1px solid ${filterStatus === 'archived' ? '#8B96AD' : '#2A3550'}`, background: filterStatus === 'archived' ? '#8B96AD' : 'transparent', color: filterStatus === 'archived' ? '#0B1220' : '#8B96AD' }}
          >Archived ({archivedCount})</button>
        </div>
        <div className="flex gap-2 overflow-x-auto fl-scroll pb-1 mb-5">
          <button type="button" onClick={() => setFilterCategory('all')} className="rounded-full flex-shrink-0"
            style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', border: '1px solid #2A3550', background: filterCategory === 'all' ? '#E8ECF4' : 'transparent', color: filterCategory === 'all' ? '#0B1220' : '#8B96AD' }}
          >All types</button>
          {CATEGORIES.map(c => (
            <button type="button" key={c.id} onClick={() => setFilterCategory(c.id)} className="rounded-full flex-shrink-0 flex items-center gap-1"
              style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', border: '1px solid #2A3550', background: filterCategory === c.id ? '#E8ECF4' : 'transparent', color: filterCategory === c.id ? '#0B1220' : '#8B96AD' }}
            ><c.Icon size={12} />{c.label}</button>
          ))}
          <button type="button" onClick={() => setFilterUrgent(u => !u)} className="rounded-full flex-shrink-0 flex items-center gap-1"
            style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', border: `1px solid ${filterUrgent ? '#E15554' : '#2A3550'}`, background: filterUrgent ? '#E15554' : 'transparent', color: filterUrgent ? '#fff' : '#8B96AD' }}
          ><Flag size={12} />Urgent ({urgentCount})</button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg mb-3" style={{ background: 'rgba(225,85,84,0.1)', color: '#E15554', border: '1px solid rgba(225,85,84,0.3)', padding: '8px 12px', fontSize: '12px' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ color: '#5B6684' }}>
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="fl-card rounded-xl text-center py-14 px-4">
            <p className="text-sm" style={{ color: '#8B96AD' }}>
              {tickets.length === 0 ? 'No issues logged yet. Tap + to report one.' : 'Nothing matches these filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => {
              const cat = categoryMeta(t.category);
              const st = statusMeta(t.status);
              const urgentActive = t.urgent && t.status !== 'done';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => cycleStatus(t)}
                  className="fl-card rounded-xl w-full text-left overflow-hidden"
                  style={{ borderLeft: `3px solid ${urgentActive ? '#E15554' : st.color}` }}
                >
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <div className="flex items-center gap-2">
                      <span className="fl-punch"></span>
                      <span className="fl-mono font-semibold" style={{ color: '#5B6684', fontSize: '11px' }}>{t.id}</span>
                      {urgentActive && (
                        <span className="flex items-center gap-1" style={{ color: '#E15554', fontSize: '10px', fontWeight: 600 }}>
                          <Flag size={11} />URGENT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {t.photo && (
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); setViewPhoto(t.photo); }}
                          style={{ width: '26px', height: '26px', borderRadius: '6px', overflow: 'hidden', display: 'inline-block', border: '1px solid #2A3550' }}
                        >
                          <img src={t.photo} alt="issue" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </span>
                      )}
                      <cat.Icon size={15} style={{ color: '#8B96AD' }} />
                    </div>
                  </div>
                  <div className="px-4 pb-1">
                    <span className="fl-display text-sm font-semibold">{t.block} \u00b7 Rm {t.room}</span>
                  </div>
                  <div className="fl-dash mx-4"></div>
                  <div className="px-4 py-3">
                    <p className="text-sm leading-snug">{t.description}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span style={{ color: '#5B6684', fontSize: '11px' }}>
                        {t.reportedBy ? `${t.reportedBy} \u00b7 ` : ''}{formatDate(t.reportedAt)}
                      </span>
                      <span className="fl-mono font-semibold rounded" style={{ background: `${st.color}22`, color: st.color, padding: '2px 8px', fontSize: '10px' }}>
                        {st.label.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => { setFormError(''); setFormOpen(true); }}
        className="fl-fab rounded-full shadow-lg"
        style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '16px', background: '#F2A93C', color: '#0B1220', border: 'none' }}
        aria-label="Report an issue"
      >
        <Plus size={22} />
      </button>

      {formOpen && (
        <div
          className="flex items-end sm:items-center justify-center"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }}
          onClick={() => setFormOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="fl-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto"
            style={{ maxHeight: '90vh' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="fl-display text-lg font-semibold">Report an issue</h2>
              <button type="button" onClick={() => setFormOpen(false)} style={{ color: '#8B96AD', background: 'none', border: 'none' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddTicket} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ color: '#8B96AD', fontSize: '11px' }}>Block</label>
                  <select value={form.block} onChange={e => setForm({ ...form, block: e.target.value })} className="fl-input w-full rounded-lg px-3 py-2 mt-1 text-sm">
                    {BLOCK_GROUPS.map(g => (
                      <optgroup key={g.label} label={g.label}>
                        {g.options.map(b => <option key={b} value={b}>{b}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#8B96AD', fontSize: '11px' }}>Room</label>
                  <input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="e.g. 17" className="fl-input w-full rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>
              </div>
              <div>
                <label style={{ color: '#8B96AD', fontSize: '11px' }}>Category</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {CATEGORIES.map(c => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setForm({ ...form, category: c.id })}
                      className="rounded-lg py-2 flex flex-col items-center gap-1"
                      style={{ border: `1px solid ${form.category === c.id ? '#F2A93C' : '#2A3550'}`, background: form.category === c.id ? 'rgba(242,169,60,0.15)' : 'transparent' }}
                    >
                      <c.Icon size={16} style={{ color: form.category === c.id ? '#F2A93C' : '#8B96AD' }} />
                      <span style={{ color: form.category === c.id ? '#F2A93C' : '#8B96AD', fontSize: '9px' }}>{c.label.split('/')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ color: '#8B96AD', fontSize: '11px' }}>What's wrong?</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. sockets not working" rows={2} className="fl-input w-full rounded-lg px-3 py-2 mt-1 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ color: '#8B96AD', fontSize: '11px' }}>Reported by</label>
                  <input value={form.reportedBy} onChange={e => setForm({ ...form, reportedBy: e.target.value })} placeholder="Name" className="fl-input w-full rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>
                <div>
                  <label style={{ color: '#8B96AD', fontSize: '11px' }}>Access contact</label>
                  <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="Phone (optional)" className="fl-input w-full rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                {!form.photo ? (
                  <button type="button" onClick={() => photoInputRef.current && photoInputRef.current.click()} className="flex items-center gap-2 rounded-lg" style={{ border: '1px solid #2A3550', color: '#8B96AD', padding: '8px 12px', fontSize: '12px', background: 'transparent' }}>
                    <Camera size={14} /> Add photo (optional)
                  </button>
                ) : (
                  <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                    <img src={form.photo} alt="attached" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px' }} />
                    <button type="button" onClick={() => setForm(f => ({ ...f, photo: null }))} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#E15554', borderRadius: '9999px', width: '18px', height: '18px', border: 'none', color: '#fff', fontSize: '11px', lineHeight: '18px', padding: 0 }}>&times;</button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, urgent: !f.urgent }))}
                  className="flex items-center gap-1 rounded-lg"
                  style={{ padding: '8px 12px', fontSize: '12px', border: `1px solid ${form.urgent ? '#E15554' : '#2A3550'}`, background: form.urgent ? '#E15554' : 'transparent', color: form.urgent ? '#fff' : '#8B96AD' }}
                >
                  <Flag size={14} /> Urgent
                </button>
              </div>

              {formError && <p style={{ color: '#E15554', fontSize: '12px' }}>{formError}</p>}
              <button type="submit" disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-semibold mt-2" style={{ background: '#F2A93C', color: '#0B1220', border: 'none' }}>
                {saving ? 'Saving...' : 'Submit ticket'}
              </button>
            </form>
          </div>
        </div>
      )}

      {viewPhoto && (
        <div onClick={() => setViewPhoto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <img src={viewPhoto} alt="issue full size" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px' }} />
        </div>
      )}
    </div>
  );
}
