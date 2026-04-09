import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'
import { useUser } from '../contexts/UserContext'
import MacroRing from '../components/MacroRing'
import MacroBar from '../components/MacroBar'

function todayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function dateShift(isoStr, n) {
  const [y, m, d] = isoStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-')
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa']

const CATEGORIES = [
  { key: 'breakfast', label: 'Breakfast', placeholder: 'e.g. "a bowl of oatmeal with blueberries and a coffee"' },
  { key: 'lunch',     label: 'Lunch',     placeholder: 'e.g. "tuna rice bowl with edamame and soy sauce"' },
  { key: 'dinner',    label: 'Dinner',    placeholder: 'e.g. "grilled salmon with roasted vegetables"' },
  { key: 'snack',     label: 'Snack',     placeholder: 'e.g. "banana with almond butter and two rice cakes"' },
]

const normCat = (cat) => ['snack_1', 'snack_2', 'snack_3'].includes(cat) ? 'snack' : cat

const emptySection = () => ({ input: '', parsing: false, preview: null, previewServings: {}, error: null })

const TSS_LABEL = (tss) =>
  tss === 0  ? { text: 'Rest',      cls: 'badge-info' }    :
  tss < 50   ? { text: 'Easy',      cls: 'badge-success' } :
  tss < 100  ? { text: 'Moderate',  cls: 'badge-warning' } :
  tss < 150  ? { text: 'Hard',      cls: 'badge-danger' }  :
  tss < 200  ? { text: 'Very Hard', cls: 'badge-danger' }  :
               { text: 'Extreme',   cls: 'badge-danger' }

export default function CalendarView() {
  const { userId } = useUser()
  const today = todayEST()
  const [ty, tm] = today.split('-').map(Number)

  // Calendar navigation
  const [viewYear,  setViewYear]  = useState(ty)
  const [viewMonth, setViewMonth] = useState(tm)

  // Selected date
  const [selectedDate, setSelectedDate] = useState(today)

  // Log data
  const [log,        setLog]        = useState(null)
  const [loadingLog, setLoadingLog] = useState(false)
  const [logError,   setLogError]   = useState(null)

  // Training state
  const [tssInput,        setTssInput]        = useState('0')
  const [tssSource,       setTssSource]       = useState(null)
  const [tssReasoning,    setTssReasoning]    = useState('')
  const [estimatingTSS,   setEstimatingTSS]   = useState(false)
  const [tssEstimateError,setTssEstimateError]= useState(null)
  const [savingTSS,       setSavingTSS]       = useState(false)
  const [tssSaved,        setTssSaved]        = useState(false)
  const [trainingNotes,   setTrainingNotes]   = useState('')
  const [savingNotes,     setSavingNotes]     = useState(false)
  const [notesSaved,      setNotesSaved]      = useState(false)
  const [file,            setFile]            = useState(null)
  const [uploading,       setUploading]       = useState(false)
  const [uploadResult,    setUploadResult]    = useState(null)
  const [uploadError,     setUploadError]     = useState(null)

  // Food state
  const [sections,        setSections]        = useState({})
  const [meals,           setMeals]           = useState([])
  const [showLibrary,     setShowLibrary]     = useState(false)
  const [libTargetCat,    setLibTargetCat]    = useState('breakfast')
  const [libServings,     setLibServings]     = useState({})
  const [editingServings, setEditingServings] = useState({})
  const [saveLibModal,    setSaveLibModal]    = useState(null)
  const [saveLibName,     setSaveLibName]     = useState('')
  const [saveLibMealType, setSaveLibMealType] = useState('breakfast')
  const [saveLibSaving,   setSaveLibSaving]   = useState(false)
  const [saveLibError,    setSaveLibError]    = useState(null)

  // Day notes
  const [instructions,       setInstructions]       = useState('')
  const [savingInstructions, setSavingInstructions] = useState(false)

  // Plan the rest of the day
  const [planInput,   setPlanInput]   = useState('')
  const [planLoading, setPlanLoading] = useState(false)
  const [planResult,  setPlanResult]  = useState(null)
  const [planError,   setPlanError]   = useState(null)

  // ── Meals (once per user) ──
  useEffect(() => {
    api.meals.list(userId).then(setMeals).catch(() => {})
  }, [userId])

  // ── Full log load when date changes ──
  const loadLog = useCallback(async () => {
    setLoadingLog(true)
    setLogError(null)
    try {
      const l = await api.foodLog.get(selectedDate, userId)
      setLog(l)
      setTssInput(String(l.tss ?? 0))
      setTrainingNotes(l.training_notes || '')
      setInstructions(l.special_instructions || '')
      setTssSource(null)
      setTssReasoning('')
      setTssEstimateError(null)
      setSections({})
      setEditingServings({})
      setUploadResult(null)
      setUploadError(null)
      setPlanResult(null)
      setPlanError(null)
    } catch (e) {
      setLogError(e.message)
    } finally {
      setLoadingLog(false)
    }
  }, [selectedDate, userId])

  useEffect(() => { loadLog() }, [loadLog])

  // ── Light reload after food/TSS changes ──
  const reloadLog = useCallback(async () => {
    try {
      const l = await api.foodLog.get(selectedDate, userId)
      setLog(l)
    } catch (e) {}
  }, [selectedDate, userId])

  // ── Calendar ──
  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  const handleSelectDate = (dateStr) => {
    if (dateStr > today) return
    setSelectedDate(dateStr)
    const [y, m] = dateStr.split('-').map(Number)
    setViewYear(y)
    setViewMonth(m)
  }

  // ── Training ──
  const handleEstimateTSS = async () => {
    if (!trainingNotes.trim()) return
    setEstimatingTSS(true)
    setTssEstimateError(null)
    setTssReasoning('')
    try {
      const result = await api.training.estimateTSS(trainingNotes)
      setTssInput(String(result.tss))
      setTssReasoning(result.reasoning || '')
      setTssSource('estimate')
    } catch (e) {
      setTssEstimateError(e.message)
    } finally {
      setEstimatingTSS(false)
    }
  }

  const handleSaveTSS = async () => {
    const tss = parseInt(tssInput, 10)
    if (isNaN(tss) || tss < 0) return
    setSavingTSS(true)
    setTssSaved(false)
    try {
      await api.foodLog.updateTSS(selectedDate, tss, userId)
      setTssSaved(true)
      setTssSource('saved')
      setTimeout(() => setTssSaved(false), 2500)
      await reloadLog()
    } finally {
      setSavingTSS(false)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    setUploadError(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('log_date', selectedDate)
    formData.append('user_id', String(userId))
    try {
      const result = await api.training.upload(formData)
      setUploadResult(result)
      if (result.tss !== null) {
        setTssInput(String(Math.round(result.tss)))
        setTssSource('file')
        setTssReasoning('')
      }
    } catch (e) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    setNotesSaved(false)
    try {
      await api.foodLog.updateTrainingNotes(selectedDate, trainingNotes, userId)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2500)
    } catch (e) {} finally {
      setSavingNotes(false)
    }
  }

  const handleSaveInstructions = async () => {
    setSavingInstructions(true)
    try {
      await api.foodLog.updateInstructions(selectedDate, instructions, userId)
    } finally {
      setSavingInstructions(false)
    }
  }

  // ── Food ──
  const getSection    = (cat) => sections[cat] || emptySection()
  const updateSection = (cat, updates) =>
    setSections(s => ({ ...s, [cat]: { ...getSection(cat), ...updates } }))
  const clearSection  = (cat) =>
    setSections(s => ({ ...s, [cat]: emptySection() }))

  const handleParse = async (cat) => {
    const { input } = getSection(cat)
    if (!input.trim()) return
    updateSection(cat, { parsing: true, error: null, preview: null })
    try {
      const result = await api.foodLog.parse(input, userId)
      updateSection(cat, { parsing: false, preview: result })
    } catch (e) {
      updateSection(cat, { parsing: false, error: e.message })
    }
  }

  const handleConfirm = async (cat) => {
    const { preview, previewServings = {}, input } = getSection(cat)
    if (!preview || !log) return
    for (let i = 0; i < preview.items.length; i++) {
      const item = preview.items[i]
      const srv = parseFloat(previewServings[i]) || 1
      await api.foodLog.addEntry({
        daily_log_id:  log.id,
        meal_category: cat,
        description:   `${item.name} (${item.amount})`,
        calories:      item.calories * srv,
        protein_g:     item.protein_g * srv,
        carbs_g:       item.carbs_g * srv,
        fat_g:         item.fat_g * srv,
        servings:      srv,
        has_mammal:    item.has_mammal,
        source:        'nlp',
        raw_input:     input,
      })
    }
    clearSection(cat)
    await reloadLog()
  }

  const handleDeleteEntry = async (id) => {
    await api.foodLog.deleteEntry(id)
    await reloadLog()
  }

  const handleServingsChange = (id, val) =>
    setEditingServings(s => ({ ...s, [id]: val }))

  const handleServingsSave = async (entry) => {
    const val = parseFloat(editingServings[entry.id])
    if (!val || val <= 0) return
    await api.foodLog.updateServings(entry.id, val)
    setEditingServings(s => { const n = { ...s }; delete n[entry.id]; return n })
    await reloadLog()
  }

  const handleAddMeal = async (meal) => {
    const servings = parseFloat(libServings[meal.id]) || 1
    if (servings === 1) {
      await api.foodLog.addMealToLog(meal.id, selectedDate, libTargetCat, userId)
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
    await reloadLog()
  }

  const openSaveLib = (cat, catEntries) => {
    setSaveLibName('')
    setSaveLibMealType(cat)
    setSaveLibError(null)
    setSaveLibModal({ cat, entries: catEntries })
  }

  const handleSaveToLibrary = async () => {
    if (!saveLibName.trim()) { setSaveLibError('Please enter a name.'); return }
    setSaveLibSaving(true)
    setSaveLibError(null)
    try {
      const { entries } = saveLibModal
      await api.meals.create({
        user_id:     userId,
        name:        saveLibName.trim(),
        meal_type:   saveLibMealType,
        slot_number: 999,
        calories:    entries.reduce((a, e) => a + e.calories,  0),
        protein_g:   entries.reduce((a, e) => a + e.protein_g, 0),
        carbs_g:     entries.reduce((a, e) => a + e.carbs_g,   0),
        fat_g:       entries.reduce((a, e) => a + e.fat_g,     0),
        ingredients: entries.map(e => e.description),
        notes:       '',
      })
      setSaveLibModal(null)
    } catch (e) {
      setSaveLibError(e.message)
    } finally {
      setSaveLibSaving(false)
    }
  }

  const handlePlanRest = async () => {
    if (!planInput.trim()) return
    setPlanLoading(true)
    setPlanError(null)
    setPlanResult(null)
    try {
      const result = await api.foodLog.restaurantEstimate({
        description: planInput,
        user_id:     userId,
        log_date:    selectedDate,
      })
      setPlanResult(result)
    } catch (e) {
      setPlanError(e.message)
    } finally {
      setPlanLoading(false)
    }
  }

  // ── Derived state ──
  const entries = log?.food_entries || []
  const byCategory = {}
  for (const e of entries) {
    const c = normCat(e.meal_category || 'breakfast')
    if (!byCategory[c]) byCategory[c] = []
    byCategory[c].push(e)
  }
  const totalConsumed = {
    calories:  entries.reduce((a, e) => a + e.calories,  0),
    protein_g: entries.reduce((a, e) => a + e.protein_g, 0),
    carbs_g:   entries.reduce((a, e) => a + e.carbs_g,   0),
    fat_g:     entries.reduce((a, e) => a + e.fat_g,     0),
  }
  const tssNum  = parseInt(tssInput, 10) || 0
  const tssInfo = TSS_LABEL(tssNum)

  // ── Calendar grid ──
  const firstDayOfMonth = new Date(viewYear, viewMonth - 1, 1).getDay()
  const daysInMonth     = new Date(viewYear, viewMonth, 0).getDate()
  const calCells = []
  for (let i = 0; i < firstDayOfMonth; i++) calCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    calCells.push(
      `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    )
  }
  while (calCells.length % 7 !== 0) calCells.push(null)

  const formatSelectedDate = () => {
    const [y, m, d] = selectedDate.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    })
  }

  // ── Render ──
  return (
    <div>
      {/* ── Row 1: Calendar (left) + Macro rings (right) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, marginBottom: 24, alignItems: 'start' }}>

        {/* Calendar */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={prevMonth} style={{ padding: '2px 8px', fontSize: 16 }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              {MONTHS[viewMonth - 1]} {viewYear}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth} style={{ padding: '2px 8px', fontSize: 16 }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 3 }}>
            {DAYS_SHORT.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '2px 0' }}>
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {calCells.map((dateStr, idx) => {
              if (!dateStr) return <div key={`e-${idx}`} />
              const isSelected = dateStr === selectedDate
              const isToday    = dateStr === today
              const isFuture   = dateStr > today
              return (
                <button
                  key={dateStr}
                  onClick={() => !isFuture && handleSelectDate(dateStr)}
                  disabled={isFuture}
                  style={{
                    padding: '5px 2px',
                    textAlign: 'center',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: isSelected || isToday ? 700 : 400,
                    background: isSelected
                      ? 'var(--accent)'
                      : isToday
                      ? 'var(--bg-input)'
                      : 'transparent',
                    color: isSelected
                      ? '#fff'
                      : isToday
                      ? 'var(--accent)'
                      : isFuture
                      ? 'var(--text-muted)'
                      : 'var(--text-primary)',
                    border: isToday && !isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                    cursor: isFuture ? 'default' : 'pointer',
                    opacity: isFuture ? 0.35 : 1,
                  }}
                >
                  {parseInt(dateStr.split('-')[2])}
                </button>
              )
            })}
          </div>

          {selectedDate !== today && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', marginTop: 10, fontSize: 11 }}
              onClick={() => handleSelectDate(todayEST())}
            >
              Jump to Today
            </button>
          )}
        </div>

        {/* Macro rings / Daily targets */}
        {loadingLog ? (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <div className="loading" style={{ margin: 0 }}>Loading…</div>
          </div>
        ) : logError ? (
          <div className="alert alert-danger">{logError}</div>
        ) : log ? (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{formatSelectedDate()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  TDEE {Math.round(log.tdee)} kcal · TSS {log.tss}
                  {selectedDate === today && (
                    <span className="badge badge-success" style={{ marginLeft: 8 }}>Today</span>
                  )}
                </div>
              </div>
              <span className={`badge ${tssInfo.cls}`}>{tssInfo.text}</span>
            </div>
            <div className="macro-rings" style={{ marginBottom: 14 }}>
              <MacroRing label="Calories" current={totalConsumed.calories}  target={log.target_calories}  color="var(--cal-color)"     unit="kcal" />
              <MacroRing label="Protein"  current={totalConsumed.protein_g} target={log.target_protein_g} color="var(--protein-color)" />
              <MacroRing label="Carbs"    current={totalConsumed.carbs_g}   target={log.target_carbs_g}   color="var(--carbs-color)" />
              <MacroRing label="Fat"      current={totalConsumed.fat_g}     target={log.target_fat_g}     color="var(--fat-color)" />
            </div>
            <div className="macro-bar-wrap">
              <MacroBar label="Cal"     current={totalConsumed.calories}  target={log.target_calories}  color="var(--cal-color)"     unit="kcal" />
              <MacroBar label="Protein" current={totalConsumed.protein_g} target={log.target_protein_g} color="var(--protein-color)" />
              <MacroBar label="Carbs"   current={totalConsumed.carbs_g}   target={log.target_carbs_g}   color="var(--carbs-color)" />
              <MacroBar label="Fat"     current={totalConsumed.fat_g}     target={log.target_fat_g}     color="var(--fat-color)" />
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Row 2: Training (left) + Food (right) ── */}
      {!loadingLog && !logError && log && (
        <div className="grid-2 gap-24" style={{ alignItems: 'start' }}>

          {/* ═══ Training panel ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Training notes + TSS estimation */}
            <div className="card">
              <div className="card-title">Training Log</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 100 }}
                  value={trainingNotes}
                  onChange={e => setTrainingNotes(e.target.value)}
                  placeholder={"Describe your training session.\n\nExamples:\n• \"90min easy zone-2 ride, avg HR 135, felt good\"\n• \"4hr long ride followed by 30min brick run\"\n• \"Rest day — light stretch only\""}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleEstimateTSS}
                    disabled={estimatingTSS || !trainingNotes.trim()}
                  >
                    {estimatingTSS ? 'Estimating…' : 'Estimate TSS from Notes'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleSaveNotes}
                    disabled={savingNotes || !trainingNotes.trim()}
                  >
                    {savingNotes ? 'Saving…' : 'Save Notes'}
                  </button>
                  {notesSaved && <span className="text-sm text-success">Saved</span>}
                </div>
                {tssEstimateError && (
                  <div className="alert alert-danger" style={{ fontSize: 12 }}>{tssEstimateError}</div>
                )}
              </div>
            </div>

            {/* TSS input */}
            <div className="card">
              <div className="card-title">Training Stress Score</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="flex gap-8 items-center">
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    style={{ width: 90, textAlign: 'center', fontSize: 20, fontWeight: 700 }}
                    value={tssInput}
                    onChange={e => { setTssInput(e.target.value); setTssSource('manual') }}
                    onKeyDown={e => e.key === 'Enter' && handleSaveTSS()}
                  />
                  <span className={`badge ${tssInfo.cls}`}>{tssInfo.text}</span>
                </div>
                {tssReasoning && (
                  <div className="text-sm text-muted" style={{ lineHeight: 1.5 }}>
                    {tssReasoning}
                  </div>
                )}
                {tssSource === 'file' && !tssReasoning && (
                  <div className="text-sm text-muted">↑ Auto-filled from uploaded file — edit if needed</div>
                )}
                <div className="flex gap-8 items-center">
                  <button className="btn btn-primary btn-sm" onClick={handleSaveTSS} disabled={savingTSS}>
                    {savingTSS ? 'Saving…' : 'Save TSS'}
                  </button>
                  {tssSaved && <span className="text-sm text-success">Saved — macro targets updated</span>}
                </div>
              </div>
            </div>

            {/* File upload */}
            <div className="card">
              <div className="card-title">
                Import File{' '}
                <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="file"
                  accept=".fit,.json"
                  className="form-input"
                  style={{ padding: '7px 12px' }}
                  onChange={e => {
                    setFile(e.target.files[0] || null)
                    setUploadResult(null)
                    setUploadError(null)
                  }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                >
                  {uploading ? 'Parsing…' : 'Parse File'}
                </button>
                {uploadError && (
                  <div className="alert alert-danger" style={{ fontSize: 12 }}>{uploadError}</div>
                )}
                {uploadResult && (
                  <div
                    className={`alert ${uploadResult.tss !== null ? 'alert-info' : 'alert-warning'}`}
                    style={{ fontSize: 12 }}
                  >
                    {uploadResult.message}
                    {uploadResult.tss !== null && ` · TSS: ${Math.round(uploadResult.tss)}`}
                  </div>
                )}
              </div>
            </div>

            {/* Day notes */}
            <div className="card">
              <div className="card-title">Day Notes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 56 }}
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder={`e.g. "race tomorrow — carb load", "traveling, limited options"`}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ alignSelf: 'flex-end' }}
                  onClick={handleSaveInstructions}
                  disabled={savingInstructions}
                >
                  {savingInstructions ? 'Saving…' : 'Save Note'}
                </button>
              </div>
            </div>
          </div>

          {/* ═══ Food panel ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Quick totals bar */}
            <div className="card" style={{ padding: '10px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {Math.round(totalConsumed.calories)} / {Math.round(log.target_calories)} kcal
                </span>
                <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                  <span>
                    <span className="macro-protein">{Math.round(totalConsumed.protein_g)}g</span>
                    {' '}<span className="text-muted">P</span>
                  </span>
                  <span>
                    <span className="macro-carbs">{Math.round(totalConsumed.carbs_g)}g</span>
                    {' '}<span className="text-muted">C</span>
                  </span>
                  <span>
                    <span className="macro-fat">{Math.round(totalConsumed.fat_g)}g</span>
                    {' '}<span className="text-muted">F</span>
                  </span>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11 }}
                  onClick={() => setShowLibrary(true)}
                >
                  + Library
                </button>
              </div>
            </div>

            {/* Meal category sections */}
            {CATEGORIES.map(cat => {
              const catEntries = byCategory[cat.key] || []
              const sec = getSection(cat.key)
              const catCals  = catEntries.reduce((a, e) => a + e.calories,  0)
              const catProt  = catEntries.reduce((a, e) => a + e.protein_g, 0)
              const catCarbs = catEntries.reduce((a, e) => a + e.carbs_g,   0)
              const catFat   = catEntries.reduce((a, e) => a + e.fat_g,     0)

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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          <span className="macro-protein">{Math.round(catProt)}g</span>
                          {' · '}
                          <span className="macro-carbs">{Math.round(catCarbs)}g</span>
                          {' · '}
                          <span className="macro-fat">{Math.round(catFat)}g</span>
                          {' · '}
                          <span className="macro-cal">{Math.round(catCals)} kcal</span>
                        </span>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 10, padding: '2px 7px', opacity: 0.7 }}
                          onClick={() => openSaveLib(cat.key, catEntries)}
                        >
                          Save to lib
                        </button>
                      </div>
                    )}
                  </div>

                  {catEntries.length > 0 && (
                    <div style={{ padding: '4px 16px' }}>
                      {catEntries.map(e => {
                        const isEditing = editingServings[e.id] !== undefined
                        return (
                          <div key={e.id} className="food-entry">
                            <div className="food-entry-info">
                              <div className="food-entry-name">{e.description}</div>
                              <div className="food-entry-macros" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span className="macro-protein">{Math.round(e.protein_g)}g P</span>
                                {' · '}
                                <span className="macro-carbs">{Math.round(e.carbs_g)}g C</span>
                                {' · '}
                                <span className="macro-fat">{Math.round(e.fat_g)}g F</span>
                                {!isEditing && (
                                  <span
                                    style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.5, fontSize: 11 }}
                                    onClick={() => handleServingsChange(e.id, String(e.servings || 1))}
                                  >
                                    {e.servings && e.servings !== 1 ? `${e.servings}×` : ''} ✎
                                  </span>
                                )}
                                {isEditing && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <input
                                      type="number" min="0.5" step="0.5" autoFocus
                                      value={editingServings[e.id]}
                                      onChange={ev => handleServingsChange(e.id, ev.target.value)}
                                      onKeyDown={ev => {
                                        if (ev.key === 'Enter') handleServingsSave(e)
                                        if (ev.key === 'Escape') setEditingServings(s => { const n={...s}; delete n[e.id]; return n })
                                      }}
                                      style={{ width: 48, fontSize: 12, padding: '2px 4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}
                                    />
                                    <span className="text-muted" style={{ fontSize: 11 }}>srv</span>
                                    <button className="btn btn-primary btn-sm" style={{ padding: '2px 7px', fontSize: 11 }} onClick={() => handleServingsSave(e)}>✓</button>
                                    <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px', fontSize: 11 }} onClick={() => setEditingServings(s => { const n={...s}; delete n[e.id]; return n })}>✕</button>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="food-entry-cal">{Math.round(e.calories)} kcal</span>
                              {!isEditing && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleDeleteEntry(e.id)}
                                  style={{ padding: '2px 7px', fontSize: 11, opacity: 0.6 }}
                                >✕</button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {sec.preview && (
                    <div style={{ padding: '12px 16px', background: 'rgba(0,200,255,0.04)', borderTop: catEntries.length > 0 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Review before saving
                      </div>
                      {sec.preview.items.map((item, i) => {
                        const srv = parseFloat((sec.previewServings || {})[i]) || 1
                        return (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '5px 0',
                            borderBottom: i < sec.preview.items.length - 1 ? '1px solid var(--border)' : 'none',
                            gap: 8,
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                              <span className="text-muted" style={{ fontSize: 12, marginLeft: 6 }}>({item.amount})</span>
                              <div className="food-entry-macros" style={{ marginTop: 1 }}>
                                <span className="macro-protein">{Math.round(item.protein_g * srv)}g P</span>
                                {' · '}
                                <span className="macro-carbs">{Math.round(item.carbs_g * srv)}g C</span>
                                {' · '}
                                <span className="macro-fat">{Math.round(item.fat_g * srv)}g F</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              <input
                                type="number" min="0.5" step="0.5"
                                value={(sec.previewServings || {})[i] ?? 1}
                                onChange={ev => updateSection(cat.key, {
                                  previewServings: { ...(sec.previewServings || {}), [i]: ev.target.value }
                                })}
                                style={{ width: 44, fontSize: 12, padding: '2px 4px', textAlign: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}
                              />
                              <span className="text-muted" style={{ fontSize: 11 }}>srv</span>
                              <span className="food-entry-cal" style={{ minWidth: 58, textAlign: 'right' }}>
                                {Math.round(item.calories * srv)} kcal
                              </span>
                            </div>
                          </div>
                        )
                      })}
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

            {/* Plan the rest of the day */}
            <div className="card">
              <div className="card-title">Plan the Rest of the Day</div>
              <div className="text-sm text-muted" style={{ marginBottom: 10 }}>
                Tell us what you're planning to eat — we'll tell you how much of each to have based on your remaining macros.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 80 }}
                  value={planInput}
                  onChange={e => setPlanInput(e.target.value)}
                  placeholder={`e.g. "chicken breast, white rice, and steamed broccoli for dinner, then a protein shake"\ne.g. "thinking about pasta or a grain bowl — not sure yet"`}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handlePlanRest}
                  disabled={planLoading || !planInput.trim()}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {planLoading ? 'Calculating…' : 'Get Macro Guidance'}
                </button>
                {planError && (
                  <div className="alert alert-danger" style={{ fontSize: 12 }}>{planError}</div>
                )}
                {planResult && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {planResult.recommendation && (
                      <div className="alert alert-info" style={{ fontSize: 13, lineHeight: 1.6 }}>
                        {planResult.recommendation}
                      </div>
                    )}
                    {planResult.portion_guidance && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                        {planResult.portion_guidance}
                      </div>
                    )}
                    {planResult.estimated_macros && (
                      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                        <span><span className="macro-cal">{Math.round(planResult.estimated_macros.calories)} kcal</span></span>
                        <span><span className="macro-protein">{Math.round(planResult.estimated_macros.protein_g)}g</span> P</span>
                        <span><span className="macro-carbs">{Math.round(planResult.estimated_macros.carbs_g)}g</span> C</span>
                        <span><span className="macro-fat">{Math.round(planResult.estimated_macros.fat_g)}g</span> F</span>
                      </div>
                    )}
                    {planResult.flags && planResult.flags.length > 0 && (
                      <div className="alert alert-warning" style={{ fontSize: 12 }}>
                        {planResult.flags.join(' · ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Meal library modal ── */}
      {showLibrary && (
        <div className="modal-overlay" onClick={() => setShowLibrary(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add from Meal Library</div>
            <div className="form-group mb-16">
              <label className="form-label">Add to meal section</label>
              <select className="form-select" value={libTargetCat} onChange={e => setLibTargetCat(e.target.value)}>
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
                    <div key={m.id} style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                          <div className="text-sm text-muted">
                            {Math.round(m.calories * servings)} kcal · {Math.round(m.protein_g * servings)}g P · {Math.round(m.carbs_g * servings)}g C · {Math.round(m.fat_g * servings)}g F
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <input
                            type="number" min="0.5" step="0.5"
                            value={libServings[m.id] ?? 1}
                            onChange={e => setLibServings(s => ({ ...s, [m.id]: e.target.value }))}
                            style={{ width: 52, textAlign: 'center', fontSize: 13, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '4px 6px' }}
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

      {/* ── Save to library modal ── */}
      {saveLibModal && (
        <div className="modal-overlay" onClick={() => setSaveLibModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Save to Meal Library</div>
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
              {saveLibModal.entries.length} item{saveLibModal.entries.length !== 1 ? 's' : ''} will be saved together as one meal.
            </div>
            <div style={{ marginBottom: 16 }}>
              {saveLibModal.entries.map(e => (
                <div key={e.id} style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {e.description}</div>
              ))}
            </div>
            <div className="form-group mb-16">
              <label className="form-label">Meal name</label>
              <input
                className="form-input" type="text" autoFocus
                value={saveLibName}
                onChange={e => { setSaveLibName(e.target.value); setSaveLibError(null) }}
                placeholder="e.g. Pre-race Breakfast"
              />
            </div>
            <div className="form-group mb-16">
              <label className="form-label">Meal type</label>
              <select className="form-select" value={saveLibMealType} onChange={e => setSaveLibMealType(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            {saveLibError && (
              <div className="alert alert-danger mb-16" style={{ fontSize: 13 }}>{saveLibError}</div>
            )}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSaveToLibrary} disabled={saveLibSaving}>
                {saveLibSaving ? 'Saving…' : 'Save to Library'}
              </button>
              <button className="btn btn-ghost" onClick={() => setSaveLibModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() }
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
