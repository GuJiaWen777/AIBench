import { useEffect, useMemo, useRef, useState } from 'react'
import type { PromptItem } from '@shared/types'
import { extractPlaceholders, renderPrompt } from '@shared/prompt-placeholders'
import { SearchIcon } from '../components/icons'
import { useTheme } from '../lib/useTheme'

const MAX_RESULTS = 20

interface FillState {
  prompt: PromptItem
  placeholders: string[]
}

function previewText(body: string): string {
  return body.replace(/\s+/g, ' ').trim()
}

export default function QuickSearch(): React.ReactElement {
  const [prompts, setPrompts] = useState<PromptItem[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [fill, setFill] = useState<FillState | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const hideTimerRef = useRef<number | null>(null)

  useTheme()

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        setPrompts(await window.aibench.prompts.list())
      } catch {
        setPrompts([])
      }
    }

    const reset = (): void => {
      setQuery('')
      setSelected(0)
      setFill(null)
      setValues({})
      setCopyState('idle')
      void load()
      window.setTimeout(() => searchRef.current?.focus(), 0)
    }

    void load()
    const offOpened = window.aibench.quick.onOpened(reset)
    return () => {
      offOpened()
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setSelected(0)
  }, [query])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = q
      ? prompts.filter(
          (prompt) =>
            prompt.title.toLowerCase().includes(q) ||
            prompt.body.toLowerCase().includes(q) ||
            prompt.tags.some((tag) => tag.toLowerCase().includes(q))
        )
      : prompts
    return items.slice(0, MAX_RESULTS)
  }, [prompts, query])

  const activeIndex = Math.min(selected, Math.max(0, filtered.length - 1))

  useEffect(() => {
    const target = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
    target?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, filtered])

  useEffect(() => {
    if (fill) firstInputRef.current?.focus()
    else searchRef.current?.focus()
  }, [fill])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (fill) {
        setFill(null)
        setValues({})
        setCopyState('idle')
      } else {
        void window.aibench.quick.hide()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fill])

  const copyText = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = window.setTimeout(() => {
        void window.aibench.quick.hide()
      }, 550)
    } catch {
      setCopyState('failed')
    }
  }

  const activate = (prompt: PromptItem): void => {
    const placeholders = extractPlaceholders(prompt.body)
    if (placeholders.length === 0) {
      void copyText(prompt.body)
      return
    }
    setFill({ prompt, placeholders })
    setValues(Object.fromEntries(placeholders.map((name) => [name, ''])))
    setCopyState('idle')
  }

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (filtered.length === 0) return
      setSelected((current) => Math.min(current + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const prompt = filtered[activeIndex]
      if (prompt) activate(prompt)
    }
  }

  return (
    <div className="quick-shell">
      <div className="quick-panel">
        {fill ? (
          <>
            <div className="quick-search">
              <span className="quick-fill-title">{fill.prompt.title}</span>
              {copyState === 'copied' && <span className="quick-copied">已复制</span>}
              {copyState === 'failed' && <span className="quick-failed">复制失败</span>}
            </div>
            <div className="quick-fill-body">
              <p className="quick-fill-hint">填写占位符后按 Enter 复制，留空会移除该变量。</p>
              {fill.placeholders.map((name, index) => (
                <label key={name} className="quick-fill-field">
                  {name}
                  <input
                    ref={index === 0 ? firstInputRef : undefined}
                    className="input mt-1"
                    placeholder={`{{${name}}}`}
                    value={values[name] ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [name]: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void copyText(renderPrompt(fill.prompt.body, values))
                      }
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="quick-footer quick-footer-actions">
              <button type="button" className="btn-ghost" onClick={() => setFill(null)}>
                返回
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void copyText(renderPrompt(fill.prompt.body, values))}
              >
                复制
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="quick-search">
              <SearchIcon />
              <input
                ref={searchRef}
                autoFocus
                value={query}
                spellCheck={false}
                placeholder="搜索 Prompt 标题、正文或分类…"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
              />
              {copyState === 'copied' && <span className="quick-copied">已复制</span>}
              {copyState === 'failed' && <span className="quick-failed">复制失败</span>}
            </div>

            <div ref={listRef} className="quick-results">
              {filtered.length === 0 ? (
                <div className="quick-empty">
                  {prompts.length === 0
                    ? '还没有 Prompt，打开 AIBench 新建一个。'
                    : '没有匹配的 Prompt'}
                </div>
              ) : (
                filtered.map((prompt, index) => (
                  <button
                    key={prompt.id}
                    type="button"
                    data-selected={index === activeIndex}
                    className={
                      index === activeIndex ? 'quick-item quick-item-active' : 'quick-item'
                    }
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => activate(prompt)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="quick-item-title">{prompt.title}</span>
                      <span className="quick-item-body">{previewText(prompt.body)}</span>
                    </span>
                    {prompt.tags.length > 0 && (
                      <span className="quick-item-tags">
                        {prompt.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="quick-footer">
              <span>↑↓ 选择</span>
              <span>Enter 复制</span>
              <span>Esc 关闭</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
