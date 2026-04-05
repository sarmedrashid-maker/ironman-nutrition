import { useState, useEffect } from 'react'
import { api } from '../api'

const RESTRICTION_OPTIONS = [
  { value: 'no_mammal_meat', label: 'No mammal meat (beef, pork, lamb, etc.)' },
  { value: 'no_dairy',       label: 'No dairy' },
  { value: 'no_eggs',        label: 'No eggs' },
  { value: 'no_gluten',      label: 'No gluten' },
  { value: 'no_shellfish',   label: 'No shellfish' },
  { value: 'vegetarian',     label: 'Vegetarian' },
  { value: 'vegan',          label: 'Vegan' },
]

const DEFAULT_MULTIPLIERS = {
  rest: 1.2, easy: 1.4, moderate: 1.6, hard: 1.8, very_hard: 2.0, extreme: 2.2,
}

const MULTIPLIER_LABELS = [
  { key: 'rest',      label: 'Rest (TSS 0)' },
  { key: 'easy',      label: 'Easy (TSS 1–49)' },
  { key: 'moderate',  label: 'Moderate (TSS 50–99)' },
  { key: 'hard',      label: 'Hard (TSS 100–149)' },
  { key: 'very_hard', label: 'Very Hard (TSS 150–199)' },
  { key: 'extreme',   label: 'Extreme (TSS 200+)' },
]

/** Replicate backend calculation to show live preview */
function previewTargets(form, ns, tss = 0) {
  const weightKg = parseFloat(form.weight_lbs) * 0.453592
  const heightCm = parseFloat(form.height_inches) * 2.54
  const age = parseInt(form.age, 10)
  if (!weightKg || !heightCm || !age) return null

  const bmr = form.sex === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161

  const bracket =
    tss === 0    ? 'rest' :
    tss <= 49    ? 'easy' :
    tss <= 99    ? 'moderate' :
    tss <= 149   ? 'hard' :
    tss <= 199   ? 'very_hard' : 'extreme'

  const mult = parseFloat(ns.activity_multipliers[bracket]) || DEFAULT_MULTIPLIERS[bracket]
  const tdee = bmr * mult

  const adjRest = parseFloat(ns.calorie_adj_rest) || -300
  const adjHard = parseFloat(ns.calorie_adj_hard) || 150
  const target =
    tss < 50 && parseFloat(form.weight_lbs) > parseFloat(form.goal_weight_lbs)
      ? tdee + adjRest
      : tss >= 100
        ? tdee + adjHard
        : tdee

  const protein = parseFloat(ns.protein_g_per_kg) * weightKg
  const fat     = parseFloat(ns.fat_g_per_kg_min) * weightKg
  const carbs   = Math.max(0, (target - protein * 4 - fat * 9) / 4)

  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee),
    target: Math.round(target),
    protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat),
    carbsPerKg: (carbs / weightKg).toFixed(1),
  }
}

