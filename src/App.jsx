import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useTickets } from './hooks/useTickets';
import { useTheme } from './hooks/useTheme';
import { useMediaQuery } from './hooks/useMediaQuery';
import AuthScreen from './components/AuthScreen';
import IdentityCard from './components/IdentityCard';
import ThemeToggle from './components/ThemeToggle';
import StatsGrid from './components/StatsGrid';
import Filters from './components/Filters';
import BoardList from './components/BoardList';
import MyReportsList from './components/MyReportsList';
import TicketFormModal from './components/TicketFormModal';
import TicketDetailModal from './components/TicketDetailModal';
import AdminPanel from './components/AdminPanel';
import SummaryPanel from './components/SummaryPanel';
import SubmissionsPanel from './components/SubmissionsPanel';
import PhotoOverlay from './components/PhotoOverlay';
import StudentHome from './components/StudentHome';
import SubmissionForm from './components/SubmissionForm';
import AccountPanel from './components/AccountPanel';
import ChangePasswordScreen from './components/ChangePasswordScreen';
import SemesterSelect from './components/SemesterSelect';
import TopBar from './components/TopBar';
import PageHeader from './components/PageHeader';
import { currentSemester, scopeToSemester } from './utils/helpers';
import { SEMESTERS } from './utils/constants';

export default function App() {
  const { initializing, currentUser, publicMode, isBoardView, isStudent, mustChangePassword, name: accountName } = useAuth();
  const { tickets, loading, error } = useTickets();
  const { theme, toggleTheme } = useTheme();
  const isDesktop = useMediaQuery('(min-width: 900px)');

  const [semesterId, setSemesterId] = useState(() => currentSemester().id);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterUrgent, setFilterUrgent] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [detailTicketId, setDetailTicketId] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);

  if (initializing) {
    return <div className="center-screen"><div className="spinner"></div></div>;
  }
  if (!currentUser && !publicMode) {
    return <AuthScreen />;
  }
  if (currentUser && mustChangePassword) {
    return <ChangePasswordScreen />;
  }

  const board = isBoardView;
  const detailTicket = tickets.find((t) => t.id === detailTicketId) || null;
  // Board views are scoped to the chosen semester (open tickets from earlier ones carry over).
  const visibleTickets = board ? scopeToSemester(tickets, semesterId) : tickets;
  const semesterLabel = semesterId === 'all' ? 'All semesters' : (SEMESTERS.find((s) => s.id === semesterId) || {}).label;

  return (
    <div className="app-frame">
      {isDesktop && (
        <TopBar
          tickets={tickets} board={board} theme={theme} onToggleTheme={toggleTheme}
          onOpenManage={() => setAdminOpen(true)} onOpenSummary={() => setSummaryOpen(true)} onOpenInbox={() => setInboxOpen(true)} onOpenAccount={() => setAccountOpen(true)}
        />
      )}
      <main className="wrap app-content">
        {isDesktop ? (
          <PageHeader board={board} semesterId={semesterId} semesterLabel={semesterLabel} onSemesterChange={setSemesterId} />
        ) : (
          <>
            <div className="header-row">
              <div>
                <p className="mobile-eyebrow">BIUST · OPERATIONS</p>
                <h1 className="display">M&amp;F Log</h1>
              </div>
              <div className="mobile-header-actions">
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                {!isStudent && <span className="mono dim mobile-total">{visibleTickets.length}{board ? ' total' : visibleTickets.length === 1 ? ' report' : ' reports'}</span>}
              </div>
            </div>
            <IdentityCard tickets={tickets} onOpenManage={() => setAdminOpen(true)} onOpenSummary={() => setSummaryOpen(true)} onOpenInbox={() => setInboxOpen(true)} onOpenAccount={() => setAccountOpen(true)} />
            <p className="subtitle">{board ? 'A live view of campus maintenance' : "Track the issues you've reported"}</p>

            {board && (
              <div className="mobile-semester-row">
                <span className="dim">Current view</span>
                <SemesterSelect value={semesterId} onChange={setSemesterId} />
              </div>
            )}
          </>
        )}
        {board && <StatsGrid tickets={visibleTickets} activeStatus={filterStatus} onSelect={setFilterStatus} />}
        {board && (
          <Filters
            tickets={visibleTickets}
            search={search} setSearch={setSearch}
            filterStatus={filterStatus} setFilterStatus={setFilterStatus}
            filterCategory={filterCategory} setFilterCategory={setFilterCategory}
            filterUrgent={filterUrgent} setFilterUrgent={setFilterUrgent}
          />
        )}

        {error && <div className="error-banner">{error}</div>}

        {board ? (
          <BoardList
            tickets={visibleTickets} loading={loading}
            search={search} filterStatus={filterStatus} filterCategory={filterCategory} filterUrgent={filterUrgent}
            onOpen={setDetailTicketId} onOpenPhoto={setPhotoUrl}
          />
        ) : isStudent ? (
          <StudentHome onReport={() => setFormOpen(true)} />
        ) : (
          <MyReportsList tickets={tickets} loading={loading} onOpen={setDetailTicketId} onOpenPhoto={setPhotoUrl} />
        )}

        {board && !loading && visibleTickets.length > 0 && (
          <p className="board-footer"><span className="live-dot"></span>{visibleTickets.length} total {visibleTickets.length === 1 ? 'issue' : 'issues'} · {semesterLabel}</p>
        )}
      </main>

      {currentUser && !isStudent && (
        <button type="button" className="fab" aria-label="Report an issue" onClick={() => setFormOpen(true)}>
          <span className="fab-plus">+</span><span className="fab-label">Report issue</span>
        </button>
      )}

      {formOpen && (isStudent
        ? <SubmissionForm student={{ uid: currentUser.uid, email: currentUser.email, name: accountName }} onClose={() => setFormOpen(false)} />
        : <TicketFormModal onClose={() => setFormOpen(false)} />)}
      {accountOpen && <AccountPanel onClose={() => setAccountOpen(false)} />}
      {detailTicket && (
        <TicketDetailModal ticket={detailTicket} onClose={() => setDetailTicketId(null)} onOpenPhoto={setPhotoUrl} />
      )}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      {summaryOpen && <SummaryPanel tickets={visibleTickets} semesterLabel={semesterLabel} onClose={() => setSummaryOpen(false)} />}
      {inboxOpen && <SubmissionsPanel onClose={() => setInboxOpen(false)} />}
      <PhotoOverlay url={photoUrl} onClose={() => setPhotoUrl(null)} />
    </div>
  );
}
