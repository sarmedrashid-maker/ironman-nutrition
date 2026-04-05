import { NavLink } from 'react-router-dom'

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/log',       label: 'Food Log' },
  { to: '/meals',     label: 'Meal Library' },
  { to: '/training',  label: 'Training' },
  { to: '/progress',  label: 'Progress' },
  { to: '/profile',   label: 'Profile' },
]

export default function Nav() {
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
    </nav>
  )
}
