import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AibenchApi, AppConfig, ThemeMode } from '../shared/types'

const api: AibenchApi = {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    update: (partial: Partial<AppConfig>) => ipcRenderer.invoke('config:update', partial)
  },
  skills: {
    list: (frameworkId) => ipcRenderer.invoke('skills:list', frameworkId),
    get: (frameworkId, dirName) => ipcRenderer.invoke('skills:get', frameworkId, dirName),
    installFromPath: (sourcePath, frameworkIds, overwrite) =>
      ipcRenderer.invoke('skills:installFromPath', sourcePath, frameworkIds, overwrite),
    installFromZip: (zipPath, frameworkIds, overwrite) =>
      ipcRenderer.invoke('skills:installFromZip', zipPath, frameworkIds, overwrite),
    create: (input) => ipcRenderer.invoke('skills:create', input),
    update: (input) => ipcRenderer.invoke('skills:update', input),
    remove: (frameworkId, dirName) => ipcRenderer.invoke('skills:remove', frameworkId, dirName),
    copies: (dirName) => ipcRenderer.invoke('skills:copies', dirName),
    diff: (dirName, a, b) => ipcRenderer.invoke('skills:diff', dirName, a, b),
    sync: (source, dirName, targets) =>
      ipcRenderer.invoke('skills:sync', source, dirName, targets),
    onChanged: (callback) => {
      const handler = (): void => callback()
      ipcRenderer.on('skills:changed', handler)
      return () => ipcRenderer.removeListener('skills:changed', handler)
    },
    rescan: () => ipcRenderer.invoke('skills:rescan')
  },
  archive: {
    list: () => ipcRenderer.invoke('archive:list'),
    restore: (id, frameworkIds, overwrite) =>
      ipcRenderer.invoke('archive:restore', id, frameworkIds, overwrite),
    deletePermanent: (id) => ipcRenderer.invoke('archive:deletePermanent', id)
  },
  prompts: {
    list: (query, tag) => ipcRenderer.invoke('prompts:list', query, tag),
    create: (title, body, tags) => ipcRenderer.invoke('prompts:create', title, body, tags),
    update: (id, title, body, tags) =>
      ipcRenderer.invoke('prompts:update', id, title, body, tags),
    delete: (id) => ipcRenderer.invoke('prompts:delete', id),
    listRevisions: (id) => ipcRenderer.invoke('prompts:listRevisions', id),
    restoreRevision: (promptId, revisionId) =>
      ipcRenderer.invoke('prompts:restoreRevision', promptId, revisionId),
    listCategories: () => ipcRenderer.invoke('prompts:listCategories'),
    createCategory: (name) => ipcRenderer.invoke('prompts:createCategory', name),
    renameCategory: (oldName, newName) =>
      ipcRenderer.invoke('prompts:renameCategory', oldName, newName),
    deleteCategory: (name) => ipcRenderer.invoke('prompts:deleteCategory', name),
    exportOne: (id) => ipcRenderer.invoke('prompts:exportOne', id),
    exportAll: () => ipcRenderer.invoke('prompts:exportAll')
  },
  backup: {
    info: () => ipcRenderer.invoke('backup:info'),
    create: (options) => ipcRenderer.invoke('backup:create', options),
    pick: () => ipcRenderer.invoke('backup:pick'),
    inspect: (path) => ipcRenderer.invoke('backup:inspect', path),
    restore: (path, options) => ipcRenderer.invoke('backup:restore', path, options)
  },
  health: {
    check: () => ipcRenderer.invoke('health:check'),
    fix: (issueId) => ipcRenderer.invoke('health:fix', issueId)
  },
  app: {
    relaunch: () => ipcRenderer.invoke('app:relaunch')
  },
  shell: {
    pickFile: (filters) => ipcRenderer.invoke('shell:pickFile', filters),
    pickDirectory: () => ipcRenderer.invoke('shell:pickDirectory'),
    getFilePath: (file) => webUtils.getPathForFile(file)
  },
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    setMode: (mode: ThemeMode) => ipcRenderer.invoke('theme:setMode', mode),
    onChanged: (callback) => {
      const handler = (_: unknown, isDark: boolean): void => callback(isDark)
      ipcRenderer.on('theme:changed', handler)
      return () => ipcRenderer.removeListener('theme:changed', handler)
    }
  }
}

contextBridge.exposeInMainWorld('aibench', api)
