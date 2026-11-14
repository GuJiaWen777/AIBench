import { useEffect, useMemo, useState } from 'react'
import type { PromptItem, PromptRevision } from '@shared/types'
import { diffLines } from '@shared/text-diff'
import Modal from './Modal'
import LineDiff from './LineDiff'
import { showError } from '../lib/errors'

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

interface Props {
  promptId: string
  current: PromptItem
  onClose: () => void
  onRestored: (prompt: PromptItem) => void
}

export default function RevisionHistory({
  promptId,
  current,
  onClose,
  onRestored
}: Props): React.ReactElement {
  const [revisions, setRevisions] = useState<PromptRevision[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showDiff, setShowDiff] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.aibench.prompts
      .listRevisions(promptId)
      .then((items) => {
        if (cancelled) return
        setRevisions(items)
        setSelectedId(items[0]?.id ?? null)
      })
      .catch((error) => showError(error, '读取历史版本失败'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [promptId])

  const selected = revisions.find((revision) => revision.id === selectedId) ?? null
  const diff = useMemo(
    () => (selected ? diffLines(selected.body, current.body) : []),
    [selected, current.body]
  )

  const restore = async (): Promise<void> => {
    if (!selected) return
    if (!confirm(`恢复到 ${formatTime(selected.createdAt)} 的版本？当前未保存的修改会丢失。`)) {
      return
    }
    try {
      const restored = await window.aibench.prompts.restoreRevision(promptId, selected.id)
      onRestored(restored)
      onClose()
    } catch (error) {
      showError(error, '恢复历史版本失败')
    }
  }

  return (
    <Modal
      open
      title="历史版本"
      onClose={onClose}
      panelClassName="max-w-5xl"
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            disabled={!selected}
            onClick={() => setShowDiff((value) => !value)}
          >
            {showDiff ? '查看全文' : '对比当前'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!selected}
            onClick={() => void restore()}
          >
            恢复此版本
          </button>
        </>
      }
    >
      <div className="grid min-h-[460px] gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-1 overflow-y-auto">
          {loading ? (
            <p className="p-2 text-sm text-slate-500">加载中…</p>
          ) : revisions.length === 0 ? (
            <p className="p-2 text-sm text-slate-500">
              还没有历史版本。之后每次保存都会留下上一版内容。
            </p>
          ) : (
            revisions.map((revision) => (
              <button
                key={revision.id}
                type="button"
                className={selectedId === revision.id ? 'side-filter-active' : 'side-filter'}
                onClick={() => setSelectedId(revision.id)}
              >
                <span className="truncate">{revision.title || '无标题'}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {formatTime(revision.createdAt)}
                </span>
              </button>
            ))
          )}
        </aside>
        <div className="min-h-0 overflow-auto rounded-md border border-slate-300 dark:border-slate-800">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 px-3 py-2 text-xs dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatTime(selected.createdAt)} 保存前的内容
                </span>
                <span className="text-slate-500">
                  {selected.tags.length > 0 ? selected.tags.join(' · ') : '未分类'}
                </span>
              </div>
              {showDiff ? (
                <LineDiff lines={diff} emptyLabel="与当前编辑内容一致" />
              ) : (
                <pre className="whitespace-pre-wrap break-all p-3 font-mono text-xs leading-5 text-slate-700 dark:text-slate-200">
                  {selected.body || '（空）'}
                </pre>
              )}
            </>
          ) : (
            <p className="p-3 text-sm text-slate-500">选择一个版本查看内容。</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
