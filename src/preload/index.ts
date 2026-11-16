import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AibenchApi } from '../shared/types'
import type { IpcArgs, IpcChannel, IpcEventArgs, IpcEvent, IpcResult } from '../shared/ipc'

/**
 * Typed wrapper around invoke. The channel name and argument list must match
 * the contract in src/shared/ipc.ts, which the main process also implements.
 */
function invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>): Promise<IpcResult<C>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<C>>
}

function subscribe<E extends IpcEvent>(
  event: E,
  callback: (...args: IpcEventArgs<E>) => void
): () => void {
  const handler = (_event: unknown, ...args: unknown[]): void => {
    callback(...(args as IpcEventArgs<E>))
  }
  ipcRenderer.on(event, handler)
  return () => ipcRenderer.removeListener(event, handler)
}

const api: AibenchApi = {
  config: {
    get: () => invoke('config:get'),
    update: (partial) => invoke('config:update', partial)
  },
  skills: {
    list: (frameworkId) => invoke('skills:list', frameworkId),
    get: (frameworkId, dirName) => invoke('skills:get', frameworkId, dirName),
    installFromPath: (sourcePath, frameworkIds, overwrite) =>
      invoke('skills:installFromPath', sourcePath, frameworkIds, overwrite),
    installFromZip: (zipPath, frameworkIds, overwrite) =>
      invoke('skills:installFromZip', zipPath, frameworkIds, overwrite),
    create: (input) => invoke('skills:create', input),
    update: (input) => invoke('skills:update', input),
    remove: (frameworkId, dirName) => invoke('skills:remove', frameworkId, dirName),
    copies: (dirName) => invoke('skills:copies', dirName),
    diff: (dirName, a, b) => invoke('skills:diff', dirName, a, b),
    sync: (source, dirName, targets) => invoke('skills:sync', source, dirName, targets),
    onChanged: (callback) => subscribe('skills:changed', callback),
    rescan: () => invoke('skills:rescan')
  },
  marketplace: {
    inspectGithub: (url) => invoke('marketplace:inspectGithub', url),
    installGithub: (sessionId, dirNames, frameworkIds, overwrite) =>
      invoke('marketplace:installGithub', sessionId, dirNames, frameworkIds, overwrite),
    cancelGithub: (sessionId) => invoke('marketplace:cancelGithub', sessionId)
  },
  archive: {
    list: () => invoke('archive:list'),
    restore: (id, frameworkIds, overwrite) =>
      invoke('archive:restore', id, frameworkIds, overwrite),
    deletePermanent: (id) => invoke('archive:deletePermanent', id)
  },
  prompts: {
    list: (query, tag) => invoke('prompts:list', query, tag),
    create: (title, body, tags) => invoke('prompts:create', title, body, tags),
    update: (id, title, body, tags) => invoke('prompts:update', id, title, body, tags),
    delete: (id) => invoke('prompts:delete', id),
    listRevisions: (id) => invoke('prompts:listRevisions', id),
    restoreRevision: (promptId, revisionId) =>
      invoke('prompts:restoreRevision', promptId, revisionId),
    listCategories: () => invoke('prompts:listCategories'),
    createCategory: (name) => invoke('prompts:createCategory', name),
    renameCategory: (oldName, newName) => invoke('prompts:renameCategory', oldName, newName),
    deleteCategory: (name) => invoke('prompts:deleteCategory', name),
    exportOne: (id) => invoke('prompts:exportOne', id),
    exportAll: () => invoke('prompts:exportAll')
  },
  backup: {
    info: () => invoke('backup:info'),
    create: (options) => invoke('backup:create', options),
    pick: () => invoke('backup:pick'),
    inspect: (path) => invoke('backup:inspect', path),
    restore: (path, options) => invoke('backup:restore', path, options)
  },
  health: {
    check: () => invoke('health:check'),
    fix: (issueId) => invoke('health:fix', issueId)
  },
  app: {
    relaunch: () => invoke('app:relaunch')
  },
  quick: {
    hide: () => invoke('quick:hide'),
    onOpened: (callback) => subscribe('quick:opened', callback)
  },
  shell: {
    pickFile: (filters) => invoke('shell:pickFile', filters),
    pickDirectory: () => invoke('shell:pickDirectory'),
    getFilePath: (file) => webUtils.getPathForFile(file)
  },
  theme: {
    get: () => invoke('theme:get'),
    setMode: (mode) => invoke('theme:setMode', mode),
    onChanged: (callback) => subscribe('theme:changed', (isDark) => callback(isDark))
  }
}

contextBridge.exposeInMainWorld('aibench', api)
