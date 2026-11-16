import { useState } from 'react'
import type { AppConfig, GithubPreview } from '@shared/types'
import { formatError } from '../lib/errors'
import Modal from './Modal'

interface Props {
  config: AppConfig
  defaultFrameworkId: string
  onClose: () => void
  onInstalled: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function GithubInstallDialog({
  config,
  defaultFrameworkId,
  onClose,
  onInstalled
}: Props): React.ReactElement {
  const initialFramework =
    defaultFrameworkId !== 'all' ? defaultFrameworkId : config.frameworks[0]?.id ?? ''

  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<GithubPreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [frameworkIds, setFrameworkIds] = useState<Set<string>>(
    () => new Set(initialFramework ? [initialFramework] : [])
  )
  const [inspecting, setInspecting] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancelSession = (): void => {
    if (preview) void window.aibench.marketplace.cancelGithub(preview.sessionId)
  }

  const close = (): void => {
    cancelSession()
    onClose()
  }

  const inspect = async (): Promise<void> => {
    if (!url.trim() || inspecting) return
    cancelSession()
    setPreview(null)
    setSelected(new Set())
    setError(null)
    setInspecting(true)
    try {
      const next = await window.aibench.marketplace.inspectGithub(url)
      setPreview(next)
      setSelected(new Set(next.skills.map((skill) => skill.dirName)))
    } catch (err) {
      setError(formatError(err, '读取仓库失败'))
    } finally {
      setInspecting(false)
    }
  }

  const toggleSkill = (dirName: string): void => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(dirName)) next.delete(dirName)
      else next.add(dirName)
      return next
    })
  }

  const toggleAll = (): void => {
    if (!preview) return
    setSelected((current) =>
      current.size === preview.skills.length
        ? new Set()
        : new Set(preview.skills.map((skill) => skill.dirName))
    )
  }

  const toggleFramework = (frameworkId: string): void => {
    setFrameworkIds((current) => {
      const next = new Set(current)
      if (next.has(frameworkId)) next.delete(frameworkId)
      else next.add(frameworkId)
      return next
    })
  }

  const install = async (): Promise<void> => {
    if (!preview || installing) return
    const dirNames = [...selected]
    const targets = [...frameworkIds]
    if (dirNames.length === 0 || targets.length === 0) return

    setInstalling(true)
    setError(null)
    try {
      let result = await window.aibench.marketplace.installGithub(
        preview.sessionId,
        dirNames,
        targets
      )
      if (result.conflicts.length > 0) {
        const names = result.conflicts.map((conflict) => `「${conflict.dirName}」`).join('、')
        if (!confirm(`${names} 已存在于目标 Framework，是否覆盖？`)) return
        result = await window.aibench.marketplace.installGithub(
          preview.sessionId,
          dirNames,
          targets,
          true
        )
      }
      if (result.installed.length === 0) {
        setError('没有安装任何 Skill，请检查目标 Framework。')
        return
      }
      onInstalled()
      onClose()
    } catch (err) {
      setError(formatError(err, '安装失败'))
    } finally {
      setInstalling(false)
    }
  }

  const allSelected =
    preview !== null && preview.skills.length > 0 && selected.size === preview.skills.length

  return (
    <Modal
      open
      title="从 GitHub 安装 Skill"
      onClose={close}
      panelClassName="max-w-3xl"
      footer={
        <>
          <button type="button" className="btn-secondary" disabled={installing} onClick={close}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={
              !preview || installing || selected.size === 0 || frameworkIds.size === 0
            }
            onClick={() => void install()}
          >
            {installing ? '安装中…' : `安装选中（${selected.size}）`}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={url}
              placeholder="https://github.com/owner/repo"
              spellCheck={false}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void inspect()
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary shrink-0"
              disabled={inspecting || !url.trim()}
              onClick={() => void inspect()}
            >
              {inspecting ? '读取中…' : '获取预览'}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            支持仓库根目录或 <span className="font-mono">/tree/&lt;分支&gt;/&lt;目录&gt;</span>{' '}
            链接。下载的文件只会复制到目标目录，App 不会执行其中的脚本。
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        )}

        {preview && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-950 dark:text-white">
                {preview.repo}
              </span>
              <span className="tag font-mono">{preview.ref}</span>
              {preview.subdir && <span className="tag font-mono">{preview.subdir}</span>}
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {preview.skills.length} 个 Skill · {formatBytes(preview.totalBytes)}
              </span>
              <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                全选
              </label>
            </div>

            {preview.truncated && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                仓库内容较多，仅显示前 50 个 Skill，每个 Skill 最多列出 200 个文件。
              </p>
            )}

            <ul className="space-y-2">
              {preview.skills.map((skill) => {
                const checked = selected.has(skill.dirName)
                return (
                  <li
                    key={skill.dirName}
                    className="rounded-xl border border-slate-300 dark:border-slate-800"
                  >
                    <div className="flex items-start gap-3 p-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggleSkill(skill.dirName)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {skill.name}
                          </span>
                          <span className="tag font-mono">{skill.dirName}</span>
                          {skill.scriptCount > 0 && (
                            <span
                              className="tag text-amber-700 dark:text-amber-300"
                              title="包含可执行或脚本文件，安装前请展开检查"
                            >
                              {skill.scriptCount} 个脚本
                            </span>
                          )}
                          {skill.parseError && (
                            <span className="tag text-rose-600 dark:text-rose-400">
                              frontmatter 解析失败
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {skill.description || '无描述'}
                        </p>
                        <p className="mt-1 break-all text-[11px] text-slate-400">
                          {skill.relativePath !== '.' && `${skill.relativePath} · `}
                          {skill.fileCount} 个文件 · {formatBytes(skill.totalBytes)}
                        </p>

                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
                            查看内容和文件
                          </summary>
                          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11.5px] leading-5 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                            {skill.body || '（正文为空）'}
                          </pre>
                          <ul className="mt-2 max-h-40 overflow-auto">
                            {skill.files.map((file) => (
                              <li
                                key={file.path}
                                className="flex justify-between gap-3 py-0.5 text-[11.5px]"
                              >
                                <span
                                  className={
                                    file.isScript
                                      ? 'break-all font-mono text-amber-700 dark:text-amber-300'
                                      : 'break-all font-mono text-slate-600 dark:text-slate-300'
                                  }
                                >
                                  {file.path}
                                </span>
                                <span className="shrink-0 text-slate-400">
                                  {formatBytes(file.size)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {skill.fileCount > skill.files.length && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              仅列出前 {skill.files.length} 个文件
                            </p>
                          )}
                        </details>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                安装到
              </span>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {config.frameworks.map((framework) => (
                  <label
                    key={framework.id}
                    className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={frameworkIds.has(framework.id)}
                      onChange={() => toggleFramework(framework.id)}
                    />
                    {framework.name}
                  </label>
                ))}
              </div>
              {frameworkIds.size === 0 && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  请至少选择一个目标 Framework。
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
