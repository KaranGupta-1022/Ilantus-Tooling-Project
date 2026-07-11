import { useEffect, useMemo, useRef, useState } from 'react'
import { mockCompareResponse, mockDomains, mockVendors } from '../mock/data.js'
import ScrollBox from '../components/ScrollBox.jsx'

const compareableVendors = mockVendors.filter((v) =>
  mockCompareResponse.vendors.some((cv) => cv.id === v.id)
)

export default function ComparePage() {
  const [domainCode, setDomainCode] = useState('IGA')
  const [domainOpen, setDomainOpen] = useState(false)
  const domainRef = useRef(null)
  const [addVendorOpen, setAddVendorOpen] = useState(false)
  const addVendorRef = useRef(null)
  const [selectedIds, setSelectedIds] = useState([101, 102, 103])

  useEffect(() => {
    function handleClickOutside(e) {
      if (domainRef.current && !domainRef.current.contains(e.target)) {
        setDomainOpen(false)
      }
      if (addVendorRef.current && !addVendorRef.current.contains(e.target)) {
        setAddVendorOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const vendorsInDomain = useMemo(
    () => compareableVendors.filter((v) => v.domain_code === domainCode),
    [domainCode]
  )

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => vendorsInDomain.some((v) => v.id === id))
    )
  }, [domainCode, vendorsInDomain])

  const availableToAdd = vendorsInDomain.filter((v) => !selectedIds.includes(v.id))

  function addVendor(id) {
    setSelectedIds([...selectedIds, Number(id)])
    setAddVendorOpen(false)
  }

  function removeVendor(id) {
    setSelectedIds(selectedIds.filter((sid) => sid !== id))
  }

  const selectedVendors = useMemo(
    () =>
      selectedIds
        .map((id) => mockCompareResponse.vendors.find((v) => v.id === id))
        .filter(Boolean),
    [selectedIds]
  )

  const useCaseRows = useMemo(() => {
    if (selectedVendors.length === 0) return []
    const first = selectedVendors[0].mapping
    return first.map((item) => {
      const perVendor = selectedVendors.map((v) =>
        v.mapping.find((m) => m.use_case_code === item.use_case_code)
      )
      const coveredValues = new Set(perVendor.map((m) => m?.covered ?? false))
      return {
        code: item.use_case_code,
        name: item.name,
        category: item.category,
        perVendor,
        differs: coveredValues.size > 1,
      }
    })
  }, [selectedVendors])

  return (
    <div>
      <h1>Compare Vendors</h1>
      <p className="page-subtitle">Select a domain, then any vendors evaluated in that domain.</p>

      <div className="card">
        <div className="form-group" style={{ maxWidth: 220 }} ref={domainRef}>
          <label htmlFor="compareDomain">IAM Domain</label>
          <div className="dropdown">
            <button
              type="button"
              id="compareDomain"
              className="dropdown-trigger domain-chip-trigger"
              onClick={() => setDomainOpen((open) => !open)}
            >
              {domainCode}
              <span className="dropdown-arrow">▾</span>
            </button>
            {domainOpen && (
              <ul className="dropdown-menu">
                {mockDomains.map((d) => (
                  <li key={d.code}>
                    <button
                      type="button"
                      className={
                        'dropdown-option' + (d.code === domainCode ? ' dropdown-option-active' : '')
                      }
                      onClick={() => {
                        setDomainCode(d.code)
                        setDomainOpen(false)
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

        <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
          Select vendors to compare
        </label>
        <div className="compare-chip-row">
          {selectedVendors.map((v) => (
            <span className="compare-chip" key={v.id}>
              {v.name}
              <button
                type="button"
                className="compare-chip-remove"
                onClick={() => removeVendor(v.id)}
                aria-label={`Remove ${v.name}`}
              >
                ×
              </button>
            </span>
          ))}
          {availableToAdd.length > 0 && (
            <div className="dropdown" ref={addVendorRef}>
              <button
                type="button"
                className="compare-add-trigger"
                onClick={() => setAddVendorOpen((open) => !open)}
              >
                + Add vendor
                <span className="dropdown-arrow">▾</span>
              </button>
              {addVendorOpen && (
                <ScrollBox maxHeight={120} wrapClassName="dropdown-menu-scroll">
                  <ul className="dropdown-menu dropdown-menu-static">
                    {availableToAdd.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          className="dropdown-option"
                          onClick={() => addVendor(v.id)}
                        >
                          {v.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollBox>
              )}
            </div>
          )}
        </div>
        {vendorsInDomain.length === 0 && (
          <p className="field-hint" style={{ marginTop: 8 }}>
            No evaluated vendors in this domain yet.
          </p>
        )}
      </div>

      {selectedVendors.length < 2 ? (
        <div className="card" style={{ marginTop: 24 }}>
          <p className="empty-state">Select at least 2 vendors to compare.</p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 24 }}>
          <ScrollBox maxHeight={420} wrapClassName="results-table-scroll">
            <table className="results-table compare-table">
              <thead>
                <tr>
                  <th>Use Case</th>
                  {selectedVendors.map((v) => (
                    <th key={v.id}>{v.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {useCaseRows.map((row) => (
                  <tr key={row.code} className={row.differs ? 'row-diff' : ''}>
                    <td>{row.name}</td>
                    {row.perVendor.map((m, idx) => (
                      <td key={selectedVendors[idx].id}>
                        {m?.covered ? (
                          <span className="icon-badge icon-badge-covered">✓</span>
                        ) : (
                          <span className="icon-badge icon-badge-not-covered">✕</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBox>
          <p className="field-hint legend-row">
            <span className="icon-badge icon-badge-covered">✓</span> Covered &nbsp;
            <span className="icon-badge icon-badge-not-covered">✕</span> Not Covered &nbsp; · Rows
            highlighted in yellow indicate differences between vendors.
          </p>
        </div>
      )}
    </div>
  )
}
