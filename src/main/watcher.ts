import chokidar, { type FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { listFrameworkPaths } from './skill-service'

let watcher: FSWatcher | null = null

export function startSkillWatcher(): void {
  stopSkillWatcher()
  const paths = listFrameworkPaths().filter(Boolean)
  if (paths.length === 0) return
  watcher = chokidar.watch(paths, {
    ignoreInitial: true,
    depth: 3,
    ignored: /(^|[/\\])\../
  })
  const notify = (): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('skills:changed')
    }
  }
  watcher.on('add', notify).on('change', notify).on('unlink', notify).on('addDir', notify).on('unlinkDir', notify)
}

export function stopSkillWatcher(): void {
  watcher?.close()
  watcher = null
}

export function restartSkillWatcher(): void {
  startSkillWatcher()
}

export function notifySkillsChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('skills:changed')
  }
}
