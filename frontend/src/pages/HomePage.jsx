import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockDomains, mockEvaluateResponse } from '../mock/data.js'

export default function HomePage() {
  const navigate = useNavigate()
  const [vendorName, setVendorName] = useState('')
  const [domainCode, setDomainCode] = useState('IGA')
  const [inputType, setInputType] = useState('url')
  const [inputValue, setInputValue] = useState('')
  const [loadingStage, setLoadingStage] = useState(null) // null | 'crawling' | 'evaluating'
  const [domainOpen, setDomainOpen] = useState(false)
  const domainRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (domainRef.current && !domainRef.current.contains(e.target)) {
        setDomainOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    if (!vendorName.trim() || !inputValue.trim()) return

    setLoadingStage('crawling')

    setTimeout(() => {
      setLoadingStage('evaluating')

      setTimeout(() => {
        navigate('/results', {
          state: {
            result: {
              ...mockEvaluateResponse,
              vendor: {
                ...mockEvaluateResponse.vendor,
                name: vendorName,
                domain_code: domainCode,
                input_type: inputType,
              },
            },
          },
        })
      }, 1500)
    }, 1500)
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
