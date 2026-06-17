import { useEffect, useState } from 'react'
import type { AppConfig } from '@shared/types'
import Sidebar, { type ViewId } from './components/Sidebar'
import SkillsView from './views/SkillsView'
import PromptsView from './views/PromptsView'
import SettingsView from './views/SettingsView'

export default function App(): React.ReactElement {
  const [view, setView] = useState<ViewId>('skills')
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    window.aibench.config.get().then(setConfig)
    window.aibench.theme.get().then((isDark) => {
      document.documentElement.classList.toggle('dark', isDark)
    })
    return window.aibench.theme.onChanged((isDark) => {
      document.documentElement.classList.toggle('dark', isDark)
    })
  }, [])

  const reloadConfig = async (): Promise<void> => {
    setConfig(await window.aibench.config.get())
  }

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-500">加载中…</div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar current={view} onChange={setView} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {view === 'skills' && <SkillsView config={config} />}
        {view === 'prompts' && <PromptsView />}
        {view === 'settings' && <SettingsView config={config} onSaved={reloadConfig} />}
      </main>
    </div>
  )
}
