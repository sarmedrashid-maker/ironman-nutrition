/**
 * Horizontal progress bar row for a single macro.
 */
export default function MacroBar({ label, current, target, color, unit = 'g' }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const over = target > 0 && current > target

  return (
    <div className="macro-bar-row">
      <span className="macro-bar-label">{label}</span>
      <div className="macro-bar-track">
        <div
          className="macro-bar-fill"
          style={{
            width: `${pct}%`,
            background: over ? 'var(--warning)' : color,
          }}
        />
      </div>
      <span className="macro-bar-nums" style={{ color: over ? 'var(--warning)' : 'var(--text-muted)' }}>
        {Math.round(current)}<span style={{ opacity: 0.6 }}>/{Math.round(target)}{unit}</span>
      </span>
    </div>
  )
}
