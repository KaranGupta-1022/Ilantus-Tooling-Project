import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockDomains, mockEvaluateResponse, mockVendors } from '../mock/data.js'
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

  useEffect(() => {
    function handleClickOutside(e) {
      if (domainFilterRef.current && !domainFilterRef.current.contains(e.target)) {
        setDomainFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredVendors = useMemo(() => {
    if (domainFilter === 'ALL') return mockVendors
    return mockVendors.filter((v) => v.domain_code === domainFilter)
  }, [domainFilter])

  function handleViewResults(vendor) {
    navigate('/results', {
      state: {
        result: {
          ...mockEvaluateResponse,
          vendor: {
            ...mockEvaluateResponse.vendor,
            name: vendor.name,
            domain_code: vendor.domain_code,
            input_type: vendor.input_type,
            pages_crawled: vendor.pages_crawled,
            created_at: vendor.created_at,
          },
        },
      },
    })
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
              {mockDomains.map((d) => (
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
              {filteredVendors.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>{v.domain_code}</td>
                  <td>
                    <span className={`badge-coverage ${coverageBadgeClass(v.coverage)}`}>
                      {v.coverage}%
                    </span>
                  </td>
                  <td>
                    {v.used_cases_covered}/{v.use_cases_total}
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
                    <button className="btn-outline" onClick={() => handleViewResults(v)}>
                      View Results
                    </button>
                  </td>
                </tr>
              ))}
              {filteredVendors.length === 0 && (
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