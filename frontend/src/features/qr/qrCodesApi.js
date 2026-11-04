import { apiClient } from '../../lib/apiClient.js'

const QR_CODES_PATH = '/qr-codes/'

function qrCodePath(id) {
  return `${QR_CODES_PATH}${id}/`
}

export async function listQrCodes() {
  const response = await apiClient.get(QR_CODES_PATH)
  return response.data
}

export async function createQrCode(payload) {
  const response = await apiClient.post(QR_CODES_PATH, payload)
  return response.data
}

export async function updateQrCode(id, payload) {
  const response = await apiClient.patch(qrCodePath(id), payload)
  return response.data
}

export async function fetchQrCodeFile(id, format) {
  const response = await apiClient.get(`${qrCodePath(id)}download/${format}/`, {
    responseType: 'blob',
  })
  return response.data
}
