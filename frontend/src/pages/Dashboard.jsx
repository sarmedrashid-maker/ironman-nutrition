import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { useUser } from '../contexts/UserContext'
import MacroRing from '../components/MacroRing'
import MacroBar from '../components/MacroBar'

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function sum(entries, field) {
  return entries.reduce((a, e) => a + (e[field] || 0), 0)
}

const CATEGORY_LABELS = {
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  dinner:    'Dinner',
  snack:     'Snack',
  snack_1:   'Snack',
  snack_2:   'Snack',
  snack_3:   'Snack',
}

const TSS_LABEL = (tss) =>
  tss === 0  ? { text: 'Rest',     cls: 'badge-info' } :
  tss < 50   ? { text: 'Easy',     cls: 'badge-success' } :
  tss < 100  ? { text: 'Moderate', cls: 'badge-warning' } :
  tss < 150  ? { text: 'Hard',     cls: 'badge-danger' } :
               { text: 'Very Hard',cls: 'badge-danger' }

export default function Dashboard() {
  const { userId } = useUser()
  const [log, setLog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [date, setDate] = useState(todayISO())

  const shiftDay = (n) => {
    const [y, m, d] = date.split('-').map(Number)
    const dt = new Date(y, m - 1, d + n)
    setDate([
      dt.getFullYear(),
      String(dt.getMonth() + 1).padStart(2, '0'),
      String(dt.getDate()).padStart(2, '0'),
    ].join('-'))
  }

  const loadLog = useCallback(() => api.foodLog.get(date, userId).then(setLog), [date, userId])

  useEffect(() => {
    loadLog().catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [loadLog])

  if (loading) return <div className="loading">Loading…</div>
  if (error)   return <div className="alert alert-danger">{error}</div>

  const entries = log.food_entries || []
  const consumed = {
    calories:  sum(entries, 'calories'),
    protein_g: sum(entries, 'protein_g'),
    carbs_g:   sum(entries, 'carbs_g'),
    fat_g:     sum(entries, 'fat_g'),
  }

  const mammalWarning = entries.some(e => e.has_mammal)
  const tssInfo = TSS_LABEL(log.tss)

  // Group entries by category for the log panel
  const normCat = (cat) => (cat === 'snack_1' || cat === 'snack_2' || cat === 'snack_3') ? 'snack' : cat
  const byCategory = {}
  for (const e of entries) {
    const cat = normCat(e.meal_category || 'breakfast')
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(e)
  }
  const populatedCats = ['breakfast','lunch','dinner','snack']
    .filter(c => byCategory[c]?.length > 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-24">
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>Dashboard</h1>
          <div className="flex items-center gap-8" style={{ marginTop: 2 }}>
            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => shiftDay(-1)}>‹</button>
            <span className="text-secondary" style={{ fontSize: 13 }}>
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 8px' }}
              onClick={() => shiftDay(1)}
              disabled={date >= todayISO()}
            >›</button>
          </div>
        </div>
        <div className="flex gap-8 items-center">
          <span className="text-muted" style={{ fontSize: 12 }}>TSS {log.tss}</span>
          <span className={`badge ${tssInfo.cls}`}>{tssInfo.text}</span>
        </div>
      </div>

      {mammalWarning && (
        <div className="alert alert-danger mb-16">
          &#9888; Mammal meat detected in today's log — conflicts with your dietary restriction.
        </div>
      )}

      {log.special_instructions && (
        <div className="alert alert-info mb-16">
          &#8505; {log.special_instructions}
        </div>
      )}

      <div className="grid-2 gap-24">
        {/* Macro targets */}
        <div className="card">
          <div className="card-title">
            Daily Targets
            <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 11 }}>
              TDEE {Math.round(log.tdee)} kcal
            </span>
          </div>

          <div className="macro-rings" style={{ marginBottom: 20 }}>
            <MacroRing label="Calories" current={consumed.calories}  target={log.target_calories}  color="var(--cal-color)"     unit="kcal" />
            <MacroRing label="Protein"  current={consumed.protein_g} target={log.target_protein_g} color="var(--protein-color)" />
            <MacroRing label="Carbs"    current={consumed.carbs_g}   target={log.target_carbs_g}   color="var(--carbs-color)" />
            <MacroRing label="Fat"      current={consumed.fat_g}     target={log.target_fat_g}     color="var(--fat-color)" />
          </div>

          <div className="macro-bar-wrap">
            <MacroBar label="Cal"     current={consumed.calories}  target={log.target_calories}  color="var(--cal-color)"     unit="kcal" />
            <MacroBar label="Protein" current={consumed.protein_g} target={log.target_protein_g} color="var(--protein-color)" />
            <MacroBar label="Carbs"   current={consumed.carbs_g}   target={log.target_carbs_g}   color="var(--carbs-color)" />
            <MacroBar label="Fat"     current={consumed.fat_g}     target={log.target_fat_g}     color="var(--fat-color)" />
          </div>
        </div>

        {/* Today's log summary */}
        <div className="card">
          <div className="flex items-center justify-between mb-16">
            <div className="card-title" style={{ marginBottom: 0 }}>Today's Log</div>
            <div className="text-sm text-muted">
              {Math.round(consumed.calories)} / {Math.round(log.target_calories)} kcal
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">&#127869;</div>
              <div>No food logged yet</div>
              <div className="text-sm text-muted">Go to Food Log to add entries</div>
            </div>
          ) : (
            populatedCats.map(cat => (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
                }}>
                  {CATEGORY_LABELS[cat]}
                </div>
                {byCategory[cat].map(e => (
                  <div key={e.id} className="food-entry" style={{ padding: '5px 0' }}>
                    <div className="food-entry-info">
                      <div className="food-entry-name" style={{ fontSize: 13 }}>
                        {e.description}
                        {e.has_mammal && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Mammal</span>}
                      </div>
                      <div className="food-entry-macros">
                        <span className="macro-protein">{Math.round(e.protein_g)}g P</span>
                        {' · '}
                        <span className="macro-carbs">{Math.round(e.carbs_g)}g C</span>
                        {' · '}
                        <span className="macro-fat">{Math.round(e.fat_g)}g F</span>
                      </div>
                    </div>
                    <div className="food-entry-cal">{Math.round(e.calories)} kcal</div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
