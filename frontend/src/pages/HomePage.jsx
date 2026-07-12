/**
 * Landing page: form to submit a vendor (by URL or pasted text) for
 * evaluation against an IAM domain's use case library, then navigates to
 * ResultsPage with the API response.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDomains, evaluateVendor } from '../api.js'

export default function HomePage() {
  const navigate = useNavigate()
  const [vendorName, setVendorName] = useState('')
  const [domainCode, setDomainCode] = useState('IGA')
  const [inputType, setInputType] = useState('url')
  const [inputValue, setInputValue] = useState('')
  const [loadingStage, setLoadingStage] = useState(null) // null | 'crawling' | 'evaluating' — drives the two-step loading message below
  const [domainOpen, setDomainOpen] = useState(false)
  const domainRef = useRef(null)

  const [domains, setDomains] = useState([])
  const [domainsError, setDomainsError] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (domainRef.current && !domainRef.current.contains(e.target)) {
        setDomainOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load available IAM domains for the dropdown on mount.
  useEffect(() => {
    getDomains()
      .then((data) => setDomains(data))
      .catch((err) => setDomainsError(err.message))
  }, [])

  /**
   * - Validates the form, then calls POST /evaluate (crawl + Groq mapping).
   * - For URL input, shows "Crawling…" first and flips to "Evaluating…"
   *   after 4s (a rough estimate — the crawl and LLM call are actually one
   *   sequential request) so the user isn't staring at one static message.
   * - On success, navigates to /results passing the API result via router state.
   */
  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    if (!vendorName.trim() || !inputValue.trim()) {
      setSubmitError('Vendor name and content are both required.')
      return
    }

    setLoadingStage(inputType === 'url' ? 'crawling' : 'evaluating')

    let stageTimer = null
    if (inputType === 'url') {
      stageTimer = setTimeout(() => setLoadingStage('evaluating'), 4000)
    }

    try {
      const result = await evaluateVendor({
        vendor_name: vendorName,
        input_type: inputType,
        input_value: inputValue,
        domain_code: domainCode,
      })
      navigate('/results', { state: { result } })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      if (stageTimer) clearTimeout(stageTimer)
      setLoadingStage(null)
    }
  }

  return (
    <div>
      <h1>Evaluate a Vendor</h1>
      <p className="page-subtitle">
        Provide vendor information and content to evaluate IAM use case coverage.
      </p>

      <div className="home-grid">
        <form className="card" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="vendorName">Vendor Name</label>
            <input
              id="vendorName"
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="SailPoint Technologies"
            />
          </div>

          <div className="form-group" ref={domainRef}>
            <label htmlFor="domainCode">IAM Domain</label>
            <div className="dropdown">
              <button
                type="button"
                id="domainCode"
                className="dropdown-trigger"
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
            {domainsError && (
              <span className="field-hint" style={{ color: '#b91c1c' }}>
                Failed to load domains: {domainsError}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>Content Source</label>
            <div className="toggle-group">
              <button
                type="button"
                className={'toggle-btn' + (inputType === 'url' ? ' toggle-btn-active' : '')}
                onClick={() => setInputType('url')}
              >
                Website URL
              </button>
              <button
                type="button"
                className={'toggle-btn' + (inputType === 'text' ? ' toggle-btn-active' : '')}
                onClick={() => setInputType('text')}
              >
                Paste Text
              </button>
            </div>
          </div>

          {inputType === 'url' ? (
            <div className="form-group">
              <label htmlFor="inputValue">Website URL</label>
              <input
                id="inputValue"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="https://www.sailpoint.com/"
              />
              <span className="field-hint">Enter the vendor website URL to crawl for content.</span>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="inputValue">Paste Text</label>
              <textarea
                id="inputValue"
                rows={6}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Paste vendor product description or documentation here..."
              />
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loadingStage !== null}>
            Evaluate
          </button>

          {submitError && (
            <div className="field-hint" style={{ color: '#b91c1c', marginTop: '0.5rem' }}>
              {submitError}
            </div>
          )}

          {loadingStage && (
            <div className="loading-box">
              <span className="spinner" />
              <div>
                <div className="loading-title">
                  {loadingStage === 'crawling'
                    ? 'Crawling vendor site…'
                    : 'Evaluating capabilities…'}
                </div>
                <div className="loading-subtitle">This may take a few moments.</div>
              </div>
            </div>
          )}
        </form>

        <div className="card home-illustration">
          <span className="home-illustration-icon">🔍</span>
          <p>
            We'll crawl the website and analyze content to identify IAM use cases covered
            by the vendor.
          </p>
        </div>
      </div>
    </div>
  )
}