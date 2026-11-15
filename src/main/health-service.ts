import fs from 'fs'
import path from 'path'
import type { HealthIssue, HealthReport } from '../shared/types'
import {
  configFilePath,
  dataDirPath,
  getConfig,
  getConfigStatus,
  saveConfig
} from './config'
import {
  buildSkillMd,
  readSkillFromDir,
  type SkillDirContent
} from './skill-utils'
import { deriveArchiveDirName } from './archive-service'
import {
  checkIntegrity,
  countOrphanRevisions,
  listDuplicateTitles,
  listOverLimitPrompts,
  repairOrphanRevisions,
  trimRevisionsToLimit
} from './db'

type Severity = HealthIssue['severity']
type Fixer = () => void

interface ScanResult {
  report: HealthReport
  fixers: Map<string, Fixer>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function readSkillSafely(dir: string): SkillDirContent | null {
  try {
    return readSkillFromDir(dir)
  } catch {
    return null
  }
}

function writeDerivedArchiveRecord(archiveDir: string, dirName: string): void {
  const skill = readSkillSafely(archiveDir)
  const record = {
    id: path.basename(archiveDir),
    dirName: deriveArchiveDirName(dirName),
    removedFrom: '未知',
    originalPath: '',
    removedAt: fs.statSync(archiveDir).mtime.toISOString(),
    meta: skill?.meta ?? { name: dirName, description: '' }
  }
  fs.writeFileSync(
    path.join(archiveDir, '.archive.json'),
    JSON.stringify(record, null, 2),
    'utf-8'
  )
}

function scan(): ScanResult {
  const issues: HealthIssue[] = []
  const fixers = new Map<string, Fixer>()
  const usedIds = new Set<string>()

  const push = (
    severity: Severity,
    code: string,
    title: string,
    detail: string,
    fixer?: Fixer
  ): void => {
    const base = `${code}:${title}`
    let id = base
    let suffix = 2
    while (usedIds.has(id)) id = `${base}:${suffix++}`
    usedIds.add(id)
    issues.push({ id, severity, code, title, detail, fixable: Boolean(fixer) })
    if (fixer) fixers.set(id, fixer)
  }

  const config = getConfig()

  // --- Framework paths and skills -----------------------------------------
  for (const framework of config.frameworks) {
    const root = framework.path?.trim() ?? ''
    if (!root) {
      push(
        'error',
        'FRAMEWORK_PATH_EMPTY',
        `${framework.name} 未设置 Skill 目录`,
        '在设置中为该 Framework 指定 Skill 根目录。'
      )
      continue
    }

    let stat: fs.Stats | null = null
    try {
      stat = fs.statSync(root)
    } catch {
      stat = null
    }
    if (!stat) {
      const target = root
      push(
        'error',
        'FRAMEWORK_PATH_MISSING',
        `${framework.name} 的目录不存在`,
        target,
        () => fs.mkdirSync(target, { recursive: true })
      )
      continue
    }
    if (!stat.isDirectory()) {
      push('error', 'FRAMEWORK_PATH_NOT_DIR', `${framework.name} 的路径不是目录`, root)
      continue
    }

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(root, { withFileTypes: true })
    } catch (error) {
      push(
        'error',
        'FRAMEWORK_PATH_UNREADABLE',
        `${framework.name} 的目录无法读取`,
        `${root}（${errorMessage(error)}）`
      )
      continue
    }

    const missingMd: string[] = []
    const nameMismatch: string[] = []
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue
      const skillDir = path.join(root, entry.name)
      let data: SkillDirContent | null = null
      let unreadable = false
      try {
        data = readSkillFromDir(skillDir)
      } catch (error) {
        unreadable = true
        push(
          'warning',
          'SKILL_UNREADABLE',
          `${framework.name} / ${entry.name} 的 SKILL.md 无法读取`,
          errorMessage(error)
        )
      }
      if (!data) {
        if (!unreadable) missingMd.push(entry.name)
        continue
      }
      if (data.parseError) {
        const canFix = Boolean(data.meta.name || data.meta.description)
        push(
          'warning',
          'SKILL_PARSE_ERROR',
          `${framework.name} / ${entry.name} 的 SKILL.md 无法解析`,
          'frontmatter 不是标准 YAML，App 已按文本兜底读取。',
          canFix
            ? () => {
                const current = readSkillFromDir(skillDir)
                if (!current) throw new Error('SKILL_NOT_FOUND')
                fs.writeFileSync(
                  path.join(skillDir, 'SKILL.md'),
                  buildSkillMd(current.meta, current.body),
                  'utf-8'
                )
              }
            : undefined
        )
      }
      if (data.meta.name && data.meta.name !== entry.name) {
        nameMismatch.push(`${entry.name}（name: ${data.meta.name}）`)
      }
    }

