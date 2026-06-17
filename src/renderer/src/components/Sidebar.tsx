export type ViewId = 'skills' | 'prompts' | 'archive' | 'settings'

const items: { id: ViewId; label: string }[] = [
  { id: 'skills', label: 'Skills' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'archive', label: '归档' },
  { id: 'settings', label: '设置' }
]

interface Props {
  current: ViewId
  onChange: (view: ViewId) => void
}

export default function Sidebar({ current, onChange }: Props): React.ReactElement {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800">
        <h1 className="text-lg font-semibold tracking-tight">AIBench</h1>
        <p className="mt-1 text-xs text-zinc-500">Skill & Prompt 管理</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              current === item.id
                ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-200'
                : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
