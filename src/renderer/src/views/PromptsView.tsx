import { useCallback, useEffect, useState } from 'react'
import type { PromptItem } from '@shared/types'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'

function promptPreview(body: string): string {
  const preview = body.replace(/\s+/g, ' ').trim()
  return preview || '空白 Prompt'
}

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function PromptsView(): React.ReactElement {
  const [prompts, setPrompts] = useState<PromptItem[]>([])
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
    void loadList()
  }, [loadList])

  const openPrompt = (prompt: PromptItem): void => {
    setDraft({ ...prompt })
    setTagInput('')
  }

  const createNew = async (): Promise<void> => {
    const item = await window.aibench.prompts.create('新 Prompt', '', [])
    await loadList()
    openPrompt(item)
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
    openPrompt(updated)
  }

  const addTag = (): void => {
    if (!draft || !tagInput.trim()) return
    const tag = tagInput.trim()
    if (!draft.tags.includes(tag)) {
      setDraft({ ...draft, tags: [...draft.tags, tag] })
    }
    setTagInput('')
  }

  const removeTag = (tag: string): void => {
    if (!draft) return
    setDraft({ ...draft, tags: draft.tags.filter((item) => item !== tag) })
  }

  const copyPrompt = async (prompt: PromptItem): Promise<void> => {
    await navigator.clipboard.writeText(prompt.body)
  }

  const copyDraft = async (): Promise<void> => {
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
    if (draft?.id === deleteId) setDraft(null)
    setDeleteId(null)
    await loadList()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-3 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Prompts</h2>
            <p className="mt-1 text-sm text-zinc-500">卡片式浏览、复制和编辑 Prompt</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => void exportAll()}>
              导出全部
            </button>
            <button type="button" className="btn-primary" onClick={() => void createNew()}>
              新建 Prompt
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input max-w-sm"
            placeholder="搜索标题、正文、标签…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={activeTag === null ? 'chip-active' : 'chip'}
              onClick={() => setActiveTag(null)}
            >
              全部
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={activeTag === tag ? 'chip-active' : 'chip'}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-6">
        {prompts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
            <p>暂无 Prompt</p>
            <p className="mt-2 text-sm">新建一个 Prompt 后会以卡片显示在这里</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {prompts.map((prompt) => (
              <article
                key={prompt.id}
                role="button"
                tabIndex={0}
                className="card group relative min-h-[190px] cursor-pointer transition hover:border-blue-300 dark:hover:border-blue-700"
                onClick={() => openPrompt(prompt)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openPrompt(prompt)
                  }
                }}
              >
                <button
                  type="button"
                  className="icon-btn absolute right-3 top-3 opacity-80 group-hover:opacity-100"
                  title="复制 Prompt 正文"
                  onClick={(event) => {
                    event.stopPropagation()
                    void copyPrompt(prompt)
                  }}
                >
                  复制
                </button>
                <div className="pr-14">
                  <h3 className="line-clamp-2 font-medium">{prompt.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    更新于 {formatUpdatedAt(prompt.updatedAt)}
                  </p>
                </div>
                <p className="mt-4 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {promptPreview(prompt.body)}
                </p>
                <div className="mt-4 flex flex-wrap gap-1">
                  {prompt.tags.length === 0 ? (
                    <span className="tag">无标签</span>
                  ) : (
                    prompt.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {draft && (
        <Modal
          open
          title={`编辑 Prompt — ${draft.title}`}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button type="button" className="btn-danger" onClick={() => setDeleteId(draft.id)}>
                删除
              </button>
              <button type="button" className="btn-secondary" onClick={() => void copyDraft()}>
                复制
              </button>
              <button type="button" className="btn-secondary" onClick={() => void exportOne()}>
                导出
              </button>
              <button type="button" className="btn-primary" onClick={() => void save()}>
                保存
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-sm">
              标题
              <input
                className="input mt-1"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </label>
            <div className="text-sm">
              <span className="mb-1 block">标签</span>
              <div className="flex flex-wrap gap-1">
                {draft.tags.map((tag) => (
                  <button key={tag} type="button" className="tag" onClick={() => removeTag(tag)}>
                    {tag} x
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className="input"
                  list="tag-suggestions"
                  placeholder="添加标签，回车确认"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addTag()
                    }
                  }}
                />
                <datalist id="tag-suggestions">
                  {allTags.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
                <button type="button" className="btn-secondary" onClick={addTag}>
                  添加
                </button>
              </div>
            </div>
            <label className="block text-sm">
              正文
              <textarea
                className="textarea mt-1 min-h-[360px] w-full"
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              />
            </label>
          </div>
        </Modal>
      )}

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
