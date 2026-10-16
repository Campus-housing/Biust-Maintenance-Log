import { SEMESTERS } from '../utils/constants';
import { currentSemester } from '../utils/helpers';

export default function SemesterSelect({ value, onChange }) {
  const current = currentSemester();
  return (
    <select
      className="input"
      style={{ width: 'auto', padding: '4px 8px', fontSize: 11, borderRadius: 8 }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Semester"
    >
      {SEMESTERS.map((s) => (
        <option key={s.id} value={s.id}>{s.label}{s.id === current.id ? ' (current)' : ''}</option>
      ))}
      <option value="all">All semesters</option>
    </select>
  );
}
