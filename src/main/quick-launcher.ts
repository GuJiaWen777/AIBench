import path from 'path'
import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  screen,
  Tray
} from 'electron'

const QUICK_SHORTCUT = 'CommandOrControl+Shift+Space'
const QUICK_WIDTH = 680
const QUICK_HEIGHT = 460

interface QuickLauncherOptions {
  preloadPath: string
  iconPath: string
  onShowMain: () => void
}

let tray: Tray | null = null
let quickWindow: BrowserWindow | null = null
let options: QuickLauncherOptions | null = null
let quitting = false

function createTray(): void {
  if (!options) return
  const image = nativeImage.createFromPath(options.iconPath)
  if (image.isEmpty()) {
    console.warn(`[AIBench] 托盘图标加载失败：${options.iconPath}`)
    return
  }

  tray = new Tray(image.resize({ width: 16, height: 16 }))
  tray.setToolTip('AIBench')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开 AIBench', click: () => options?.onShowMain() },
      {
        label: '快速搜索 Prompt',
        accelerator: QUICK_SHORTCUT,
        registerAccelerator: false,
        click: () => showQuickWindow()
      },
      { type: 'separator' },
      {
        label: '退出 AIBench',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => options?.onShowMain())
}

function createQuickWindow(): void {
  if (!options || quickWindow) return

  quickWindow = new BrowserWindow({
    width: QUICK_WIDTH,
    height: QUICK_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  quickWindow.setAlwaysOnTop(true, 'floating')
  if (process.platform === 'darwin') {
    quickWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void quickWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}?quick=1`)
  } else {
    void quickWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      query: { quick: '1' }
    })
  }

  quickWindow.on('blur', () => {
    if (!quickWindow?.webContents.isDevToolsOpened()) quickWindow?.hide()
  })
  quickWindow.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    quickWindow?.hide()
  })
  quickWindow.on('closed', () => {
    quickWindow = null
  })
}

function positionQuickWindow(): void {
  if (!quickWindow) return
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { workArea } = display
  const x = Math.round(workArea.x + (workArea.width - QUICK_WIDTH) / 2)
  const y = Math.round(workArea.y + workArea.height * 0.18)
  quickWindow.setPosition(x, y, false)
}

function showQuickWindow(): void {
  createQuickWindow()
  if (!quickWindow) return
  positionQuickWindow()
  quickWindow.show()
  quickWindow.focus()
  quickWindow.webContents.send('quick:opened')
}

export function hideQuickWindow(): void {
  quickWindow?.hide()
}

function toggleQuickWindow(): void {
  if (quickWindow?.isVisible()) quickWindow.hide()
  else showQuickWindow()
}

/** Returns whether the tray is available; without it the app should still quit on close. */
export function setupQuickLauncher(launcherOptions: QuickLauncherOptions): boolean {
  options = launcherOptions
  createTray()
  createQuickWindow()

  const registered = globalShortcut.register(QUICK_SHORTCUT, toggleQuickWindow)
  if (!registered) {
    console.warn(`[AIBench] 全局快捷键 ${QUICK_SHORTCUT} 注册失败，可从托盘菜单打开快速搜索。`)
  }

  app.on('before-quit', () => {
    quitting = true
  })
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    tray?.destroy()
    tray = null
  })

  return tray !== null
}
