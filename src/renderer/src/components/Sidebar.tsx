export type ViewId = 'skills' | 'prompts' | 'settings'

const items: { id: ViewId; label: string; short: string }[] = [
  { id: 'skills', label: 'Skills', short: 'Sk' },
  { id: 'prompts', label: 'Prompts', short: 'Pr' }
]

const settingsItem: { id: ViewId; label: string; short: string } = {
  id: 'settings',
  label: '设置',
  short: 'Se'
}

interface Props {
  current: ViewId
  onChange: (view: ViewId) => void
}

export default function Sidebar({ current, onChange }: Props): React.ReactElement {
  return (
    <aside className="flex w-24 shrink-0 flex-col border-r border-slate-300 bg-slate-950 text-slate-300 shadow-xl shadow-slate-950/20 dark:border-slate-800">
      <div className="border-b border-slate-800 px-3 py-4 text-center">
        <div className="mx-auto mb-2 h-8 w-8 rounded-lg border border-cyan-400/50 bg-cyan-300 text-sm font-black leading-8 text-slate-950 shadow-sm shadow-cyan-500/30">
          AI
        </div>
        <h1 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Bench
        </h1>
      </div>
      <nav className="flex flex-1 flex-col gap-2 p-2">
        {items.map((item) => (
          <SidebarButton key={item.id} item={item} current={current} onChange={onChange} />
        ))}
      </nav>
      <div className="border-t border-slate-800 p-2">
        <SidebarButton item={settingsItem} current={current} onChange={onChange} />
      </div>
    </aside>
  )
}

function SidebarButton({
  item,
  current,
  onChange
}: {
  item: { id: ViewId; label: string; short: string }
  current: ViewId
  onChange: (view: ViewId) => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onChange(item.id)}
      title={item.label}
      className={`w-full rounded-lg px-2 py-2 text-center text-xs transition ${
        current === item.id
          ? 'bg-cyan-300 font-semibold text-slate-950 shadow-sm shadow-cyan-500/30'
          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
      }`}
    >
      <span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-md border border-current text-[11px] font-black">
        {item.short}
      </span>
      {item.label}
    </button>
  )
}
