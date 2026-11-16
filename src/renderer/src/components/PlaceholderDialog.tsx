import { useMemo, useState } from 'react'
import { renderPrompt } from '@shared/prompt-placeholders'
import Modal from './Modal'

interface Props {
  placeholders: string[]
  body: string
  onClose: () => void
  onConfirm: (text: string) => void
}

export default function PlaceholderDialog({
  placeholders,
  body,
  onClose,
  onConfirm
}: Props): React.ReactElement {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(placeholders.map((name) => [name, '']))
  )

  const preview = useMemo(() => renderPrompt(body, values), [body, values])

  const update = (name: string, value: string): void => {
    setValues((current) => ({ ...current, [name]: value }))
  }

  return (
    <Modal
      open
      title="填写占位符"
      onClose={onClose}
      panelClassName="max-w-3xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onConfirm(preview)}
          >
            复制
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {placeholders.map((name, index) => (
            <label key={name} className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
              {name}
              <input
                className="input mt-1"
                autoFocus={index === 0}
                placeholder={`{{${name}}}`}
                value={values[name] ?? ''}
                onChange={(event) => update(name, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    onConfirm(preview)
                  }
                }}
              />
            </label>
          ))}
        </div>

        <div>
          <div className="meta-line">预览</div>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200">
            {preview || '（空）'}
          </pre>
        </div>
      </div>
    </Modal>
  )
}
