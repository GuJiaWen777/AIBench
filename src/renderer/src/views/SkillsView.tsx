import { useCallback, useEffect, useState } from 'react'
import type { AppConfig, CreateSkillInput, SkillDetail, SkillItem } from '@shared/types'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import ArchiveView from './ArchiveView'

interface Props {
  config: AppConfig
}

export default function SkillsView({ config }: Props): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'skills' | 'archive'>('skills')
  const [frameworkId, setFrameworkId] = useState(config.frameworks[0]?.id ?? '')
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editSkill, setEditSkill] = useState<SkillDetail | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<SkillItem | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const load = useCallback(async () => {
    if (!frameworkId) return
    setLoading(true)
    try {
      setSkills(await window.aibench.skills.list(frameworkId))
    } finally {
      setLoading(false)
    }
  }, [frameworkId])

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

  const openSkill = async (item: SkillItem): Promise<void> => {
    const detail = await window.aibench.skills.get(item.frameworkId, item.dirName)
    if (detail) setEditSkill(detail)
  }

  const installToCurrent = async (sourcePath: string, overwrite = false): Promise<void> => {
    const result = await window.aibench.skills.installFromPath(
      sourcePath,
      [frameworkId],
      overwrite
    )
    if (result.conflicts.length > 0) {
      const c = result.conflicts[0]
      const ok = confirm(`「${c.dirName}」已存在，是否覆盖？`)
      if (ok) await installToCurrent(sourcePath, true)
    } else {
      await load()
    }
  }

  const handlePickFolder = async (): Promise<void> => {
    const dir = await window.aibench.shell.pickDirectory()
    if (dir) await installToCurrent(dir)
  }

  const handlePickZip = async (): Promise<void> => {
    const zip = await window.aibench.shell.pickFile([{ name: 'Zip', extensions: ['zip'] }])
    if (!zip) return
    const result = await window.aibench.skills.installFromZip(zip, [frameworkId])
    if (result.conflicts.length > 0) {
      const ok = confirm(`「${result.conflicts[0].dirName}」已存在，是否覆盖？`)
      if (ok) await window.aibench.skills.installFromZip(zip, [frameworkId], true)
    }
    await load()
  }

  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const filePath = window.aibench.shell.getFilePath(file)
    if (file.name.endsWith('.zip')) {
      const result = await window.aibench.skills.installFromZip(filePath, [frameworkId])
      if (result.conflicts.length > 0) {
        const ok = confirm(`「${result.conflicts[0].dirName}」已存在，是否覆盖？`)
        if (ok) await window.aibench.skills.installFromZip(filePath, [frameworkId], true)
      }
    } else {
      await installToCurrent(filePath)
    }
    await load()
  }

  const saveSkill = async (): Promise<void> => {
    if (!editSkill) return
    await window.aibench.skills.update({
      frameworkId: editSkill.frameworkId,
      dirName: editSkill.dirName,
      name: editSkill.meta.name,
      description: editSkill.meta.description,
      body: editSkill.body
    })
    setEditSkill(null)
    await load()
  }

  const confirmRemove = async (): Promise<void> => {
    if (!removeTarget) return
    await window.aibench.skills.remove(removeTarget.frameworkId, removeTarget.dirName)
    setRemoveTarget(null)
    await load()
  }

  return (
    <div
      className={`flex h-full flex-col ${dragOver ? 'ring-2 ring-inset ring-blue-400' : ''}`}
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
      <header className="space-y-3 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Skills</h2>
            <p className="mt-1 text-sm text-zinc-500">管理本地 Agent Skill 与归档</p>
          </div>
          <div className="segmented">
            <button
              type="button"
              className={activeTab === 'skills' ? 'segmented-active' : 'segmented-item'}
              onClick={() => setActiveTab('skills')}
            >
              Skills
            </button>
            <button
              type="button"
              className={activeTab === 'archive' ? 'segmented-active' : 'segmented-item'}
              onClick={() => setActiveTab('archive')}
            >
              归档
            </button>
          </div>
        </div>
        {activeTab === 'skills' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-1 flex-wrap gap-2">
              {config.frameworks.map((fw) => (
                <button
                  key={fw.id}
                  type="button"
                  onClick={() => setFrameworkId(fw.id)}
                  className={frameworkId === fw.id ? 'chip-active' : 'chip'}
                >
                  {fw.name}
                </button>
              ))}
            </div>
            <input
              className="input max-w-xs"
              placeholder="搜索 Skill…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" className="btn-secondary" onClick={() => void load()}>
              刷新
            </button>
            <button type="button" className="btn-secondary" onClick={() => void handlePickZip()}>
              安装 Zip
            </button>
            <button type="button" className="btn-secondary" onClick={() => void handlePickFolder()}>
              安装文件夹
            </button>
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
              新建 Skill
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'archive' ? (
          <ArchiveView config={config} embedded />
        ) : (
          <>
            {loading ? (
              <p className="text-zinc-500">加载中…</p>
            ) : filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
                <p>暂无 Skill</p>
                <p className="mt-2 text-sm">拖拽文件夹或 zip 到此处安装</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((skill) => (
                  <button
                    key={skill.dirName}
                    type="button"
                    className="card text-left transition hover:border-blue-300 dark:hover:border-blue-700"
                    onClick={() => void openSkill(skill)}
                  >
                    <div className="font-medium">{skill.meta.name || skill.dirName}</div>
                    <div className="mt-1 text-xs text-zinc-500">{skill.dirName}</div>
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {skill.meta.description || '无描述'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {editSkill && (
        <Modal
          open
          title={`编辑 Skill — ${editSkill.dirName}`}
          onClose={() => setEditSkill(null)}
          footer={
            <>
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  const item = skills.find((s) => s.dirName === editSkill.dirName)
                  if (item) {
                    setEditSkill(null)
                    setRemoveTarget(item)
                  }
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
          </div>
        </Modal>
      )}

      {createOpen && (
        <CreateSkillModal
          frameworkId={frameworkId}
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
