import { useCallback, useEffect, useState } from 'react'
import type { AppConfig, ArchiveRecord } from '@shared/types'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { showError } from '../lib/errors'

interface Props {
  config: AppConfig
  embedded?: boolean
}

export default function ArchiveView({ config, embedded = false }: Props): React.ReactElement {
  const [records, setRecords] = useState<ArchiveRecord[]>([])
  const [restoreTarget, setRestoreTarget] = useState<ArchiveRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ArchiveRecord | null>(null)
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([])

  const load = useCallback(async () => {
    try {
      setRecords(await window.aibench.archive.list())
    } catch (error) {
      showError(error, '读取归档失败')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleFramework = (id: string): void => {
    setSelectedFrameworks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const doRestore = async (overwrite = false): Promise<void> => {
    if (!restoreTarget || selectedFrameworks.length === 0) return
    try {
      const result = await window.aibench.archive.restore(
        restoreTarget.id,
        selectedFrameworks,
        overwrite
      )
      if (result.conflicts.length > 0) {
        const names = result.conflicts.map((conflict) => `「${conflict.dirName}」`).join('、')
        if (confirm(`${names} 已存在，是否覆盖？`)) await doRestore(true)
        return
      }
      setRestoreTarget(null)
      setSelectedFrameworks([])
      await load()
    } catch (error) {
      showError(error, '恢复 Skill 失败')
    }
  }

  const doDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await window.aibench.archive.deletePermanent(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (error) {
      showError(error, '彻底删除失败')
    }
  }

  return (
    <div className="flex h-full flex-col">
      {!embedded && (
        <header className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-xl font-semibold">归档</h2>
          <p className="mt-1 text-sm text-slate-500">已移除的 Skill，可恢复或彻底删除</p>
        </header>
      )}
      <div className={`flex-1 overflow-y-auto ${embedded ? 'p-0' : 'p-6'}`}>
        {records.length === 0 ? (
          <p className="text-slate-500">归档为空</p>
        ) : (
          <div className="space-y-3">
            {records.map((r) => (
              <div key={r.id} className="card flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{r.meta.name || r.dirName}</div>
                  <div className="mt-1 text-xs text-slate-500">{r.dirName}</div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    来源：{r.removedFrom}
                  </p>
                  <p className="text-sm text-slate-500">原路径：{r.originalPath || '—'}</p>
                  <p className="text-sm text-slate-500">
                    移除时间：{new Date(r.removedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setRestoreTarget(r)
                      setSelectedFrameworks([])
                    }}
                  >
                    恢复
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => setDeleteTarget(r)}
                  >
                    彻底删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {restoreTarget && (
        <Modal
          open
          title={`恢复 — ${restoreTarget.meta.name || restoreTarget.dirName}`}
          onClose={() => setRestoreTarget(null)}
          footer={
            <button
              type="button"
              className="btn-primary"
              disabled={selectedFrameworks.length === 0}
              onClick={() => void doRestore()}
            >
              恢复到所选 Framework
            </button>
          }
        >
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">选择要恢复到的 Framework：</p>
          <div className="space-y-2">
            {config.frameworks.map((fw) => (
              <label key={fw.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedFrameworks.includes(fw.id)}
                  onChange={() => toggleFramework(fw.id)}
                />
                {fw.name}
              </label>
            ))}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`确定彻底删除「${deleteTarget.meta.name || deleteTarget.dirName}」吗？此操作不可恢复。`}
          confirmLabel="彻底删除"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void doDelete()}
        />
      )}
    </div>
  )
}
