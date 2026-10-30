import { STATUSES, CATEGORIES, CATEGORY_COLORS } from '../utils/constants';
import { isArchived } from '../utils/helpers';
import { SearchIcon, FlagIcon, CategoryIcon } from './icons';

// Idle: tinted outline + text in the chip's own colour. Selected: filled.
function Chip({ active, color, onClick, children }) {
  const bg = active ? (color || 'var(--text)') : 'transparent';
  const bd = active ? (color || 'var(--text)') : (color ? color + '55' : 'var(--border-soft)');
  const fg = active ? (color ? '#0B1220' : 'var(--bg)') : (color || 'var(--muted)');
  return (
    <button type="button" className="chip" style={{ background: bg, borderColor: bd, color: fg }} aria-pressed={!!active} onClick={onClick}>
      {children}
    </button>
  );
}

export default function Filters({ tickets, search, setSearch, filterStatus, setFilterStatus, filterCategory, setFilterCategory, filterUrgent, setFilterUrgent }) {
  const archivedCount = tickets.filter(isArchived).length;
  const urgentCount = tickets.filter((t) => t.urgent && t.status !== 'done' && !isArchived(t)).length;
  const hasActiveFilters = !!search.trim() || filterStatus !== 'all' || filterCategory !== 'all' || filterUrgent;

  return (
    <div className="filters-panel">
      <div className="filter-heading-row">
        <div>
          <p className="section-kicker">Find an issue</p>
          <p className="filter-hint">Search by room, location, category, or description.</p>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            className="clear-filters"
            onClick={() => { setSearch(''); setFilterStatus('all'); setFilterCategory('all'); setFilterUrgent(false); }}
          >Clear filters</button>
        )}
      </div>
      <div className="search-wrap">
        <span className="search-icon"><SearchIcon size={18} /></span>
        <input
          id="searchInput"
          className="input"
          aria-label="Search issues"
          placeholder="Search room, location, description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">✕</button>}
      </div>
      <div className="chip-row">
        <Chip active={filterStatus === 'all'} onClick={() => setFilterStatus('all')}>All status</Chip>
        {STATUSES.map((s) => (
          <Chip key={s.id} active={filterStatus === s.id} color={s.color} onClick={() => setFilterStatus(s.id)}>{s.label}</Chip>
        ))}
        <Chip active={filterStatus === 'archived'} color="#8B96AD" onClick={() => setFilterStatus('archived')}>Archived ({archivedCount})</Chip>
      </div>
      <div className="chip-row">
        <Chip active={filterCategory === 'all'} onClick={() => setFilterCategory('all')}>All types</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={filterCategory === c.id} color={CATEGORY_COLORS[c.id]} onClick={() => setFilterCategory(c.id)}>
            <CategoryIcon id={c.id} size={14} /> {c.label}
          </Chip>
        ))}
        <button
          type="button"
          className={'chip' + (filterUrgent ? ' chip-urgent-active' : '')}
          style={filterUrgent ? undefined : { color: '#E15554', borderColor: '#E1555555' }}
          aria-pressed={!!filterUrgent}
          onClick={() => setFilterUrgent((u) => !u)}
        >
          <FlagIcon size={14} /> Urgent ({urgentCount})
        </button>
      </div>
    </div>
  );
}
