import { NavLink, useNavigate } from 'react-router-dom'
import { useUser } from '../contexts/UserContext'

const links = [
  { to: '/calendar', label: 'Calendar' },
  { to: '/meals',    label: 'Meal Library' },
  { to: '/progress', label: 'Progress' },
  { to: '/profile',  label: 'Profile' },
]

export default function Nav() {
  const { username, logout } = useUser()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="nav">
      <span className="nav-brand">IRONMAN NUTRITION</span>
      <div className="nav-links">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            {label}
          </NavLink>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {username && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            {username}
          </span>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
          style={{ fontSize: 12 }}
        >
          Log out
        </button>
      </div>
    </nav>
  )
}
