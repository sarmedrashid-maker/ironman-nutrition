import { useState } from 'react'
import { api } from '../api'

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export default function EatingOut() {
  const [description, setDescription] = useState('')
  const [logDate, setLogDate] = useState(today())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleEstimate = async () => {
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.eatingOut.estimate({
        description,
        user_id: 1,
        log_date: logDate,
      })
      setResult(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Eating Out Estimator</h1>
      <div className="text-secondary mb-24" style={{ fontSize: 14, marginTop: -12 }}>
        Describe a restaurant meal and get portion guidance to hit your remaining daily targets.
      </div>

      <div className="grid-2 gap-24">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title">Describe Your Meal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Date (uses remaining targets for that day)</label>
                <input
                  type="date"
                  className="form-input"
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Restaurant & meal description</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 120 }}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={`Examples:\n• "Sushi restaurant — thinking salmon rolls, edamame, miso soup"\n• "Italian place, pasta options and grilled fish"\n• "Thai food — pad see ew and spring rolls"\n• "Hotel breakfast buffet — eggs, fruit, bread"`}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleEstimate}
                disabled={loading || !description.trim()}
              >
                {loading ? 'Estimating…' : 'Get Portion Guidance'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">How It Works</div>
            <div className="text-sm text-secondary" style={{ lineHeight: 1.8 }}>
              <p>1. Enter what you're considering ordering.</p>
              <p>2. The app fetches your remaining macro targets for the selected date.</p>
              <p>3. Claude estimates typical portions and macros for the meal.</p>
              <p>4. You get specific guidance on how much to eat to hit your targets.</p>
              <div className="divider" />
              <p className="text-muted">Estimates use typical restaurant portions — actual macros vary. Use this as a guide, not a precise measurement.</p>
            </div>
          </div>
        </div>

        <div>
          {error && <div className="alert alert-danger mb-16">{error}</div>}

          {!result && !loading && (
            <div className="card" style={{ height: '100%', minHeight: 300 }}>
              <div className="empty-state">
                <div className="empty-state-icon">&#127858;</div>
                <div>Enter a meal description to get started</div>
              </div>
            </div>
          )}

          {loading && (
            <div className="card">
              <div className="loading" style={{ padding: '48px 0' }}>Asking Claude to estimate macros…</div>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {result.flags && result.flags.length > 0 && (
                <div className="alert alert-danger">
                  <div>
                    <strong>Dietary flags:</strong>
                    <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                      {result.flags.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              <div className="card">
                <div className="card-title">Recommendation</div>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}>{result.recommendation}</p>
                <div className="divider" />
                <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.7 }}>{result.portion_guidance}</p>
              </div>

              <div className="card">
                <div className="card-title">Estimated Macros (Recommended Portion)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <MacroStat label="Calories" value={Math.round(result.estimated_macros.calories || 0)} unit="kcal" color="var(--cal-color)" />
                  <MacroStat label="Protein" value={Math.round(result.estimated_macros.protein_g || 0)} unit="g" color="var(--protein-color)" />
                  <MacroStat label="Carbs" value={Math.round(result.estimated_macros.carbs_g || 0)} unit="g" color="var(--carbs-color)" />
                  <MacroStat label="Fat" value={Math.round(result.estimated_macros.fat_g || 0)} unit="g" color="var(--fat-color)" />
                </div>
              </div>

              {result.meal_items && result.meal_items.length > 0 && (
                <div className="card">
                  <div className="card-title">Item Breakdown</div>
                  {result.meal_items.map((item, i) => (
                    <div key={i} className="food-entry">
                      <div className="food-entry-info">
                        <div className="food-entry-name">{item.name}</div>
                        <div className="food-entry-macros">
                          {item.typical_serving && <span>{item.typical_serving} · </span>}
                          <span className="macro-protein">{Math.round(item.protein_g_per_serving || 0)}g P</span>
                          {' · '}
                          <span className="macro-carbs">{Math.round(item.carbs_g_per_serving || 0)}g C</span>
                          {' · '}
                          <span className="macro-fat">{Math.round(item.fat_g_per_serving || 0)}g F</span>
                        </div>
                      </div>
                      <div className="food-entry-cal">{Math.round(item.calories_per_serving || 0)} kcal</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MacroStat({ label, value, unit, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}<span style={{ fontSize: 13, fontWeight: 400 }}>{unit}</span></div>
      <div className="text-sm text-muted" style={{ marginTop: 2 }}>{label}</div>
    </div>
  )
}