export default function Profile() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  // Personal info form
  const [form, setForm] = useState(null)

  // Nutrition settings form (separate so we can show live preview)
  const [ns, setNs] = useState({
    protein_g_per_kg: '1.6',
    fat_g_per_kg_min: '1.0',
    activity_multipliers: { ...DEFAULT_MULTIPLIERS },
    calorie_adj_rest: '-300',
    calorie_adj_hard: '150',
  })

  useEffect(() => {
    api.users.get(1)
      .then(u => {
        setUser(u)
        setForm({
          name: u.name, sex: u.sex,
          age: String(u.age),
          weight_lbs: String(u.weight_lbs),
          goal_weight_lbs: String(u.goal_weight_lbs),
          height_inches: String(u.height_inches),
          dietary_restrictions: u.dietary_restrictions || [],
        })
        const s = u.nutrition_settings || {}
        setNs({
          protein_g_per_kg: String(s.protein_g_per_kg ?? 1.6),
          fat_g_per_kg_min: String(s.fat_g_per_kg_min ?? 1.0),
          activity_multipliers: {
            ...DEFAULT_MULTIPLIERS,
            ...(s.activity_multipliers || {}),
          },
          calorie_adj_rest: String(s.calorie_adj_rest ?? -300),
          calorie_adj_hard: String(s.calorie_adj_hard ?? 150),
        })
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const toggleRestriction = (value) => {
    setForm(f => ({
      ...f,
      dietary_restrictions: f.dietary_restrictions.includes(value)
        ? f.dietary_restrictions.filter(r => r !== value)
        : [...f.dietary_restrictions, value],
    }))
  }

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError(null)
    try {
      const updated = await api.users.update(1, {
        name: form.name,
        sex: form.sex,
        age: parseInt(form.age, 10),
        weight_lbs: parseFloat(form.weight_lbs),
        goal_weight_lbs: parseFloat(form.goal_weight_lbs),
        height_inches: parseFloat(form.height_inches),
        dietary_restrictions: form.dietary_restrictions,
        nutrition_settings: {
          protein_g_per_kg:    parseFloat(ns.protein_g_per_kg),
          fat_g_per_kg_min:    parseFloat(ns.fat_g_per_kg_min),
          activity_multipliers: Object.fromEntries(
            Object.entries(ns.activity_multipliers).map(([k, v]) => [k, parseFloat(v)])
          ),
          calorie_adj_rest: parseFloat(ns.calorie_adj_rest),
          calorie_adj_hard: parseFloat(ns.calorie_adj_hard),
        },
      })
      setUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const resetNsToDefaults = () => {
    setNs({
      protein_g_per_kg: '1.6',
      fat_g_per_kg_min: '1.0',
      activity_multipliers: { ...DEFAULT_MULTIPLIERS },
      calorie_adj_rest: '-300',
      calorie_adj_hard: '150',
    })
  }

  if (loading) return <div className="loading">Loading…</div>
  if (!form)   return <div className="alert alert-danger">{error || 'Could not load profile.'}</div>

  const feetPart  = Math.floor(parseFloat(form.height_inches) / 12)
  const inchesPart = Math.round(parseFloat(form.height_inches) % 12)

  // Live preview at three TSS levels
  const prev0   = previewTargets(form, ns, 0)
  const prev75  = previewTargets(form, ns, 75)
  const prev120 = previewTargets(form, ns, 120)

  const weightKg = parseFloat(form.weight_lbs) * 0.453592

  return (
    <div>
      <h1 className="page-title">Profile</h1>

      <div className="grid-2 gap-24">
        {/* ── Left column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Personal info */}
          <div className="card">
            <div className="card-title">Personal Information</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Sex</label>
                  <select className="form-select" value={form.sex}
                    onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input className="form-input" type="number" min={10} max={100}
                    value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Current Weight (lbs)</label>
                  <input className="form-input" type="number" step="0.1"
                    value={form.weight_lbs} onChange={e => setForm(f => ({ ...f, weight_lbs: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Goal Weight (lbs)</label>
                  <input className="form-input" type="number" step="0.1"
                    value={form.goal_weight_lbs} onChange={e => setForm(f => ({ ...f, goal_weight_lbs: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Height (inches)
                  <span className="text-muted" style={{ marginLeft: 8, fontWeight: 400 }}>
                    = {feetPart}'{inchesPart}"
                  </span>
                </label>
                <input className="form-input" type="number" step="0.5" min={48} max={96}
                  value={form.height_inches} onChange={e => setForm(f => ({ ...f, height_inches: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Nutrition formula overrides */}
          <div className="card">
            <div className="flex items-center justify-between mb-16">
              <div className="card-title" style={{ marginBottom: 0 }}>Nutrition Formula Overrides</div>
              <button className="btn btn-ghost btn-sm" onClick={resetNsToDefaults}>Reset defaults</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Protein & fat */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Protein (g/kg)</label>
                  <input className="form-input" type="number" step="0.1" min={0.8} max={3.5}
                    value={ns.protein_g_per_kg}
                    onChange={e => setNs(n => ({ ...n, protein_g_per_kg: e.target.value }))} />
                  <div className="text-sm text-muted" style={{ marginTop: 3 }}>
                    = {Math.round(parseFloat(ns.protein_g_per_kg || 0) * weightKg)}g/day · default 1.6
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Fat minimum (g/kg)</label>
                  <input className="form-input" type="number" step="0.1" min={0.5} max={2.5}
                    value={ns.fat_g_per_kg_min}
                    onChange={e => setNs(n => ({ ...n, fat_g_per_kg_min: e.target.value }))} />
                  <div className="text-sm text-muted" style={{ marginTop: 3 }}>
                    = {Math.round(parseFloat(ns.fat_g_per_kg_min || 0) * weightKg)}g/day · default 1.0
                  </div>
                </div>
              </div>

              <div className="alert alert-info" style={{ fontSize: 12 }}>
                Carbs auto-fill remaining calories after protein and fat are allocated. Increasing protein decreases carbs at the same calorie target.
              </div>

              {/* Calorie adjustments */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Calorie adj — rest day</label>
                  <input className="form-input" type="number" step="50"
                    value={ns.calorie_adj_rest}
                    onChange={e => setNs(n => ({ ...n, calorie_adj_rest: e.target.value }))} />
                  <div className="text-sm text-muted" style={{ marginTop: 3 }}>Applied when TSS &lt; 50 &amp; above goal weight</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Calorie adj — hard day</label>
                  <input className="form-input" type="number" step="50"
                    value={ns.calorie_adj_hard}
                    onChange={e => setNs(n => ({ ...n, calorie_adj_hard: e.target.value }))} />
                  <div className="text-sm text-muted" style={{ marginTop: 3 }}>Applied when TSS ≥ 100</div>
                </div>
              </div>

              {/* Activity multipliers */}
              <div>
                <div className="form-label" style={{ marginBottom: 8 }}>Activity multipliers (BMR ×)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {MULTIPLIER_LABELS.map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 160 }}>{label}</span>
                      <input
                        className="form-input"
                        type="number"
                        step="0.05"
                        min={1.0}
                        max={3.0}
                        style={{ width: 80 }}
                        value={ns.activity_multipliers[key]}
                        onChange={e => setNs(n => ({
                          ...n,
                          activity_multipliers: { ...n.activity_multipliers, [key]: e.target.value }
                        }))}
                      />
                      {prev0 && (
                        <span className="text-sm text-muted">
                          → {Math.round(prev0.bmr * parseFloat(ns.activity_multipliers[key] || DEFAULT_MULTIPLIERS[key]))} kcal TDEE
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Dietary restrictions */}
          <div className="card">
            <div className="card-title">Dietary Restrictions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {RESTRICTION_OPTIONS.map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={form.dietary_restrictions.includes(opt.value)}
                    onChange={() => toggleRestriction(opt.value)}
                    style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save All Changes'}
          </button>
          {saved && <div className="alert alert-info">Profile saved. Macro targets will update on next Dashboard load.</div>}
        </div>

        {/* ── Right column: live preview ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title">Live Target Preview</div>
            <div className="text-sm text-muted mb-16">
              Updates as you edit. Shows targets with current formula settings before saving.
            </div>

            {[
              { label: 'Rest day (TSS 0)',       prev: prev0 },
              { label: 'Moderate day (TSS 75)',  prev: prev75 },
              { label: 'Hard day (TSS 120)',      prev: prev120 },
            ].map(({ label, prev }) => prev && (
              <div key={label} style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 10
                }}>
                  {label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <PreviewRow label="Target calories" value={`${prev.target} kcal`} />
                  <PreviewRow label="TDEE" value={`${prev.tdee} kcal`} sub={`BMR ${prev.bmr}`} />
                  <PreviewRow label="Protein" value={`${prev.protein}g`} color="var(--protein-color)" />
                  <PreviewRow
                    label="Carbs (auto-fill)"
                    value={`${prev.carbs}g`}
                    sub={`${prev.carbsPerKg} g/kg`}
                    color="var(--carbs-color)"
                  />
                  <PreviewRow label="Fat (minimum)" value={`${prev.fat}g`} color="var(--fat-color)" />
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Formula Reference</div>
            <div className="text-sm text-secondary" style={{ lineHeight: 1.8 }}>
              <p><strong style={{ color: 'var(--text-primary)' }}>BMR:</strong> Mifflin-St Jeor (1990)</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>TDEE:</strong> BMR × activity multiplier</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>Protein:</strong> ACSM/AND/DC — 1.6 g/kg default</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>Fat:</strong> Minimum 1.0 g/kg for hormone health</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>Carbs:</strong> Fills remaining calories (target − protein − fat)</p>
              <div className="divider" />
              <p className="text-muted">Raising protein_g_per_kg reduces carbs proportionally, keeping total calories constant.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewRow({ label, value, sub, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
      <span className="text-muted">{label}</span>
      <span>
        <strong style={{ color: color || 'var(--text-primary)' }}>{value}</strong>
        {sub && <span className="text-muted" style={{ marginLeft: 6, fontSize: 11 }}>{sub}</span>}
      </span>
    </div>
  )
}
