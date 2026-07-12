/**
 * Shows the outcome of a single vendor evaluation: coverage summary,
 * per-category breakdown, the full use case mapping table, and any new
 * use cases the LLM discovered (pending human review). Reads the result
 * from router state, so it only renders after a navigation from HomePage
 * or HistoryPage's "View Results" action.
 */
import { useLocation } from 'react-router-dom'
import ScrollBox from '../components/ScrollBox.jsx'

/**
 * - Groups mapping rows by category and tallies covered vs. total per group.
 * - Returns an array (not a map) so it can be rendered directly via .map().
 */
function buildCategoryBreakdown(mapping) {
  const byCategory = {}
  for (const item of mapping) {
    if (!byCategory[item.category]) {
      byCategory[item.category] = { covered: 0, total: 0 }
    }
    byCategory[item.category].total += 1
    if (item.covered) byCategory[item.category].covered += 1
  }
  return Object.entries(byCategory).map(([category, stats]) => ({
    category,
    ...stats,
    percent: Math.round((stats.covered / stats.total) * 100),
  }))
}

// API returns confidence as a 0.0-1.0 float; display it as a rounded percentage.
function formatConfidence(confidence) {
  return confidence == null ? '—' : `${Math.round(confidence * 100)}%`
}

export default function ResultsPage() {
  const location = useLocation()
  // Populated by navigate('/results', { state: { result } }) from HomePage or HistoryPage.
  const result = location.state?.result

  if (!result) {
    return (
      <div className="card">
        <p>No results to show. Run an evaluation from the Home page first.</p>
      </div>
    )
  }

  const { vendor, mapping, new_use_cases_found: newUseCases } = result

  const coveredCount = mapping.filter((m) => m.covered).length
  const totalCount = mapping.length
  const coveredPercent = totalCount === 0 ? 0 : Math.round((coveredCount / totalCount) * 100)
  const categories = buildCategoryBreakdown(mapping)

  function handleExport() {
    alert('Export to CSV will be implemented in Phase 8.')
  }

  return (
    <div>
      <div className="results-header">
        <div>
          <h1>{vendor.name}</h1>
          <p className="page-subtitle">
            Domain: {vendor.domain_code}
            {vendor.input_type === 'url' && vendor.pages_crawled != null && (
              <> · Pages Crawled: {vendor.pages_crawled}</>
            )}
            {vendor.word_count != null && <> · Word Count: {vendor.word_count.toLocaleString()}</>}
          </p>
        </div>
        <button className="btn-primary" onClick={handleExport}>
          Export to CSV
        </button>
      </div>

      <div className="results-summary-grid">
        <div className="card summary-card">
          <div className="summary-count">
            {coveredCount}/{totalCount}
          </div>
          <div className="summary-label">Use Cases Covered</div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${coveredPercent}%` }} />
          </div>
          <div className="summary-footer">
            <span className="status-covered">{coveredPercent}% Covered</span>
            <span className="status-not-covered">{100 - coveredPercent}% Not Covered</span>
          </div>
        </div>

        <div className="card">
          <div className="summary-label" style={{ marginBottom: 12 }}>
            Category Breakdown
          </div>
          {categories.map((c) => (
            <div className="category-row" key={c.category}>
              <span className="category-name">{c.category}</span>
              <div className="progress-bar progress-bar-inline">
                <div className="progress-bar-fill" style={{ width: `${c.percent}%` }} />
              </div>
              <span className="category-stat">
                {c.covered}/{c.total} {c.percent}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <ScrollBox maxHeight={420} wrapClassName="results-table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                <th>Use Case</th>
                <th>Category</th>
                <th>Covered</th>
                <th>Confidence</th>
                <th>Reasoning</th>
              </tr>
            </thead>
            <tbody>
              {mapping.map((item) => (
                <tr key={item.use_case_code}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>
                    {item.covered ? (
                      <span className="icon-badge icon-badge-covered">✓</span>
                    ) : (
                      <span className="icon-badge icon-badge-not-covered">✕</span>
                    )}
                  </td>
                  <td>{formatConfidence(item.confidence)}</td>
                  <td className="reasoning-cell">{item.reasoning ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollBox>
      </div>

      {/* new_use_cases_found comes from the discovery pass in mapping_engine.py;
          field names (suggested_*, llm_reasoning) mirror the pending_use_cases table. */}
      {newUseCases && newUseCases.length > 0 && (
        <div className="card new-use-cases-card">
          <div className="new-use-cases-header">
            <span>New Use Cases Discovered</span>
            <span className="badge-pending">Pending Human Review</span>
          </div>
          <p className="field-hint">
            These use cases were identified in the content but are not yet in the master
            library.
          </p>
          <ScrollBox maxHeight={280} wrapClassName="new-use-cases-scroll">
            <ul className="new-use-cases-list">
              {newUseCases.map((uc) => (
                <li key={uc.suggested_code}>
                  <div className="new-use-case-title">
                    {uc.suggested_code} — {uc.suggested_name}
                  </div>
                  <div className="new-use-case-desc">{uc.suggested_description}</div>
                  <div className="new-use-case-reasoning">{uc.llm_reasoning}</div>
                </li>
              ))}
            </ul>
          </ScrollBox>
        </div>
      )}
    </div>
  )
}
