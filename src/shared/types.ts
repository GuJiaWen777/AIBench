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

export interface BackupCounts {
  prompts: number
  categories: number
  revisions: number
  archivedSkills: number
  skills: number
}

export interface BackupFrameworkRef {
  id: string
  name: string
  path: string
}

export interface BackupSkillRef {
  frameworkId: string
  dirName: string
}

export interface BackupManifest {
  format: 'aibench-backup'
  version: number
  createdAt: string
  appVersion: string
  includeSkills: boolean
  frameworks: BackupFrameworkRef[]
  skills: BackupSkillRef[]
  counts: BackupCounts
}

export interface BackupInfo {
  dataDir: string
  configPath: string
  dbPath: string
  archivePath: string
}

export interface BackupPreview {
  path: string
  size: number
  manifest: BackupManifest
  hasConfig: boolean
  hasArchive: boolean
}

export interface BackupCreateResult {
  path: string
  size: number
  manifest: BackupManifest
}

export interface RestoreOptions {
  restoreConfig: boolean
  restoreSkills: boolean
  overwriteSkills: boolean
}

export type RestoreSkipReason = 'FRAMEWORK_NOT_FOUND' | 'TARGET_EXISTS' | 'MISSING_IN_BACKUP'

export interface RestoreSkip {
  frameworkId: string
  dirName: string
  reason: RestoreSkipReason
}

export interface RestoreResult {
  manifest: BackupManifest
  safetyBackupPath: string
  archiveRestored: boolean
  skillsInstalled: string[]
  skillsSkipped: RestoreSkip[]
}

export type HealthSeverity = 'error' | 'warning' | 'info'

export interface HealthIssue {
  id: string
  severity: HealthSeverity
  code: string
  title: string
  detail: string
  fixable: boolean
}

export interface HealthReport {
  checkedAt: string
  issues: HealthIssue[]
  summary: { errors: number; warnings: number; infos: number; total: number }
}

export interface InstallConflict {
  dirName: string
  targetPath: string
}

export interface InstallResult {
  installed: string[]
  conflicts: InstallConflict[]
}

export interface GithubSkillFile {
  path: string
  size: number
  /** Executable or source file the user should review before installing. */
  isScript: boolean
}

export interface GithubSkillPreview {
  dirName: string
  name: string
  description: string
  relativePath: string
  body: string
  files: GithubSkillFile[]
  fileCount: number
  totalBytes: number
  scriptCount: number
  parseError?: string
}

export interface GithubPreview {
  sessionId: string
  repo: string
  ref: string
  subdir: string
  skills: GithubSkillPreview[]
  totalBytes: number
  /** True when the repo contained more skills/files than the preview cap. */
  truncated: boolean
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
  marketplace: {
    inspectGithub: (url: string) => Promise<GithubPreview>
    installGithub: (
      sessionId: string,
      dirNames: string[],
      frameworkIds: string[],
      overwrite?: boolean
    ) => Promise<InstallResult>
    cancelGithub: (sessionId: string) => Promise<void>
  }
  backup: {
    info: () => Promise<BackupInfo>
    create: (options: { includeSkills: boolean }) => Promise<BackupCreateResult | null>
    pick: () => Promise<string | null>
    inspect: (path: string) => Promise<BackupPreview>
    restore: (path: string, options: RestoreOptions) => Promise<RestoreResult>
  }
  health: {
    check: () => Promise<HealthReport>
    fix: (issueId: string) => Promise<HealthReport>
  }
  app: {
    relaunch: () => Promise<void>
  }
  quick: {
    hide: () => Promise<void>
    onOpened: (callback: () => void) => () => void
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
