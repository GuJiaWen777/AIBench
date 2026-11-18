import { app, ipcMain, dialog, nativeTheme } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { getConfig, updateConfig, ensureDataDirs } from './config'
import * as skillService from './skill-service'
import * as skillCompare from './skill-compare'
import * as archiveService from './archive-service'
import * as marketplaceService from './marketplace-service'
import * as promptDb from './db'
import * as exportService from './export-service'
import * as backupService from './backup-service'
import * as healthService from './health-service'
import { restartSkillWatcher, notifySkillsChanged } from './watcher'
import { hideQuickWindow } from './quick-launcher'
import type { IpcArgs, IpcChannel, IpcResult } from '../shared/ipc'
import type { AppConfig } from '../shared/types'

type IpcHandler<C extends IpcChannel> = (
  event: IpcMainInvokeEvent,
  ...args: IpcArgs<C>
) => IpcResult<C> | Promise<IpcResult<C>>

/** One handler per contract channel; a missing channel is a compile error. */
type IpcHandlers = { [C in IpcChannel]: IpcHandler<C> }

function frameworkSignature(config: AppConfig): string {
  return config.frameworks.map((framework) => `${framework.id}|${framework.path}`).join('\n')
}

export function registerIpcHandlers(): void {
  const handlers: IpcHandlers = {
    'config:get': () => getConfig(),

    'config:update': (_e, partial) => {
      const before = frameworkSignature(getConfig())
      const next = updateConfig(partial)
      if (frameworkSignature(next) !== before) restartSkillWatcher()
      return next
    },

    'skills:list': (_e, frameworkId) => skillService.listSkills(frameworkId),

    'skills:get': (_e, frameworkId, dirName) => skillService.getSkill(frameworkId, dirName),

    'skills:installFromPath': (_e, sourcePath, frameworkIds, overwrite) =>
      skillService.installFromPath(sourcePath, frameworkIds, overwrite),

    'skills:installFromZip': (_e, zipPath, frameworkIds, overwrite) =>
      skillService.installFromZip(zipPath, frameworkIds, overwrite),

    'skills:create': (_e, input) => {
      const result = skillService.createSkill(input)
      notifySkillsChanged()
      return result
    },

    'skills:update': (_e, input) => {
      const result = skillService.updateSkill(input)
      notifySkillsChanged()
      return result
    },

    'skills:remove': (_e, frameworkId, dirName) => {
      skillService.removeSkillToArchive(frameworkId, dirName)
      notifySkillsChanged()
    },

    'skills:copies': (_e, dirName) => skillCompare.listSkillCopies(dirName),

    'skills:diff': (_e, dirName, a, b) => skillCompare.diffSkillCopies(dirName, a, b),

    'skills:sync': (_e, source, dirName, targets) => {
      const result = skillCompare.syncSkillCopies(source, dirName, targets)
      if (result.installed.length > 0) notifySkillsChanged()
      return result
    },

    'marketplace:inspectGithub': (_e, url) => marketplaceService.inspectGithub(url),

    'marketplace:installGithub': (_e, sessionId, dirNames, frameworkIds, overwrite) => {
      const result = marketplaceService.installGithub(
        sessionId,
        dirNames,
        frameworkIds,
        overwrite
      )
      if (result.installed.length > 0) notifySkillsChanged()
      return result
    },

    'marketplace:cancelGithub': (_e, sessionId) => {
      marketplaceService.cancelGithub(sessionId)
    },

    'archive:list': () => archiveService.listArchive(),

    'archive:restore': (_e, id, frameworkIds, overwrite) => {
      const result = archiveService.restoreFromArchive(id, frameworkIds, overwrite)
      if (result.installed.length > 0) notifySkillsChanged()
      return result
    },

    'archive:deletePermanent': (_e, id) => {
      archiveService.deleteArchivePermanent(id)
    },

    'prompts:list': (_e, query, tag) => promptDb.listPrompts(query, tag),

    'prompts:create': (_e, title, body, tags) => promptDb.createPrompt(title, body, tags),

    'prompts:update': (_e, id, title, body, tags) =>
      promptDb.updatePrompt(id, title, body, tags),

    'prompts:delete': (_e, id) => promptDb.deletePrompt(id),

    'prompts:listRevisions': (_e, id) => promptDb.listRevisions(id),

    'prompts:restoreRevision': (_e, promptId, revisionId) =>
      promptDb.restoreRevision(promptId, revisionId),

    'prompts:listCategories': () => promptDb.listCategories(),

    'prompts:createCategory': (_e, name) => promptDb.createCategory(name),

    'prompts:renameCategory': (_e, oldName, newName) =>
      promptDb.renameCategory(oldName, newName),

    'prompts:deleteCategory': (_e, name) => promptDb.deleteCategory(name),

    'prompts:exportOne': (_e, id) => exportService.exportPrompt(id),

    'prompts:exportAll': () => exportService.exportAllPrompts(),

    'backup:info': () => backupService.getBackupInfo(),

    'backup:create': (_e, options) =>
      backupService.createBackup({ includeSkills: options?.includeSkills === true }),

    'backup:pick': () => backupService.pickBackupFile(),

    'backup:inspect': (_e, filePath) => {
      if (typeof filePath !== 'string' || !filePath) throw new Error('BACKUP_SOURCE_MISSING')
      return backupService.inspectBackup(filePath)
    },

    'backup:restore': (_e, filePath, options) => {
      if (typeof filePath !== 'string' || !filePath) throw new Error('BACKUP_SOURCE_MISSING')
      const result = backupService.restoreBackup(filePath, options)
      applyThemeFromConfig()
      restartSkillWatcher()
      notifySkillsChanged()
      return result
    },

    'health:check': () => healthService.runHealthCheck(),

    'health:fix': (_e, issueId) => {
      if (typeof issueId !== 'string' || !issueId) throw new Error('HEALTH_FIX_UNAVAILABLE')
      return healthService.fixHealthIssue(issueId)
    },

    'app:relaunch': () => {
      app.relaunch()
      app.exit(0)
    },

    'quick:hide': () => {
      hideQuickWindow()
    },

    'shell:pickFile': async (_e, filters) => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: filters ?? [{ name: 'Zip', extensions: ['zip'] }]
      })
      return result.canceled ? null : (result.filePaths[0] ?? null)
    },

    'shell:pickDirectory': async () => {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      return result.canceled ? null : (result.filePaths[0] ?? null)
    },

    'theme:get': () => nativeTheme.shouldUseDarkColors,

    'theme:setMode': (_e, mode) => {
      updateConfig({ theme: mode })
      if (mode === 'system') nativeTheme.themeSource = 'system'
      else nativeTheme.themeSource = mode
      return nativeTheme.shouldUseDarkColors
    }
  }

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, handler as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown)
  }
}

export function applyThemeFromConfig(): void {
  const { theme } = getConfig()
  nativeTheme.themeSource = theme === 'system' ? 'system' : theme
}

export function ensureAppReady(): void {
  ensureDataDirs()
  promptDb.getDb()
}
