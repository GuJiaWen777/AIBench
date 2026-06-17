import { app, BrowserWindow, nativeTheme } from 'electron'
import path from 'path'
import { applyThemeFromConfig, ensureAppReady, registerIpcHandlers } from './ipc-handlers'
import { startSkillWatcher } from './watcher'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AIBench',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ensureAppReady()
  registerIpcHandlers()
  applyThemeFromConfig()
  createWindow()
  startSkillWatcher()

  nativeTheme.on('updated', () => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
