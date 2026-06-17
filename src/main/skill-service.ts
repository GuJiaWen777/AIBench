import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import os from 'os'
import type {
  CreateSkillInput,
  InstallConflict,
  InstallResult,
  SkillDetail,
  SkillItem,
  UpdateSkillInput
} from '../shared/types'
import { getConfig, getFramework } from './config'
import {
  buildSkillMd,
  copyDir,
  findSkillRoots,
  isValidDirName,
  readSkillFromDir
} from './skill-utils'

export function listSkills(frameworkId: string): SkillItem[] {
  const fw = getFramework(frameworkId)
  if (!fw || !fs.existsSync(fw.path)) return []
  const items: SkillItem[] = []
  for (const entry of fs.readdirSync(fw.path, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillDir = path.join(fw.path, entry.name)
    const data = readSkillFromDir(skillDir)
    if (!data) continue
    items.push({
      dirName: entry.name,
      frameworkId: fw.id,
      frameworkName: fw.name,
      path: skillDir,
      meta: data.meta,
      modifiedAt: data.modifiedAt
    })
  }
  return items.sort((a, b) => a.dirName.localeCompare(b.dirName, 'zh-CN'))
}

export function getSkill(frameworkId: string, dirName: string): SkillDetail | null {
  const fw = getFramework(frameworkId)
  if (!fw) return null
  const skillDir = path.join(fw.path, dirName)
  const data = readSkillFromDir(skillDir)
  if (!data) return null
  return {
    dirName,
    frameworkId: fw.id,
    frameworkName: fw.name,
    path: skillDir,
    meta: data.meta,
    modifiedAt: data.modifiedAt,
    body: data.body
  }
}

function installOne(
  sourceDir: string,
  frameworkId: string,
  overwrite = false
): { ok: true; dirName: string } | { ok: false; conflict: InstallConflict } {
  const fw = getFramework(frameworkId)
  if (!fw) throw new Error('FRAMEWORK_NOT_FOUND')
  const dirName = path.basename(sourceDir)
  const target = path.join(fw.path, dirName)
  fs.mkdirSync(fw.path, { recursive: true })
  if (fs.existsSync(target) && !overwrite) {
    return { ok: false, conflict: { dirName, targetPath: target } }
  }
  copyDir(sourceDir, target, overwrite)
  return { ok: true, dirName }
}

export function installFromPath(
  sourcePath: string,
  frameworkIds: string[],
  overwrite = false
): InstallResult {
  const roots = findSkillRoots(sourcePath)
  if (roots.length === 0) throw new Error('NO_SKILL_FOUND')
  const installed: string[] = []
  const conflicts: InstallConflict[] = []
  for (const root of roots) {
    for (const fwId of frameworkIds) {
      const result = installOne(root, fwId, overwrite)
      if (result.ok) installed.push(`${fwId}:${result.dirName}`)
      else conflicts.push(result.conflict)
    }
  }
  return { installed, conflicts }
}

export function installFromZip(
  zipPath: string,
  frameworkIds: string[],
  overwrite = false
): InstallResult {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibench-zip-'))
  try {
    const zip = new AdmZip(zipPath)
    zip.extractAllTo(tempDir, true)
    return installFromPath(tempDir, frameworkIds, overwrite)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

export function createSkill(input: CreateSkillInput): SkillDetail {
  if (!isValidDirName(input.dirName)) throw new Error('INVALID_DIR_NAME')
  const fw = getFramework(input.frameworkId)
  if (!fw) throw new Error('FRAMEWORK_NOT_FOUND')
  const skillDir = path.join(fw.path, input.dirName)
  if (fs.existsSync(skillDir)) throw new Error('TARGET_EXISTS')
  fs.mkdirSync(skillDir, { recursive: true })
  const content = buildSkillMd(
    { name: input.name, description: input.description },
    input.body
  )
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8')
  return getSkill(input.frameworkId, input.dirName)!
}

export function updateSkill(input: UpdateSkillInput): SkillDetail {
  const fw = getFramework(input.frameworkId)
  if (!fw) throw new Error('FRAMEWORK_NOT_FOUND')
  const skillDir = path.join(fw.path, input.dirName)
  if (!fs.existsSync(skillDir)) throw new Error('SKILL_NOT_FOUND')
  const content = buildSkillMd(
    { name: input.name, description: input.description },
    input.body
  )
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8')
  return getSkill(input.frameworkId, input.dirName)!
}

export function removeSkillToArchive(frameworkId: string, dirName: string): void {
  const fw = getFramework(frameworkId)
  if (!fw) throw new Error('FRAMEWORK_NOT_FOUND')
  const skillDir = path.join(fw.path, dirName)
  if (!fs.existsSync(skillDir)) throw new Error('SKILL_NOT_FOUND')
  const config = getConfig()
  fs.mkdirSync(config.archivePath, { recursive: true })
  const archiveId = `${Date.now()}-${dirName}`
  const dest = path.join(config.archivePath, archiveId)
  fs.renameSync(skillDir, dest)
  const meta = readSkillFromDir(dest)
  const record = {
    id: archiveId,
    dirName,
    removedFrom: fw.name,
    originalPath: skillDir,
    removedAt: new Date().toISOString(),
    meta: meta?.meta ?? { name: dirName, description: '' }
  }
  fs.writeFileSync(path.join(dest, '.archive.json'), JSON.stringify(record, null, 2), 'utf-8')
}

export function listFrameworkPaths(): string[] {
  return getConfig().frameworks.map((f) => f.path)
}
