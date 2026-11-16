import { app, BrowserWindow, nativeTheme } from 'electron'
import path from 'path'
import { applyThemeFromConfig, ensureAppReady, registerIpcHandlers } from './ipc-handlers'
import { setupQuickLauncher } from './quick-launcher'
import { startAutoUpdater } from './updater'
import { startSkillWatcher } from './watcher'

// Lets e2e tests (and portable setups) point the app at an isolated data
// directory instead of the user's real %APPDATA%/AIBench.
if (process.env.AIBENCH_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.AIBENCH_USER_DATA))
}

let mainWindow: BrowserWindow | null = null
let quitting = false
let keepInTray = false

function createWindow(): void {
  if (mainWindow) {
    showMainWindow()
    return
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AIBench',
    icon: path.join(app.getAppPath(), 'resources', 'tray.png'),
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

  mainWindow.on('close', (event) => {
    if (!quitting && keepInTray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
    if (!keepInTray) app.quit()
  })
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (app.isReady()) showMainWindow()
  })

  app.on('before-quit', () => {
    quitting = true
  })

  app.on('window-all-closed', () => {
    // The tray keeps the app running; without a tray, preserve the old quit behavior.
    if (!keepInTray) app.quit()
  })

  app.whenReady().then(() => {
    ensureAppReady()
    registerIpcHandlers()
    applyThemeFromConfig()
    createWindow()
    startSkillWatcher()
    startAutoUpdater()

    keepInTray = setupQuickLauncher({
      preloadPath: path.join(__dirname, '../preload/index.mjs'),
      iconPath: path.join(app.getAppPath(), 'resources', 'tray.png'),
      onShowMain: showMainWindow
    })

    nativeTheme.on('updated', () => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors)
      }
    })

    app.on('activate', () => {
      showMainWindow()
    })
  })
}
