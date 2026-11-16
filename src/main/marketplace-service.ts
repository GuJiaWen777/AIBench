import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'node:crypto'
import AdmZip from 'adm-zip'
import { net } from 'electron'
import type {
  GithubPreview,
  GithubSkillPreview,
  InstallConflict,
  InstallResult
} from '../shared/types'
import { isSafeArchiveEntryName } from '../shared/backup-manifest'
import { getFramework } from './config'
import { copyDir, resolveSkillDir } from './skill-utils'
import {
  githubRepoLabel,
  githubZipUrl,
  parseGithubUrl,
  type GithubSource
} from './github-url'
import { scanStagedSkills, type StagedSkill } from './marketplace-scan'

const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024
const MAX_EXTRACT_ENTRIES = 20000
const MAX_EXTRACT_BYTES = 256 * 1024 * 1024
const SESSION_TTL_MS = 30 * 60 * 1000

interface StagingSession {
  dir: string
  source: GithubSource
  skills: StagedSkill[]
  truncated: boolean
  createdAt: number
}

const sessions = new Map<string, StagingSession>()

function cleanupExpired(): void {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt <= SESSION_TTL_MS) continue
    sessions.delete(id)
    fs.rmSync(session.dir, { recursive: true, force: true })
  }
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function responseError(status: number): Error {
  if (status === 404) return new Error('GITHUB_REPO_NOT_FOUND')
  if (status === 429) return new Error('GITHUB_RATE_LIMITED')
  return new Error('GITHUB_DOWNLOAD_FAILED')
}

async function downloadZip(source: GithubSource, target: string): Promise<void> {
  let response: Response
  try {
    response = await net.fetch(githubZipUrl(source), {
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000)
    })
  } catch {
    throw new Error('GITHUB_DOWNLOAD_FAILED')
  }

  if (!response.ok) throw responseError(response.status)

  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > MAX_DOWNLOAD_BYTES) throw new Error('GITHUB_TOO_LARGE')
  if (!response.body) throw new Error('GITHUB_DOWNLOAD_FAILED')

  const handle = await fs.promises.open(target, 'w')
  try {
    const reader = response.body.getReader()
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_DOWNLOAD_BYTES) {
        await reader.cancel()
        throw new Error('GITHUB_TOO_LARGE')
      }
      await handle.write(value)
    }
  } finally {
    await handle.close()
  }
}

function extractZip(zipPath: string, targetDir: string): void {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()
  if (entries.length > MAX_EXTRACT_ENTRIES) throw new Error('GITHUB_TOO_LARGE')

  const root = path.resolve(targetDir)
  let totalBytes = 0

  for (const entry of entries) {
    const name = entry.entryName.replace(/\\/g, '/')
    if (name.startsWith('__MACOSX/')) continue
    if (!isSafeArchiveEntryName(name)) throw new Error('GITHUB_ARCHIVE_UNSAFE')

    // Check the declared size before decompressing, then the real size after;
    // a crafted archive can understate its uncompressed size.
    const declared = Number(entry.header.size ?? 0)
    if (totalBytes + declared > MAX_EXTRACT_BYTES) throw new Error('GITHUB_TOO_LARGE')

    const target = path.resolve(root, name)
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error('GITHUB_ARCHIVE_UNSAFE')
    }
    if (entry.isDirectory) {
      fs.mkdirSync(target, { recursive: true })
    } else {
      const data = entry.getData()
      totalBytes += data.byteLength
      if (totalBytes > MAX_EXTRACT_BYTES) throw new Error('GITHUB_TOO_LARGE')
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, data)
    }
  }
}

/** GitHub archives contain a single `<repo>-<ref>/` wrapper directory. */
function findRepoRoot(extractDir: string): string {
  let dirs: fs.Dirent[]
  try {
    dirs = fs.readdirSync(extractDir, { withFileTypes: true })
  } catch {
    throw new Error('GITHUB_DOWNLOAD_FAILED')
  }
  const candidates = dirs.filter((entry) => entry.isDirectory() && entry.name !== '__MACOSX')
  return candidates.length === 1 ? path.join(extractDir, candidates[0].name) : extractDir
}

