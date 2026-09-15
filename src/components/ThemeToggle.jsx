export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button type="button" className="badge-btn" onClick={onToggle} aria-label="Toggle light/dark mode">
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
