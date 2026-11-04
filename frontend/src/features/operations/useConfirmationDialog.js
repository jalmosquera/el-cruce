import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useConfirmationDialog({ dialogRef, initialFocusRef, isDeleting, isOpen, triggerElement, onClose }) {
  const isDeletingRef = useRef(isDeleting)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    isDeletingRef.current = isDeleting
  }, [isDeleting])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (isOpen && isDeleting) dialogRef.current?.focus()
  }, [dialogRef, isDeleting, isOpen])

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return undefined

    const dialog = dialogRef.current
    const backgroundElements = Array.from(document.body.children).filter((element) => !element.contains(dialog))
    const backgroundState = backgroundElements.map((element) => ({
      element,
      hadInertAttribute: element.hasAttribute('inert'),
      inert: element.inert,
    }))

    backgroundElements.forEach((element) => {
      element.inert = true
      element.setAttribute('inert', '')
    })
    initialFocusRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isDeletingRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusableElements = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
      if (!focusableElements.length) {
        event.preventDefault()
        return
      }
      const first = focusableElements[0]
      const last = focusableElements.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      backgroundState.forEach(({ element, hadInertAttribute, inert }) => {
        element.inert = inert
        if (!hadInertAttribute) element.removeAttribute('inert')
      })
      if (triggerElement?.isConnected) triggerElement.focus()
    }
  }, [dialogRef, initialFocusRef, isOpen, triggerElement])
}
