import { useState } from 'react'
import type { AppConfig, Framework, ThemeMode } from '@shared/types'

interface Props {
  config: AppConfig
  onSaved: () => Promise<void>
}

export default function SettingsView({ config, onSaved }: Props): React.ReactElement {
  const [draft, setDraft] = useState<AppConfig>(config)
  const [newFwName, setNewFwName] = useState('')
  const [newFwPath, setNewFwPath] = useState('')

  const save = async (): Promise<void> => {
    await window.aibench.config.update(draft)
    const isDark = await window.aibench.theme.setMode(draft.theme)
    document.documentElement.classList.toggle('dark', isDark)
    await onSaved()
    alert('设置已保存')
  }

  const pickPath = async (key: 'archivePath' | 'exportPath'): Promise<void> => {
    const dir = await window.aibench.config.pickDirectory()
    if (dir) setDraft({ ...draft, [key]: dir })
  }

  const pickFrameworkPath = async (index: number): Promise<void> => {
    const dir = await window.aibench.config.pickDirectory()
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
    <div className="h-full overflow-y-auto p-6">
      <h2 className="text-xl font-semibold">设置</h2>

      <section className="card mt-6 space-y-4">
        <h3 className="font-medium">外观</h3>
        <label className="block text-sm">
          主题
          <select
            className="input mt-1"
            value={draft.theme}
            onChange={(e) => setDraft({ ...draft, theme: e.target.value as ThemeMode })}
          >
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>
      </section>

      <section className="card mt-4 space-y-4">
        <h3 className="font-medium">Framework 路径</h3>
        {draft.frameworks.map((fw, index) => (
          <div key={fw.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {fw.name}
                {fw.builtIn && (
                  <span className="ml-2 text-xs text-zinc-500">内置</span>
                )}
              </span>
              {!fw.builtIn && (
                <button
                  type="button"
                  className="text-xs text-red-600"
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

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h4 className="text-sm font-medium">添加 Custom Framework</h4>
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

      <section className="card mt-4 space-y-4">
        <h3 className="font-medium">数据目录</h3>
        <div>
          <span className="text-sm">归档目录</span>
          <div className="mt-1 flex gap-2">
            <input className="input font-mono text-xs" value={draft.archivePath} readOnly />
            <button type="button" className="btn-secondary" onClick={() => void pickPath('archivePath')}>
              浏览
            </button>
          </div>
        </div>
        <div>
          <span className="text-sm">Prompt 导出目录</span>
          <div className="mt-1 flex gap-2">
            <input className="input font-mono text-xs" value={draft.exportPath} readOnly />
            <button type="button" className="btn-secondary" onClick={() => void pickPath('exportPath')}>
              浏览
            </button>
          </div>
        </div>
      </section>

      <button type="button" className="btn-primary mt-6" onClick={() => void save()}>
        保存设置
      </button>
    </div>
  )
}
