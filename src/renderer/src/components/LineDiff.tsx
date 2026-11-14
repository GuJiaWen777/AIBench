import type { TextDiffLine } from '@shared/text-diff'

const MAX_RENDERED_LINES = 3000

interface Props {
  lines: TextDiffLine[]
  emptyLabel?: string
}

export default function LineDiff({ lines, emptyLabel = '没有差异' }: Props): React.ReactElement {
  if (lines.length === 0) {
    return <p className="p-3 text-sm text-slate-500">{emptyLabel}</p>
  }

  return (
    <div className="font-mono text-xs leading-5">
      {lines.slice(0, MAX_RENDERED_LINES).map((line, index) => (
        <div
          key={index}
          className={
            line.type === 'add'
              ? 'whitespace-pre-wrap break-all bg-emerald-50 px-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : line.type === 'del'
                ? 'whitespace-pre-wrap break-all bg-rose-50 px-2 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                : 'whitespace-pre-wrap break-all px-2 text-slate-600 dark:text-slate-300'
          }
        >
          <span className="select-none pr-2 opacity-60">
            {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
          </span>
          {line.text || ' '}
        </div>
      ))}
      {lines.length > MAX_RENDERED_LINES && (
        <p className="px-2 py-2 text-slate-500">仅显示前 {MAX_RENDERED_LINES} 行…</p>
      )}
    </div>
  )
}
