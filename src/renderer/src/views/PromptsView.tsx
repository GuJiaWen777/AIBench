import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizePromptTags } from '@shared/prompt-tags'
import type { PromptCategory, PromptItem } from '@shared/types'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'

type CategorySelection = 'all' | 'uncategorized' | string

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
  const [categories, setCategories] = useState<PromptCategory[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategorySelection>('all')
  const [draft, setDraft] = useState<PromptItem | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)

  const loadList = useCallback(async () => {
    const [list, nextCategories] = await Promise.all([
      window.aibench.prompts.list(search),
      window.aibench.prompts.listCategories()
    ])
    setPrompts(list)
    setCategories(nextCategories)
    return list
  }, [search])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const visiblePrompts = useMemo(() => {
    if (activeCategory === 'all') return prompts
    if (activeCategory === 'uncategorized') {
      return prompts.filter((prompt) => prompt.tags.length === 0)
    }
    return prompts.filter((prompt) => prompt.tags.includes(activeCategory))
  }, [activeCategory, prompts])

  const uncategorizedCount = prompts.filter((prompt) => prompt.tags.length === 0).length
  const categoryNames = categories.map((category) => category.name)

  const openPrompt = (prompt: PromptItem): void => {
    setDraft({ ...prompt })
    setTagInput('')
  }

  const createNew = async (): Promise<void> => {
    try {
      const tags =
        activeCategory !== 'all' && activeCategory !== 'uncategorized' ? [activeCategory] : []
      const item = await window.aibench.prompts.create('新 Prompt', '', tags)
      const [list, nextCategories] = await Promise.all([
        window.aibench.prompts.list(''),
        window.aibench.prompts.listCategories()
      ])
      setSearch('')
      setPrompts(list)
      setCategories(nextCategories)
      openPrompt(item)
    } catch (err) {
      alert(err instanceof Error ? err.message : '新建 Prompt 失败')
    }
  }

  const save = async (): Promise<void> => {
    if (!draft) return
    const tags = normalizePromptTags([...draft.tags, tagInput])
    const updated = await window.aibench.prompts.update(
      draft.id,
      draft.title,
      draft.body,
      tags
    )
    setTagInput('')
    await loadList()
    openPrompt(updated)
  }

  const addTag = (): void => {
    if (!draft || !tagInput.trim()) return
    const tag = tagInput.trim()
    setDraft({ ...draft, tags: normalizePromptTags([...draft.tags, tag]) })
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

  const createCategory = async (name: string): Promise<void> => {
    const next = await window.aibench.prompts.createCategory(name)
    setCategories(next)
  }

  const renameCategory = async (oldName: string, newName: string): Promise<void> => {
    const next = await window.aibench.prompts.renameCategory(oldName, newName)
    setCategories(next)
    if (activeCategory === oldName) setActiveCategory(newName)
    await loadList()
  }

  const deleteCategory = async (name: string): Promise<void> => {
    const next = await window.aibench.prompts.deleteCategory(name)
    setCategories(next)
    if (activeCategory === name) setActiveCategory('all')
    await loadList()
  }

  return (
    <div className="page-shell">
      <header className="command-header space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="command-title">Prompts</h2>
            <p className="command-subtitle">按分类浏览、复制和编辑 Prompt</p>
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
        <input
          className="input max-w-sm"
          placeholder="搜索标题、正文、分类…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="rail-panel">
          <div className="mb-2 flex items-center justify-between gap-2 px-2">
            <span className="rail-label mb-0 px-0">分类</span>
            <button
              type="button"
              className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 dark:text-cyan-300"
              onClick={() => setManageCategoriesOpen(true)}
            >
              管理
            </button>
          </div>
          <button
            type="button"
            className={activeCategory === 'all' ? 'side-filter-active' : 'side-filter'}
            onClick={() => setActiveCategory('all')}
          >
            <span>全部</span>
            <span>{prompts.length}</span>
          </button>
          <button
            type="button"
            className={activeCategory === 'uncategorized' ? 'side-filter-active' : 'side-filter'}
            onClick={() => setActiveCategory('uncategorized')}
          >
            <span>未分类</span>
            <span>{uncategorizedCount}</span>
          </button>
          <div className="my-2 border-t border-slate-300 dark:border-slate-800" />
          {categories.map((category) => (
            <button
              key={category.name}
              type="button"
              className={activeCategory === category.name ? 'side-filter-active' : 'side-filter'}
              onClick={() => setActiveCategory(category.name)}
            >
              <span className="truncate">{category.name}</span>
              <span>{category.promptCount}</span>
            </button>
          ))}
        </aside>

        <section className="content-scroll">
          {visiblePrompts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
              <p>暂无 Prompt</p>
              <p className="mt-2 text-sm">新建一个 Prompt 后会以卡片显示在这里</p>
            </div>
          ) : (
            <div className="work-grid">
              {visiblePrompts.map((prompt) => (
                <article
                  key={prompt.id}
                  role="button"
                  tabIndex={0}
                  className="card group relative min-h-[190px] cursor-copy"
                  title="点击复制 Prompt 正文"
                  onClick={() => void copyPrompt(prompt)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void copyPrompt(prompt)
                    }
                  }}
                >
                  <div className="absolute right-3 top-3 flex gap-1 opacity-85 group-hover:opacity-100">
                    <button
                      type="button"
                      className="icon-btn"
                      title="打开编辑"
                      onClick={(event) => {
                        event.stopPropagation()
                        openPrompt(prompt)
                      }}
                    >
                      打开
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="复制 Prompt 正文"
                      onClick={(event) => {
                        event.stopPropagation()
                        void copyPrompt(prompt)
                      }}
                    >
                      复制
                    </button>
                  </div>
                  <div className="pr-28">
                    <h3 className="line-clamp-2 font-semibold text-slate-950 dark:text-white">
                      {prompt.title}
                    </h3>
                    <p className="meta-line mt-1">
                      更新于 {formatUpdatedAt(prompt.updatedAt)}
                    </p>
                  </div>
                  <p className="mt-4 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {promptPreview(prompt.body)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1">
                    {prompt.tags.length === 0 ? (
                      <span className="tag tag-muted">未分类</span>
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
      </div>

      {draft && (
        <Modal
          open
          title="编辑 Prompt"
          onClose={() => setDraft(null)}
          panelClassName="max-w-5xl"
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
          <div className="grid min-h-[540px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="rounded-lg border border-slate-300 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="meta-line">Prompt Profile</div>
              <label className="mt-4 block text-sm font-semibold text-slate-800 dark:text-slate-100">
                标题
                <input
                  className="input mt-2"
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                />
              </label>

              <div className="mt-5 text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-100">分类</span>
                <div className="mt-2 flex min-h-9 flex-wrap gap-1.5">
                  {draft.tags.length === 0 ? (
                    <span className="tag tag-muted">未分类</span>
                  ) : (
                    draft.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="tag tag-removable"
                        title={`移除 ${tag}`}
                        onClick={() => removeTag(tag)}
                      >
                        <span>{tag}</span>
                        <span className="tag-remove-mark">x</span>
                      </button>
                    ))
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    className="input"
                    list="category-suggestions"
                    placeholder="添加分类"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addTag()
                      }
                    }}
                  />
                  <datalist id="category-suggestions">
                    {categoryNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  <button type="button" className="btn-secondary shrink-0" onClick={addTag}>
                    添加
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-md border border-slate-300 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                <div className="meta-line">Updated</div>
                <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {formatUpdatedAt(draft.updatedAt)}
                </div>
              </div>
            </aside>

            <label className="flex min-h-0 flex-col text-sm font-semibold text-slate-800 dark:text-slate-100">
              <span>正文</span>
              <textarea
                className="textarea mt-2 min-h-[500px] flex-1 rounded-lg leading-7"
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              />
            </label>
          </div>
        </Modal>
      )}

      {manageCategoriesOpen && (
        <CategoryManager
          categories={categories}
          onClose={() => setManageCategoriesOpen(false)}
          onCreate={(name) => void createCategory(name)}
          onRename={(oldName, newName) => void renameCategory(oldName, newName)}
          onDelete={(name) => void deleteCategory(name)}
        />
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

function CategoryManager({
  categories,
  onClose,
  onCreate,
  onRename,
  onDelete
}: {
  categories: PromptCategory[]
  onClose: () => void
  onCreate: (name: string) => void
  onRename: (oldName: string, newName: string) => void
  onDelete: (name: string) => void
}): React.ReactElement {
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const create = (): void => {
    if (!newName.trim()) return
    onCreate(newName.trim())
    setNewName('')
  }

  const startEdit = (name: string): void => {
    setEditingName(name)
    setEditingValue(name)
  }

  const saveEdit = (): void => {
    if (!editingName || !editingValue.trim()) return
    onRename(editingName, editingValue.trim())
    setEditingName(null)
    setEditingValue('')
  }

  const remove = (name: string): void => {
    const ok = confirm(`删除分类「${name}」？这会从所有 Prompt 中移除此分类，但不会删除 Prompt。`)
    if (ok) onDelete(name)
  }

  return (
    <Modal
      open
      title="管理分类"
      onClose={onClose}
      footer={
        <button type="button" className="btn-primary" onClick={onClose}>
          完成
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="新分类名称"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                create()
              }
            }}
          />
          <button type="button" className="btn-secondary shrink-0" onClick={create}>
            新建
          </button>
        </div>
        <div className="space-y-2">
          {categories.length === 0 ? (
            <p className="text-sm text-slate-500">暂无分类</p>
          ) : (
            categories.map((category) => (
              <div
                key={category.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-300 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-900/70"
              >
                {editingName === category.name ? (
                  <input
                    className="input min-w-[180px] flex-1"
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        saveEdit()
                      }
                    }}
                  />
                ) : (
                  <div>
                    <div className="text-sm font-semibold">{category.name}</div>
                    <div className="meta-line">{category.promptCount} 个 Prompt</div>
                  </div>
                )}
                <div className="flex gap-2">
                  {editingName === category.name ? (
                    <button type="button" className="btn-secondary" onClick={saveEdit}>
                      保存
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => startEdit(category.name)}
                    >
                      重命名
                    </button>
                  )}
                  <button type="button" className="btn-danger" onClick={() => remove(category.name)}>
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
