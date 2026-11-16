import { useEffect, useState } from 'react'
import type { AppConfig } from '@shared/types'
import TopNav, { type ViewId } from './components/TopNav'
import SkillsView from './views/SkillsView'
import PromptsView from './views/PromptsView'
import SettingsView from './views/SettingsView'
import { useTheme } from './lib/useTheme'

export default function App(): React.ReactElement {
  const [view, setView] = useState<ViewId>('skills')
  const [config, setConfig] = useState<AppConfig | null>(null)

  useTheme()

  useEffect(() => {
    window.aibench.config.get().then(setConfig)
  }, [])

  const reloadConfig = async (): Promise<void> => {
    setConfig(await window.aibench.config.get())
  }

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        加载中…
      </div>
    )
  }

  return (
    <div className="app-shell">
      <TopNav current={view} onChange={setView} />
      <main className="app-main">
        {view === 'skills' && <SkillsView config={config} />}
        {view === 'prompts' && <PromptsView />}
        {view === 'settings' && <SettingsView config={config} onSaved={reloadConfig} />}
      </main>
    </div>
  )
}
