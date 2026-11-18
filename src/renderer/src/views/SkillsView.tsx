import { useCallback, useEffect, useState } from 'react'
import type {
  AppConfig,
  CreateSkillInput,
  SkillCopy,
  SkillDetail,
  SkillDiff,
  SkillItem
} from '@shared/types'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import GithubInstallDialog from '../components/GithubInstallDialog'
import SkillDiffView from '../components/SkillDiffView'
import { ChevronRightIcon, SearchIcon } from '../components/icons'
import ArchiveView from './ArchiveView'
import { showError } from '../lib/errors'

interface Props {
  config: AppConfig
}

export default function SkillsView({ config }: Props): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'skills' | 'archive'>('skills')
  const [frameworkId, setFrameworkId] = useState<string>('all')
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editSkill, setEditSkill] = useState<SkillDetail | null>(null)
  const [copies, setCopies] = useState<SkillCopy[]>([])
  const [diff, setDiff] = useState<SkillDiff | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [githubOpen, setGithubOpen] = useState(false)
  const [frameworkPrompt, setFrameworkPrompt] = useState<'create' | 'zip' | 'folder' | null>(null)
  const [removeTarget, setRemoveTarget] = useState<SkillItem | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (frameworkId === 'all') {
        const lists = await Promise.all(
          config.frameworks.map((framework) => window.aibench.skills.list(framework.id))
        )
        setSkills(lists.flat())
      } else {
        setSkills(await window.aibench.skills.list(frameworkId))
      }
    } catch (error) {
      showError(error, '读取 Skill 列表失败')
    } finally {
      setLoading(false)
    }
  }, [config.frameworks, frameworkId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return window.aibench.skills.onChanged(() => {
      void load()
    })
  }, [load])

  const filtered = skills.filter((s) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      s.dirName.toLowerCase().includes(q) ||
      s.meta.name.toLowerCase().includes(q) ||
      s.meta.description.toLowerCase().includes(q)
    )
  })

  const closeSkill = (): void => {
    setEditSkill(null)
    setCopies([])
    setDiff(null)
  }

  const refreshCopies = async (dirName: string): Promise<void> => {
    try {
      setCopies(await window.aibench.skills.copies(dirName))
    } catch (error) {
      showError(error, '读取 Framework 副本失败')
    }
  }

  const openSkill = async (item: SkillItem): Promise<void> => {
    try {
      const detail = await window.aibench.skills.get(item.frameworkId, item.dirName)
      if (!detail) return
      setEditSkill(detail)
      setDiff(null)
      await refreshCopies(detail.dirName)
    } catch (error) {
      showError(error, '打开 Skill 失败')
    }
  }

  const syncCopies = async (targetIds: string[]): Promise<void> => {
    if (!editSkill || targetIds.length === 0) return
    try {
      await window.aibench.skills.sync(editSkill.frameworkId, editSkill.dirName, targetIds)
      await refreshCopies(editSkill.dirName)
      await load()
    } catch (error) {
      showError(error, '同步 Skill 失败')
    }
  }

  const syncTo = async (copy: SkillCopy): Promise<void> => {
    if (!editSkill) return
    const action = copy.exists ? '覆盖' : '复制到'
    if (!confirm(`用当前版本${action} ${copy.frameworkName}？`)) return
    await syncCopies([copy.frameworkId])
  }

  const openDiff = async (copy: SkillCopy): Promise<void> => {
    if (!editSkill) return
    try {
      setDiff(
        await window.aibench.skills.diff(
          editSkill.dirName,
          editSkill.frameworkId,
          copy.frameworkId
        )
      )
    } catch (error) {
      showError(error, '读取差异失败')
    }
  }

  const syncAllDiffering = async (): Promise<void> => {
    if (!editSkill) return
    const targets = copies
      .filter((copy) => copy.frameworkId !== editSkill.frameworkId)
      .filter((copy) => !copy.exists || copy.contentHash !== editSkill.contentHash)
      .map((copy) => copy.frameworkId)
    if (targets.length === 0) return
    if (!confirm(`将当前版本同步到 ${targets.length} 个 Framework？已有副本会被覆盖。`)) return
    await syncCopies(targets)
  }

  const confirmConflicts = (conflicts: { dirName: string }[]): boolean => {
    const names = conflicts.map((conflict) => `「${conflict.dirName}」`).join('、')
    return confirm(`${names} 已存在，是否覆盖？`)
  }

  const installToCurrent = async (
    sourcePath: string,
    overwrite = false,
    targetFrameworkId = frameworkId
  ): Promise<void> => {
    if (targetFrameworkId === 'all') return
    try {
      const result = await window.aibench.skills.installFromPath(
        sourcePath,
        [targetFrameworkId],
        overwrite
      )
      if (result.conflicts.length > 0) {
        if (confirmConflicts(result.conflicts)) {
          await installToCurrent(sourcePath, true, targetFrameworkId)
        }
      } else {
        await load()
      }
    } catch (error) {
      showError(error, '安装 Skill 失败')
    }
  }

  const handlePickFolder = async (targetFrameworkId = frameworkId): Promise<void> => {
    if (targetFrameworkId === 'all') return
    const dir = await window.aibench.shell.pickDirectory()
    if (dir) await installToCurrent(dir, false, targetFrameworkId)
  }

  const handlePickZip = async (targetFrameworkId = frameworkId): Promise<void> => {
    if (targetFrameworkId === 'all') return
    try {
      const zip = await window.aibench.shell.pickFile([{ name: 'Zip', extensions: ['zip'] }])
      if (!zip) return
      const result = await window.aibench.skills.installFromZip(zip, [targetFrameworkId])
      if (result.conflicts.length > 0 && confirmConflicts(result.conflicts)) {
        await window.aibench.skills.installFromZip(zip, [targetFrameworkId], true)
      }
      await load()
    } catch (error) {
      showError(error, '安装 Zip 失败')
    }
  }

  const runFrameworkAction = (action: 'create' | 'zip' | 'folder', targetId: string): void => {
    if (action === 'create') setCreateOpen(true)
    else if (action === 'zip') void handlePickZip(targetId)
    else void handlePickFolder(targetId)
  }

  /**
   * Install and create need a concrete framework directory. When the list is
   * filtered to "全部", ask which framework to write to instead of leaving the
   * primary actions permanently disabled.
   */
  const requestFrameworkAction = (action: 'create' | 'zip' | 'folder'): void => {
    if (frameworkId !== 'all') {
      runFrameworkAction(action, frameworkId)
      return
    }
    setFrameworkPrompt(action)
  }

  const chooseFramework = (targetId: string): void => {
    const action = frameworkPrompt
    setFrameworkPrompt(null)
    setFrameworkId(targetId)
    if (action) runFrameworkAction(action, targetId)
  }

  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (frameworkId === 'all') return
    try {
      const filePath = window.aibench.shell.getFilePath(file)
      if (file.name.endsWith('.zip')) {
        const result = await window.aibench.skills.installFromZip(filePath, [frameworkId])
        if (result.conflicts.length > 0 && confirmConflicts(result.conflicts)) {
          await window.aibench.skills.installFromZip(filePath, [frameworkId], true)
        }
      } else {
        await installToCurrent(filePath)
      }
      await load()
    } catch (error) {
      showError(error, '安装 Skill 失败')
    }
  }

  const saveSkill = async (): Promise<void> => {
    if (!editSkill) return
    try {
      await window.aibench.skills.update({
        frameworkId: editSkill.frameworkId,
        dirName: editSkill.dirName,
        name: editSkill.meta.name,
        description: editSkill.meta.description,
        body: editSkill.body
      })
      closeSkill()
      await load()
    } catch (error) {
      showError(error, '保存 Skill 失败')
    }
  }

  const confirmRemove = async (): Promise<void> => {
    if (!removeTarget) return
    try {
      await window.aibench.skills.remove(removeTarget.frameworkId, removeTarget.dirName)
      setRemoveTarget(null)
      await load()
    } catch (error) {
      showError(error, '移到归档失败')
    }
  }

  const otherCopies = editSkill
    ? copies.filter((copy) => copy.frameworkId !== editSkill.frameworkId)
    : []
  const differingCopies = editSkill
    ? otherCopies.filter((copy) => !copy.exists || copy.contentHash !== editSkill.contentHash)
    : []

  return (
    <div
      className={`page-shell ${dragOver ? 'ring-2 ring-inset ring-accent-400' : ''}`}
      onDragOver={(e) => {
        if (activeTab !== 'skills') return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (activeTab === 'skills') void onDrop(e)
      }}
    >
      <header className="command-header">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="command-title">Skills</h2>
            <p className="command-subtitle">管理本地 Agent Skill 与归档</p>
          </div>
          <div className="segmented">
            <button
              type="button"
              className={activeTab === 'skills' ? 'segmented-item segmented-active' : 'segmented-item'}
              onClick={() => setActiveTab('skills')}
            >
              Skills
            </button>
            <button
              type="button"
              className={activeTab === 'archive' ? 'segmented-item segmented-active' : 'segmented-item'}
              onClick={() => setActiveTab('archive')}
            >
              归档
            </button>
          </div>
        </div>

        {activeTab === 'skills' && (
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <div className="search-field w-full max-w-[260px]">
              <SearchIcon className="h-[15px] w-[15px]" />
              <input
                className="input"
                placeholder="搜索 Skill…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-0.5">
              <button
                type="button"
                className={frameworkId === 'all' ? 'filter-pill filter-pill-active' : 'filter-pill'}
                onClick={() => setFrameworkId('all')}
              >
                全部
              </button>
              {config.frameworks.map((framework) => (
                <button
                  key={framework.id}
                  type="button"
                  className={
                    frameworkId === framework.id ? 'filter-pill filter-pill-active' : 'filter-pill'
                  }
                  onClick={() => setFrameworkId(framework.id)}
                >
                  {framework.name}
                </button>
              ))}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button type="button" className="btn-ghost" onClick={() => void load()}>
                刷新
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setGithubOpen(true)}
              >
                GitHub 安装
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => requestFrameworkAction('zip')}
              >
                安装 Zip
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => requestFrameworkAction('folder')}
              >
                安装文件夹
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => requestFrameworkAction('create')}
              >
                新建 Skill
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="content-scroll">
        {activeTab === 'archive' ? (
          <ArchiveView config={config} embedded />
        ) : loading ? (
          <p className="text-sm text-slate-500">加载中…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">暂无 Skill</p>
            <p className="text-[13px]">
              {frameworkId === 'all' ? '所有平台暂无 Skill' : '拖拽文件夹或 zip 到此处安装'}
            </p>
          </div>
        ) : (
          <div className="list-card">
            {filtered.map((skill) => (
              <button
                key={`${skill.frameworkId}:${skill.dirName}`}
                type="button"
                className="row-item"
                onClick={() => void openSkill(skill)}
              >
                <span className="row-icon" aria-hidden>
                  {(skill.meta.name || skill.dirName).slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="row-title">{skill.meta.name || skill.dirName}</span>
                  <span className="row-desc">{skill.meta.description || '无描述'}</span>
                  {skill.parseError && (
                    <span className="mt-1 block text-[11.5px] font-medium text-rose-600 dark:text-rose-400">
                      SKILL.md 解析失败，打开后可修复
                    </span>
                  )}
                </span>
                <span className="row-meta">
                  {skill.frameworkName}
                  <ChevronRightIcon />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {editSkill && (
        <Modal
          open
          title={`编辑 Skill — ${editSkill.dirName}`}
          onClose={closeSkill}
          footer={
            <>
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  setRemoveTarget(editSkill)
                  closeSkill()
                }}
              >
                移到归档
              </button>
              <button type="button" className="btn-primary" onClick={() => void saveSkill()}>
                保存
              </button>
            </>
          }
        >
          <div className="space-y-3">
            {editSkill.parseError && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                SKILL.md 的 frontmatter 解析失败：{editSkill.parseError}
                <br />
                保存后会按当前 name / description / 正文重新生成文件。
              </div>
            )}
            <label className="block text-sm">
              name
              <input
                className="input mt-1"
                value={editSkill.meta.name}
                onChange={(e) =>
                  setEditSkill({
                    ...editSkill,
                    meta: { ...editSkill.meta, name: e.target.value }
                  })
                }
              />
            </label>
            <label className="block text-sm">
              description
              <input
                className="input mt-1"
                value={editSkill.meta.description}
                onChange={(e) =>
                  setEditSkill({
                    ...editSkill,
                    meta: { ...editSkill.meta, description: e.target.value }
                  })
                }
              />
            </label>
            <label className="block text-sm">
              正文
              <textarea
                className="textarea mt-1 min-h-[280px]"
                value={editSkill.body}
                onChange={(e) => setEditSkill({ ...editSkill, body: e.target.value })}
              />
            </label>

            <div className="rounded-xl border border-slate-300 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    其他 Framework 副本
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    同一目录名在其他 Framework 中的安装情况
                  </div>
                </div>
                {differingCopies.length > 0 && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void syncAllDiffering()}
                  >
                    同步到全部差异副本
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {otherCopies.length === 0 ? (
                  <p className="text-sm text-slate-500">没有其他 Framework。</p>
                ) : (
                  otherCopies.map((copy) => {
                    const same = copy.exists && copy.contentHash === editSkill.contentHash
                    return (
                      <div
                        key={copy.frameworkId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-950/70"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {copy.frameworkName}
                          </div>
                          <div
                            className={`mt-0.5 text-xs font-semibold ${
                              !copy.exists
                                ? 'text-slate-500'
                                : same
                                  ? 'text-emerald-600 dark:text-emerald-300'
                                  : 'text-amber-600 dark:text-amber-300'
                            }`}
                          >
                            {!copy.exists ? '未安装' : same ? '内容一致' : '内容不同'}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {!copy.exists ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => void syncTo(copy)}
                            >
                              复制到此
                            </button>
                          ) : !same ? (
                            <>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => void openDiff(copy)}
                              >
                                查看差异
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => void syncTo(copy)}
                              >
                                用当前版本覆盖
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {githubOpen && (
        <GithubInstallDialog
          config={config}
          defaultFrameworkId={frameworkId}
          onClose={() => setGithubOpen(false)}
          onInstalled={() => {
            setGithubOpen(false)
            void load()
          }}
        />
      )}

      {frameworkPrompt && (
        <Modal
          open
          title="选择目标平台"
          onClose={() => setFrameworkPrompt(null)}
          panelClassName="max-w-md"
        >
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            安装和新建 Skill 需要写入一个具体的 Framework 目录。
          </p>
          <div className="list-card">
            {config.frameworks.map((framework) => (
              <button
                key={framework.id}
                type="button"
                className="row-item"
                title={framework.path}
                onClick={() => chooseFramework(framework.id)}
              >
                <span className="row-icon" aria-hidden>
                  {framework.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="row-title">{framework.name}</span>
                  <span className="row-desc font-mono">{framework.path}</span>
                </span>
                <ChevronRightIcon />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {diff && <SkillDiffView diff={diff} onClose={() => setDiff(null)} />}

      {createOpen && (
        <CreateSkillModal
          frameworkId={frameworkId === 'all' ? config.frameworks[0]?.id ?? '' : frameworkId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false)
            void load()
          }}
        />
      )}

      {removeTarget && (
        <ConfirmDialog
          message={`确定将「${removeTarget.meta.name || removeTarget.dirName}」移到归档吗？`}
          confirmLabel="移到归档"
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => void confirmRemove()}
        />
      )}
    </div>
  )
}

function CreateSkillModal({
  frameworkId,
  onClose,
  onCreated
}: {
  frameworkId: string
  onClose: () => void
  onCreated: () => void
}): React.ReactElement {
  const [form, setForm] = useState<CreateSkillInput>({
    frameworkId,
    dirName: '',
    name: '',
    description: '',
    body: ''
  })

  const submit = async (): Promise<void> => {
    try {
      await window.aibench.skills.create({ ...form, frameworkId })
      onCreated()
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败')
    }
  }

  return (
    <Modal
      open
      title="新建 Skill"
      onClose={onClose}
      footer={
        <button type="button" className="btn-primary" onClick={() => void submit()}>
          创建
        </button>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          目录名（小写、连字符）
          <input
            className="input mt-1"
            value={form.dirName}
            onChange={(e) => setForm({ ...form, dirName: e.target.value })}
            placeholder="code-review"
          />
        </label>
        <label className="block text-sm">
          name
          <input
            className="input mt-1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          description
          <input
            className="input mt-1"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          正文（可选）
          <textarea
            className="textarea mt-1"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>
      </div>
    </Modal>
  )
}
