import { useAuth } from '../contexts/AuthContext';
import { ROLE_META } from '../utils/constants';
import { specialtyLabel } from '../utils/helpers';
import { downloadWorkbook } from '../utils/export';
import { useSubmissionsCount } from '../hooks/useSubmissionsCount';

export default function IdentityCard({ tickets, onOpenManage, onOpenSummary, onOpenInbox }) {
  const {
    currentUser, role, name, specialty, assignedBlocks, publicMode,
    isAdmin, isMaintainer, canSeeOversight, logout, exitPublicMode,
  } = useAuth();
  const { count: inboxCount, canReview } = useSubmissionsCount();

  if (publicMode) {
    return (
      <div className="identity-card">
        <div className="identity-name">Public status board</div>
        <div className="identity-meta-row">
          <span className="dim" style={{ fontSize: 12 }}>Read-only — no account</span>
          <span style={{ marginLeft: 'auto' }}>
            <button type="button" className="badge-btn" onClick={exitPublicMode}>Log in to report</button>
          </span>
        </div>
      </div>
    );
  }
  if (!currentUser) return null;

  const rm = ROLE_META[role] || { label: role, color: '#8B96AD' };
  let extra = '';
  if (isMaintainer) extra = specialtyLabel(specialty);
  else if (role === 'reporter' && assignedBlocks.length) extra = 'RA: ' + assignedBlocks.join(', ');

  return (
    <div className="identity-card">
      <div className="identity-name">{name || currentUser.email}</div>
      <div className="identity-meta-row">
        <span className="role-pill" style={{ background: rm.color + '22', color: rm.color, border: '1px solid ' + rm.color + '55' }}>
          {rm.label}
        </span>
        {extra && <span className="dim" style={{ fontSize: 11 }}>{extra}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAdmin && <button type="button" className="badge-btn" onClick={onOpenManage}>Manage</button>}
          {canSeeOversight && <button type="button" className="badge-btn" onClick={onOpenSummary}>Summary</button>}
          {canReview && (
            <button type="button" className="badge-btn" onClick={onOpenInbox} style={inboxCount > 0 ? { borderColor: '#F2A93C', color: '#F2A93C' } : undefined}>
              Inbox{inboxCount > 0 ? ' (' + inboxCount + ')' : ''}
            </button>
          )}
          <button type="button" className="badge-btn" onClick={() => downloadWorkbook(tickets, role || 'export')}>Export</button>
          <button type="button" className="badge-btn" onClick={logout}>Log out</button>
        </span>
      </div>
    </div>
  );
}
