import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import {
  BACKUP_ARCHIVE_DIR,
  BACKUP_CONFIG_FILE,
  BACKUP_DB_FILE,
  BACKUP_MANIFEST_FILE,
  BACKUP_SKILLS_DIR,
  MAX_BACKUP_BYTES,
  MAX_BACKUP_FILES
} from '../shared/backup-manifest'
import type { BackupManifest } from '../shared/types'

export interface BackupWriterSkill {
  frameworkId: string
  dirName: string
  dir: string
}

/**
 * Everything the archive writer needs. The input must stay structured-cloneable
 * because it is handed to a worker thread as `workerData`.
 */
export interface BackupWriterInput {
  targetPath: string
  dbSnapshotPath: string
  configPath: string | null
  archivePath: string
  skills: BackupWriterSkill[]
  manifest: BackupManifest
}

export interface BackupWriterResult {
  path: string
  size: number
}

interface ZipFileSource {
  fullPath: string
  zipPath: string
  size: number
}

function collectFiles(root: string, zipRoot: string, out: ZipFileSource[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue
    const fullPath = path.join(root, entry.name)
    const zipPath = `${zipRoot}/${entry.name}`
    // Symlinks can point outside the data directory and are not part of the
    // skill's own content, so they are skipped rather than followed.
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) collectFiles(fullPath, zipPath, out)
    else if (entry.isFile()) {
      try {
        out.push({ fullPath, zipPath, size: fs.statSync(fullPath).size })
      } catch {
        // File vanished between readdir and stat; skip it.
      }
    }
  }
}

function readmeText(manifest: BackupManifest): string {
  return [
    'AIBench 备份',
    '',
    `导出时间: ${manifest.createdAt}`,
    `版本: ${manifest.appVersion}`,
    `包含已安装 Skill: ${manifest.includeSkills ? '是' : '否'}`,
    `Prompt: ${manifest.counts.prompts} 条，分类: ${manifest.counts.categories} 个，历史版本: ${manifest.counts.revisions} 条`,
    `归档 Skill: ${manifest.counts.archivedSkills} 个，已安装 Skill: ${manifest.counts.skills} 个`,
    '',
    '恢复方式: 打开 AIBench → 设置 → 备份与恢复 → 从备份恢复',
    '恢复前 App 会自动保存一份当前数据快照。'
  ].join('\n')
}

/**
 * Compresses the snapshot, config, archive and skill directories into the
 * backup zip. Pure fs/zip work so it can run on a worker thread.
 */
export function writeBackupZip(input: BackupWriterInput): BackupWriterResult {
  const files: ZipFileSource[] = [
    {
      fullPath: input.dbSnapshotPath,
      zipPath: BACKUP_DB_FILE,
      size: fs.statSync(input.dbSnapshotPath).size
    }
  ]

  if (input.configPath && fs.existsSync(input.configPath)) {
    files.push({
      fullPath: input.configPath,
      zipPath: BACKUP_CONFIG_FILE,
      size: fs.statSync(input.configPath).size
    })
  }

  if (input.archivePath && fs.existsSync(input.archivePath)) {
    collectFiles(input.archivePath, BACKUP_ARCHIVE_DIR, files)
  }

  for (const skill of input.skills) {
    collectFiles(skill.dir, `${BACKUP_SKILLS_DIR}/${skill.frameworkId}/${skill.dirName}`, files)
  }

  if (files.length > MAX_BACKUP_FILES) throw new Error('BACKUP_TOO_LARGE')
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  if (totalBytes > MAX_BACKUP_BYTES) throw new Error('BACKUP_TOO_LARGE')

  const zip = new AdmZip()
  zip.addFile(
    BACKUP_MANIFEST_FILE,
    Buffer.from(JSON.stringify(input.manifest, null, 2), 'utf-8')
  )
  zip.addFile('README.txt', Buffer.from(readmeText(input.manifest), 'utf-8'))
  for (const file of files) {
    const slash = file.zipPath.lastIndexOf('/')
    zip.addLocalFile(file.fullPath, file.zipPath.slice(0, slash), file.zipPath.slice(slash + 1))
  }
  fs.mkdirSync(path.dirname(input.targetPath), { recursive: true })
  zip.writeZip(input.targetPath)
  return { path: input.targetPath, size: fs.statSync(input.targetPath).size }
}
