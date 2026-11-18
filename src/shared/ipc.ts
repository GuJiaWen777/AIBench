import type {
  AppConfig,
  ArchiveRecord,
  BackupCreateResult,
  BackupInfo,
  BackupPreview,
  CreateSkillInput,
  GithubPreview,
  HealthReport,
  InstallResult,
  PromptCategory,
  PromptItem,
  PromptRevision,
  RestoreOptions,
  RestoreResult,
  SkillCopy,
  SkillDetail,
  SkillDiff,
  SkillItem,
  ThemeMode,
  UpdateSkillInput
} from './types'

export interface FileFilter {
  name: string
  extensions: string[]
}

/**
 * Single source of truth for every request/response IPC channel.
 *
 * The main process registers handlers through this map and the preload bridge
 * calls it through the same map, so a channel name, argument list or result
 * type cannot drift between the two sides without a compile error.
 */
export interface IpcContract {
  'config:get': { args: []; result: AppConfig }
  'config:update': { args: [partial: Partial<AppConfig>]; result: AppConfig }

  'skills:list': { args: [frameworkId: string]; result: SkillItem[] }
  'skills:get': { args: [frameworkId: string, dirName: string]; result: SkillDetail | null }
  'skills:installFromPath': {
    args: [sourcePath: string, frameworkIds: string[], overwrite?: boolean]
    result: InstallResult
  }
  'skills:installFromZip': {
    args: [zipPath: string, frameworkIds: string[], overwrite?: boolean]
    result: InstallResult
  }
  'skills:create': { args: [input: CreateSkillInput]; result: SkillDetail }
  'skills:update': { args: [input: UpdateSkillInput]; result: SkillDetail }
  'skills:remove': { args: [frameworkId: string, dirName: string]; result: void }
  'skills:copies': { args: [dirName: string]; result: SkillCopy[] }
  'skills:diff': { args: [dirName: string, a: string, b: string]; result: SkillDiff }
  'skills:sync': {
    args: [source: string, dirName: string, targets: string[]]
    result: InstallResult
  }
  'marketplace:inspectGithub': { args: [url: string]; result: GithubPreview }
  'marketplace:installGithub': {
    args: [sessionId: string, dirNames: string[], frameworkIds: string[], overwrite?: boolean]
    result: InstallResult
  }
  'marketplace:cancelGithub': { args: [sessionId: string]; result: void }

  'archive:list': { args: []; result: ArchiveRecord[] }
  'archive:restore': {
    args: [id: string, frameworkIds: string[], overwrite?: boolean]
    result: InstallResult
  }
  'archive:deletePermanent': { args: [id: string]; result: void }

  'prompts:list': { args: [query?: string, tag?: string]; result: PromptItem[] }
  'prompts:create': { args: [title: string, body: string, tags: string[]]; result: PromptItem }
  'prompts:update': {
    args: [id: string, title: string, body: string, tags: string[]]
    result: PromptItem
  }
  'prompts:delete': { args: [id: string]; result: void }
  'prompts:listRevisions': { args: [id: string]; result: PromptRevision[] }
  'prompts:restoreRevision': { args: [promptId: string, revisionId: number]; result: PromptItem }
  'prompts:listCategories': { args: []; result: PromptCategory[] }
  'prompts:createCategory': { args: [name: string]; result: PromptCategory[] }
  'prompts:renameCategory': {
    args: [oldName: string, newName: string]
    result: PromptCategory[]
  }
  'prompts:deleteCategory': { args: [name: string]; result: PromptCategory[] }
  'prompts:exportOne': { args: [id: string]; result: string }
  'prompts:exportAll': { args: []; result: string[] }

  'backup:info': { args: []; result: BackupInfo }
  'backup:create': {
    args: [options?: { includeSkills?: boolean }]
    result: BackupCreateResult | null
  }
  'backup:pick': { args: []; result: string | null }
  'backup:inspect': { args: [filePath: string]; result: BackupPreview }
  'backup:restore': {
    args: [filePath: string, options?: Partial<RestoreOptions>]
    result: RestoreResult
  }

  'health:check': { args: []; result: HealthReport }
  'health:fix': { args: [issueId: string]; result: HealthReport }

  'app:relaunch': { args: []; result: void }

  'quick:hide': { args: []; result: void }

  'shell:pickFile': { args: [filters?: FileFilter[]]; result: string | null }
  'shell:pickDirectory': { args: []; result: string | null }

  'theme:get': { args: []; result: boolean }
  'theme:setMode': { args: [mode: ThemeMode]; result: boolean }
}

export type IpcChannel = keyof IpcContract
export type IpcArgs<C extends IpcChannel> = IpcContract[C]['args']
export type IpcResult<C extends IpcChannel> = IpcContract[C]['result']

/** Push channels sent from main to renderer. */
export interface IpcEvents {
  'skills:changed': []
  'theme:changed': [isDark: boolean]
  'quick:opened': []
}

export type IpcEvent = keyof IpcEvents
export type IpcEventArgs<E extends IpcEvent> = IpcEvents[E]
