import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { api } from '../api'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDateLabel(isoDate) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Build chart data merging actual entries with a projected weight trajectory.
 *
 * Projected rate calculation:
 *   weekly_loss = |calorie_adj_rest| × rest_days_per_week / 3500 kcal/lb
 *
 * We assume ~3.5 rest/easy days per week for Ironman training.
 * This is an approximation — actual rate depends on training volume.
 *
 * For the reference user (-300 kcal rest-day deficit):
 *   300 × 3.5 / 3500 = 0.3 lbs/week
 */
function buildChartData(entries, user) {
  const weightEntries = entries.filter(e => e.weight_lbs != null)
  if (!user || weightEntries.length === 0) return { data: [], weeklyRate: 0, weeksToGoal: null }

  const calorieAdjRest = user.nutrition_settings?.calorie_adj_rest ?? -300
  const weeklyRate = Math.abs(calorieAdjRest) * 3.5 / 3500   // lbs/week

  const startEntry = weightEntries[0]
  const startDate  = startEntry.entry_date
  const startWeight = startEntry.weight_lbs
  const goalWeight  = user.goal_weight_lbs

  // Projected weight at any ISO date relative to startDate
  const projectAt = (isoDate) => {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000
    const weeksElapsed = (new Date(isoDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')) / msPerWeek
    const raw = startWeight - weeklyRate * weeksElapsed
    return parseFloat(Math.max(goalWeight, raw).toFixed(1))
  }

  // Collect all dates: actual entries + weekly projections from start to goal (max 78 weeks / 18 mo)
  const MAX_WEEKS = 78
  const dateSet = new Set(weightEntries.map(e => e.entry_date))

  let projDate = startDate
  for (let w = 0; w <= MAX_WEEKS; w++) {
    dateSet.add(projDate)
    const proj = projectAt(projDate)
    if (proj <= goalWeight) {
      dateSet.add(projDate)
      break
    }
    projDate = addDays(projDate, 7)
  }

  const today = todayISO()
  const entryByDate = Object.fromEntries(weightEntries.map(e => [e.entry_date, e]))

  const data = [...dateSet]
    .sort()
    .map(d => ({
      isoDate: d,
      date: formatDateLabel(d),
      weight:    entryByDate[d]?.weight_lbs ?? null,   // null = no measurement on that date
      projected: projectAt(d),
      isFuture:  d > today,
    }))

  // Weeks to goal from today (for summary)
  const todayWeight = weightEntries[weightEntries.length - 1]?.weight_lbs ?? startWeight
  const weeksToGoal = weeklyRate > 0 && todayWeight > goalWeight
    ? Math.ceil((todayWeight - goalWeight) / weeklyRate)
    : null

  return { data, weeklyRate, weeksToGoal }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map(p => p.value != null && (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value} lbs</strong>
        </div>
      ))}
    </div>
  )
}

