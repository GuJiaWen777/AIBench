export type ThemeMode = 'system' | 'light' | 'dark'

export interface Framework {
  id: string
  name: string
  path: string
  builtIn: boolean
}

export interface AppConfig {
  frameworks: Framework[]
  archivePath: string
  exportPath: string
  theme: ThemeMode
}

export interface SkillMeta {
  name: string
  description: string
}

export interface SkillItem {
  dirName: string
  frameworkId: string
  frameworkName: string
  path: string
  meta: SkillMeta
  modifiedAt: string
  parseError?: string
}

export interface SkillDetail extends SkillItem {
  body: string
  contentHash: string
}

export interface SkillCopy {
  frameworkId: string
  frameworkName: string
  path: string
  exists: boolean
  modifiedAt: string | null
  contentHash: string | null
}

export type SkillFileStatus = 'same' | 'modified' | 'onlyA' | 'onlyB'

export interface SkillFileDiff {
  path: string
  status: SkillFileStatus
  binary: boolean
  aContent: string | null
  bContent: string | null
  aSize: number
  bSize: number
}

export interface SkillDiff {
  dirName: string
  a: { frameworkId: string; frameworkName: string }
  b: { frameworkId: string; frameworkName: string }
  identical: boolean
  files: SkillFileDiff[]
}

export interface ArchiveRecord {
  id: string
  dirName: string
  removedFrom: string
  originalPath: string
  removedAt: string
  archivePath: string
  meta: SkillMeta
}

export interface PromptItem {
  id: string
  title: string
  body: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface PromptCategory {
  name: string
  promptCount: number
}

export interface PromptRevision {
  id: number
  promptId: string
  title: string
  body: string
  tags: string[]
  createdAt: string
}

export interface InstallConflict {
  dirName: string
  targetPath: string
}

export interface InstallResult {
  installed: string[]
  conflicts: InstallConflict[]
}

export interface CreateSkillInput {
  frameworkId: string
  dirName: string
  name: string
  description: string
  body: string
}

export interface UpdateSkillInput {
  frameworkId: string
  dirName: string
  name: string
  description: string
  body: string
}

export interface AibenchApi {
  config: {
    get: () => Promise<AppConfig>
    update: (partial: Partial<AppConfig>) => Promise<AppConfig>
  }
  skills: {
    list: (frameworkId: string) => Promise<SkillItem[]>
    get: (frameworkId: string, dirName: string) => Promise<SkillDetail | null>
    installFromPath: (
      sourcePath: string,
      frameworkIds: string[],
      overwrite?: boolean
    ) => Promise<InstallResult>
    installFromZip: (
      zipPath: string,
      frameworkIds: string[],
      overwrite?: boolean
    ) => Promise<InstallResult>
    create: (input: CreateSkillInput) => Promise<SkillDetail>
    update: (input: UpdateSkillInput) => Promise<SkillDetail>
    remove: (frameworkId: string, dirName: string) => Promise<void>
    copies: (dirName: string) => Promise<SkillCopy[]>
    diff: (dirName: string, a: string, b: string) => Promise<SkillDiff>
    sync: (source: string, dirName: string, targets: string[]) => Promise<InstallResult>
    onChanged: (callback: () => void) => () => void
    rescan: () => Promise<void>
  }
  archive: {
    list: () => Promise<ArchiveRecord[]>
    restore: (id: string, frameworkIds: string[], overwrite?: boolean) => Promise<InstallResult>
    deletePermanent: (id: string) => Promise<void>
  }
  prompts: {
    list: (query?: string, tag?: string) => Promise<PromptItem[]>
    create: (title: string, body: string, tags: string[]) => Promise<PromptItem>
    update: (
      id: string,
      title: string,
      body: string,
      tags: string[]
    ) => Promise<PromptItem>
    delete: (id: string) => Promise<void>
    listRevisions: (id: string) => Promise<PromptRevision[]>
    restoreRevision: (promptId: string, revisionId: number) => Promise<PromptItem>
    listCategories: () => Promise<PromptCategory[]>
    createCategory: (name: string) => Promise<PromptCategory[]>
    renameCategory: (oldName: string, newName: string) => Promise<PromptCategory[]>
    deleteCategory: (name: string) => Promise<PromptCategory[]>
    exportOne: (id: string) => Promise<string>
    exportAll: () => Promise<string[]>
  }
  shell: {
    pickFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
    pickDirectory: () => Promise<string | null>
    getFilePath: (file: File) => string
  }
  theme: {
    get: () => Promise<boolean>
    setMode: (mode: ThemeMode) => Promise<boolean>
    onChanged: (callback: (isDark: boolean) => void) => () => void
  }
}

declare global {
  interface Window {
    aibench: AibenchApi
  }
}

export {}
