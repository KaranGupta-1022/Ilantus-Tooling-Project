/**
 * Shared page shell: mobile topbar + collapsible drawer sidebar + content
 * outlet. Rendered once by the router; individual pages render into <Outlet />.
 */
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'

export default function Layout() {
  // Sidebar is an off-canvas drawer on mobile; menuOpen tracks whether it's shown.
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
        <span className="mobile-topbar-title">IAM Use Case Evaluator</span>
      </header>

      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <Sidebar isOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />

      <main className="content-area">
        <Outlet />
      </main>
    </div>
  )
}
