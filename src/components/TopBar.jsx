import { useAuth } from '../contexts/AuthContext';
import { ROLE_META } from '../utils/constants';
import { specialtyLabel } from '../utils/helpers';
import { downloadWorkbook } from '../utils/export';
import { useSubmissionsCount } from '../hooks/useSubmissionsCount';
import { WrenchIcon, InboxIcon, SunIcon, MoonIcon } from './icons';

function initialsOf(text) {
  const parts = String(text || '?').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// Desktop navigation bar. Phones keep the compact header + identity card.
export default function TopBar({ tickets, board, theme, onToggleTheme, onOpenManage, onOpenSummary, onOpenInbox, onOpenAccount }) {
  const {
    currentUser, role, name, specialty, assignedBlocks, publicMode,
    isAdmin, isMaintainer, isStudent, canSeeOversight, logout, exitPublicMode,
  } = useAuth();
  const { count: inboxCount, canReview } = useSubmissionsCount();

  const rm = ROLE_META[role] || { label: role, color: '#8B96AD' };
  let extra = '';
  if (isMaintainer) extra = specialtyLabel(specialty);
  else if (role === 'reporter' && assignedBlocks.length) extra = 'RA: ' + assignedBlocks.join(', ');
  const display = name || (currentUser && currentUser.email) || '';

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand">
          <span className="brand-mark"><WrenchIcon size={20} stroke={2.2} /></span>
          <span className="display">BIUST M&amp;F Log</span>
        </div>

        <nav className="topbar-nav" aria-label="Main">
          <button type="button" className="nav-tab nav-tab-active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            {board ? 'Dashboard' : 'My reports'}
          </button>
          {isAdmin && <button type="button" className="nav-tab" onClick={onOpenManage}>Manage</button>}
          {canSeeOversight && <button type="button" className="nav-tab" onClick={onOpenSummary}>Summary</button>}
          {currentUser && !isStudent && <button type="button" className="nav-tab" onClick={() => downloadWorkbook(tickets, role || 'export')}>Export</button>}
        </nav>

        <div className="topbar-right">
          <div className="theme-seg" role="group" aria-label="Colour mode">
            <button type="button" aria-label="Light mode" aria-pressed={theme === 'light'} onClick={() => theme !== 'light' && onToggleTheme()}><SunIcon size={16} /></button>
            <button type="button" aria-label="Dark mode" aria-pressed={theme === 'dark'} onClick={() => theme !== 'dark' && onToggleTheme()}><MoonIcon size={16} /></button>
          </div>
          {canReview && (
            <button type="button" className="inbox-pill" onClick={onOpenInbox}>
              <InboxIcon size={18} /> Inbox
              {inboxCount > 0 && <span className="count-badge">{inboxCount}</span>}
            </button>
          )}
          {currentUser && (
            <button type="button" className="topbar-user" onClick={onOpenAccount} title="Account settings" aria-label="Account settings">
              <span className="avatar" aria-hidden="true">{initialsOf(display)}</span>
              <span className="topbar-user-text">
                <span className="topbar-user-name">{display}</span>
                <span className="topbar-user-meta">
                  <span className="role-pill" style={{ background: rm.color + '22', color: rm.color, border: '1px solid ' + rm.color + '55' }}>{rm.label}</span>
                  {extra && <span className="dim" style={{ fontSize: 11 }}>{extra}</span>}
                </span>
              </span>
            </button>
          )}
          {currentUser && <button type="button" className="logout-btn" onClick={logout}>Log out</button>}
          {publicMode && !currentUser && <button type="button" className="logout-btn" onClick={exitPublicMode}>Log in to report</button>}
        </div>
      </div>
    </header>
  );
}
