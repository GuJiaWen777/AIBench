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
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`modal-panel flex max-h-[90vh] w-full flex-col overflow-hidden ${panelClassName}`}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-300 pb-3 dark:border-slate-800">
          <h2 className="min-w-0 truncate text-lg font-semibold text-slate-950 dark:text-white">
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button type="button" className="btn-secondary" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-300 pt-4 dark:border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
