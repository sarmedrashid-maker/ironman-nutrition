import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const CATEGORIES = [
  { key: 'breakfast', label: 'Breakfast',  placeholder: 'e.g. "a bowl of oatmeal with blueberries and a coffee with oat milk"' },
  { key: 'lunch',     label: 'Lunch',      placeholder: 'e.g. "tuna rice bowl with edamame and soy sauce"' },
  { key: 'dinner',    label: 'Dinner',     placeholder: 'e.g. "grilled salmon with roasted vegetables and brown rice"' },
  { key: 'snack_1',   label: 'Snack 1',   placeholder: 'e.g. "banana with almond butter and two rice cakes"' },
  { key: 'snack_2',   label: 'Snack 2',   placeholder: 'e.g. "protein shake with almond milk and spinach"' },
  { key: 'snack_3',   label: 'Snack 3',   placeholder: 'e.g. "apple and a handful of walnuts"' },
]

const MEAL_TYPE_TO_CAT = {
  breakfast: 'breakfast',
  lunch:     'lunch',
  dinner:    'dinner',
  snack:     'snack_1',
}

// Per-section state shape
const emptySection = () => ({ input: '', parsing: false, preview: null, error: null })

export default function FoodLog() {
  const [log, setLog] = useState(null)
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState(todayISO())

  // Per-section NLP state: { breakfast: {input, parsing, preview, error}, ... }
  const [sections, setSections] = useState({})

  // Library modal
  const [showLibrary, setShowLibrary] = useState(false)
  const [libTargetCat, setLibTargetCat] = useState('breakfast')
  const [libServings, setLibServings] = useState({})

  // Day notes
  const [instructions, setInstructions] = useState('')
  const [savingInstructions, setSavingInstructions] = useState(false)

  // ── Helpers ──
  const getSection = (cat) => sections[cat] || emptySection()

  const updateSection = (cat, updates) =>
    setSections(s => ({ ...s, [cat]: { ...getSection(cat), ...updates } }))

  const clearSection = (cat) =>
    setSections(s => ({ ...s, [cat]: emptySection() }))

  // ── Data loading ──
  const loadLog = useCallback(() =>
    api.foodLog.get(selectedDate).then(l => {
      setLog(l)
      setInstructions(l.special_instructions || '')
    })
  , [selectedDate])

  useEffect(() => {
    setLoading(true)
    setSections({})
    Promise.all([loadLog(), api.meals.list()])
      .then(([, m]) => setMeals(m))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [loadLog])

  // ── Per-section NLP ──
  const handleParse = async (cat) => {
    const { input } = getSection(cat)
    if (!input.trim()) return
    updateSection(cat, { parsing: true, error: null, preview: null })
    try {
      const result = await api.foodLog.parse(input)
      updateSection(cat, { parsing: false, preview: result })
    } catch (e) {
      updateSection(cat, { parsing: false, error: e.message })
    }
  }

  const handleConfirm = async (cat) => {
    const { preview, input } = getSection(cat)
    if (!preview || !log) return
    for (const item of preview.items) {
      await api.foodLog.addEntry({
        daily_log_id:  log.id,
        meal_category: cat,
        description:   `${item.name} (${item.amount})`,
        calories:      item.calories,
        protein_g:     item.protein_g,
        carbs_g:       item.carbs_g,
        fat_g:         item.fat_g,
        has_mammal:    item.has_mammal,
        source:        'nlp',
        raw_input:     input,
      })
    }
    clearSection(cat)
    await loadLog()
  }

  // ── Library ──
  const handleAddMeal = async (meal) => {
    const servings = parseFloat(libServings[meal.id]) || 1
    if (servings === 1) {
      await api.foodLog.addMealToLog(meal.id, selectedDate, libTargetCat)
    } else {
      await api.foodLog.addEntry({
        daily_log_id:  log.id,
        meal_category: libTargetCat,
        description:   `${meal.name} (${servings} serving${servings !== 1 ? 's' : ''})`,
        calories:      meal.calories * servings,
        protein_g:     meal.protein_g * servings,
        carbs_g:       meal.carbs_g * servings,
        fat_g:         meal.fat_g * servings,
        has_mammal:    false,
        source:        'meal_library',
        raw_input:     `${meal.name} x${servings}`,
      })
    }
    setShowLibrary(false)
    setLibServings({})
    await loadLog()
  }

  // ── Delete entry ──
  const handleDeleteEntry = async (id) => {
    await api.foodLog.deleteEntry(id)
    await loadLog()
  }

  // ── Instructions ──
  const handleSaveInstructions = async () => {
    setSavingInstructions(true)
    try { await api.foodLog.updateInstructions(selectedDate, instructions) }
    finally { setSavingInstructions(false) }
  }

  // ── Derived state ──
  if (loading) return <div className="loading">Loading…</div>
  if (error)   return <div className="alert alert-danger">{error}</div>

  const entries = log?.food_entries || []
  const byCategory = {}
  for (const e of entries) {
    const c = e.meal_category || 'breakfast'
    if (!byCategory[c]) byCategory[c] = []
    byCategory[c].push(e)
  }

  const totalConsumed = {
    calories:  entries.reduce((a, e) => a + e.calories, 0),
    protein_g: entries.reduce((a, e) => a + e.protein_g, 0),
    carbs_g:   entries.reduce((a, e) => a + e.carbs_g, 0),
    fat_g:     entries.reduce((a, e) => a + e.fat_g, 0),
  }
  const mammalWarning = entries.some(e => e.has_mammal)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-24">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Food Log</h1>
        <input
          type="date" className="form-input" style={{ width: 'auto' }}
          value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
        />
      </div>

      {mammalWarning && (
        <div className="alert alert-danger mb-16">
          &#9888; Mammal meat detected — conflicts with your dietary restriction.
        </div>
      )}

      <div className="grid-2 gap-24" style={{ alignItems: 'start' }}>

        {/* ── Left: sidebar tools ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Quick totals */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="flex items-center justify-between">
              <span className="card-title" style={{ marginBottom: 0 }}>Today</span>
              <span className="text-sm text-muted">
                {Math.round(totalConsumed.calories)} / {Math.round(log.target_calories)} kcal
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13 }}>
              <span><span className="macro-protein">{Math.round(totalConsumed.protein_g)}g</span> <span className="text-muted">P</span></span>
              <span><span className="macro-carbs">{Math.round(totalConsumed.carbs_g)}g</span> <span className="text-muted">C</span></span>
              <span><span className="macro-fat">{Math.round(totalConsumed.fat_g)}g</span> <span className="text-muted">F</span></span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 10, width: '100%' }}
              onClick={() => setShowLibrary(true)}
            >
              + Add from Meal Library
            </button>
          </div>

          {/* Day notes */}
          <div className="card">
            <div className="card-title">Day Notes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                className="form-textarea"
                placeholder="e.g. 'race tomorrow — carb load', 'traveling, limited options'"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                style={{ minHeight: 56 }}
              />
              <button className="btn btn-ghost btn-sm" onClick={handleSaveInstructions}
                disabled={savingInstructions} style={{ alignSelf: 'flex-end' }}>
                {savingInstructions ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: entries by category with inline NLP ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {CATEGORIES.map((cat, idx) => {
            const catEntries = byCategory[cat.key] || []
            const sec = getSection(cat.key)

            const catCals  = catEntries.reduce((a, e) => a + e.calories, 0)
            const catProt  = catEntries.reduce((a, e) => a + e.protein_g, 0)
            const catCarbs = catEntries.reduce((a, e) => a + e.carbs_g, 0)
            const catFat   = catEntries.reduce((a, e) => a + e.fat_g, 0)

            return (
              <div
                key={cat.key}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: 12,
                  overflow: 'hidden',
                }}
              >
                {/* Section header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 16px',
                  borderBottom: (catEntries.length > 0 || sec.preview) ? '1px solid var(--border)' : 'none',
                  background: 'var(--bg-surface)',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {cat.label}
                  </span>
                  {catEntries.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      <span className="macro-protein">{Math.round(catProt)}g</span>
                      {' · '}
                      <span className="macro-carbs">{Math.round(catCarbs)}g</span>
                      {' · '}
                      <span className="macro-fat">{Math.round(catFat)}g</span>
                      {' · '}
                      <span className="macro-cal">{Math.round(catCals)} kcal</span>
                    </span>
                  )}
                </div>

                {/* Logged entries */}
                {catEntries.length > 0 && (
                  <div style={{ padding: '4px 16px' }}>
                    {catEntries.map(e => (
                      <div key={e.id} className="food-entry">
                        <div className="food-entry-info">
                          <div className="food-entry-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {e.description}
                            {e.has_mammal && <span className="badge badge-danger">Mammal</span>}
                          </div>
                          <div className="food-entry-macros">
                            <span className="macro-protein">{Math.round(e.protein_g)}g P</span>
                            {' · '}
                            <span className="macro-carbs">{Math.round(e.carbs_g)}g C</span>
                            {' · '}
                            <span className="macro-fat">{Math.round(e.fat_g)}g F</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="food-entry-cal">{Math.round(e.calories)} kcal</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDeleteEntry(e.id)}
                            style={{ padding: '2px 7px', fontSize: 11, opacity: 0.6 }}
                          >✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* NLP preview */}
                {sec.preview && (
                  <div style={{ padding: '12px 16px', background: 'rgba(0,200,255,0.04)', borderTop: catEntries.length > 0 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      Review before saving
                    </div>

                    {sec.preview.has_mammal_flag && (
                      <div className="alert alert-danger mb-8" style={{ fontSize: 12 }}>
                        &#9888; Mammal meat detected in this entry.
                      </div>
                    )}

                    {sec.preview.items.map((item, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        padding: '5px 0', borderBottom: i < sec.preview.items.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                          <span className="text-muted" style={{ fontSize: 12, marginLeft: 6 }}>({item.amount})</span>
                          {item.has_mammal && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Mammal</span>}
                          <div className="food-entry-macros" style={{ marginTop: 1 }}>
                            <span className="macro-protein">{item.protein_g}g P</span>
                            {' · '}
                            <span className="macro-carbs">{item.carbs_g}g C</span>
                            {' · '}
                            <span className="macro-fat">{item.fat_g}g F</span>
                          </div>
                        </div>
                        <span className="food-entry-cal" style={{ flexShrink: 0 }}>{Math.round(item.calories)} kcal</span>
                      </div>
                    ))}

                    {/* Preview totals */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', fontSize: 13, fontWeight: 600 }}>
                      <span className="text-muted">Total</span>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <span className="macro-protein">{sec.preview.total_protein_g}g</span>
                        <span className="macro-carbs">{sec.preview.total_carbs_g}g</span>
                        <span className="macro-fat">{sec.preview.total_fat_g}g</span>
                        <span className="macro-cal">{Math.round(sec.preview.total_calories)} kcal</span>
                      </div>
                    </div>

                    <div className="flex gap-8" style={{ marginTop: 10 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleConfirm(cat.key)}>
                        Confirm & Save
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => updateSection(cat.key, { preview: null, input: '' })}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline NLP input */}
                {!sec.preview && (
                  <div style={{ padding: '10px 16px', borderTop: catEntries.length > 0 ? '1px solid var(--border)' : 'none' }}>
                    {sec.error && (
                      <div className="alert alert-danger mb-8" style={{ fontSize: 12 }}>{sec.error}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <AutosizeTextarea
                        value={sec.input}
                        onChange={v => updateSection(cat.key, { input: v, error: null })}
                        onSubmit={() => handleParse(cat.key)}
                        placeholder={cat.placeholder}
                        disabled={sec.parsing}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleParse(cat.key)}
                        disabled={sec.parsing || !sec.input.trim()}
                        style={{ flexShrink: 0, alignSelf: 'flex-end' }}
                      >
                        {sec.parsing ? '…' : 'Log'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Library modal */}
      {showLibrary && (
        <div className="modal-overlay" onClick={() => setShowLibrary(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add from Meal Library</div>

            <div className="form-group mb-16">
              <label className="form-label">Add to meal section</label>
              <select className="form-select" value={libTargetCat}
                onChange={e => setLibTargetCat(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>

            {meals.length === 0 ? (
              <div className="empty-state">No meals in library yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {meals.map(m => {
                  const servings = parseFloat(libServings[m.id]) || 1
                  return (
                    <div key={m.id} style={{
                      padding: '10px 14px', background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                          <div className="text-sm text-muted">
                            {Math.round(m.calories * servings)} kcal · {Math.round(m.protein_g * servings)}g P · {Math.round(m.carbs_g * servings)}g C · {Math.round(m.fat_g * servings)}g F
                            <span style={{ marginLeft: 8, opacity: 0.5 }}>{m.meal_type}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={libServings[m.id] ?? 1}
                            onChange={e => setLibServings(s => ({ ...s, [m.id]: e.target.value }))}
                            style={{
                              width: 52, textAlign: 'center', fontSize: 13,
                              background: 'var(--bg-card)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                              padding: '4px 6px',
                            }}
                          />
                          <span className="text-muted" style={{ fontSize: 12 }}>srv</span>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleAddMeal(m)}>Add</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowLibrary(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Textarea that auto-sizes to content (single line by default, expands on wrap).
 * Submits on Enter (without Shift).
 */
function AutosizeTextarea({ value, onChange, onSubmit, placeholder, disabled }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = Math.min(ref.current.scrollHeight, 120) + 'px'
    }
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onSubmit()
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      style={{
        flex: 1,
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-primary)',
        padding: '8px 10px',
        fontSize: 13,
        fontFamily: 'inherit',
        resize: 'none',
        overflow: 'hidden',
        lineHeight: 1.5,
        transition: 'border-color 0.15s',
        minHeight: 36,
      }}
      onFocus={e => { e.target.style.borderColor = 'var(--border-focus)' }}
      onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
    />
  )
}
