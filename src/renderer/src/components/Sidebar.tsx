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
    <aside className="flex w-24 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-3 py-4 text-center dark:border-zinc-800">
        <h1 className="text-sm font-semibold tracking-tight">AIBench</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-2 p-2">
        {items.map((item) => (
          <SidebarButton key={item.id} item={item} current={current} onChange={onChange} />
        ))}
      </nav>
      <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
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
      className={`w-full rounded-md px-2 py-2 text-center text-xs transition-colors ${
        current === item.id
          ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-200'
          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      <span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-md border border-current text-[11px]">
        {item.short}
      </span>
      {item.label}
    </button>
  )
}
