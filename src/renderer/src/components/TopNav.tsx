export type ViewId = 'skills' | 'prompts' | 'settings'

const tabs: { id: ViewId; label: string }[] = [
  { id: 'skills', label: 'Skills' },
  { id: 'prompts', label: 'Prompts' }
]

interface Props {
  current: ViewId
  onChange: (view: ViewId) => void
}

export default function TopNav({ current, onChange }: Props): React.ReactElement {
  return (
    <header className="top-nav">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          A
        </span>
        <span className="brand-name">AIBench</span>
      </div>

      <nav className="nav-tabs" aria-label="主导航">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`nav-${tab.id}`}
            aria-current={current === tab.id ? 'page' : undefined}
            className={
              current === tab.id ? 'segmented-item segmented-active' : 'segmented-item'
            }
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="nav-actions">
        <button
          type="button"
          data-testid="nav-settings"
          title="设置"
          aria-label="设置"
          aria-current={current === 'settings' ? 'page' : undefined}
          className={current === 'settings' ? 'icon-btn icon-btn-active' : 'icon-btn'}
          onClick={() => onChange('settings')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
            aria-hidden
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </header>
  )
}
