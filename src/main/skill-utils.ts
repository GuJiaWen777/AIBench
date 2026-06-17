import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { SkillMeta } from '../shared/types'

export function parseSkillMd(content: string): { meta: SkillMeta; body: string } {
  const parsed = matter(content)
  const data = parsed.data as Record<string, unknown>
  return {
    meta: {
      name: String(data.name ?? ''),
      description: String(data.description ?? '')
    },
    body: parsed.content.trim()
  }
}

export function buildSkillMd(meta: SkillMeta, body: string): string {
  const frontmatter = ['---', `name: ${meta.name}`, `description: ${meta.description}`, '---', '']
  return frontmatter.join('\n') + body
}

export function readSkillFromDir(skillDir: string): {
  meta: SkillMeta
  body: string
  modifiedAt: string
} | null {
  const skillFile = path.join(skillDir, 'SKILL.md')
  if (!fs.existsSync(skillFile)) return null
  const stat = fs.statSync(skillFile)
  const content = fs.readFileSync(skillFile, 'utf-8')
  const { meta, body } = parseSkillMd(content)
  return { meta, body, modifiedAt: stat.mtime.toISOString() }
}

export function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export function isValidDirName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(name)
}

export function copyDir(src: string, dest: string, overwrite = false): void {
  if (fs.existsSync(dest)) {
    if (!overwrite) throw new Error('TARGET_EXISTS')
    fs.rmSync(dest, { recursive: true, force: true })
  }
  fs.cpSync(src, dest, { recursive: true })
}

export function findSkillRoots(baseDir: string): string[] {
  const roots: string[] = []
  if (!fs.existsSync(baseDir)) return roots
  const direct = path.join(baseDir, 'SKILL.md')
  if (fs.existsSync(direct)) {
    roots.push(baseDir)
    return roots
  }
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const candidate = path.join(baseDir, entry.name)
    if (fs.existsSync(path.join(candidate, 'SKILL.md'))) roots.push(candidate)
  }
  return roots
}
