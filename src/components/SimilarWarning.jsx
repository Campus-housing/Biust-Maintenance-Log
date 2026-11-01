import { useSimilarReports } from '../hooks/useSimilarReports';
import { formatDuration, statusMeta } from '../utils/helpers';

// "This may already be reported" — shown before sending, never blocks sending.
export default function SimilarWarning({ block, room, category }) {
  const matches = useSimilarReports({ block, room, category });
  if (!matches.length) return null;
  return (
    <div className="similar-warning" role="status">
      <strong>This may already be reported</strong>
      {matches.map((m) => (
        <div key={m.id} style={{ marginTop: 4 }}>
          “{m.description}” — {statusMeta(m.status).label}, {formatDuration(Date.now() - new Date(m.reportedAt).getTime())} ago{m.code ? ' (' + m.code + ')' : ''}
        </div>
      ))}
      <div style={{ marginTop: 4, color: 'var(--muted)' }}>If yours is a different problem, go ahead and send it.</div>
    </div>
  );
}
