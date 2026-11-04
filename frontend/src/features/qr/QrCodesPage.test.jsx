import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QrCodesPage } from './QrCodesPage.jsx'

const QR_CODE = { id: 4, identifier: 'stable-identifier', name: 'Carta terraza', target_path: '/carta', is_active: true }

function service(overrides = {}) {
  return { listQrCodes: vi.fn().mockResolvedValue([QR_CODE]), createQrCode: vi.fn(), updateQrCode: vi.fn(), fetchQrCodeFile: vi.fn().mockResolvedValue(new Blob(['<svg/>'], { type: 'image/svg+xml' })), ...overrides }
}

describe('QrCodesPage', () => {
  it('lists stable public URLs and keeps the identifier out of the editable payload', async () => {
    const updateQrCode = vi.fn().mockResolvedValue({ ...QR_CODE, name: 'Carta salón', is_active: false })
    render(<QrCodesPage qrCodesService={service({ updateQrCode })} siteUrl="https://public.example" />)
    const table = await screen.findByRole('table', { name: 'Códigos QR registrados' })
    expect(within(table).getByText('https://public.example/q/stable-identifier/')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Editar código QR Carta terraza' }))
    expect(screen.getByText('El identificador público es permanente y no se puede modificar.')).toBeTruthy()
    expect(screen.queryByLabelText(/identificador/i)).toBeNull()
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Carta salón' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Código QR activo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(updateQrCode).toHaveBeenCalledWith(4, { name: 'Carta salón', target_path: '/carta', is_active: false }))
  })

  it('creates a QR code and maps backend validation errors without losing entered values', async () => {
    const createQrCode = vi.fn().mockRejectedValue({ response: { status: 400, data: { name: ['Already exists.'] } } })
    render(<QrCodesPage qrCodesService={service({ listQrCodes: vi.fn().mockResolvedValue([]), createQrCode })} />)
    await screen.findByText(/Todavía no hay códigos QR/)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo código QR' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Carta terraza' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear código QR' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    const nameInput = screen.getByLabelText('Nombre')
    expect(nameInput.value).toBe('Carta terraza')
    expect(nameInput.getAttribute('aria-describedby')).toBe('qr-name-error')
    expect(document.getElementById('qr-name-error').textContent).toBe('Already exists.')
    expect(screen.getByRole('alert').textContent).toContain('Revisá los datos del formulario.')
    expect(document.activeElement).toBe(nameInput)
  })

  it('associates client-side errors with their inputs and focuses the first invalid field', async () => {
    render(<QrCodesPage qrCodesService={service({ listQrCodes: vi.fn().mockResolvedValue([]) })} />)
    await screen.findByText(/Todavía no hay códigos QR/)

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo código QR' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear código QR' }))

    const nameInput = screen.getByLabelText('Nombre')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(nameInput.getAttribute('aria-describedby')).toBe('qr-name-error')
    expect(document.getElementById('qr-name-error').textContent).toBe('Ingresá un nombre para el código QR.')
    expect(screen.getByRole('alert').textContent).toContain('Revisá los datos del formulario.')
    expect(document.activeElement).toBe(nameInput)
  })

  it('previews the protected SVG as an image and downloads SVG/PNG blobs', async () => {
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const createObjectURL = vi.fn()
      .mockReturnValueOnce('blob:qr-preview')
      .mockReturnValueOnce('blob:qr-svg')
      .mockReturnValueOnce('blob:qr-png')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const qrCodesService = service()
    render(<QrCodesPage qrCodesService={qrCodesService} />)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa de Carta terraza' }))
    expect((await screen.findByRole('img', { name: 'Código QR para Carta terraza' })).getAttribute('src')).toBe('blob:qr-preview')
    fireEvent.click(screen.getByRole('button', { name: 'Descargar SVG' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PNG' }))
    await waitFor(() => expect(qrCodesService.fetchQrCodeFile).toHaveBeenCalledWith(4, 'png'))
    expect(click).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:qr-preview')
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    click.mockRestore()
  })

  it('copies the configured stable URL and reports load and permission errors safely', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const { rerender } = render(<QrCodesPage qrCodesService={service()} siteUrl="https://public.example" />)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar URL de Carta terraza' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://public.example/q/stable-identifier/'))
    rerender(<QrCodesPage qrCodesService={service({ listQrCodes: vi.fn().mockRejectedValue({ response: { status: 403 } }) })} />)
    expect((await screen.findByRole('alert')).textContent).toContain('No tenés permisos para administrar códigos QR.')
  })
})
