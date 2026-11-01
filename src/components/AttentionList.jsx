import { useMemo, useState } from 'react';
import { attentionList, blockLabel, roomLabel } from '../utils/helpers';
import { ChevronRightIcon } from './icons';

// "Needs attention": open tickets past their target, stuck on no-access, or with nobody assigned.
export default function AttentionList({ tickets, onOpen }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => attentionList(tickets), [tickets]);
  if (!rows.length) return null;
  const shown = rows.slice(0, 8);
  return (
    <div className="attention-card">
      <button type="button" className="attention-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span><span style={{ color: '#E15554' }}>●</span> Needs attention <strong className="mono">{rows.length}</strong></span>
        <ChevronRightIcon size={16} className={'chev' + (open ? ' chev-open' : '')} />
      </button>
      {open && (
        <div>
          {shown.map(({ t, reasons }) => (
            <button key={t.id} type="button" className="attention-row" onClick={() => onOpen(t.id)}>
              <span style={{ textAlign: 'left', minWidth: 0 }}>
                <strong style={{ fontSize: 13 }}>{blockLabel(t.block)} · {roomLabel(t.room)}</strong>
                <br /><span className="dim" style={{ fontSize: 11 }}>{t.description}</span>
              </span>
              <span className="attention-tags">
                {reasons.map((r) => <span key={r.id} className={'attn-tag attn-' + r.id}>{r.label}</span>)}
              </span>
            </button>
          ))}
          {rows.length > shown.length && <p className="dim" style={{ fontSize: 11, margin: '8px 12px 4px' }}>+ {rows.length - shown.length} more</p>}
        </div>
      )}
    </div>
  );
}
