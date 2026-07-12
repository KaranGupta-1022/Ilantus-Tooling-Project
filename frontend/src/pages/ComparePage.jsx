import { useEffect, useMemo, useRef, useState } from 'react'
import { getDomains, getVendors, compareVendors } from '../api.js'
import ScrollBox from '../components/ScrollBox.jsx'

export default function ComparePage() {
  const [domainCode, setDomainCode] = useState('IGA')
  const [domainOpen, setDomainOpen] = useState(false)
  const domainRef = useRef(null)
  const [addVendorOpen, setAddVendorOpen] = useState(false)
  const addVendorRef = useRef(null)
  const [selectedIds, setSelectedIds] = useState([])

  const [domains, setDomains] = useState([])
  const [vendorsInDomain, setVendorsInDomain] = useState([])
  const [vendorsLoading, setVendorsLoading] = useState(true)
  const [vendorsError, setVendorsError] = useState(null)

  const [compareData, setCompareData] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState(null)

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

  useEffect(() => {
    getDomains()
      .then(setDomains)
      .catch(() => {})
  }, [])

  useEffect(() => {
    setVendorsLoading(true)
    setVendorsError(null)
    setSelectedIds([])
    getVendors(domainCode)
      .then(setVendorsInDomain)
      .catch((err) => setVendorsError(err.message))
      .finally(() => setVendorsLoading(false))
  }, [domainCode])

  useEffect(() => {
    if (selectedIds.length < 2) {
      setCompareData(null)
      return
    }
    setCompareLoading(true)
    setCompareError(null)
    compareVendors(selectedIds)
      .then(setCompareData)
      .catch((err) => setCompareError(err.message))
      .finally(() => setCompareLoading(false))
  }, [selectedIds])

  const selectedVendorMeta = useMemo(
    () => selectedIds.map((id) => vendorsInDomain.find((v) => v.id === id)).filter(Boolean),
    [selectedIds, vendorsInDomain]
  )

  const availableToAdd = vendorsInDomain.filter((v) => !selectedIds.includes(v.id))

  function addVendor(id) {
    setSelectedIds([...selectedIds, Number(id)])
    setAddVendorOpen(false)
  }

  function removeVendor(id) {
    setSelectedIds(selectedIds.filter((sid) => sid !== id))
  }

  const useCaseRows = useMemo(() => {
    if (!compareData || compareData.vendors.length === 0) return []
    const first = compareData.vendors[0].mapping
    return first.map((item) => {
      const perVendor = compareData.vendors.map((v) =>
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
  }, [compareData])

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
                {domains.map((d) => (
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
          {selectedVendorMeta.map((v) => (
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
        {vendorsLoading && <p className="field-hint" style={{ marginTop: 8 }}>Loading vendors…</p>}
        {vendorsError && (
          <p className="field-hint" style={{ marginTop: 8, color: '#b91c1c' }}>
            {vendorsError}
          </p>
        )}
        {!vendorsLoading && !vendorsError && vendorsInDomain.length === 0 && (
          <p className="field-hint" style={{ marginTop: 8 }}>
            No evaluated vendors in this domain yet.
          </p>
        )}
      </div>

      {selectedIds.length < 2 ? (
        <div className="card" style={{ marginTop: 24 }}>
          <p className="empty-state">Select at least 2 vendors to compare.</p>
        </div>
      ) : compareError ? (
        <div className="card" style={{ marginTop: 24, color: '#b91c1c' }}>
          {compareError}
        </div>
      ) : compareLoading || !compareData ? (
        <div className="card" style={{ marginTop: 24 }}>
          <p className="empty-state">Loading comparison…</p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 24 }}>
          <ScrollBox maxHeight={420} wrapClassName="results-table-scroll">
            <table className="results-table compare-table">
              <thead>
                <tr>
                  <th>Use Case</th>
                  {compareData.vendors.map((v) => (
                    <th key={v.id}>{v.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {useCaseRows.map((row) => (
                  <tr key={row.code} className={row.differs ? 'row-diff' : ''}>
                    <td>{row.name}</td>
                    {row.perVendor.map((m, idx) => (
                      <td key={compareData.vendors[idx].id}>
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
