const ERROR_MESSAGES: Record<string, string> = {
  INVALID_DIR_NAME: '目录名无效：只能使用小写字母、数字和连字符，且不能包含路径分隔符。',
  FRAMEWORK_NOT_FOUND: '找不到该 Agent Framework，请检查设置中的路径。',
  TARGET_EXISTS: '目标位置已存在同名 Skill。',
  SKILL_NOT_FOUND: '找不到该 Skill，它可能已被移动或删除。',
  NO_SKILL_FOUND: '没有找到包含 SKILL.md 的 Skill。',
  SOURCE_EQUALS_TARGET: '不能把 Skill 安装到它自己所在的目录。',
  SOURCE_TARGET_OVERLAP: '源目录与目标目录不能互相包含。',
  ARCHIVE_NOT_FOUND: '找不到该归档记录。',
  PROMPT_NOT_FOUND: '找不到该 Prompt。',
  REVISION_NOT_FOUND: '找不到该历史版本。',
  INVALID_CATEGORY_NAME: '分类名称不能为空。',
  BACKUP_INVALID: '备份文件无效或已损坏。',
  BACKUP_UNSUPPORTED_VERSION: '该备份由更高版本的 AIBench 创建，请先升级。',
  BACKUP_ARCHIVE_UNSAFE: '备份中包含不安全的路径，已中止恢复。',
  BACKUP_TOO_LARGE: '备份内容过大，已中止。可取消“包含已安装 Skill”后重试。',
  BACKUP_DB_INVALID: '备份中的数据库无法通过完整性检查，已中止恢复。',
  BACKUP_INVALID_PATH: '归档目录路径无效，已中止恢复。',
  BACKUP_SOURCE_MISSING: '找不到备份文件。',
  HEALTH_FIX_UNAVAILABLE: '该问题无法自动修复，已重新检查。',
  HEALTH_FIX_FAILED: '修复失败，请检查文件权限或手动处理。',
  GITHUB_URL_INVALID: '链接无效。请粘贴 github.com 仓库或 /tree/ 目录链接。',
  GITHUB_REPO_NOT_FOUND: '找不到该仓库或分支，也可能是私有仓库。',
  GITHUB_RATE_LIMITED: 'GitHub 请求过于频繁，请稍后再试。',
  GITHUB_DOWNLOAD_FAILED: '下载仓库失败，请检查网络后重试。',
  GITHUB_TOO_LARGE: '仓库文件过大，已中止下载或解压。',
  GITHUB_ARCHIVE_UNSAFE: '仓库压缩包中包含不安全的路径，已中止。',
  GITHUB_NO_SKILLS: '没有在该链接下找到包含 SKILL.md 的 Skill。',
  GITHUB_SESSION_EXPIRED: '预览已过期，请重新获取仓库内容。',
  GITHUB_NO_FRAMEWORK: '请至少选择一个目标 Framework。',
  GITHUB_INVALID_REQUEST: '请求无效，请重新获取仓库预览。'
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

export function formatError(error: unknown, fallback = '操作失败，请重试。'): string {
  const raw = rawMessage(error)
  const restoreMarker = 'RESTORE_FAILED:'
  const restoreIndex = raw.indexOf(restoreMarker)
  if (restoreIndex >= 0) {
    const snapshot = raw.slice(restoreIndex + restoreMarker.length).trim()
    return `恢复失败，已停止。恢复前的数据保存在：\n${snapshot}`
  }
  for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
    if (raw.includes(code)) return message
  }
  const cleaned = raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '').trim()
  return cleaned || fallback
}

export function showError(error: unknown, fallback?: string): void {
  alert(formatError(error, fallback))
}
