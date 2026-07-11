import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/results', label: 'Results' },
  { to: '/history', label: 'History' },
  { to: '/compare', label: 'Compare' },
  { to: '/library', label: 'Library' },
]

export default function Sidebar({ isOpen = false, onNavigate }) {
  return (
    <aside className={'sidebar' + (isOpen ? ' sidebar-mobile-open' : '')}>
      <div className="sidebar-brand">
        <span className="sidebar-logo">🛡️</span>
        <div className="sidebar-title">
          <span className="sidebar-title-main">IAM</span>
          <span className="sidebar-title-sub">Use Case Evaluator</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              'sidebar-link' + (isActive ? ' sidebar-link-active' : '')
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
