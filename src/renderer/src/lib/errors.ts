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
  INVALID_CATEGORY_NAME: '分类名称不能为空。'
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

export function formatError(error: unknown, fallback = '操作失败，请重试。'): string {
  const raw = rawMessage(error)
  for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
    if (raw.includes(code)) return message
  }
  const cleaned = raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '').trim()
  return cleaned || fallback
}

export function showError(error: unknown, fallback?: string): void {
  alert(formatError(error, fallback))
}
