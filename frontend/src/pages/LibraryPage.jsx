import { useEffect, useMemo, useRef, useState } from 'react'
import { mockDomains, mockMasterLibrary, mockPendingUseCases } from '../mock/data.js'
import ScrollBox from '../components/ScrollBox.jsx'

const PAGE_SIZE = 6

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState('master')
  const [masterList, setMasterList] = useState(mockMasterLibrary)
  const [pendingList, setPendingList] = useState(mockPendingUseCases)

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

  const filteredMaster = useMemo(() => {
    return masterList.filter((uc) => {
      const matchesDomain = domainFilter === 'ALL' || uc.domain_code === domainFilter
      const matchesSearch =
        search.trim() === '' ||
        uc.name.toLowerCase().includes(search.toLowerCase()) ||
        uc.code.toLowerCase().includes(search.toLowerCase())
      return matchesDomain && matchesSearch
    })
  }, [masterList, search, domainFilter])

  useEffect(() => {
    setPage(1)
  }, [search, domainFilter])

  const totalPages = Math.max(1, Math.ceil(filteredMaster.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const paginatedMaster = filteredMaster.slice(pageStart, pageStart + PAGE_SIZE)

  const filteredPending = useMemo(() => {
    return pendingList.filter((uc) => {
      const matchesDomain = pendingDomainFilter === 'ALL' || uc.domain_code === pendingDomainFilter
      const matchesSearch =
        pendingSearch.trim() === '' ||
        uc.suggested_name.toLowerCase().includes(pendingSearch.toLowerCase()) ||
        uc.suggested_code.toLowerCase().includes(pendingSearch.toLowerCase())
      return matchesDomain && matchesSearch
    })
  }, [pendingList, pendingSearch, pendingDomainFilter])

  function startEdit(item) {
    setEditingId(item.id)
    setEditDraft({ ...item })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  function saveEdit() {
    setPendingList((list) =>
      list.map((item) => (item.id === editDraft.id ? { ...editDraft } : item))
    )
    setEditingId(null)
    setEditDraft(null)
  }

  function approve(item) {
    const approvedItem = editingId === item.id ? editDraft : item
    setMasterList((list) => [
      ...list,
      {
        id: Date.now(),
        code: approvedItem.suggested_code,
        name: approvedItem.suggested_name,
        category: approvedItem.category,
        description: approvedItem.description,
        domain_code: approvedItem.domain_code,
        source: 'llm_approved',
      },
    ])
    setPendingList((list) => list.filter((p) => p.id !== item.id))
    if (editingId === item.id) cancelEdit()
  }

  function reject(item) {
    setPendingList((list) => list.filter((p) => p.id !== item.id))
    if (editingId === item.id) cancelEdit()
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

          <ScrollBox maxHeight={420} wrapClassName="results-table-scroll">
            <table className="results-table">
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
                {paginatedMaster.map((uc) => (
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
                {filteredMaster.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      No use cases match your search/filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollBox>

          {filteredMaster.length > 0 && (
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
                  {mockDomains.map((d) => (
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

          <ScrollBox maxHeight={420} wrapClassName="pending-list-scroll">
            <div className="pending-list">
              {filteredPending.length === 0 && (
                <p className="empty-state">No pending use cases match your search/filter.</p>
              )}
              {filteredPending.map((item) => {
                const isEditing = editingId === item.id
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
                              value={editDraft.description}
                              onChange={(e) =>
                                setEditDraft({ ...editDraft, description: e.target.value })
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
                              {mockDomains.map((d) => (
                                <option key={d.code} value={d.code}>
                                  {d.code}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="new-use-case-title">{item.suggested_name}</div>
                          <div className="new-use-case-desc">{item.description}</div>
                          <div className="field-hint">
                            Discovered on {item.discovered_pages}{' '}
                            {item.discovered_pages === 1 ? 'page' : 'pages'}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="pending-card-actions">
                      {isEditing ? (
                        <>
                          <button className="btn-secondary" onClick={saveEdit}>
                            Save
                          </button>
                          <button className="btn-secondary" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button className="btn-edit-outline" onClick={() => startEdit(item)}>
                          Edit
                        </button>
                      )}
                      <button className="btn-approve" onClick={() => approve(item)}>
                        Approve
                      </button>
                      <button className="btn-reject" onClick={() => reject(item)}>
                        Reject
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
