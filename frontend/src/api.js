import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

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
