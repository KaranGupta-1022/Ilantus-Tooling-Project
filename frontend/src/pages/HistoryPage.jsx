/**
 * Table of previously evaluated vendors, filterable by IAM domain. "View
 * Results" re-fetches the full evaluation for a vendor and reuses
 * ResultsPage to display it.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDomains, getVendors, getVendor } from '../api.js'
import ScrollBox from '../components/ScrollBox.jsx'

function coverageBadgeClass(percent) {
  if (percent >= 70) return 'badge-coverage-green'
  if (percent >= 50) return 'badge-coverage-amber'
  return 'badge-coverage-red'
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [domainFilter, setDomainFilter] = useState('ALL')
  const [domainFilterOpen, setDomainFilterOpen] = useState(false)
  const domainFilterRef = useRef(null)

  const [domains, setDomains] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewLoadingId, setViewLoadingId] = useState(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (domainFilterRef.current && !domainFilterRef.current.contains(e.target)) {
        setDomainFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    getDomains()
      .then(setDomains)
      .catch(() => {})
  }, [])

  // Refetch the vendor list whenever the domain filter changes.
  useEffect(() => {
    setLoading(true)
    setError(null)
    getVendors(domainFilter === 'ALL' ? undefined : domainFilter)
      .then(setVendors)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [domainFilter])

  const filteredVendors = useMemo(() => vendors, [vendors])

  /**
   * - Fetches GET /vendors/{id} for full mapping detail (the list endpoint
   *   only returns summary fields), then reshapes it into the same
   *   { vendor, mapping, new_use_cases_found } shape ResultsPage expects
   *   from a fresh evaluation, and navigates there with it.
   */
  async function handleViewResults(vendor) {
    setViewLoadingId(vendor.id)
    try {
      const detail = await getVendor(vendor.id)
      const { mapping, new_use_cases_found, ...vendorFields } = detail
      navigate('/results', {
        state: {
          result: {
            vendor: vendorFields,
            mapping,
            new_use_cases_found,
          },
        },
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setViewLoadingId(null)
    }
  }

  return (
    <div>
      <h1>Evaluation History</h1>
      <p className="page-subtitle">All previously evaluated vendors.</p>

      <div className="form-group" style={{ maxWidth: 220, marginBottom: 16 }} ref={domainFilterRef}>
        <label htmlFor="domainFilter">IAM Domain</label>
        <div className="dropdown">
          <button
            type="button"
            id="domainFilter"
            className="dropdown-trigger"
            onClick={() => setDomainFilterOpen((open) => !open)}
          >
            {domainFilter === 'ALL' ? 'All Domains' : domainFilter}
            <span className="dropdown-arrow">▾</span>
          </button>
          {domainFilterOpen && (
            <ul className="dropdown-menu">
              <li>
                <button
                  type="button"
                  className={
                    'dropdown-option' + (domainFilter === 'ALL' ? ' dropdown-option-active' : '')
                  }
                  onClick={() => {
                    setDomainFilter('ALL')
                    setDomainFilterOpen(false)
                  }}
                >
                  All Domains
                </button>
              </li>
              {domains.map((d) => (
                <li key={d.code}>
                  <button
                    type="button"
                    className={
                      'dropdown-option' + (d.code === domainFilter ? ' dropdown-option-active' : '')
                    }
                    onClick={() => {
                      setDomainFilter(d.code)
                      setDomainFilterOpen(false)
                    }}
                  >
                    {d.code}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <div className="card">
        <ScrollBox maxHeight={420} wrapClassName="history-table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Domain</th>
                <th>Coverage</th>
                <th>Use Cases Covered</th>
                <th>Date Evaluated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                filteredVendors.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name}</td>
                    <td>{v.domain_code}</td>
                    <td>
                      <span className={`badge-coverage ${coverageBadgeClass(v.coverage)}`}>
                        {v.coverage}%
                      </span>
                    </td>
                    <td>
                      {v.use_cases_covered}/{v.use_cases_total}
                    </td>
                    <td>
                      {new Date(v.created_at).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <button
                        className="btn-outline"
                        onClick={() => handleViewResults(v)}
                        disabled={viewLoadingId === v.id}
                      >
                        {viewLoadingId === v.id ? 'Loading…' : 'View Results'}
                      </button>
                    </td>
                  </tr>
                ))}
              {!loading && filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No vendors evaluated for this domain yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollBox>
      </div>
    </div>
  )
}
