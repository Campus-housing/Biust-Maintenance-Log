import SemesterSelect from './SemesterSelect';
import { currentSemester } from '../utils/helpers';

// Big page title + semester line, with the semester picker on the right (desktop layout).
export default function PageHeader({ board, semesterId, semesterLabel, onSemesterChange }) {
  const isCurrent = semesterId === currentSemester().id;
  return (
    <div className="page-header">
      <div>
        <h1 className="display page-title">{board ? 'Report and track campus maintenance issues' : "Track the issues you've reported"}</h1>
        {board && <p className="page-sub">{semesterLabel}{isCurrent ? ' (current)' : ''}</p>}
      </div>
      {board && (
        <div className="page-semester">
          <span className="dim">Showing</span>
          <SemesterSelect value={semesterId} onChange={onSemesterChange} />
        </div>
      )}
    </div>
  );
}
