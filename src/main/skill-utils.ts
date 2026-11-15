import crypto from 'node:crypto'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { SkillMeta } from '../shared/types'

export interface ParsedSkillMd {
  meta: SkillMeta
  body: string
  parseError?: string
}

export interface SkillDirContent extends ParsedSkillMd {
  modifiedAt: string
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseFrontmatterFallback(content: string): ParsedSkillMd | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content)
  if (!match) return null
  const [, frontmatter, body] = match
  const name = /^name\s*:\s*(.*)$/m.exec(frontmatter)?.[1] ?? ''
  const description = /^description\s*:\s*(.*)$/m.exec(frontmatter)?.[1] ?? ''
  return {
    meta: { name: stripQuotes(name), description: stripQuotes(description) },
    body: body.trim()
  }
}

export function parseSkillMd(content: string): ParsedSkillMd {
  try {
    // Passing an options object skips gray-matter's internal cache. That cache
    // stores the file before parsing, so a frontmatter error would poison it
    // and later reads would silently return empty data instead of recovering.
    const parsed = matter(content, {})
    const data = parsed.data as Record<string, unknown>
    return {
      meta: { name: textValue(data.name), description: textValue(data.description) },
      body: parsed.content.trim()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const fallback = parseFrontmatterFallback(content)
    if (fallback) return { ...fallback, parseError: message }
    return {
      meta: { name: '', description: '' },
      body: content.trim(),
      parseError: message
    }
  }
}

function yamlString(value: string): string {
  // A JSON string is a valid YAML double-quoted scalar and safely escapes
  // colons, quotes, backslashes and newlines in user-provided values.
  return JSON.stringify(value)
}

export function buildSkillMd(meta: SkillMeta, body: string): string {
  const frontmatter = [
    '---',
    `name: ${yamlString(meta.name)}`,
    `description: ${yamlString(meta.description)}`,
    '---',
    ''
  ]
  return frontmatter.join('\n') + body
}

export function readSkillFromDir(skillDir: string): SkillDirContent | null {
  const skillFile = path.join(skillDir, 'SKILL.md')
  if (!fs.existsSync(skillFile)) return null
  const stat = fs.statSync(skillFile)
  const content = fs.readFileSync(skillFile, 'utf-8')
  const parsed = parseSkillMd(content)
  return {
    meta: parsed.meta,
    body: parsed.body,
    parseError: parsed.parseError,
    modifiedAt: stat.mtime.toISOString()
  }
}

const MAX_HASH_FILES = 1000

function collectFiles(dir: string, base: string, out: string[]): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (out.length >= MAX_HASH_FILES) return out
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectFiles(full, base, out)
    else if (entry.isFile()) out.push(path.relative(base, full))
  }
  return out
}

export function listSkillFiles(dir: string): string[] {
  return collectFiles(dir, dir, []).sort()
}

/** Stable hash over every file's relative path and bytes, used to compare copies. */
export function hashSkillDir(dir: string): string {
  const digest = crypto.createHash('sha256')
  for (const relative of listSkillFiles(dir)) {
    digest.update(relative)
    digest.update(fs.readFileSync(path.join(dir, relative)))
  }
  return digest.digest('hex')
}

export function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w一-鿿\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export function isValidDirName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(name)
}

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

/**
 * Directory names come from the renderer (IPC is a trust boundary), so they
 * must not be able to escape the framework root. Unlike isValidDirName this
 * also accepts names created by other tools (uppercase, dots, underscores).
 */
export function resolveSkillDir(root: string, dirName: string): string {
  if (
    !dirName ||
    dirName === '.' ||
    dirName === '..' ||
    dirName.includes('/') ||
    dirName.includes('\\') ||
    path.isAbsolute(dirName)
  ) {
    throw new Error('INVALID_DIR_NAME')
  }
  const rootPath = path.resolve(root)
  const target = path.resolve(rootPath, dirName)
  if (path.dirname(target) !== rootPath) throw new Error('INVALID_DIR_NAME')
  return target
}

export function copyDir(src: string, dest: string, overwrite = false): void {
  const srcPath = path.resolve(src)
  const destPath = path.resolve(dest)
  if (srcPath === destPath) throw new Error('SOURCE_EQUALS_TARGET')
  if (isPathInside(srcPath, destPath) || isPathInside(destPath, srcPath)) {
    throw new Error('SOURCE_TARGET_OVERLAP')
  }
  if (fs.existsSync(destPath)) {
    if (!overwrite) throw new Error('TARGET_EXISTS')
    fs.rmSync(destPath, { recursive: true, force: true })
  }
  fs.cpSync(srcPath, destPath, { recursive: true })
}

const SKIPPED_SCAN_DIRS = new Set(['__MACOSX', 'node_modules', '.git'])

export function findSkillRoots(baseDir: string, maxDepth = 4): string[] {
  const roots: string[] = []
  if (!fs.existsSync(baseDir)) return roots
  const visited = new Set<string>()

  const walk = (dir: string, depth: number): void => {
    let realDir: string
    try {
      realDir = fs.realpathSync(dir)
    } catch {
      return
    }
    if (visited.has(realDir)) return
    visited.add(realDir)

    if (fs.existsSync(path.join(dir, 'SKILL.md'))) {
      roots.push(dir)
      return
    }
    if (depth >= maxDepth) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIPPED_SCAN_DIRS.has(entry.name)) continue
      walk(path.join(dir, entry.name), depth + 1)
    }
  }

  walk(baseDir, 0)
  return roots
}
