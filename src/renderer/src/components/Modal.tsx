import { useEffect, useId, useRef } from 'react'
import { isTopModal, popModal, pushModal } from '../lib/modal-stack'
import { CloseIcon } from './icons'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  headerActions?: React.ReactNode
  panelClassName?: string
}

export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  headerActions,
  panelClassName = 'max-w-2xl'
}: Props): React.ReactElement | null {
  const titleId = useId()
  const tokenRef = useRef(Symbol('modal'))
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const token = tokenRef.current
    pushModal(token)
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isTopModal(token)) {
        event.preventDefault()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      popModal(token)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!open) return null
  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal-panel flex max-h-[90vh] w-full flex-col overflow-hidden ${panelClassName}`}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerActions}
            <button
              type="button"
              className="icon-btn"
              aria-label="关闭"
              title="关闭"
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
