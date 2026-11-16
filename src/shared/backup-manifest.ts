import type {
  BackupCounts,
  BackupFrameworkRef,
  BackupManifest,
  BackupSkillRef
} from './types'

export const BACKUP_FORMAT = 'aibench-backup'
export const BACKUP_VERSION = 1
export const BACKUP_MANIFEST_FILE = 'manifest.json'
export const BACKUP_DB_FILE = 'data/aibench.db'
export const BACKUP_CONFIG_FILE = 'data/config.json'
export const BACKUP_ARCHIVE_DIR = 'data/archive'
export const BACKUP_SKILLS_DIR = 'skills'

/** Limits for a freshly created backup; shared so the backup worker and the
 * main process enforce the same caps. */
export const MAX_BACKUP_FILES = 20000
export const MAX_BACKUP_BYTES = 512 * 1024 * 1024

export const BACKUP_INVALID = 'BACKUP_INVALID'
export const BACKUP_UNSUPPORTED_VERSION = 'BACKUP_UNSUPPORTED_VERSION'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0
}

/** A single path segment that can be joined under a trusted root. */
export function isSafePathSegment(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 255 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('\0')
  )
}

/**
 * Zip entry names come from an untrusted file. Reject absolute paths, drive
 * letters, `..` traversal and empty segments before anything is written.
 */
export function isSafeArchiveEntryName(name: unknown): name is string {
  if (typeof name !== 'string' || name.length === 0 || name.includes('\0')) return false
  const normalized = name.replace(/\\/g, '/')
  if (normalized.startsWith('/')) return false
  if (/^[A-Za-z]:/.test(normalized)) return false
  const trimmed = normalized.replace(/\/+$/, '')
  if (!trimmed) return false
  return trimmed.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..')
}

function toFramework(value: unknown): BackupFrameworkRef | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null
  return {
    id: value.id,
    name: value.name,
    path: typeof value.path === 'string' ? value.path : ''
  }
}

function toSkillRef(value: unknown): BackupSkillRef | null {
  if (!isRecord(value)) return null
  if (!isSafePathSegment(value.frameworkId) || !isSafePathSegment(value.dirName)) return null
  return { frameworkId: value.frameworkId, dirName: value.dirName }
}

export function emptyCounts(): BackupCounts {
  return { prompts: 0, categories: 0, revisions: 0, archivedSkills: 0, skills: 0 }
}

/**
 * Validates a parsed manifest. Skill references with unsafe path segments are
 * dropped rather than trusted, so a hand-edited backup cannot escape roots.
 */
export function parseBackupManifest(raw: unknown): BackupManifest {
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) throw new Error(BACKUP_INVALID)

  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error(BACKUP_INVALID)
  }
  if (version > BACKUP_VERSION) throw new Error(BACKUP_UNSUPPORTED_VERSION)

  const frameworks = Array.isArray(raw.frameworks)
    ? raw.frameworks.map(toFramework).filter((item): item is BackupFrameworkRef => item !== null)
    : []
  const skills = Array.isArray(raw.skills)
    ? raw.skills.map(toSkillRef).filter((item): item is BackupSkillRef => item !== null)
    : []
  const counts = isRecord(raw.counts) ? raw.counts : {}

  return {
    format: BACKUP_FORMAT,
    version,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : '',
    includeSkills: raw.includeSkills === true,
    frameworks,
    skills,
    counts: {
      prompts: toCount(counts.prompts),
      categories: toCount(counts.categories),
      revisions: toCount(counts.revisions),
      archivedSkills: toCount(counts.archivedSkills),
      skills: toCount(counts.skills)
    }
  }
}
