import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Training() {
  const [uploadDate, setUploadDate] = useState(todayISO())

  // TSS state — loaded from the day's log, overridable
  const [tssInput, setTssInput] = useState('0')
  const [tssSource, setTssSource] = useState(null)   // null | 'log' | 'file' | 'manual'
  const [savingTSS, setSavingTSS] = useState(false)
  const [tssSaved, setTssSaved] = useState(false)

  // File upload
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadError, setUploadError] = useState(null)

  // Training notes
  const [trainingNotes, setTrainingNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // Load existing TSS and notes for the selected date
  const loadDayData = useCallback(async () => {
    try {
      const log = await api.foodLog.get(uploadDate)
      setTssInput(String(log.tss ?? 0))
      setTrainingNotes(log.training_notes || '')
      setTssSource('log')
      setUploadResult(null)
      setUploadError(null)
    } catch {
      // If log doesn't exist yet that's fine — defaults are 0
    }
  }, [uploadDate])

  useEffect(() => { loadDayData() }, [loadDayData])

  const handleSaveTSS = async () => {
    const tss = parseInt(tssInput, 10)
    if (isNaN(tss) || tss < 0) return
    setSavingTSS(true)
    setTssSaved(false)
    try {
      await api.foodLog.updateTSS(uploadDate, tss)
      setTssSaved(true)
      setTssSource('manual')
      setTimeout(() => setTssSaved(false), 2500)
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
    formData.append('log_date', uploadDate)
    formData.append('user_id', '1')
    try {
      const result = await api.training.upload(formData)
      setUploadResult(result)
      // Auto-fill TSS from file — user can still override before saving
      if (result.tss !== null) {
        setTssInput(String(Math.round(result.tss)))
        setTssSource('file')
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
      await api.foodLog.updateTrainingNotes(uploadDate, trainingNotes)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2500)
    } catch {
      // non-critical
    } finally {
      setSavingNotes(false)
    }
  }

  const tssNum = parseInt(tssInput, 10) || 0
  const tssLabel =
    tssNum === 0   ? { text: 'Rest',      cls: 'badge-info' } :
    tssNum < 50    ? { text: 'Easy',      cls: 'badge-success' } :
    tssNum < 100   ? { text: 'Moderate',  cls: 'badge-warning' } :
    tssNum < 150   ? { text: 'Hard',      cls: 'badge-danger' } :
    tssNum < 200   ? { text: 'Very Hard', cls: 'badge-danger' } :
                     { text: 'Extreme',   cls: 'badge-danger' }

  return (
    <div>
      <h1 className="page-title">Training</h1>

      <div className="grid-2 gap-24">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Date picker — shared across all sections */}
          <div className="card">
            <div className="card-title">Date</div>
            <input
              type="date"
              className="form-input"
              value={uploadDate}
              onChange={e => setUploadDate(e.target.value)}
            />
          </div>

          {/* TSS input — primary home */}
          <div className="card">
            <div className="card-title">Training Stress Score</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="flex gap-8 items-center">
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  style={{ width: 100, textAlign: 'center', fontSize: 18, fontWeight: 700 }}
                  value={tssInput}
                  onChange={e => { setTssInput(e.target.value); setTssSource('manual') }}
                  onKeyDown={e => e.key === 'Enter' && handleSaveTSS()}
                  placeholder="0"
                />
                <span className={`badge ${tssLabel.cls}`} style={{ fontSize: 12 }}>
                  {tssLabel.text}
                </span>
              </div>

              {tssSource && (
                <div className="text-sm text-muted">
                  {tssSource === 'file'   && '↑ Auto-filled from uploaded file — edit if needed'}
                  {tssSource === 'log'    && `Loaded from saved log for ${uploadDate}`}
                  {tssSource === 'manual' && 'Manual entry'}
                </div>
              )}

              <div className="flex gap-8 items-center">
                <button
                  className="btn btn-primary"
                  onClick={handleSaveTSS}
                  disabled={savingTSS}
                >
                  {savingTSS ? 'Saving…' : 'Save TSS'}
                </button>
                {tssSaved && <span className="text-sm text-success">Saved — macro targets updated</span>}
              </div>
            </div>
          </div>

          {/* Session notes */}
          <div className="card">
            <div className="card-title">Session Notes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                className="form-textarea"
                style={{ minHeight: 100 }}
                value={trainingNotes}
                onChange={e => setTrainingNotes(e.target.value)}
                placeholder={'Add context about today\'s training.\n\nExamples:\n• "Easy 1hr run, felt tired — likely under-fueled"\n• "Long ride 4hr, good legs, hit all intervals"\n• "Rest day — light walk only"'}
              />
              <div className="flex gap-8 items-center">
                <button
                  className="btn btn-secondary"
                  onClick={handleSaveNotes}
                  disabled={savingNotes || !trainingNotes.trim()}
                >
                  {savingNotes ? 'Saving…' : 'Save Notes'}
                </button>
                {notesSaved && <span className="text-sm text-success">Saved</span>}
              </div>
            </div>
          </div>

          {/* File upload */}
          <div className="card">
            <div className="card-title">Import File <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">File (.fit or .json)</label>
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
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleUpload}
                disabled={!file || uploading}
              >
                {uploading ? 'Parsing…' : 'Parse File'}
              </button>
            </div>

            {uploadError && <div className="alert alert-danger mt-12">{uploadError}</div>}

            {uploadResult && (
              <div style={{ marginTop: 14 }}>
                <div className={`alert ${uploadResult.tss !== null ? 'alert-info' : 'alert-warning'}`}>
                  {uploadResult.message}
                </div>
                {uploadResult.tss !== null && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <ResultRow label="TSS (auto-filled above)" value={Math.round(uploadResult.tss)} />
                    {uploadResult.activity_name && <ResultRow label="Activity" value={uploadResult.activity_name} />}
                    {uploadResult.duration_seconds && <ResultRow label="Duration" value={formatDuration(uploadResult.duration_seconds)} />}
                    {uploadResult.distance_meters  && <ResultRow label="Distance" value={`${(uploadResult.distance_meters / 1000).toFixed(1)} km`} />}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title">TSS Reference Scale</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TSS_SCALE.map(row => (
                <div key={row.range} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span className={`badge ${row.badge}`} style={{ minWidth: 72, justifyContent: 'center' }}>
                    {row.range}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.label}</div>
                    <div className="text-sm text-muted">{row.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Nutrition Strategy by TSS</div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <p><strong style={{ color: 'var(--text-primary)' }}>Rest (TSS 0):</strong> Calorie deficit applied. Protein stable, carbs reduced.</p>
              <p style={{ marginTop: 8 }}><strong style={{ color: 'var(--text-primary)' }}>Easy (TSS 1–49):</strong> Slight deficit. Light carb fueling.</p>
              <p style={{ marginTop: 8 }}><strong style={{ color: 'var(--text-primary)' }}>Moderate (TSS 50–99):</strong> Maintenance calories.</p>
              <p style={{ marginTop: 8 }}><strong style={{ color: 'var(--text-primary)' }}>Hard (TSS 100+):</strong> Calorie surplus. High carbs fill remaining calories.</p>
              <div className="divider" />
              <p className="text-muted">Adjust formula parameters in Profile → Nutrition Formula Overrides.</p>
            </div>
          </div>

          <div className="card" style={{ borderColor: 'rgba(250,204,21,0.3)' }}>
            <div className="card-title" style={{ color: 'var(--warning)' }}>File Parse Confidence</div>
            <div className="text-sm text-secondary" style={{ lineHeight: 1.7 }}>
              <p><strong style={{ color: 'var(--text-primary)' }}>.fit (~75%):</strong> Reads <code style={{ background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 3 }}>training_stress_score</code> from FIT session records. If not found, TSS will be null — use manual entry above.</p>
              <p style={{ marginTop: 8 }}><strong style={{ color: 'var(--text-primary)' }}>.json (~60%):</strong> Supports <code style={{ background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 3 }}>tss</code>, <code style={{ background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 3 }}>metrics.tss</code>, <code style={{ background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 3 }}>training_stress_score</code>. Use manual entry as fallback.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span className="text-muted">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const TSS_SCALE = [
  { range: '0',       label: 'Rest',      badge: 'badge-info',    desc: 'Complete rest — body composition focus' },
  { range: '1–49',    label: 'Easy',      badge: 'badge-success', desc: 'Recovery ride, easy swim or run' },
  { range: '50–99',   label: 'Moderate',  badge: 'badge-warning', desc: '90 min zone-2 brick, steady aerobic work' },
  { range: '100–149', label: 'Hard',      badge: 'badge-danger',  desc: 'Long intervals, hard brick, tempo run' },
  { range: '150–199', label: 'Very Hard', badge: 'badge-danger',  desc: 'Race simulation, 4–5 hr long ride' },
  { range: '200+',    label: 'Extreme',   badge: 'badge-danger',  desc: 'Back-to-back hard sessions or race day' },
]
