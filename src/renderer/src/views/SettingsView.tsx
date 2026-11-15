import { useState } from 'react'
import type { AppConfig, Framework, ThemeMode } from '@shared/types'
import BackupRestoreSection from '../components/BackupRestoreSection'
import HealthSection from '../components/HealthSection'
import { showError } from '../lib/errors'

interface Props {
  config: AppConfig
  onSaved: () => Promise<void>
}

export default function SettingsView({ config, onSaved }: Props): React.ReactElement {
  const [draft, setDraft] = useState<AppConfig>(config)
  const [newFwName, setNewFwName] = useState('')
  const [newFwPath, setNewFwPath] = useState('')

  const save = async (): Promise<void> => {
    try {
      await window.aibench.config.update(draft)
      await onSaved()
      alert('设置已保存')
    } catch (error) {
      showError(error, '保存设置失败')
    }
  }

  const setTheme = async (theme: ThemeMode): Promise<void> => {
    setDraft((current) => ({ ...current, theme }))
    const isDark = await window.aibench.theme.setMode(theme)
    document.documentElement.classList.toggle('dark', isDark)
    await onSaved()
  }

  const handleRestored = async (): Promise<void> => {
    // A restore may replace config.json; drop any stale draft so saving the
    // form later cannot overwrite the restored settings.
    setDraft(await window.aibench.config.get())
    await onSaved()
  }

  const pickPath = async (key: 'archivePath' | 'exportPath'): Promise<void> => {
    const dir = await window.aibench.shell.pickDirectory()
    if (dir) setDraft({ ...draft, [key]: dir })
  }

  const pickFrameworkPath = async (index: number): Promise<void> => {
    const dir = await window.aibench.shell.pickDirectory()
    if (!dir) return
    const frameworks = [...draft.frameworks]
    frameworks[index] = { ...frameworks[index], path: dir }
    setDraft({ ...draft, frameworks })
  }

  const addFramework = (): void => {
    if (!newFwName.trim() || !newFwPath.trim()) return
    const id = `custom-${Date.now()}`
    const fw: Framework = {
      id,
      name: newFwName.trim(),
      path: newFwPath.trim(),
      builtIn: false
    }
    setDraft({ ...draft, frameworks: [...draft.frameworks, fw] })
    setNewFwName('')
    setNewFwPath('')
  }

  const removeFramework = (id: string): void => {
    setDraft({
      ...draft,
      frameworks: draft.frameworks.filter((f) => !f.builtIn && f.id !== id)
    })
  }

  return (
    <div className="page-shell">
      <header className="command-header">
        <h2 className="command-title">设置</h2>
        <p className="command-subtitle">配置本地路径、Agent Framework 与界面外观</p>
      </header>

      <div className="content-scroll">
        <div className="max-w-5xl space-y-4">
          <section className="card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950 dark:text-white">外观</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  主题切换会立即生效，不需要等待保存设置。
                </p>
              </div>
              <div className="segmented">
                {[
                  { value: 'system', label: '跟随系统' },
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      draft.theme === option.value ? 'segmented-active' : 'segmented-item'
                    }
                    onClick={() => void setTheme(option.value as ThemeMode)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card space-y-4">
            <div>
              <h3 className="font-semibold text-slate-950 dark:text-white">Framework 路径</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                管理 Codex、Hermes、OpenClaw 等 Skill 根目录。
              </p>
            </div>
            {draft.frameworks.map((fw, index) => (
              <div key={fw.id} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {fw.name}
                    {fw.builtIn && (
                      <span className="tag ml-2 align-middle">内置</span>
                    )}
                  </span>
                  {!fw.builtIn && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-300"
                      onClick={() => removeFramework(fw.id)}
                    >
                      删除
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input className="input font-mono text-xs" value={fw.path} readOnly />
                  <button
                    type="button"
                    className="btn-secondary shrink-0"
                    onClick={() => void pickFrameworkPath(index)}
                  >
                    浏览
                  </button>
                </div>
              </div>
            ))}

            <div className="border-t border-slate-300 pt-4 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                添加 Custom Framework
              </h4>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  className="input max-w-[160px]"
                  placeholder="名称"
                  value={newFwName}
                  onChange={(e) => setNewFwName(e.target.value)}
                />
                <input
                  className="input min-w-[200px] flex-1 font-mono text-xs"
                  placeholder="Skill 根目录路径"
                  value={newFwPath}
                  onChange={(e) => setNewFwPath(e.target.value)}
                />
                <button type="button" className="btn-secondary" onClick={addFramework}>
                  添加
                </button>
              </div>
            </div>
          </section>

          <section className="card space-y-4">
            <div>
              <h3 className="font-semibold text-slate-950 dark:text-white">数据目录</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                指定归档与 Prompt 导出位置。
              </p>
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                归档目录
              </span>
              <div className="mt-1 flex gap-2">
                <input className="input font-mono text-xs" value={draft.archivePath} readOnly />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  onClick={() => void pickPath('archivePath')}
                >
                  浏览
                </button>
              </div>
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Prompt 导出目录
              </span>
              <div className="mt-1 flex gap-2">
                <input className="input font-mono text-xs" value={draft.exportPath} readOnly />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  onClick={() => void pickPath('exportPath')}
                >
                  浏览
                </button>
              </div>
            </div>
          </section>

          <BackupRestoreSection onRestored={handleRestored} />

          <HealthSection />

          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={() => void save()}>
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
