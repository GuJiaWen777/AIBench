import { app } from 'electron'
import electronUpdater from 'electron-updater'

const FIRST_CHECK_DELAY_MS = 10_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let started = false

/**
 * Updates come from the GitHub Releases configured in package.json (publish).
 * Dev builds, the portable exe (which has no installer to update in place) and
 * `AIBENCH_DISABLE_UPDATES=1` skip every network check.
 */
export function updatesEnabled(): boolean {
  return (
    app.isPackaged &&
    !process.env.PORTABLE_EXECUTABLE_FILE &&
    process.env.AIBENCH_DISABLE_UPDATES !== '1'
  )
}

export function startAutoUpdater(): void {
  if (started || !updatesEnabled()) return
  started = true

  const { autoUpdater } = electronUpdater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // No release yet, offline, or a proxy in the way: never break the app.
  autoUpdater.on('error', () => {})

  const check = (): void => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  }

  const firstCheck = setTimeout(check, FIRST_CHECK_DELAY_MS)
  firstCheck.unref()
  const interval = setInterval(check, CHECK_INTERVAL_MS)
  interval.unref()
}
