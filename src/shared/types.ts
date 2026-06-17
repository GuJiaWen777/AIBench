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
}

export interface SkillDetail extends SkillItem {
  body: string
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
    pickDirectory: () => Promise<string | null>
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
    get: (id: string) => Promise<PromptItem | null>
    create: (title: string, body: string, tags: string[]) => Promise<PromptItem>
    update: (
      id: string,
      title: string,
      body: string,
      tags: string[]
    ) => Promise<PromptItem>
    delete: (id: string) => Promise<void>
    listTags: () => Promise<string[]>
    exportOne: (id: string) => Promise<string>
    exportAll: () => Promise<string[]>
  }
  shell: {
    openPath: (targetPath: string) => Promise<void>
    pickFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
    pickDirectory: () => Promise<string | null>
    getFilePath: (file: File) => string
  }
  theme: {
    get: () => Promise<boolean>
    setMode: (mode: ThemeMode) => Promise<void>
    onChanged: (callback: (isDark: boolean) => void) => () => void
  }
}

declare global {
  interface Window {
    aibench: AibenchApi
  }
}

export {}
