import { useEffect, useState } from 'react'
import type {
  BackupInfo,
  BackupPreview,
  RestoreOptions,
  RestoreResult,
  RestoreSkip
} from '@shared/types'
import { showError } from '../lib/errors'
import Modal from './Modal'
import RestorePreviewDialog from './RestorePreviewDialog'

interface Props {
  onRestored: () => Promise<void>
}

const SKIP_LABEL: Record<RestoreSkip['reason'], string> = {
  FRAMEWORK_NOT_FOUND: 'Framework 不存在',
  TARGET_EXISTS: '目标已存在',
  MISSING_IN_BACKUP: '备份中缺少文件'
}

function skippedSummary(skipped: RestoreSkip[]): string {
  const counts = new Map<string, number>()
  for (const item of skipped) {
    const label = SKIP_LABEL[item.reason]
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, count]) => `${label} ${count}`).join('，')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function BackupRestoreSection({ onRestored }: Props): React.ReactElement {
  const [info, setInfo] = useState<BackupInfo | null>(null)
  const [includeSkills, setIncludeSkills] = useState(true)
  const [busy, setBusy] = useState<'backup' | 'inspect' | 'restore' | null>(null)
  const [preview, setPreview] = useState<BackupPreview | null>(null)
  const [result, setResult] = useState<RestoreResult | null>(null)

  useEffect(() => {
    window.aibench.backup
      .info()
      .then(setInfo)
      .catch(() => setInfo(null))
  }, [])

  const createBackup = async (): Promise<void> => {
    setBusy('backup')
    try {
      const created = await window.aibench.backup.create({ includeSkills })
      if (!created) return
      alert(`备份已保存：\n${created.path}\n\n大小：${formatBytes(created.size)}`)
    } catch (error) {
      showError(error, '导出备份失败')
    } finally {
      setBusy(null)
    }
  }

  const chooseRestore = async (): Promise<void> => {
    setBusy('inspect')
    try {
      const file = await window.aibench.backup.pick()
      if (!file) return
      setPreview(await window.aibench.backup.inspect(file))
    } catch (error) {
      showError(error, '无法读取备份文件')
    } finally {
      setBusy(null)
    }
  }

  const confirmRestore = async (options: RestoreOptions): Promise<void> => {
    if (!preview) return
    setBusy('restore')
    try {
      const restored = await window.aibench.backup.restore(preview.path, options)
      setPreview(null)
      setResult(restored)
      await onRestored()
    } catch (error) {
      showError(error, '恢复失败')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card space-y-4">
      <div>
        <h3 className="font-semibold text-slate-950 dark:text-white">备份与恢复</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          把 Prompt 数据库、设置和归档打包成一个 zip，换机器或重装后可一键还原。恢复前会自动保留当前数据快照。
        </p>
      </div>

      {info && (
        <div className="rounded-xl border border-slate-300 p-3 text-xs dark:border-slate-800">
          <span className="font-semibold text-slate-700 dark:text-slate-200">数据目录</span>
          <p className="mt-1 break-all font-mono text-slate-500 dark:text-slate-400">
            {info.dataDir}
          </p>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={includeSkills}
          disabled={busy !== null}
          onChange={(event) => setIncludeSkills(event.target.checked)}
        />
        <span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            包含已安装的 Skill 目录
          </span>
          <span className="block text-slate-500 dark:text-slate-400">
            勾选后可连 Skill 文件一起还原；内容较多时备份会更大、更慢。
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          data-testid="backup-create"
          disabled={busy !== null}
          onClick={() => void createBackup()}
        >
          {busy === 'backup' ? '导出中…' : '导出备份…'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy !== null}
          onClick={() => void chooseRestore()}
        >
          {busy === 'inspect' ? '读取中…' : '从备份恢复…'}
        </button>
      </div>

      {preview && (
        <RestorePreviewDialog
          preview={preview}
          busy={busy === 'restore'}
          onClose={() => {
            if (busy !== 'restore') setPreview(null)
          }}
          onConfirm={(options) => void confirmRestore(options)}
        />
      )}

      {result && (
        <Modal
          open
          title="恢复完成"
          onClose={() => setResult(null)}
          panelClassName="max-w-lg"
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setResult(null)}>
                稍后
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void window.aibench.app.relaunch()}
              >
                重启 App
              </button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <p className="text-slate-700 dark:text-slate-200">
              已恢复 {result.manifest.counts.prompts} 条 Prompt、
              {result.manifest.counts.categories} 个分类、
              {result.manifest.counts.revisions} 条历史版本。
            </p>
            <ul className="space-y-1 text-slate-600 dark:text-slate-300">
              <li>
                归档 Skill：
                {result.archiveRestored
                  ? `${result.manifest.counts.archivedSkills} 个已恢复`
                  : '未改动'}
              </li>
              <li>已安装 Skill：{result.skillsInstalled.length} 个已写入</li>
              {result.skillsSkipped.length > 0 && (
                <li>
                  跳过 {result.skillsSkipped.length} 个：{skippedSummary(result.skillsSkipped)}
                </li>
              )}
            </ul>
            <div className="rounded-xl border border-slate-300 p-3 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                恢复前的数据快照
              </span>
              <p className="mt-1 break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                {result.safetyBackupPath}
              </p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              建议重启 App，确保所有视图都使用恢复后的数据。
            </p>
          </div>
        </Modal>
      )}
    </section>
  )
}
