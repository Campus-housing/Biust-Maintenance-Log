import { COMMON_ISSUES } from '../utils/constants';

// One-tap wording for the usual problems in a category; tapping adds it to the description.
export default function IssueChips({ category, onPick }) {
  const issues = COMMON_ISSUES[category] || [];
  if (!issues.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      {issues.map((t) => (
        <button key={t} type="button" className="chip" style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => onPick(t)}>{t}</button>
      ))}
    </div>
  );
}
