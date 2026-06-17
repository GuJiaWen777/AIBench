import { useCallback, useEffect, useState } from 'react'
import type { PromptItem } from '@shared/types'
import ConfirmDialog from '../components/ConfirmDialog'

export default function PromptsView(): React.ReactElement {
  const [prompts, setPrompts] = useState<PromptItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<string[]>([])
  const [draft, setDraft] = useState<PromptItem | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    const [list, tags] = await Promise.all([
      window.aibench.prompts.list(search, activeTag ?? undefined),
      window.aibench.prompts.listTags()
    ])
    setPrompts(list)
    setAllTags(tags)
    return list
  }, [search, activeTag])

  useEffect(() => {
    void loadList().then((list) => {
      if (list.length === 0) {
        setSelectedId(null)
        setDraft(null)
        return
      }
      setSelectedId((prev) => {
        const next = prev && list.some((p) => p.id === prev) ? prev : list[0].id
        const item = list.find((p) => p.id === next)!
        setDraft({ ...item })
        return next
      })
    })
  }, [loadList])

  const selectPrompt = (p: PromptItem): void => {
    setSelectedId(p.id)
    setDraft({ ...p })
  }

  const createNew = async (): Promise<void> => {
    const item = await window.aibench.prompts.create('新 Prompt', '', [])
    await loadList()
    selectPrompt(item)
  }

  const save = async (): Promise<void> => {
    if (!draft) return
    const updated = await window.aibench.prompts.update(
      draft.id,
      draft.title,
      draft.body,
      draft.tags
    )
    await loadList()
    selectPrompt(updated)
  }

  const addTag = (): void => {
    if (!draft || !tagInput.trim()) return
    const t = tagInput.trim()
    if (!draft.tags.includes(t)) {
      setDraft({ ...draft, tags: [...draft.tags, t] })
    }
    setTagInput('')
  }

  const removeTag = (tag: string): void => {
    if (!draft) return
    setDraft({ ...draft, tags: draft.tags.filter((t) => t !== tag) })
  }

  const copyBody = async (): Promise<void> => {
    if (!draft) return
    await navigator.clipboard.writeText(draft.body)
  }

  const exportOne = async (): Promise<void> => {
    if (!draft) return
    const path = await window.aibench.prompts.exportOne(draft.id)
    alert(`已导出到：${path}`)
  }

  const exportAll = async (): Promise<void> => {
    const paths = await window.aibench.prompts.exportAll()
    alert(`已导出 ${paths.length} 个文件`)
  }

  const confirmDelete = async (): Promise<void> => {
    if (!deleteId) return
    await window.aibench.prompts.delete(deleteId)
    setDeleteId(null)
    await loadList()
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
        <div className="space-y-2 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <input
            className="input"
            placeholder="搜索标题、正文、标签…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={activeTag === null ? 'tag-active' : 'tag'}
              onClick={() => setActiveTag(null)}
            >
              全部
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={activeTag === tag ? 'tag-active' : 'tag'}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1" onClick={() => void createNew()}>
              新建
            </button>
            <button type="button" className="btn-secondary" onClick={() => void exportAll()}>
              导出全部
            </button>
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {prompts.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={`w-full border-b border-zinc-100 px-4 py-3 text-left dark:border-zinc-800 ${
                  selectedId === p.id
                    ? 'bg-blue-50 dark:bg-blue-950'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
                onClick={() => selectPrompt(p)}
              >
                <div className="font-medium">{p.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col p-6">
        {!draft ? (
          <div className="flex flex-1 items-center justify-center text-zinc-500">
            选择或新建一个 Prompt
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <label className="block text-sm">
                标题
                <input
                  className="input mt-1"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <div className="text-sm">
                <span className="mb-1 block">标签</span>
                <div className="flex flex-wrap gap-1">
                  {draft.tags.map((tag) => (
                    <button key={tag} type="button" className="tag" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    className="input"
                    list="tag-suggestions"
                    placeholder="添加标签，回车确认"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                  />
                  <datalist id="tag-suggestions">
                    {allTags.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  <button type="button" className="btn-secondary" onClick={addTag}>
                    添加
                  </button>
                </div>
              </div>
              <label className="block flex-1 text-sm">
                正文
                <textarea
                  className="textarea mt-1 min-h-[360px] w-full"
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => void save()}>
                保存
              </button>
              <button type="button" className="btn-secondary" onClick={() => void copyBody()}>
                复制
              </button>
              <button type="button" className="btn-secondary" onClick={() => void exportOne()}>
                导出
              </button>
              <button type="button" className="btn-danger" onClick={() => setDeleteId(draft.id)}>
                删除
              </button>
            </div>
          </>
        )}
      </section>

      {deleteId && (
        <ConfirmDialog
          message="确定永久删除此 Prompt 吗？此操作不可恢复。"
          confirmLabel="删除"
          danger
          onCancel={() => setDeleteId(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  )
}
