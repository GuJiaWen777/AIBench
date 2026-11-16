import { useEffect, useId, useRef } from 'react'
import { isTopModal, popModal, pushModal } from '../lib/modal-stack'

interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  danger?: boolean
}

export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel = '确认',
  danger
}: Props): React.ReactElement {
  const titleId = useId()
  const tokenRef = useRef(Symbol('confirm'))
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    const token = tokenRef.current
    pushModal(token)
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isTopModal(token)) {
        event.preventDefault()
        onCancelRef.current()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      popModal(token)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div
      className="modal-overlay modal-overlay-top"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-panel w-full max-w-sm"
      >
        <p id={titleId} className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
