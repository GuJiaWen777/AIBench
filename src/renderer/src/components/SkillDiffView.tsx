import { useMemo, useState } from 'react'
import type { SkillDiff, SkillFileStatus } from '@shared/types'
import { diffLines } from '@shared/text-diff'
import Modal from './Modal'
import LineDiff from './LineDiff'

const STATUS_LABEL: Record<SkillFileStatus, string> = {
  same: '一致',
  modified: '已修改',
  onlyA: '仅当前',
  onlyB: '仅目标'
}

const STATUS_CLASS: Record<SkillFileStatus, string> = {
  same: 'text-slate-500',
  modified: 'text-amber-600 dark:text-amber-300',
  onlyA: 'text-rose-600 dark:text-rose-300',
  onlyB: 'text-emerald-600 dark:text-emerald-300'
}

interface Props {
  diff: SkillDiff
  onClose: () => void
}

export default function SkillDiffView({ diff, onClose }: Props): React.ReactElement {
  const [selectedPath, setSelectedPath] = useState<string | null>(
    () => diff.files.find((file) => file.status !== 'same')?.path ?? diff.files[0]?.path ?? null
  )

  const selected = diff.files.find((file) => file.path === selectedPath) ?? null
  const lines = useMemo(() => {
    if (!selected || selected.binary) return []
    return diffLines(selected.aContent ?? '', selected.bContent ?? '')
  }, [selected])

  return (
    <Modal
      open
      title={`差异 — ${diff.dirName}`}
      onClose={onClose}
      panelClassName="max-w-6xl"
      footer={
        <button type="button" className="btn-primary" onClick={onClose}>
          关闭
        </button>
      }
    >
      <div className="grid min-h-[460px] gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-1 overflow-y-auto">
          <div className="meta-line px-2">当前：{diff.a.frameworkName}</div>
          <div className="meta-line px-2 pb-2">目标：{diff.b.frameworkName}</div>
          {diff.files.map((file) => (
            <button
              key={file.path}
              type="button"
              className={selectedPath === file.path ? 'side-filter-active' : 'side-filter'}
              onClick={() => setSelectedPath(file.path)}
            >
              <span className="truncate font-mono text-xs">{file.path}</span>
              <span className={`shrink-0 text-xs font-semibold ${STATUS_CLASS[file.status]}`}>
                {STATUS_LABEL[file.status]}
              </span>
            </button>
          ))}
        </aside>
        <div className="min-h-0 overflow-auto rounded-xl border border-slate-300 dark:border-slate-800">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 px-3 py-2 text-xs dark:border-slate-800">
                <span className="truncate font-mono">{selected.path}</span>
                <span className="text-slate-500">
                  {selected.aSize} B → {selected.bSize} B
                </span>
              </div>
              {selected.binary || (selected.aContent === null && selected.bContent === null) ? (
                <p className="p-3 text-sm text-slate-500">二进制或过大文件，无法预览差异。</p>
              ) : (
                <LineDiff lines={lines} emptyLabel="文件内容一致" />
              )}
            </>
          ) : (
            <p className="p-3 text-sm text-slate-500">没有可比较的文件</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
