import fs from 'fs'
import os from 'os'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'
import AdmZip from 'adm-zip'
import { app, BrowserWindow, dialog } from 'electron'
import {
  BACKUP_ARCHIVE_DIR,
  BACKUP_CONFIG_FILE,
  BACKUP_DB_FILE,
  BACKUP_INVALID,
  BACKUP_MANIFEST_FILE,
  BACKUP_SKILLS_DIR,
  BACKUP_UNSUPPORTED_VERSION,
  BACKUP_VERSION,
  BACKUP_FORMAT,
  emptyCounts,
  isSafeArchiveEntryName,
  isSafePathSegment,
  parseBackupManifest
} from '../shared/backup-manifest'
import type {
  BackupCreateResult,
  BackupInfo,
  BackupManifest,
  BackupPreview,
  RestoreOptions,
  RestoreResult,
  RestoreSkip
} from '../shared/types'
import { configFilePath, dataDirPath, getConfig, reloadConfig } from './config'
import {
  closeDb,
  exportSnapshot,
  getDb,
  getDbPath,
  getStats
} from './db'
import { SCHEMA_VERSION } from './db-migrations'
import { listArchive } from './archive-service'
import { copyDir, resolveSkillDir } from './skill-utils'
import createBackupWorker from './backup-worker?nodeWorker'
import type { BackupWorkerMessage } from './backup-worker'
import type { BackupWriterInput, BackupWriterResult, BackupWriterSkill } from './backup-writer'

const MAX_RESTORE_ENTRIES = 20000
const MAX_RESTORE_BYTES = 4 * 1024 * 1024 * 1024

type SkillSource = BackupWriterSkill

function stampForFile(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

function stampForSafety(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function defaultBackupDir(): string {
  try {
    return app.getPath('downloads')
  } catch {
    return app.getPath('documents')
  }
}

export function getBackupInfo(): BackupInfo {
  const config = getConfig()
  return {
    dataDir: dataDirPath(),
    configPath: configFilePath(),
    dbPath: getDbPath(),
    archivePath: config.archivePath
  }
}

function collectSkillSources(): SkillSource[] {
  const sources: SkillSource[] = []
  for (const framework of getConfig().frameworks) {
    if (!framework.path || !isSafePathSegment(framework.id)) continue
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(framework.path, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue
      if (!isSafePathSegment(entry.name)) continue
      const dir = path.join(framework.path, entry.name)
      if (!fs.existsSync(path.join(dir, 'SKILL.md'))) continue
      sources.push({ frameworkId: framework.id, dirName: entry.name, dir })
    }
  }
  return sources
}

/**
 * Zipping tens of thousands of skill files takes seconds and used to block the
 * main process; the compression now happens on a worker thread.
 */
function runBackupWorker(input: BackupWriterInput): Promise<BackupWriterResult> {
  return new Promise((resolve, reject) => {
    const worker = createBackupWorker({ workerData: input })
    let settled = false
    const finish = (): boolean => {
      if (settled) return false
      settled = true
      return true
    }

    worker.once('message', (message: BackupWorkerMessage) => {
      if (!finish()) return
      if (message.ok) resolve(message.result)
      else reject(new Error(message.error))
    })
    worker.once('error', (error) => {
      if (finish()) reject(error)
    })
    worker.once('exit', (code) => {
      if (finish()) reject(new Error(`BACKUP_WORKER_EXIT_${code}`))
    })
  })
}

export async function createBackup(options: {
  includeSkills?: boolean
}): Promise<BackupCreateResult | null> {
  const defaultPath = path.join(defaultBackupDir(), `AIBench-backup-${stampForFile()}.zip`)
  const dialogOptions = {
    title: '导出 AIBench 备份',
    defaultPath,
    filters: [{ name: 'AIBench 备份', extensions: ['zip'] }]
  }
  const win = BrowserWindow.getFocusedWindow()
  const picked = win
    ? await dialog.showSaveDialog(win, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions)
  if (picked.canceled || !picked.filePath) return null
  const target = picked.filePath.toLowerCase().endsWith('.zip')
    ? picked.filePath
    : `${picked.filePath}.zip`
  return createBackupAt(target, options?.includeSkills === true)
}

export async function createBackupAt(
  targetPath: string,
  includeSkills: boolean
): Promise<BackupCreateResult> {
  const config = getConfig()
  const skills = includeSkills ? collectSkillSources() : []
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aibench-backup-'))
  try {
    const dbSnapshot = path.join(temp, 'aibench.db')
    exportSnapshot(dbSnapshot)
    const stats = getStats()
    const archivedSkills = listArchive().length
    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      includeSkills,
      frameworks: config.frameworks.map((framework) => ({
        id: framework.id,
        name: framework.name,
        path: framework.path
      })),
      skills: skills.map((skill) => ({
        frameworkId: skill.frameworkId,
        dirName: skill.dirName
      })),
      counts: {
        ...emptyCounts(),
        prompts: stats.prompts,
        categories: stats.categories,
        revisions: stats.revisions,
        archivedSkills,
        skills: skills.length
      }
    }

    const written = await runBackupWorker({
      targetPath,
      dbSnapshotPath: dbSnapshot,
      configPath: configFilePath(),
      archivePath: config.archivePath,
      skills,
      manifest
    })
    return { path: written.path, size: written.size, manifest }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
}

export async function pickBackupFile(): Promise<string | null> {
  const dialogOptions = {
    title: '选择 AIBench 备份',
    properties: ['openFile' as const],
    filters: [{ name: 'AIBench 备份', extensions: ['zip'] }]
  }
  const win = BrowserWindow.getFocusedWindow()
  const picked = win
    ? await dialog.showOpenDialog(win, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions)
  return picked.canceled ? null : (picked.filePaths[0] ?? null)
}

function openZip(filePath: string): AdmZip {
  try {
    return new AdmZip(filePath)
  } catch {
    throw new Error(BACKUP_INVALID)
  }
}

export function inspectBackup(filePath: string): BackupPreview {
  if (!filePath || !fs.existsSync(filePath)) throw new Error('BACKUP_SOURCE_MISSING')
  const zip = openZip(filePath)
  const manifestEntry = zip.getEntry(BACKUP_MANIFEST_FILE)
  if (!manifestEntry) throw new Error(BACKUP_INVALID)
  if (Number(manifestEntry.header.size ?? 0) > 1024 * 1024) throw new Error(BACKUP_INVALID)
  let manifest: BackupManifest
  try {
    manifest = parseBackupManifest(JSON.parse(manifestEntry.getData().toString('utf-8')))
  } catch (error) {
    if (error instanceof Error && error.message === BACKUP_UNSUPPORTED_VERSION) {
      throw new Error(BACKUP_UNSUPPORTED_VERSION)
    }
    throw new Error(BACKUP_INVALID)
  }
  if (!zip.getEntry(BACKUP_DB_FILE)) throw new Error(BACKUP_INVALID)
  const hasArchive = zip
    .getEntries()
    .some(
      (entry) =>
        !entry.isDirectory &&
        entry.entryName.replace(/\\/g, '/').startsWith(`${BACKUP_ARCHIVE_DIR}/`)
    )
  return {
    path: filePath,
    size: fs.statSync(filePath).size,
    manifest,
    hasConfig: Boolean(zip.getEntry(BACKUP_CONFIG_FILE)),
    hasArchive
  }
}

function extractSafe(zip: AdmZip, destRoot: string): void {
  const root = path.resolve(destRoot)
  const entries = zip.getEntries()
  if (entries.length > MAX_RESTORE_ENTRIES) throw new Error('BACKUP_TOO_LARGE')
  let totalBytes = 0
  for (const entry of entries) {
    const name = entry.entryName
    if (!isSafeArchiveEntryName(name)) throw new Error('BACKUP_ARCHIVE_UNSAFE')
    totalBytes += Number(entry.header.size ?? 0)
    if (totalBytes > MAX_RESTORE_BYTES) throw new Error('BACKUP_TOO_LARGE')
    const target = path.resolve(root, name.replace(/\\/g, '/'))
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error('BACKUP_ARCHIVE_UNSAFE')
    }
    if (entry.isDirectory) {
      fs.mkdirSync(target, { recursive: true })
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, entry.getData())
    }
  }
}

