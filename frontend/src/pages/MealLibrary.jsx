import { useState, useEffect } from 'react'
import { api } from '../api'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const emptyForm = (mealType = 'breakfast') => ({
  name: '', meal_type: mealType,
  calories: '', protein_g: '', carbs_g: '', fat_g: '',
  ingredients: '', notes: '',
})

export default function MealLibrary() {
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('breakfast')

  const [modal, setModal] = useState(null)  // null | { mode: 'add'|'edit', meal? }
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const [addingToLog, setAddingToLog] = useState(null)

  useEffect(() => {
    api.meals.list().then(setMeals).finally(() => setLoading(false))
  }, [])

  const visibleMeals = meals.filter(m => m.meal_type === activeTab)

  // Auto-assign slot_number as max + 1 for the given type
  const nextSlot = (type) => {
    const existing = meals.filter(m => m.meal_type === type)
    return existing.length > 0 ? Math.max(...existing.map(m => m.slot_number)) + 1 : 1
  }

  const openAdd = () => {
    setForm(emptyForm(activeTab))
    setFormError(null)
    setModal({ mode: 'add' })
  }

  const openEdit = (meal) => {
    setForm({
      name: meal.name,
      meal_type: meal.meal_type,
      calories: String(meal.calories),
      protein_g: String(meal.protein_g),
      carbs_g: String(meal.carbs_g),
      fat_g: String(meal.fat_g),
      ingredients: (meal.ingredients || []).join('\n'),
      notes: meal.notes || '',
    })
    setFormError(null)
    setModal({ mode: 'edit', meal })
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Name is required.'); return }
    setSaving(true)
    setFormError(null)

    const payload = {
      name:        form.name.trim(),
      meal_type:   form.meal_type,
      slot_number: modal.mode === 'edit' ? modal.meal.slot_number : nextSlot(form.meal_type),
      calories:    parseFloat(form.calories) || 0,
      protein_g:   parseFloat(form.protein_g) || 0,
      carbs_g:     parseFloat(form.carbs_g) || 0,
      fat_g:       parseFloat(form.fat_g) || 0,
      ingredients: form.ingredients.split('\n').map(s => s.trim()).filter(Boolean),
      notes:       form.notes,
      user_id:     1,
    }

    try {
      if (modal.mode === 'edit') {
        await api.meals.update(modal.meal.id, payload)
      } else {
        await api.meals.create(payload)
      }
      const updated = await api.meals.list()
      setMeals(updated)
      setModal(null)
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this meal?')) return
    await api.meals.delete(id)
    setMeals(m => m.filter(x => x.id !== id))
  }

  const handleAddToLog = async (meal) => {
    setAddingToLog(meal.id)
    try {
      const MEAL_TYPE_TO_CAT = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack_1' }
      await api.foodLog.addMealToLog(meal.id, todayISO(), MEAL_TYPE_TO_CAT[meal.meal_type] || 'snack_1')
      alert(`"${meal.name}" added to today's log!`)
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setAddingToLog(null)
    }
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <h1 className="page-title">Meal Library</h1>

      <div className="tab-bar">
        {MEAL_TYPES.map(t => (
          <button
            key={t}
            className={'tab' + (activeTab === t ? ' active' : '')}
            onClick={() => setActiveTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}s
            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.55 }}>
              ({meals.filter(m => m.meal_type === t).length})
            </span>
          </button>
        ))}
      </div>

      {/* Meal grid — free-form, no fixed slots */}
      <div className="grid-3">
        {visibleMeals.map(meal => (
          <div key={meal.id} className="meal-card">
            <div className="meal-card-name">{meal.name}</div>

            <div className="meal-card-macros">
              <span className="macro-cal">{Math.round(meal.calories)} kcal</span>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span className="macro-protein">{Math.round(meal.protein_g)}g P</span>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span className="macro-carbs">{Math.round(meal.carbs_g)}g C</span>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span className="macro-fat">{Math.round(meal.fat_g)}g F</span>
            </div>

            {meal.ingredients?.length > 0 && (
              <div>
                {meal.ingredients.slice(0, 4).map((ing, i) => (
                  <div key={i} className="meal-card-ingredient">· {ing}</div>
                ))}
                {meal.ingredients.length > 4 && (
                  <div className="meal-card-ingredient text-muted">
                    +{meal.ingredients.length - 4} more
                  </div>
                )}
              </div>
            )}

            {meal.notes && (
              <div className="text-sm text-muted" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                {meal.notes}
              </div>
            )}

            <div className="meal-card-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleAddToLog(meal)}
                disabled={addingToLog === meal.id}
              >
                {addingToLog === meal.id ? '…' : '+ Today'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(meal)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(meal.id)}>Delete</button>
            </div>
          </div>
        ))}

        {/* Add card — always at the end */}
        <div className="meal-card meal-card-empty" onClick={openAdd}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>+</div>
          <div style={{ fontSize: 13 }}>Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</div>
        </div>
      </div>

      {visibleMeals.length === 0 && (
        <div className="empty-state" style={{ marginTop: -8 }}>
          <div className="text-sm text-muted">
            No {activeTab}s saved yet. Click the + card to add one.
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{modal.mode === 'edit' ? 'Edit Meal' : `Add ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Meal Name *</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Power Oatmeal"
                  autoFocus
                />
              </div>

              {modal.mode === 'add' && (
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="form-select"
                    value={form.meal_type}
                    onChange={e => setForm(f => ({ ...f, meal_type: e.target.value }))}
                  >
                    {MEAL_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Calories</label>
                  <input className="form-input" type="number" min={0}
                    value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Protein (g)</label>
                  <input className="form-input" type="number" min={0} step="0.1"
                    value={form.protein_g} onChange={e => setForm(f => ({ ...f, protein_g: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Carbs (g)</label>
                  <input className="form-input" type="number" min={0} step="0.1"
                    value={form.carbs_g} onChange={e => setForm(f => ({ ...f, carbs_g: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fat (g)</label>
                  <input className="form-input" type="number" min={0} step="0.1"
                    value={form.fat_g} onChange={e => setForm(f => ({ ...f, fat_g: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Ingredients (one per line)</label>
                <textarea
                  className="form-textarea"
                  value={form.ingredients}
                  onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))}
                  placeholder={'80g rolled oats\n120g banana\n30g protein powder'}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Prep tips, timing, etc." />
              </div>
            </div>

            {formError && <div className="alert alert-danger mt-8">{formError}</div>}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Meal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
