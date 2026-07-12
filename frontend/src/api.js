/**
 * Axios client for the Flask backend and one function per REST endpoint.
 * baseURL is a relative '/api' path — Vite's dev server proxies it to
 * Flask on :5000 (see vite.config.js), so no absolute host is needed.
 */
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  // Generous timeout: /evaluate does a live site crawl plus a Groq LLM call,
  // both of which can take much longer than a typical API request.
  timeout: 60000,
})

// Normalizes all failures to an Error whose message is the backend's
// {"error": "..."} body when present, so callers can just read err.message.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred'
    return Promise.reject(new Error(message))
  }
)

export function getDomains() {
  return api.get('/domains').then((res) => res.data)
}

// payload: { vendor_name, input_type, input_value, domain_code }. Triggers the crawl + Groq mapping pipeline.
export function evaluateVendor(payload) {
  return api.post('/evaluate', payload).then((res) => res.data)
}

export function getVendors(domainCode) {
  return api
    .get('/vendors', { params: domainCode ? { domain: domainCode } : {} })
    .then((res) => res.data)
}

export function getVendor(vendorId) {
  return api.get(`/vendors/${vendorId}`).then((res) => res.data)
}

// ids: array of vendor ids, sent as a comma-joined string per the /compare?ids= query param.
export function compareVendors(ids) {
  return api.get('/compare', { params: { ids: ids.join(',') } }).then((res) => res.data)
}

export function getUseCases(domainCode) {
  return api
    .get('/use-cases', { params: { domain: domainCode } })
    .then((res) => res.data)
}

export function getPendingUseCases(domainCode) {
  return api
    .get('/pending-use-cases', { params: domainCode ? { domain: domainCode } : {} })
    .then((res) => res.data)
}

// fields: partial update, e.g. { suggested_code, suggested_name, suggested_description, domain_code }.
export function updatePendingUseCase(id, fields) {
  return api.patch(`/pending-use-cases/${id}`, fields).then((res) => res.data)
}

export function approvePendingUseCase(id) {
  return api.post(`/pending-use-cases/${id}/approve`).then((res) => res.data)
}

export function rejectPendingUseCase(id) {
  return api.post(`/pending-use-cases/${id}/reject`).then((res) => res.data)
}

export default api
