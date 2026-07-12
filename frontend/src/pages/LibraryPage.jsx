import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getDomains,
  getUseCases,
  getPendingUseCases,
  updatePendingUseCase,
  approvePendingUseCase,
  rejectPendingUseCase,
} from '../api.js'
import ScrollBox from '../components/ScrollBox.jsx'

const PAGE_SIZE = 6

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState('master')
  const [domains, setDomains] = useState([])

  const [masterList, setMasterList] = useState([])
  const [masterLoading, setMasterLoading] = useState(true)
  const [masterError, setMasterError] = useState(null)

  const [pendingList, setPendingList] = useState([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingError, setPendingError] = useState(null)
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState('ALL')
  const [domainFilterOpen, setDomainFilterOpen] = useState(false)
  const domainFilterRef = useRef(null)
  const [page, setPage] = useState(1)

  const [pendingSearch, setPendingSearch] = useState('')
  const [pendingDomainFilter, setPendingDomainFilter] = useState('ALL')
  const [pendingDomainFilterOpen, setPendingDomainFilterOpen] = useState(false)
  const pendingDomainFilterRef = useRef(null)

  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (domainFilterRef.current && !domainFilterRef.current.contains(e.target)) {
        setDomainFilterOpen(false)
      }
      if (pendingDomainFilterRef.current && !pendingDomainFilterRef.current.contains(e.target)) {
        setPendingDomainFilterOpen(false)
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

  async function loadMaster() {
    setMasterLoading(true)
    setMasterError(null)
    try {
      if (domainFilter === 'ALL') {
        const results = await Promise.all(
          domains.map((d) =>
            getUseCases(d.code).then((items) => items.map((i) => ({ ...i, domain_code: d.code })))
          )
        )
        setMasterList(results.flat())
      } else {
        const items = await getUseCases(domainFilter)
        setMasterList(items.map((i) => ({ ...i, domain_code: domainFilter })))
      }
    } catch (err) {
      setMasterError(err.message)
    } finally {
      setMasterLoading(false)
    }
  }

  async function loadPending() {
    setPendingLoading(true)
    setPendingError(null)
    try {
      const items = await getPendingUseCases(pendingDomainFilter === 'ALL' ? undefined : pendingDomainFilter)
      setPendingList(items)
    } catch (err) {
      setPendingError(err.message)
    } finally {
      setPendingLoading(false)
    }
  }

  useEffect(() => {
    if (domains.length === 0 && domainFilter === 'ALL') return
    loadMaster()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainFilter, domains])

  useEffect(() => {
    loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDomainFilter])

  const filteredMaster = useMemo(() => {
    return masterList.filter((uc) => {
      const matchesSearch =
        search.trim() === '' ||
        uc.name.toLowerCase().includes(search.toLowerCase()) ||
        uc.code.toLowerCase().includes(search.toLowerCase())
      return matchesSearch
    })
  }, [masterList, search])

  useEffect(() => {
    setPage(1)
  }, [search, domainFilter])

  const totalPages = Math.max(1, Math.ceil(filteredMaster.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const paginatedMaster = filteredMaster.slice(pageStart, pageStart + PAGE_SIZE)

  const filteredPending = useMemo(() => {
    return pendingList.filter((uc) => {
      const matchesSearch =
        pendingSearch.trim() === '' ||
        uc.suggested_name.toLowerCase().includes(pendingSearch.toLowerCase()) ||
        uc.suggested_code.toLowerCase().includes(pendingSearch.toLowerCase())
      return matchesSearch
    })
  }, [pendingList, pendingSearch])

  function startEdit(item) {
    setEditingId(item.id)
    setEditDraft({ ...item })
    setActionError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  async function saveEdit() {
    setActionLoadingId(editDraft.id)
    setActionError(null)
    try {
      await updatePendingUseCase(editDraft.id, {
        suggested_code: editDraft.suggested_code,
        suggested_name: editDraft.suggested_name,
        suggested_description: editDraft.suggested_description,
        domain_code: editDraft.domain_code,
      })
      setPendingList((list) =>
        list.map((item) => (item.id === editDraft.id ? { ...editDraft } : item))
      )
      setEditingId(null)
      setEditDraft(null)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  async function approve(item) {
    setActionLoadingId(item.id)
    setActionError(null)
    try {
      await approvePendingUseCase(item.id)
      setPendingList((list) => list.filter((p) => p.id !== item.id))
      if (editingId === item.id) cancelEdit()
      loadMaster()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  async function reject(item) {
    setActionLoadingId(item.id)
    setActionError(null)
    try {
      await rejectPendingUseCase(item.id)
      setPendingList((list) => list.filter((p) => p.id !== item.id))
      if (editingId === item.id) cancelEdit()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div>
      <h1>Use Case Library</h1>

      <div className="tab-row">
        <button
          className={'tab-btn' + (activeTab === 'master' ? ' tab-btn-active' : '')}
          onClick={() => setActiveTab('master')}
        >
          Master Library
        </button>
        <button
          className={'tab-btn' + (activeTab === 'pending' ? ' tab-btn-active' : '')}
          onClick={() => setActiveTab('pending')}
        >
          Pending Review {pendingList.length > 0 && `(${pendingList.length})`}
        </button>
      </div>

      {activeTab === 'master' ? (
        <div className="card">
          <div className="library-filter-row">
            <input
              type="text"
              placeholder="Search use cases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="library-search"
            />
            <div className="dropdown library-domain-dropdown" ref={domainFilterRef}>
              <button
                type="button"
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

          {masterError && (
            <p className="field-hint" style={{ color: '#b91c1c' }}>
              {masterError}
            </p>
          )}

          <ScrollBox maxHeight={420} wrapClassName="results-table-scroll">
            <table className="results-table library-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Domain</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {masterLoading && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Loading…
                    </td>
                  </tr>
                )}
                {!masterLoading &&
                  paginatedMaster.map((uc) => (
                    <tr key={uc.id}>
                      <td>{uc.code}</td>
                      <td>{uc.name}</td>
                      <td>{uc.category}</td>
                      <td className="reasoning-cell">{uc.description}</td>
                      <td>{uc.domain_code}</td>
                      <td>
                        <span
                          className={
                            uc.source === 'manual' ? 'badge-source-manual' : 'badge-source-llm'
                          }
                        >
                          {uc.source === 'manual' ? 'Manual' : 'LLM'}
                        </span>
                      </td>
                    </tr>
                  ))}
                {!masterLoading && filteredMaster.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      No use cases match your search/filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollBox>

          {!masterLoading && filteredMaster.length > 0 && (
            <div className="pagination-row">
              <span>
                Showing {pageStart + 1} to {Math.min(pageStart + PAGE_SIZE, filteredMaster.length)} of{' '}
                {filteredMaster.length} use cases
              </span>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={'pagination-btn' + (n === currentPage ? ' pagination-btn-active' : '')}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="pagination-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="library-filter-row">
            <input
              type="text"
              placeholder="Search pending use cases..."
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              className="library-search"
            />
            <div className="dropdown library-domain-dropdown" ref={pendingDomainFilterRef}>
              <button
                type="button"
                className="dropdown-trigger"
                onClick={() => setPendingDomainFilterOpen((open) => !open)}
              >
                {pendingDomainFilter === 'ALL' ? 'All Domains' : pendingDomainFilter}
                <span className="dropdown-arrow">▾</span>
              </button>
              {pendingDomainFilterOpen && (
                <ul className="dropdown-menu">
                  <li>
                    <button
                      type="button"
                      className={
                        'dropdown-option' +
                        (pendingDomainFilter === 'ALL' ? ' dropdown-option-active' : '')
                      }
                      onClick={() => {
                        setPendingDomainFilter('ALL')
                        setPendingDomainFilterOpen(false)
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
                          'dropdown-option' +
                          (d.code === pendingDomainFilter ? ' dropdown-option-active' : '')
                        }
                        onClick={() => {
                          setPendingDomainFilter(d.code)
                          setPendingDomainFilterOpen(false)
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

          {(pendingError || actionError) && (
            <p className="field-hint" style={{ color: '#b91c1c' }}>
              {pendingError || actionError}
            </p>
          )}

          <ScrollBox maxHeight={420} wrapClassName="pending-list-scroll">
            <div className="pending-list">
              {pendingLoading && <p className="empty-state">Loading…</p>}
              {!pendingLoading && filteredPending.length === 0 && (
                <p className="empty-state">No pending use cases match your search/filter.</p>
              )}
              {!pendingLoading &&
                filteredPending.map((item) => {
                  const isEditing = editingId === item.id
                  const isBusy = actionLoadingId === item.id
                  return (
                    <div className="pending-card" key={item.id}>
                      <div className="pending-icon-col">
                        <span className="icon-badge-new">🕐</span>
                        <span className="badge-new">New</span>
                      </div>

                      <div className="pending-content">
                        {isEditing ? (
                          <div className="pending-edit-form">
                            <div className="form-group">
                              <label>Code</label>
                              <input
                                value={editDraft.suggested_code}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, suggested_code: e.target.value })
                                }
                              />
                            </div>
                            <div className="form-group">
                              <label>Name</label>
                              <input
                                value={editDraft.suggested_name}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, suggested_name: e.target.value })
                                }
                              />
                            </div>
                            <div className="form-group">
                              <label>Description</label>
                              <textarea
                                rows={2}
                                value={editDraft.suggested_description}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, suggested_description: e.target.value })
                                }
                              />
                            </div>
                            <div className="form-group">
                              <label>Domain</label>
                              <select
                                value={editDraft.domain_code}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, domain_code: e.target.value })
                                }
                              >
                                {domains.map((d) => (
                                  <option key={d.code} value={d.code}>
                                    {d.code}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="new-use-case-title">
                              {item.suggested_code} — {item.suggested_name}
                              <span className="field-hint"> · {item.suggested_category} · {item.domain_code}</span>
                            </div>
                            <div className="new-use-case-desc">{item.suggested_description}</div>
                            <div className="new-use-case-reasoning">{item.llm_reasoning}</div>
                          </>
                        )}
                      </div>

                      <div className="pending-card-actions">
                        {isEditing ? (
                          <>
                            <button className="btn-secondary" onClick={saveEdit} disabled={isBusy}>
                              {isBusy ? 'Saving…' : 'Save'}
                            </button>
                            <button className="btn-secondary" onClick={cancelEdit} disabled={isBusy}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button className="btn-edit-outline" onClick={() => startEdit(item)} disabled={isBusy}>
                            Edit
                          </button>
                        )}
                        <button className="btn-approve" onClick={() => approve(item)} disabled={isBusy}>
                          {isBusy ? '…' : 'Approve'}
                        </button>
                        <button className="btn-reject" onClick={() => reject(item)} disabled={isBusy}>
                          {isBusy ? '…' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </ScrollBox>
        </div>
      )}
    </div>
  )
}