function toPreview(skill: StagedSkill): GithubSkillPreview {
  const { rootPath: _rootPath, ...preview } = skill
  return preview
}

export async function inspectGithub(input: string): Promise<GithubPreview> {
  if (typeof input !== 'string' || !input.trim()) throw new Error('GITHUB_URL_INVALID')
  cleanupExpired()
  const source = parseGithubUrl(input)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibench-github-'))
  let keep = false

  try {
    const zipPath = path.join(dir, 'repo.zip')
    await downloadZip(source, zipPath)

    const extractDir = path.join(dir, 'files')
    fs.mkdirSync(extractDir, { recursive: true })
    extractZip(zipPath, extractDir)
    fs.rmSync(zipPath, { force: true })

    const repoRoot = findRepoRoot(extractDir)
    const baseDir = source.subdir ? path.resolve(repoRoot, source.subdir) : repoRoot
    if (!isWithin(repoRoot, baseDir) || !fs.existsSync(baseDir)) {
      throw new Error('GITHUB_NO_SKILLS')
    }

    const fallbackName = source.subdir ? path.basename(source.subdir) : source.repo
    const { skills, truncated } = scanStagedSkills(baseDir, fallbackName)
    if (skills.length === 0) throw new Error('GITHUB_NO_SKILLS')

    const sessionId = randomUUID()
    sessions.set(sessionId, {
      dir,
      source,
      skills,
      truncated,
      createdAt: Date.now()
    })
    keep = true

    return {
      sessionId,
      repo: githubRepoLabel(source),
      ref: source.ref,
      subdir: source.subdir,
      skills: skills.map(toPreview),
      totalBytes: skills.reduce((sum, skill) => sum + skill.totalBytes, 0),
      truncated
    }
  } finally {
    if (!keep) fs.rmSync(dir, { recursive: true, force: true })
  }
}

export function installGithub(
  sessionId: string,
  dirNames: string[],
  frameworkIds: string[],
  overwrite = false
): InstallResult {
  if (
    typeof sessionId !== 'string' ||
    !Array.isArray(dirNames) ||
    !Array.isArray(frameworkIds) ||
    !dirNames.every((name) => typeof name === 'string') ||
    !frameworkIds.every((id) => typeof id === 'string')
  ) {
    throw new Error('GITHUB_INVALID_REQUEST')
  }
  cleanupExpired()
  const session = sessions.get(sessionId)
  if (!session) throw new Error('GITHUB_SESSION_EXPIRED')
  if (frameworkIds.length === 0) throw new Error('GITHUB_NO_FRAMEWORK')

  const wanted = new Set(dirNames)
  const selected = session.skills.filter((skill) => wanted.has(skill.dirName))
  if (selected.length === 0) throw new Error('GITHUB_NO_SKILLS')

  const installed: string[] = []
  const conflicts: InstallConflict[] = []
  const shouldOverwrite = overwrite === true

  for (const skill of selected) {
    for (const frameworkId of frameworkIds) {
      const framework = getFramework(frameworkId)
      if (!framework) throw new Error('FRAMEWORK_NOT_FOUND')
      fs.mkdirSync(framework.path, { recursive: true })
      const target = resolveSkillDir(framework.path, skill.dirName)
      if (fs.existsSync(target) && !shouldOverwrite) {
        conflicts.push({ dirName: skill.dirName, targetPath: target })
        continue
      }
      copyDir(skill.rootPath, target, shouldOverwrite)
      installed.push(`${frameworkId}:${skill.dirName}`)
    }
  }

  // Keep the staging directory when some targets need an overwrite decision.
  if (conflicts.length === 0) {
    sessions.delete(sessionId)
    fs.rmSync(session.dir, { recursive: true, force: true })
  }

  return { installed, conflicts }
}

export function cancelGithub(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (!session) return
  sessions.delete(sessionId)
  fs.rmSync(session.dir, { recursive: true, force: true })
}
