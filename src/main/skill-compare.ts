import crypto from 'node:crypto'
import fs from 'fs'
import path from 'path'
import type {
  InstallConflict,
  InstallResult,
  SkillCopy,
  SkillDiff,
  SkillFileDiff,
  SkillFileStatus
} from '../shared/types'
import { getConfig, getFramework } from './config'
import { copyDir, hashSkillDir, listSkillFiles, resolveSkillDir } from './skill-utils'

const MAX_PREVIEW_BYTES = 256 * 1024
const MAX_FILE_BYTES = 2 * 1024 * 1024

interface FileInfo {
  size: number
  binary: boolean
  digest: string
  content: string | null
}

const EMPTY_FILE: FileInfo = { size: 0, binary: false, digest: '', content: null }

function inspectFile(filePath: string): FileInfo {
  const stat = fs.statSync(filePath)
  if (stat.size > MAX_FILE_BYTES) {
    return { size: stat.size, binary: true, digest: `size:${stat.size}`, content: null }
  }
  const buffer = fs.readFileSync(filePath)
  const binary = buffer.subarray(0, 8000).includes(0)
  return {
    size: buffer.length,
    binary,
    digest: crypto.createHash('sha256').update(buffer).digest('hex'),
    content: binary ? null : buffer.toString('utf-8')
  }
}

export function listSkillCopies(dirName: string): SkillCopy[] {
  return getConfig().frameworks.map((framework) => {
    let dir: string
    try {
      dir = resolveSkillDir(framework.path, dirName)
    } catch {
      return {
        frameworkId: framework.id,
        frameworkName: framework.name,
        path: '',
        exists: false,
        modifiedAt: null,
        contentHash: null
      }
    }
    const skillFile = path.join(dir, 'SKILL.md')
    const exists = fs.existsSync(skillFile)
    return {
      frameworkId: framework.id,
      frameworkName: framework.name,
      path: dir,
      exists,
      modifiedAt: exists ? fs.statSync(skillFile).mtime.toISOString() : null,
      contentHash: exists ? hashSkillDir(dir) : null
    }
  })
}

export function diffSkillCopies(dirName: string, aId: string, bId: string): SkillDiff {
  const aFramework = getFramework(aId)
  const bFramework = getFramework(bId)
  if (!aFramework || !bFramework) throw new Error('FRAMEWORK_NOT_FOUND')

  const aDir = resolveSkillDir(aFramework.path, dirName)
  const bDir = resolveSkillDir(bFramework.path, dirName)
  if (!fs.existsSync(path.join(aDir, 'SKILL.md'))) throw new Error('SKILL_NOT_FOUND')
  if (!fs.existsSync(path.join(bDir, 'SKILL.md'))) throw new Error('SKILL_NOT_FOUND')

  const aFiles = new Set(listSkillFiles(aDir))
  const bFiles = new Set(listSkillFiles(bDir))
  const allPaths = [...new Set([...aFiles, ...bFiles])].sort()

  const files: SkillFileDiff[] = allPaths.map((relative) => {
    const inA = aFiles.has(relative)
    const inB = bFiles.has(relative)
    const aInfo = inA ? inspectFile(path.join(aDir, relative)) : EMPTY_FILE
    const bInfo = inB ? inspectFile(path.join(bDir, relative)) : EMPTY_FILE

    let status: SkillFileStatus
    if (inA && inB) status = aInfo.digest === bInfo.digest ? 'same' : 'modified'
    else status = inA ? 'onlyA' : 'onlyB'

    return {
      path: relative,
      status,
      binary: aInfo.binary || bInfo.binary,
      aContent: aInfo.content,
      bContent: bInfo.content,
      aSize: aInfo.size,
      bSize: bInfo.size
    }
  })

  return {
    dirName,
    a: { frameworkId: aFramework.id, frameworkName: aFramework.name },
    b: { frameworkId: bFramework.id, frameworkName: bFramework.name },
    identical: files.every((file) => file.status === 'same'),
    files
  }
}

export function syncSkillCopies(
  sourceId: string,
  dirName: string,
  targetIds: string[]
): InstallResult {
  const sourceFramework = getFramework(sourceId)
  if (!sourceFramework) throw new Error('FRAMEWORK_NOT_FOUND')
  const sourceDir = resolveSkillDir(sourceFramework.path, dirName)
  if (!fs.existsSync(path.join(sourceDir, 'SKILL.md'))) throw new Error('SKILL_NOT_FOUND')

  const installed: string[] = []
  const conflicts: InstallConflict[] = []
  for (const targetId of targetIds) {
    if (targetId === sourceId) continue
    const targetFramework = getFramework(targetId)
    if (!targetFramework) throw new Error('FRAMEWORK_NOT_FOUND')
    fs.mkdirSync(targetFramework.path, { recursive: true })
    const target = resolveSkillDir(targetFramework.path, dirName)
    copyDir(sourceDir, target, true)
    installed.push(`${targetId}:${dirName}`)
  }
  return { installed, conflicts }
}
