import SemesterSelect from './SemesterSelect';
import { currentSemester } from '../utils/helpers';

// Big page title + semester line, with the semester picker on the right (desktop layout).
export default function PageHeader({ board, semesterId, onSemesterChange }) {
  const isCurrent = semesterId === currentSemester().id;
  return (
    <div className="page-header">
      <div className="page-heading-group">
        <div className="page-eyebrow"><span className="live-dot"></span>{board ? 'OPERATIONS OVERVIEW' : 'PERSONAL REPORTS'}</div>
        <h1 className="display page-title">{board ? 'Keep campus moving.' : 'Your reports, in one place.'}</h1>
        <p className="page-sub">{board ? 'See what needs attention, what is underway, and what is ready to close.' : "Track the issues you've reported and follow each one through to resolution."}</p>
      </div>
      {board && (
        <div className="page-semester">
          <span className="dim">View</span>
          <SemesterSelect value={semesterId} onChange={onSemesterChange} />
          {isCurrent && <span className="current-view-pill">Live</span>}
        </div>
      )}
    </div>
  );
}
