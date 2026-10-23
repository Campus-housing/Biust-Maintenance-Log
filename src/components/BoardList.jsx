import { useEffect, useMemo, useState } from 'react';
import { BLOCKS, RESIDENTIAL_BLOCKS, FACILITIES_GROUP } from '../utils/constants';
import { isArchived, ticketMatchesSearch, blockLabel } from '../utils/helpers';
import TicketCard from './TicketCard';
import { ChevronRightIcon, FlagIcon, HomeIcon, LandmarkIcon, PinIcon } from './icons';

const FACILITY_NAMES = FACILITIES_GROUP ? FACILITIES_GROUP.options : [];

export default function BoardList({ tickets, loading, search, filterStatus, filterCategory, filterUrgent, onOpen, onOpenPhoto }) {
  const [openSections, setOpenSections] = useState(() => new Set());
  const [openLocations, setOpenLocations] = useState(() => new Set());

  const filtered = useMemo(() => {
    return tickets
      .filter((t) => {
        const archived = isArchived(t);
        if (filterStatus === 'archived') return archived;
        if (archived) return false;
        if (filterStatus !== 'all' && t.status !== filterStatus) return false;
        if (filterCategory !== 'all' && t.category !== filterCategory) return false;
        if (filterUrgent && !t.urgent) return false;
        if (!ticketMatchesSearch(t, search)) return false;
        return true;
      })
      .sort((a, b) => {
        const aUrg = a.urgent && a.status !== 'done';
        const bUrg = b.urgent && b.status !== 'done';
        if (aUrg !== bUrg) return aUrg ? -1 : 1;
        return new Date(b.reportedAt) - new Date(a.reportedAt);
      });
  }, [tickets, search, filterStatus, filterCategory, filterUrgent]);

  const byBlock = useMemo(() => {
    const m = new Map();
    filtered.forEach((t) => {
      if (!m.has(t.block)) m.set(t.block, []);
      m.get(t.block).push(t);
    });
    return m;
  }, [filtered]);

  const sections = useMemo(() => {
    const extras = [...byBlock.keys()].filter((b) => !BLOCKS.includes(b)).sort();
    const defs = [
      { key: 'residences', label: 'Residences', icon: HomeIcon, names: RESIDENTIAL_BLOCKS },
      { key: 'facilities', label: 'Campus facilities', icon: LandmarkIcon, names: FACILITY_NAMES },
    ];
    if (extras.length) defs.push({ key: 'other', label: 'Other locations', icon: PinIcon, names: extras });
    return defs.map((s) => {
      const urgentOf = (n) => (byBlock.get(n) || []).filter((t) => t.urgent && t.status !== 'done').length;
      const withReports = s.names
        .filter((n) => byBlock.has(n))
        .sort((a, b) => urgentOf(b) - urgentOf(a) || byBlock.get(b).length - byBlock.get(a).length || s.names.indexOf(a) - s.names.indexOf(b));
      return {
        ...s,
        withReports,
        empty: s.names.filter((n) => !byBlock.has(n)),
        total: withReports.reduce((n, b) => n + byBlock.get(b).length, 0),
        urgent: withReports.reduce((n, b) => n + urgentOf(b), 0),
      };
    });
  }, [byBlock]);

  // While searching, open everything that has a match so results are never hidden behind a closed menu.
  useEffect(() => {
    if (!search.trim()) return;
    setOpenSections(new Set(sections.filter((s) => s.withReports.length).map((s) => s.key)));
    setOpenLocations(new Set(byBlock.keys()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (loading) {
    return <div className="loading-wrap"><div className="spinner"></div></div>;
  }
  if (filtered.length === 0) {
    return <div className="empty-card">{tickets.length === 0 ? 'No issues logged yet.' : 'Nothing matches these filters.'}</div>;
  }

  const flip = (setter, key) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div>
      <div className="section-tiles" style={sections.length > 2 ? { gridTemplateColumns: '1fr 1fr 1fr' } : undefined}>
        {sections.map((s) => (
          <button
            key={s.key} type="button"
            className={'section-tile' + (openSections.has(s.key) ? ' section-tile-active' : '')}
            onClick={() => flip(setOpenSections, s.key)}
            aria-expanded={openSections.has(s.key)}
          >
            <span className="section-tile-title">
              <span className="tile-title-main"><span className="tile-icon"><s.icon size={16} /></span>{s.label}</span>
              <ChevronRightIcon size={16} className={'chev' + (openSections.has(s.key) ? ' chev-open' : '')} />
            </span>
            <span className="section-tile-sub">
              {s.total} {s.total === 1 ? 'report' : 'reports'}{s.withReports.length ? ' · ' + s.withReports.length + (s.withReports.length === 1 ? ' place' : ' places') : ''}
            </span>
            {s.urgent > 0 && <span className="section-tile-sub" style={{ color: '#E15554', display: 'flex', alignItems: 'center', gap: 5 }}><FlagIcon size={12} /> {s.urgent} urgent</span>}
          </button>
        ))}
      </div>

      {sections.filter((s) => openSections.has(s.key)).map((s) => (
        <div key={s.key} className="section-panel">
          <div className="section-panel-label">{s.label}</div>
          {s.withReports.length === 0 && <div className="empty-card" style={{ padding: 14 }}>No reports here.</div>}
          {s.withReports.map((block) => {
            const group = byBlock.get(block);
            const open = openLocations.has(block);
            const urgentInGroup = group.some((t) => t.urgent && t.status !== 'done');
            return (
              <div key={block} className="block-group">
                <button type="button" className="block-group-header" onClick={() => flip(setOpenLocations, block)} aria-expanded={open}>
                  <span className="block-group-title">{urgentInGroup && <FlagIcon size={14} style={{ color: '#E15554', marginRight: 7 }} />}{blockLabel(block)}</span>
                  <span className="block-group-count">{group.length}</span>
                  <ChevronRightIcon size={16} className={'chev' + (open ? ' chev-open' : '')} />
                </button>
                {open && (
                  <div className="block-group-body">
                    {group.map((t) => (
                      <TicketCard key={t.id} ticket={t} onOpen={onOpen} onOpenPhoto={onOpenPhoto} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {s.empty.length > 0 && (
            <div className="empty-locations">No reports: {s.empty.map(blockLabel).join(' · ')}</div>
          )}
        </div>
      ))}
    </div>
  );
}
