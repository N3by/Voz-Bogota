import { useEffect } from 'react'
import './Modal.css'

export default function Modal({ isOpen, onClose, children, closeOnOverlay = true }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={closeOnOverlay ? onClose : undefined}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        {children}
      </div>
    </div>
  )
}