function validateDbFile(filePath: string): void {
  let probe: DatabaseSync | null = null
  try {
    probe = new DatabaseSync(filePath)
    const row = probe.prepare('PRAGMA integrity_check').get() as
      | Record<string, unknown>
      | undefined
    const value = row ? String(Object.values(row)[0] ?? '') : ''
    if (value.toLowerCase() !== 'ok') throw new Error('BACKUP_DB_INVALID')
    const table = probe
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'prompts'")
      .get()
    if (!table) throw new Error('BACKUP_DB_INVALID')
    const versionRow = probe.prepare('PRAGMA user_version').get() as
      | { user_version?: number | bigint }
      | undefined
    if (Number(versionRow?.user_version ?? 0) > SCHEMA_VERSION) {
      throw new Error('BACKUP_UNSUPPORTED_VERSION')
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'BACKUP_DB_INVALID' || error.message === 'BACKUP_UNSUPPORTED_VERSION')
    ) {
      throw error
    }
    throw new Error('BACKUP_DB_INVALID')
  } finally {
    try {
      probe?.close()
    } catch {
      // Probe already closed.
    }
  }
}

function readConfigFromBackup(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null
  if (fs.statSync(filePath).size > 5 * 1024 * 1024) throw new Error(BACKUP_INVALID)
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(BACKUP_INVALID)
    }
    return parsed as Record<string, unknown>
  } catch {
    throw new Error(BACKUP_INVALID)
  }
}

function assertUsableDataDir(dir: string): void {
  if (typeof dir !== 'string' || !dir.trim() || !path.isAbsolute(dir)) {
    throw new Error('BACKUP_INVALID_PATH')
  }
  const resolved = path.resolve(dir)
  if (path.parse(resolved).root === resolved) throw new Error('BACKUP_INVALID_PATH')
  // Replacing the archive removes the target recursively. Refuse a target that
  // is the data directory itself or one of its parents; a subdirectory such as
  // the default `archive/` is fine.
  const dataDir = path.resolve(dataDirPath())
  const relative = path.relative(resolved, dataDir)
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error('BACKUP_INVALID_PATH')
  }
  fs.mkdirSync(resolved, { recursive: true })
  fs.accessSync(resolved, fs.constants.W_OK)
}

