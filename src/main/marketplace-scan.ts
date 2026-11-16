import fs from 'fs'
import path from 'path'
import type { GithubSkillFile, GithubSkillPreview } from '../shared/types'
import { findSkillRoots, listSkillFiles, readSkillFromDir } from './skill-utils'

export interface StagedSkill extends GithubSkillPreview {
  /** Absolute path inside the staging directory; never sent to the renderer. */
  rootPath: string
}

export interface StagedScan {
  skills: StagedSkill[]
  truncated: boolean
}

const MAX_SKILLS = 50
const MAX_FILES = 200
const MAX_BODY_CHARS = 12000

const SCRIPT_EXTENSIONS = new Set([
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.ps1',
  '.bat',
  '.cmd',
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
  '.py',
  '.rb',
  '.pl',
  '.php',
  '.lua',
  '.r',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.jar',
  '.app',
  '.bin'
])

export function isScriptFile(filePath: string): boolean {
  return SCRIPT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

/**
 * Reads a downloaded repository into a preview. Only SKILL.md and file
 * metadata are inspected; nothing is executed.
 */
export function scanStagedSkills(baseDir: string, rootFallbackName: string): StagedScan {
  if (!fs.existsSync(baseDir) || !fs.statSync(baseDir).isDirectory()) {
    return { skills: [], truncated: false }
  }

  const roots = findSkillRoots(baseDir, 6)
  const skills: StagedSkill[] = []
  const seenDirNames = new Set<string>()
  let truncated = roots.length > MAX_SKILLS

  for (const root of roots) {
    if (skills.length >= MAX_SKILLS) break
    const data = readSkillFromDir(root)
    if (!data) continue

    const dirName =
      path.resolve(root) === path.resolve(baseDir) ? rootFallbackName : path.basename(root)
    if (seenDirNames.has(dirName)) continue
    seenDirNames.add(dirName)

    const relativeFiles = listSkillFiles(root)
    const files: GithubSkillFile[] = []
    let totalBytes = 0
    let scriptCount = 0

    for (const relative of relativeFiles) {
      let size = 0
      try {
        size = fs.statSync(path.join(root, relative)).size
      } catch {
        continue
      }
      totalBytes += size
      const normalized = relative.split(path.sep).join('/')
      const isScript = isScriptFile(normalized)
      if (isScript) scriptCount += 1
      if (files.length < MAX_FILES) {
        files.push({ path: normalized, size, isScript })
      } else {
        truncated = true
      }
    }

    skills.push({
      dirName,
      rootPath: root,
      name: data.meta.name || dirName,
      description: data.meta.description,
      relativePath: path.relative(baseDir, root).split(path.sep).join('/') || '.',
      body: data.body.slice(0, MAX_BODY_CHARS),
      files,
      fileCount: relativeFiles.length,
      totalBytes,
      scriptCount,
      parseError: data.parseError
    })
  }

  return { skills, truncated }
}
