import { ipcMain, dialog, shell, nativeTheme } from 'electron'
import { getConfig, updateConfig, ensureDataDirs } from './config'
import * as skillService from './skill-service'
import * as archiveService from './archive-service'
import * as promptDb from './db'
import * as exportService from './export-service'
import { restartSkillWatcher, notifySkillsChanged } from './watcher'
import type { AppConfig, ThemeMode } from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('config:get', () => getConfig())

  ipcMain.handle('config:update', (_e, partial: Partial<AppConfig>) => {
    const next = updateConfig(partial)
    restartSkillWatcher()
    return next
  })

  ipcMain.handle('config:pickDirectory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('skills:list', (_e, frameworkId: string) =>
    skillService.listSkills(frameworkId)
  )

  ipcMain.handle('skills:get', (_e, frameworkId: string, dirName: string) =>
    skillService.getSkill(frameworkId, dirName)
  )

  ipcMain.handle(
    'skills:installFromPath',
    (_e, sourcePath: string, frameworkIds: string[], overwrite?: boolean) =>
      skillService.installFromPath(sourcePath, frameworkIds, overwrite)
  )

  ipcMain.handle(
    'skills:installFromZip',
    (_e, zipPath: string, frameworkIds: string[], overwrite?: boolean) =>
      skillService.installFromZip(zipPath, frameworkIds, overwrite)
  )

  ipcMain.handle('skills:create', (_e, input) => {
    const result = skillService.createSkill(input)
    notifySkillsChanged()
    return result
  })

  ipcMain.handle('skills:update', (_e, input) => {
    const result = skillService.updateSkill(input)
    notifySkillsChanged()
    return result
  })

  ipcMain.handle('skills:remove', (_e, frameworkId: string, dirName: string) => {
    skillService.removeSkillToArchive(frameworkId, dirName)
    notifySkillsChanged()
  })

  ipcMain.handle('skills:rescan', () => {
    notifySkillsChanged()
  })

  ipcMain.handle('archive:list', () => archiveService.listArchive())

  ipcMain.handle(
    'archive:restore',
    (_e, id: string, frameworkIds: string[], overwrite?: boolean) => {
      const result = archiveService.restoreFromArchive(id, frameworkIds, overwrite)
      if (result.installed.length > 0) notifySkillsChanged()
      return result
    }
  )

  ipcMain.handle('archive:deletePermanent', (_e, id: string) => {
    archiveService.deleteArchivePermanent(id)
  })

  ipcMain.handle('prompts:list', (_e, query?: string, tag?: string) =>
    promptDb.listPrompts(query, tag)
  )

  ipcMain.handle('prompts:get', (_e, id: string) => promptDb.getPrompt(id))

  ipcMain.handle('prompts:create', (_e, title: string, body: string, tags: string[]) =>
    promptDb.createPrompt(title, body, tags)
  )

  ipcMain.handle(
    'prompts:update',
    (_e, id: string, title: string, body: string, tags: string[]) =>
      promptDb.updatePrompt(id, title, body, tags)
  )

  ipcMain.handle('prompts:delete', (_e, id: string) => promptDb.deletePrompt(id))

  ipcMain.handle('prompts:listTags', () => promptDb.listTags())

  ipcMain.handle('prompts:exportOne', (_e, id: string) => exportService.exportPrompt(id))

  ipcMain.handle('prompts:exportAll', () => exportService.exportAllPrompts())

  ipcMain.handle('shell:openPath', (_e, targetPath: string) => {
    shell.openPath(targetPath)
  })

  ipcMain.handle('shell:pickFile', async (_e, filters?) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters ?? [{ name: 'Zip', extensions: ['zip'] }]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('shell:pickDirectory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('theme:get', () => nativeTheme.shouldUseDarkColors)

  ipcMain.handle('theme:setMode', (_e, mode: ThemeMode) => {
    const config = updateConfig({ theme: mode })
    if (mode === 'system') nativeTheme.themeSource = 'system'
    else nativeTheme.themeSource = mode
    return config.theme
  })
}

export function applyThemeFromConfig(): void {
  const { theme } = getConfig()
  nativeTheme.themeSource = theme === 'system' ? 'system' : theme
}

export function ensureAppReady(): void {
  ensureDataDirs()
  promptDb.getDb()
}