    if (missingMd.length > 0) {
      push(
        'info',
        'SKILL_WITHOUT_MD',
        `${framework.name} 有 ${missingMd.length} 个目录缺少 SKILL.md`,
        missingMd.slice(0, 5).join('、') + (missingMd.length > 5 ? ' 等' : '')
      )
    }
    if (nameMismatch.length > 0) {
      push(
        'info',
        'SKILL_NAME_MISMATCH',
        `${framework.name} 有 ${nameMismatch.length} 个 Skill 的 name 与目录名不一致`,
        nameMismatch.slice(0, 5).join('、') + (nameMismatch.length > 5 ? ' 等' : '')
      )
    }
  }

  // --- Archive -------------------------------------------------------------
  const archivePath = config.archivePath?.trim() ?? ''
  if (!archivePath) {
    push('error', 'ARCHIVE_PATH_EMPTY', '未设置归档目录', '在设置中指定归档目录。')
  } else {
    let stat: fs.Stats | null = null
    try {
      stat = fs.statSync(archivePath)
    } catch {
      stat = null
    }
    if (!stat) {
      const target = archivePath
      push(
        'warning',
        'ARCHIVE_PATH_MISSING',
        '归档目录不存在',
        target,
        () => fs.mkdirSync(target, { recursive: true })
      )
    } else if (!stat.isDirectory()) {
      push('error', 'ARCHIVE_PATH_NOT_DIR', '归档路径不是目录', archivePath)
    } else {
      let entries: fs.Dirent[] = []
      try {
        entries = fs.readdirSync(archivePath, { withFileTypes: true })
      } catch (error) {
        push(
          'error',
          'ARCHIVE_PATH_UNREADABLE',
          '归档目录无法读取',
          `${archivePath}（${errorMessage(error)}）`
        )
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const archiveDir = path.join(archivePath, entry.name)
        const recordFile = path.join(archiveDir, '.archive.json')
        let recordOk = false
        if (fs.existsSync(recordFile)) {
          try {
            const raw = JSON.parse(fs.readFileSync(recordFile, 'utf-8')) as unknown
            recordOk =
              typeof raw === 'object' &&
              raw !== null &&
              typeof (raw as { id?: unknown }).id === 'string' &&
              typeof (raw as { dirName?: unknown }).dirName === 'string'
          } catch {
            recordOk = false
          }
        }
        if (!recordOk) {
          const dirName = entry.name
          push(
            'warning',
            'ARCHIVE_RECORD_INVALID',
            `归档记录异常：${dirName}`,
            fs.existsSync(recordFile)
              ? '.archive.json 无法解析，可按目录内容重建。'
              : '缺少 .archive.json，可按目录内容重建。',
            () => writeDerivedArchiveRecord(archiveDir, dirName)
          )
        }
        if (!readSkillSafely(archiveDir)) {
          push(
            'warning',
            'ARCHIVE_SKILL_INVALID',
            `归档中的 ${entry.name} 缺少 SKILL.md`,
            '恢复后不会被识别为 Skill，可在 Archive 视图中删除。'
          )
        }
      }
    }
  }

  // --- Export directory ----------------------------------------------------
  const exportPath = config.exportPath?.trim() ?? ''
  if (!exportPath) {
    push('warning', 'EXPORT_PATH_EMPTY', '未设置 Prompt 导出目录', '在设置中指定导出目录。')
  } else {
    let stat: fs.Stats | null = null
    try {
      stat = fs.statSync(exportPath)
    } catch {
      stat = null
    }
    if (!stat) {
      const target = exportPath
      push(
        'warning',
        'EXPORT_PATH_MISSING',
        'Prompt 导出目录不存在',
        target,
        () => fs.mkdirSync(target, { recursive: true })
      )
    } else if (!stat.isDirectory()) {
      push('error', 'EXPORT_PATH_NOT_DIR', 'Prompt 导出路径不是目录', exportPath)
    } else {
      try {
        fs.accessSync(exportPath, fs.constants.W_OK)
      } catch {
        push('error', 'EXPORT_PATH_UNWRITABLE', 'Prompt 导出目录不可写', exportPath)
      }
    }
  }

  // --- Config file ---------------------------------------------------------
  const configStatus = getConfigStatus()
  if (configStatus.source === 'backup') {
    push(
      'warning',
      'CONFIG_USING_BACKUP',
      'config.json 无法解析，正在使用 .bak',
      '修复会用当前生效的设置重写 config.json。',
      () => saveConfig(getConfig())
    )
  } else if (configStatus.source === 'default' && configStatus.invalid) {
    push(
      'warning',
      'CONFIG_INVALID',
      'config.json 无法解析，已回退到默认设置',
      `修复会用当前设置重写 ${configFilePath()}。`,
      () => saveConfig(getConfig())
    )
  }

  // --- Database ------------------------------------------------------------
  try {
    const integrity = checkIntegrity()
    if (integrity !== 'ok') {
      push('error', 'DB_INTEGRITY', 'Prompt 数据库完整性检查未通过', integrity)
    }

    const orphanRevisions = countOrphanRevisions()
    if (orphanRevisions > 0) {
      push(
        'warning',
        'DB_ORPHAN_REVISIONS',
        `${orphanRevisions} 条历史版本没有对应的 Prompt`,
        '通常由异常退出或手动修改数据库产生，可安全删除。',
        () => {
          repairOrphanRevisions()
        }
      )
    }

    const overLimit = listOverLimitPrompts()
    if (overLimit.length > 0) {
      push(
        'warning',
        'DB_REVISIONS_OVER_LIMIT',
        `${overLimit.length} 个 Prompt 的历史版本超过上限`,
        overLimit
          .slice(0, 3)
          .map((item) => `${item.title}（${item.count} 条）`)
          .join('、'),
        () => {
          trimRevisionsToLimit()
        }
      )
    }

    const duplicates = listDuplicateTitles()
    if (duplicates.length > 0) {
      push(
        'info',
        'DB_DUPLICATE_TITLES',
        `${duplicates.length} 组 Prompt 标题重复`,
        duplicates
          .slice(0, 3)
          .map((item) => `${item.title}（${item.count} 条）`)
          .join('、')
      )
    }
  } catch (error) {
    push('error', 'DB_UNAVAILABLE', '无法读取 Prompt 数据库', errorMessage(error))
  }

  // --- Data directory ------------------------------------------------------
  try {
    fs.accessSync(dataDirPath(), fs.constants.W_OK)
  } catch {
    push('error', 'DATA_DIR_UNWRITABLE', '数据目录不可写', dataDirPath())
  }

  const weight: Record<Severity, number> = { error: 0, warning: 1, info: 2 }
  issues.sort((a, b) => weight[a.severity] - weight[b.severity])

  const report: HealthReport = {
    checkedAt: new Date().toISOString(),
    issues,
    summary: {
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
      infos: issues.filter((issue) => issue.severity === 'info').length,
      total: issues.length
    }
  }

  return { report, fixers }
}

export function runHealthCheck(): HealthReport {
  return scan().report
}

export function fixHealthIssue(issueId: string): HealthReport {
  const fixer = scan().fixers.get(issueId)
  if (!fixer) throw new Error('HEALTH_FIX_UNAVAILABLE')
  try {
    fixer()
  } catch (error) {
    console.error('AIBench health fix failed:', error)
    throw new Error('HEALTH_FIX_FAILED')
  }
  return runHealthCheck()
}
