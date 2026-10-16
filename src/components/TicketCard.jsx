import { categoryMeta, statusMeta, formatDate } from '../utils/helpers';

export default function TicketCard({ ticket, onOpen, onOpenPhoto }) {
  const cat = categoryMeta(ticket.category);
  const st = statusMeta(ticket.status);
  const urgentActive = ticket.urgent && ticket.status !== 'done';
  const borderColor = urgentActive ? '#E15554' : st.color;

  return (
    <button
      type="button"
      className="ticket-card"
      style={{ borderLeftColor: borderColor }}
      onClick={() => onOpen(ticket.id)}
    >
      <div className="ticket-top">
        <div className="ticket-top-left">
          <span className="punch"></span>
          <span className="mono ticket-code">{ticket.code || ''}</span>
          {urgentActive && <span className="urgent-tag">🚩 URGENT</span>}
          {ticket._carriedFrom && <span className="dim mono" style={{ fontSize: 10 }}>↪ from {ticket._carriedFrom}</span>}
        </div>
        <div className="ticket-top-right">
          {ticket.photo && (
            <span
              className="thumb"
              onClick={(e) => { e.stopPropagation(); onOpenPhoto(ticket.photo); }}
            >
              <img src={ticket.photo} alt="issue" />
            </span>
          )}
          {Array.isArray(ticket.notes) && ticket.notes.length > 0 && (
            <span className="dim mono" style={{ fontSize: 10 }}>💬{ticket.notes.length}</span>
          )}
          <span className="cat-icon">{cat.icon}</span>
        </div>
      </div>
      <div className="ticket-title display">{ticket.block} · Rm {ticket.room}</div>
      <div className="dash"></div>
      <div className="ticket-body">
        <p className="ticket-desc">{ticket.description}</p>
        <div className="ticket-meta">
          <span className="dim">
            {ticket.reportedBy ? ticket.reportedBy + ' · ' : ''}{formatDate(ticket.reportedAt)}
          </span>
          <span className="mono status-pill" style={{ background: st.color + '22', color: st.color }}>
            {st.label.toUpperCase()}
          </span>
        </div>
      </div>
    </button>
  );
}
