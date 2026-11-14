import fs from 'fs'
import path from 'path'
import type { ArchiveRecord, InstallResult } from '../shared/types'
import { getConfig } from './config'
import { copyDir, readSkillFromDir, resolveSkillDir } from './skill-utils'
import { getFramework } from './config'

export function listArchive(): ArchiveRecord[] {
  const { archivePath } = getConfig()
  if (!fs.existsSync(archivePath)) return []
  const records: ArchiveRecord[] = []
  for (const entry of fs.readdirSync(archivePath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const archiveDir = path.join(archivePath, entry.name)
    const metaFile = path.join(archiveDir, '.archive.json')
    if (fs.existsSync(metaFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(metaFile, 'utf-8')) as Partial<ArchiveRecord>
        if (typeof raw.id === 'string' && typeof raw.dirName === 'string') {
          records.push({
            id: raw.id,
            dirName: raw.dirName,
            removedFrom: raw.removedFrom ?? '未知',
            originalPath: raw.originalPath ?? '',
            removedAt: raw.removedAt ?? fs.statSync(archiveDir).mtime.toISOString(),
            archivePath: archiveDir,
            meta: raw.meta ?? { name: raw.dirName, description: '' }
          })
          continue
        }
      } catch {
        // Fall through and derive a record from the archived skill itself.
      }
    }
    const skill = readSkillFromDir(archiveDir)
    records.push({
      id: entry.name,
      dirName: entry.name,
      removedFrom: '未知',
      originalPath: '',
      removedAt: fs.statSync(archiveDir).mtime.toISOString(),
      archivePath: archiveDir,
      meta: skill?.meta ?? { name: entry.name, description: '' }
    })
  }
  return records.sort((a, b) => b.removedAt.localeCompare(a.removedAt))
}

export function restoreFromArchive(
  id: string,
  frameworkIds: string[],
  overwrite = false
): InstallResult {
  const record = listArchive().find((r) => r.id === id)
  if (!record) throw new Error('ARCHIVE_NOT_FOUND')
  const installed: string[] = []
  const conflicts: InstallResult['conflicts'] = []
  for (const fwId of frameworkIds) {
    const fw = getFramework(fwId)
    if (!fw) continue
    fs.mkdirSync(fw.path, { recursive: true })
    const target = resolveSkillDir(fw.path, record.dirName)
    if (fs.existsSync(target) && !overwrite) {
      conflicts.push({ dirName: record.dirName, targetPath: target })
      continue
    }
    copyDir(record.archivePath, target, overwrite)
    fs.rmSync(path.join(target, '.archive.json'), { force: true })
    installed.push(`${fwId}:${record.dirName}`)
  }
  return { installed, conflicts }
}

export function deleteArchivePermanent(id: string): void {
  const record = listArchive().find((r) => r.id === id)
  if (!record) throw new Error('ARCHIVE_NOT_FOUND')
  fs.rmSync(record.archivePath, { recursive: true, force: true })
}
