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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card w-full max-w-md"
      >
        <p id={titleId} className="text-sm leading-relaxed">
          {message}
        </p>
        <div className="mt-4 flex justify-end gap-2">
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
