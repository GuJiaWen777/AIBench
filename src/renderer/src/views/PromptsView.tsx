import { useCallback, useEffect, useMemo, useState } from 'react'
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
    const tags =
      activeCategory !== 'all' && activeCategory !== 'uncategorized' ? [activeCategory] : []
    const item = await window.aibench.prompts.create('新 Prompt', '', tags)
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
    <div className="flex h-full flex-col">
      <header className="space-y-3 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Prompts</h2>
            <p className="mt-1 text-sm text-zinc-500">按分类浏览、复制和编辑 Prompt</p>
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
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-2 flex items-center justify-between gap-2 px-2">
            <span className="text-xs font-medium uppercase text-zinc-500">分类</span>
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300"
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
          <div className="my-2 border-t border-zinc-200 dark:border-zinc-800" />
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

        <section className="flex-1 overflow-y-auto p-6">
          {visiblePrompts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
              <p>暂无 Prompt</p>
              <p className="mt-2 text-sm">新建一个 Prompt 后会以卡片显示在这里</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visiblePrompts.map((prompt) => (
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
                      <span className="tag">未分类</span>
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
          title={`编辑 Prompt - ${draft.title}`}
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
              <span className="mb-1 block">分类</span>
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
                  list="category-suggestions"
                  placeholder="添加分类，回车确认"
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
            <p className="text-sm text-zinc-500">暂无分类</p>
          ) : (
            categories.map((category) => (
              <div
                key={category.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-800"
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
                    <div className="text-sm font-medium">{category.name}</div>
                    <div className="text-xs text-zinc-500">{category.promptCount} 个 Prompt</div>
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
