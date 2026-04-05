/**
 * Circular SVG progress ring for a single macro.
 * Uses a relative container overlay so the center text aligns precisely with the ring.
 */
export default function MacroRing({ label, current, target, color, unit = 'g' }) {
  const radius = 38
  const stroke = 7
  const size = (radius + stroke) * 2
  const circumference = 2 * Math.PI * radius
  const pct = target > 0 ? Math.min(current / target, 1) : 0
  const dashOffset = circumference * (1 - pct)
  const over = target > 0 && current > target
  const displayColor = over ? 'var(--warning)' : color

  return (
    <div className="macro-ring-wrap">
      {/* Relative container sized to the SVG so the overlay centers correctly */}
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="var(--bg-input)"
            strokeWidth={stroke}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={displayColor}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        {/* Center text overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span className="macro-ring-current" style={{ color: displayColor }}>
            {Math.round(current)}
          </span>
          <span className="macro-ring-target">/{Math.round(target)}{unit}</span>
        </div>
      </div>
      <span className="macro-ring-label">{label}</span>
    </div>
  )
}
