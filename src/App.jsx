import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useTickets } from './hooks/useTickets';
import { useTheme } from './hooks/useTheme';
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
import SemesterSelect from './components/SemesterSelect';
import { currentSemester, scopeToSemester } from './utils/helpers';
import { SEMESTERS } from './utils/constants';

export default function App() {
  const { initializing, currentUser, publicMode, isBoardView } = useAuth();
  const { tickets, loading, error } = useTickets();
  const { theme, toggleTheme } = useTheme();

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
  const [photoUrl, setPhotoUrl] = useState(null);

  if (initializing) {
    return <div className="center-screen"><div className="spinner"></div></div>;
  }
  if (!currentUser && !publicMode) {
    return <AuthScreen />;
  }

  const board = isBoardView;
  const detailTicket = tickets.find((t) => t.id === detailTicketId) || null;
  // Board views are scoped to the chosen semester (open tickets from earlier ones carry over).
  const visibleTickets = board ? scopeToSemester(tickets, semesterId) : tickets;
  const semesterLabel = semesterId === 'all' ? 'All semesters' : (SEMESTERS.find((s) => s.id === semesterId) || {}).label;

  return (
    <div>
      <div className="wrap">
        <div className="header-row">
          <h1 className="display">BIUST M&amp;F Log</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <span className="mono dim">{visibleTickets.length}{board ? ' total' : visibleTickets.length === 1 ? ' report' : ' reports'}</span>
          </div>
        </div>
        <IdentityCard tickets={tickets} onOpenManage={() => setAdminOpen(true)} onOpenSummary={() => setSummaryOpen(true)} onOpenInbox={() => setInboxOpen(true)} />
        <p className="subtitle">{board ? 'Report and track campus maintenance issues' : "Track the issues you've reported"}</p>

        {board && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="dim" style={{ fontSize: 11 }}>Showing</span>
            <SemesterSelect value={semesterId} onChange={setSemesterId} />
          </div>
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
        ) : (
          <MyReportsList tickets={tickets} loading={loading} onOpen={setDetailTicketId} onOpenPhoto={setPhotoUrl} />
        )}
      </div>

      {currentUser && (
        <button type="button" className="fab" aria-label="Report an issue" onClick={() => setFormOpen(true)}>+</button>
      )}

      {formOpen && <TicketFormModal onClose={() => setFormOpen(false)} />}
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
