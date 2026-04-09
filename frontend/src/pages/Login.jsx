import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useUser } from '../contexts/UserContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { login } = useUser()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      let user
      try {
        user = await api.users.getByUsername(trimmed)
      } catch {
        // Username not found — create a new account
        user = await api.users.register(trimmed)
      }
      login(user.id, user.username)
      navigate('/calendar', { replace: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg-base)',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: 8,
          }}>
            Ironman Nutrition
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Welcome
          </h1>
        </div>

        <div className="card" style={{ padding: '32px 28px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            If this is your first time here, please create a username. You will use this username to access your information in the future.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(null) }}
                placeholder="Enter your username"
                autoFocus
                autoComplete="username"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="alert alert-danger" style={{ fontSize: 13 }}>{error}</div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !username.trim()}
              style={{ marginTop: 4 }}
            >
              {loading ? 'Loading…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