/**
 * The restore is destructive, so the current database, config and archive are
 * copied aside first. The returned path is shown to the user on success or on
 * failure, and is never deleted automatically.
 */
function createSafetySnapshot(archivePath: string): string {
  const dir = path.join(dataDirPath(), 'restore-safety', stampForSafety())
  fs.mkdirSync(dir, { recursive: true })
  exportSnapshot(path.join(dir, 'aibench.db'))
  const configPath = configFilePath()
  if (fs.existsSync(configPath)) fs.copyFileSync(configPath, path.join(dir, 'config.json'))
  if (archivePath && fs.existsSync(archivePath)) {
    fs.cpSync(archivePath, path.join(dir, 'archive'), { recursive: true })
  }
  return dir
}

function normalizeOptions(options?: Partial<RestoreOptions>): RestoreOptions {
  return {
    restoreConfig: options?.restoreConfig === true,
    restoreSkills: options?.restoreSkills === true,
    overwriteSkills: options?.overwriteSkills === true
  }
}

export function restoreBackup(
  filePath: string,
  options?: Partial<RestoreOptions>
): RestoreResult {
  const preview = inspectBackup(filePath)
  const flags = normalizeOptions(options)
  const zip = openZip(filePath)
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aibench-restore-'))
  let safetyDir: string | null = null

  try {
    extractSafe(zip, temp)

    const dbSource = path.join(temp, BACKUP_DB_FILE)
    if (!fs.existsSync(dbSource)) throw new Error(BACKUP_INVALID)
    validateDbFile(dbSource)
    const restoredConfig = readConfigFromBackup(path.join(temp, BACKUP_CONFIG_FILE))

    const currentArchive = getConfig().archivePath
    safetyDir = createSafetySnapshot(currentArchive)

    if (flags.restoreConfig && restoredConfig) {
      fs.writeFileSync(
        configFilePath(),
        JSON.stringify(restoredConfig, null, 2),
        'utf-8'
      )
      reloadConfig()
    }

    // Validate the archive destination before touching the database, so a bad
    // path fails cleanly instead of leaving a half-restored app.
    const backupArchive = path.join(temp, BACKUP_ARCHIVE_DIR)
    const hasBackupArchive =
      preview.hasArchive && fs.existsSync(backupArchive) && fs.readdirSync(backupArchive).length > 0
    const archiveTarget = getConfig().archivePath
    if (hasBackupArchive) assertUsableDataDir(archiveTarget)

    const dbDest = getDbPath()
    closeDb()
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      fs.rmSync(`${dbDest}${suffix}`, { force: true })
    }
    fs.copyFileSync(dbSource, dbDest)
    getDb()

    let archiveRestored = false
    if (hasBackupArchive) {
      fs.rmSync(archiveTarget, { recursive: true, force: true })
      fs.mkdirSync(archiveTarget, { recursive: true })
      fs.cpSync(backupArchive, archiveTarget, { recursive: true })
      archiveRestored = true
    }

    const skillsInstalled: string[] = []
    const skillsSkipped: RestoreSkip[] = []
    if (flags.restoreSkills && preview.manifest.includeSkills) {
      const frameworks = new Map(getConfig().frameworks.map((item) => [item.id, item]))
      for (const skill of preview.manifest.skills) {
        const framework = frameworks.get(skill.frameworkId)
        if (!framework) {
          skillsSkipped.push({ ...skill, reason: 'FRAMEWORK_NOT_FOUND' })
          continue
        }
        const source = path.join(temp, BACKUP_SKILLS_DIR, skill.frameworkId, skill.dirName)
        const relative = path.relative(path.join(temp, BACKUP_SKILLS_DIR), source)
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          throw new Error('BACKUP_ARCHIVE_UNSAFE')
        }
        if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
          skillsSkipped.push({ ...skill, reason: 'MISSING_IN_BACKUP' })
          continue
        }
        const target = resolveSkillDir(framework.path, skill.dirName)
        if (fs.existsSync(target) && !flags.overwriteSkills) {
          skillsSkipped.push({ ...skill, reason: 'TARGET_EXISTS' })
          continue
        }
        fs.mkdirSync(framework.path, { recursive: true })
        copyDir(source, target, true)
        skillsInstalled.push(`${skill.frameworkId}:${skill.dirName}`)
      }
    }

    return {
      manifest: preview.manifest,
      safetyBackupPath: safetyDir,
      archiveRestored,
      skillsInstalled,
      skillsSkipped
    }
  } catch (error) {
    closeDb()
    try {
      getDb()
    } catch {
      // Leave the app usable even if the restored database is unreadable.
    }
    if (safetyDir) {
      console.error('AIBench restore failed:', error)
      throw new Error(`RESTORE_FAILED:${safetyDir}`)
    }
    throw error
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
}
