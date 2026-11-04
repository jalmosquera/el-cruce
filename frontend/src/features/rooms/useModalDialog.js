import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(dialog) {
  return Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  )
}

export function useModalDialog({ isOpen, isLocked = false, onClose, initialFocusRef }) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const isLockedRef = useRef(isLocked)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    isLockedRef.current = isLocked
  }, [isLocked])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    const initialFocusTarget = initialFocusRef?.current ?? getFocusableElements(dialog)[0]
    initialFocusTarget?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()

        if (isLockedRef.current) {
          return
        }

        onCloseRef.current?.()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = getFocusableElements(dialog)

      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    dialog.addEventListener('keydown', handleKeyDown)

    return () => {
      dialog.removeEventListener('keydown', handleKeyDown)
    }
  }, [initialFocusRef, isOpen])

  return dialogRef
}
