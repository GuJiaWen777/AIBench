import { useState } from 'react'
import type { BackupPreview, RestoreOptions } from '@shared/types'
import Modal from './Modal'

interface Props {
  preview: BackupPreview
  busy: boolean
  onClose: () => void
  onConfirm: (options: RestoreOptions) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatTime(iso: string): string {
  if (!iso) return '未知'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('zh-CN')
}

export default function RestorePreviewDialog({
  preview,
  busy,
  onClose,
  onConfirm
}: Props): React.ReactElement {
  const { manifest } = preview
  const [restoreConfig, setRestoreConfig] = useState(preview.hasConfig)
  const [restoreSkills, setRestoreSkills] = useState(manifest.includeSkills)
  const [overwriteSkills, setOverwriteSkills] = useState(false)

  return (
    <Modal
      open
      title="从备份恢复"
      onClose={onClose}
      panelClassName="max-w-xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={() => onConfirm({ restoreConfig, restoreSkills, overwriteSkills })}
          >
            {busy ? '恢复中…' : '开始恢复'}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
          <dt className="text-slate-500 dark:text-slate-400">备份文件</dt>
          <dd className="break-all font-mono text-xs">{preview.path}</dd>
          <dt className="text-slate-500 dark:text-slate-400">导出时间</dt>
          <dd>{formatTime(manifest.createdAt)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">App 版本</dt>
          <dd>{manifest.appVersion || '未知'}</dd>
          <dt className="text-slate-500 dark:text-slate-400">文件大小</dt>
          <dd>{formatBytes(preview.size)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">Prompt</dt>
          <dd>
            {manifest.counts.prompts} 条 · 分类 {manifest.counts.categories} 个 · 历史版本{' '}
            {manifest.counts.revisions} 条
          </dd>
          <dt className="text-slate-500 dark:text-slate-400">归档 Skill</dt>
          <dd>{manifest.counts.archivedSkills} 个</dd>
          <dt className="text-slate-500 dark:text-slate-400">已安装 Skill</dt>
          <dd>
            {manifest.includeSkills ? `${manifest.counts.skills} 个` : '未包含在备份中'}
          </dd>
        </dl>

        <div className="space-y-3 rounded-md border border-slate-300 p-3 dark:border-slate-800">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={restoreConfig}
              disabled={!preview.hasConfig || busy}
              onChange={(event) => setRestoreConfig(event.target.checked)}
            />
            <span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                同时恢复设置
              </span>
              <span className="block text-slate-500 dark:text-slate-400">
                Framework 路径、归档与导出目录、主题
                {!preview.hasConfig && '（备份中不含设置）'}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={restoreSkills}
              disabled={!manifest.includeSkills || busy}
              onChange={(event) => setRestoreSkills(event.target.checked)}
            />
            <span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                恢复已安装 Skill
              </span>
              <span className="block text-slate-500 dark:text-slate-400">
                写入当前设置中的 Framework 目录
                {!manifest.includeSkills && '（备份中不含 Skill）'}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={overwriteSkills}
              disabled={!restoreSkills || !manifest.includeSkills || busy}
              onChange={(event) => setOverwriteSkills(event.target.checked)}
            />
            <span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                覆盖已存在的 Skill
              </span>
              <span className="block text-slate-500 dark:text-slate-400">
                关闭时跳过目标目录中已有的同名 Skill
              </span>
            </span>
          </label>
        </div>

        <p className="text-slate-500 dark:text-slate-400">
          恢复会覆盖当前 Prompt 数据库和归档内容。开始前会自动把当前数据快照保存到数据目录下的
          <span className="font-mono text-xs"> restore-safety/</span>，恢复失败时也会保留。
        </p>
      </div>
    </Modal>
  )
}
