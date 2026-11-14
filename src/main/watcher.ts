import chokidar, { type FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { listFrameworkPaths } from './skill-service'

let watcher: FSWatcher | null = null
let notifyTimer: NodeJS.Timeout | null = null

const NOTIFY_DELAY_MS = 250

function sendSkillsChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('skills:changed')
  }
}

export function startSkillWatcher(): void {
  stopSkillWatcher()
  const paths = listFrameworkPaths().filter(Boolean)
  if (paths.length === 0) return
  watcher = chokidar.watch(paths, {
    ignoreInitial: true,
    depth: 4,
    ignored: /(^|[/\\])\../
  })
  const scheduleNotify = (): void => {
    if (notifyTimer) clearTimeout(notifyTimer)
    notifyTimer = setTimeout(() => {
      notifyTimer = null
      sendSkillsChanged()
    }, NOTIFY_DELAY_MS)
  }
  watcher
    .on('add', scheduleNotify)
    .on('change', scheduleNotify)
    .on('unlink', scheduleNotify)
    .on('addDir', scheduleNotify)
    .on('unlinkDir', scheduleNotify)
}

export function stopSkillWatcher(): void {
  if (notifyTimer) {
    clearTimeout(notifyTimer)
    notifyTimer = null
  }
  watcher?.close()
  watcher = null
}

export function restartSkillWatcher(): void {
  startSkillWatcher()
}

export function notifySkillsChanged(): void {
  sendSkillsChanged()
}