export default function Progress() {
  const [entries, setEntries] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    entry_date: todayISO(),
    weight_lbs: '',
    navel_circumference_inches: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const loadAll = () =>
    Promise.all([api.progress.list(), api.users.get(1)]).then(([data, u]) => {
      setEntries([...data].reverse())
      setUser(u)
    })

  useEffect(() => { loadAll().finally(() => setLoading(false)) }, [])

  const handleSave = async () => {
    if (!form.weight_lbs && !form.navel_circumference_inches) {
      setSaveMsg({ type: 'error', text: 'Enter at least one measurement.' })
      return
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      await api.progress.add({
        user_id: 1,
        entry_date: form.entry_date,
        weight_lbs: form.weight_lbs ? parseFloat(form.weight_lbs) : null,
        navel_circumference_inches: form.navel_circumference_inches
          ? parseFloat(form.navel_circumference_inches) : null,
        notes: form.notes,
      })
      setSaveMsg({ type: 'success', text: 'Saved!' })
      setForm(f => ({ ...f, weight_lbs: '', navel_circumference_inches: '', notes: '' }))
      await loadAll()
    } catch (e) {
      setSaveMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return
    await api.progress.delete(id)
    await loadAll()
  }

  // ── Chart data ──
  const { data: chartData, weeklyRate, weeksToGoal } = buildChartData(entries, user)

  // Circumference chart data (actual only)
  const circumData = entries
    .filter(e => e.navel_circumference_inches != null)
    .map(e => ({
      date: formatDateLabel(e.entry_date),
      circumference: e.navel_circumference_inches,
    }))

  const latest  = entries.length > 0 ? entries[entries.length - 1] : null
  const earliest = entries.length > 1 ? entries[0] : null
  const weightChange = latest?.weight_lbs && earliest?.weight_lbs
    ? (latest.weight_lbs - earliest.weight_lbs).toFixed(1) : null
  const circumChange = latest?.navel_circumference_inches && earliest?.navel_circumference_inches
    ? (latest.navel_circumference_inches - earliest.navel_circumference_inches).toFixed(1) : null

  // Whether user is ahead or behind the projected trajectory
  const lastActual   = entries.filter(e => e.weight_lbs).slice(-1)[0]
  const projAtLastActual = lastActual && chartData.length
    ? chartData.find(d => d.isoDate === lastActual.entry_date)?.projected
    : null
  const vsTrajectory = lastActual && projAtLastActual
    ? (lastActual.weight_lbs - projAtLastActual).toFixed(1)
    : null

  return (
    <div>
      <h1 className="page-title">Progress Tracking</h1>

      <div className="grid-2 gap-24">
        {/* Left: log + summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title">Log Measurement</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={form.entry_date}
                  onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Weight (lbs)</label>
                <input type="number" className="form-input" step="0.1" min={0}
                  value={form.weight_lbs}
                  onChange={e => setForm(f => ({ ...f, weight_lbs: e.target.value }))}
                  placeholder="e.g. 174.5" />
              </div>
              <div className="form-group">
                <label className="form-label">Navel Circumference (inches)</label>
                <input type="number" className="form-input" step="0.1" min={0}
                  value={form.navel_circumference_inches}
                  onChange={e => setForm(f => ({ ...f, navel_circumference_inches: e.target.value }))}
                  placeholder="e.g. 35.5" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional note" />
              </div>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Entry'}
              </button>
              {saveMsg && (
                <div className={`alert ${saveMsg.type === 'error' ? 'alert-danger' : 'alert-info'}`}>
                  {saveMsg.text}
                </div>
              )}
            </div>
          </div>

          {/* Trend summary */}
          {entries.length >= 1 && user && (
            <div className="card">
              <div className="card-title">Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {latest?.weight_lbs && (
                  <TrendRow label="Current weight" value={`${latest.weight_lbs} lbs`} />
                )}
                {user && (
                  <TrendRow label="Goal weight" value={`${user.goal_weight_lbs} lbs`} />
                )}
                {latest?.weight_lbs && user && (
                  <TrendRow
                    label="Remaining"
                    value={`${(latest.weight_lbs - user.goal_weight_lbs).toFixed(1)} lbs`}
                  />
                )}
                {weightChange !== null && (
                  <TrendRow
                    label={`Change (${entries.filter(e=>e.weight_lbs).length} weigh-ins)`}
                    value={`${weightChange > 0 ? '+' : ''}${weightChange} lbs`}
                    positive={parseFloat(weightChange) < 0}
                  />
                )}
                {weeklyRate > 0 && (
                  <TrendRow
                    label="Projected rate"
                    value={`${weeklyRate.toFixed(2)} lbs/wk`}
                    sub={`based on ${Math.abs(user?.nutrition_settings?.calorie_adj_rest ?? 300)} kcal rest deficit`}
                  />
                )}
                {weeksToGoal && (
                  <TrendRow
                    label="Projected weeks to goal"
                    value={`~${weeksToGoal} weeks`}
                  />
                )}
                {vsTrajectory !== null && (
                  <TrendRow
                    label="vs projected trajectory"
                    value={`${vsTrajectory > 0 ? '+' : ''}${vsTrajectory} lbs`}
                    positive={parseFloat(vsTrajectory) < 0}
                    sub={parseFloat(vsTrajectory) < 0 ? 'ahead of plan' : parseFloat(vsTrajectory) > 0 ? 'behind plan' : 'on track'}
                  />
                )}
                {circumChange !== null && (
                  <>
                    <div className="divider" style={{ margin: '4px 0' }} />
                    <TrendRow
                      label="Circumference change"
                      value={`${circumChange > 0 ? '+' : ''}${circumChange}"`}
                      positive={parseFloat(circumChange) < 0}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Log table */}
          {entries.length > 0 && (
            <div className="card">
              <div className="card-title">Log ({entries.length})</div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {[...entries].reverse().map(e => (
                  <div key={e.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {new Date(e.entry_date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric',
                        })}
                      </div>
                      <div className="text-sm text-muted">
                        {e.weight_lbs ? `${e.weight_lbs} lbs` : '—'}
                        {' · '}
                        {e.navel_circumference_inches ? `${e.navel_circumference_inches}"` : '—'}
                        {e.notes ? ` · ${e.notes}` : ''}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(e.id)}
                      style={{ padding: '2px 8px' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div className="loading">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">&#128200;</div>
                <div>No data yet</div>
                <div className="text-sm text-muted">Log your first measurement to see charts</div>
              </div>
            </div>
          ) : (
            <>
              {/* Weight chart with projected line */}
              <div className="card">
                <div className="flex items-center justify-between mb-16">
                  <div className="card-title" style={{ marginBottom: 0 }}>Body Weight</div>
                  {user && (
                    <span className="text-sm text-muted">
                      Goal: {user.goal_weight_lbs} lbs
                    </span>
                  )}
                </div>

                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      tickLine={false} axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      tickLine={false} axisLine={false}
                      domain={['dataMin - 3', 'dataMax + 1']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      iconType="line"
                      iconSize={12}
                      wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }}
                    />

                    {/* Projected trajectory — dashed */}
                    <Line
                      type="monotone"
                      dataKey="projected"
                      name="Projected"
                      stroke="var(--text-muted)"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      dot={false}
                      activeDot={false}
                      connectNulls
                    />

                    {/* Actual weight — solid, dots on measured days */}
                    <Line
                      type="monotone"
                      dataKey="weight"
                      name="Actual"
                      stroke="var(--cal-color)"
                      strokeWidth={2}
                      dot={(props) => {
                        if (props.value == null) return null
                        return (
                          <circle
                            key={props.index}
                            cx={props.cx} cy={props.cy} r={3.5}
                            fill="var(--cal-color)" stroke="none"
                          />
                        )
                      }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>

                {weeklyRate > 0 && (
                  <div className="text-sm text-muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                    Dashed line = projected trajectory at {weeklyRate.toFixed(2)} lbs/week
                    {' '}(based on ~{Math.abs(user?.nutrition_settings?.calorie_adj_rest ?? 300)} kcal rest-day deficit × 3.5 days/week).
                    Actual rate depends on training volume and adherence.
                  </div>
                )}
              </div>

              {/* Circumference chart */}
              {circumData.length > 0 && (
                <div className="card">
                  <div className="card-title">Navel Circumference (inches)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={circumData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone" dataKey="circumference" name="Circumference"
                        stroke="var(--protein-color)" strokeWidth={2}
                        dot={{ r: 3, fill: 'var(--protein-color)' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function TrendRow({ label, value, sub, positive }) {
  const color = positive === undefined
    ? 'var(--text-primary)'
    : positive ? 'var(--success)' : 'var(--danger)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
      <span className="text-muted">{label}</span>
      <span>
        <strong style={{ color }}>{value}</strong>
        {sub && <span className="text-muted" style={{ marginLeft: 6, fontSize: 11 }}>{sub}</span>}
      </span>
    </div>
  )
}
