import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  isSafeArchiveEntryName,
  parseBackupManifest
} from '../src/shared/backup-manifest.ts'

const validManifest = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  createdAt: '2026-11-15T08:00:00.000Z',
  appVersion: '1.0.0',
  includeSkills: true,
  frameworks: [{ id: 'cursor', name: 'Cursor', path: '/home/u/.cursor/skills' }],
  skills: [{ frameworkId: 'cursor', dirName: 'pdf-tools' }],
  counts: { prompts: 3, categories: 2, revisions: 9, archivedSkills: 1, skills: 1 }
}

test('parseBackupManifest accepts a manifest produced by the app', () => {
  const manifest = parseBackupManifest(validManifest)
  assert.equal(manifest.format, BACKUP_FORMAT)
  assert.equal(manifest.version, BACKUP_VERSION)
  assert.deepEqual(manifest.skills, [{ frameworkId: 'cursor', dirName: 'pdf-tools' }])
  assert.deepEqual(manifest.counts, validManifest.counts)
})

test('parseBackupManifest rejects foreign or broken files', () => {
  assert.throws(() => parseBackupManifest(null), /BACKUP_INVALID/)
  assert.throws(() => parseBackupManifest({ ...validManifest, format: 'other' }), /BACKUP_INVALID/)
  assert.throws(() => parseBackupManifest({ ...validManifest, version: '1' }), /BACKUP_INVALID/)
  assert.throws(() => parseBackupManifest({ ...validManifest, version: 0 }), /BACKUP_INVALID/)
})

test('parseBackupManifest rejects newer backup versions', () => {
  assert.throws(
    () => parseBackupManifest({ ...validManifest, version: BACKUP_VERSION + 1 }),
    /BACKUP_UNSUPPORTED_VERSION/
  )
})

test('parseBackupManifest drops skill refs that could escape the framework root', () => {
  const manifest = parseBackupManifest({
    ...validManifest,
    skills: [
      { frameworkId: 'cursor', dirName: 'ok-skill' },
      { frameworkId: 'cursor', dirName: '../escape' },
      { frameworkId: 'cursor', dirName: 'nested/skill' },
      { frameworkId: 'cursor', dirName: '..' },
      { frameworkId: '../cursor', dirName: 'ok-skill' },
      { frameworkId: 'cursor', dirName: '中文-skill' }
    ]
  })
  assert.deepEqual(manifest.skills, [
    { frameworkId: 'cursor', dirName: 'ok-skill' },
    { frameworkId: 'cursor', dirName: '中文-skill' }
  ])
})

test('parseBackupManifest tolerates missing optional fields', () => {
  const manifest = parseBackupManifest({ format: BACKUP_FORMAT, version: 1 })
  assert.deepEqual(manifest.frameworks, [])
  assert.deepEqual(manifest.skills, [])
  assert.equal(manifest.includeSkills, false)
  assert.deepEqual(manifest.counts, {
    prompts: 0,
    categories: 0,
    revisions: 0,
    archivedSkills: 0,
    skills: 0
  })
})

test('isSafeArchiveEntryName accepts normal nested paths', () => {
  assert.equal(isSafeArchiveEntryName('manifest.json'), true)
  assert.equal(isSafeArchiveEntryName('data/archive/skill/.archive.json'), true)
  assert.equal(isSafeArchiveEntryName('skills/cursor/中文-skill/SKILL.md'), true)
})

test('isSafeArchiveEntryName rejects traversal and absolute paths', () => {
  assert.equal(isSafeArchiveEntryName('../evil.txt'), false)
  assert.equal(isSafeArchiveEntryName('data/../../evil.txt'), false)
  assert.equal(isSafeArchiveEntryName('data\\..\\evil.txt'), false)
  assert.equal(isSafeArchiveEntryName('/etc/passwd'), false)
  assert.equal(isSafeArchiveEntryName('C:\\Windows\\evil.txt'), false)
  assert.equal(isSafeArchiveEntryName(''), false)
  assert.equal(isSafeArchiveEntryName('data//evil.txt'), false)
  assert.equal(isSafeArchiveEntryName('data/./evil.txt'), false)
})
