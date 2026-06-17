import fs from 'fs'
import path from 'path'
import { getConfig } from './config'
import { getPrompt, listPrompts } from './db'
import { slugify } from './skill-utils'

function promptToMarkdown(prompt: {
  title: string
  body: string
  tags: string[]
  createdAt: string
  updatedAt: string
}): string {
  const tags = prompt.tags.map((t) => `"${t}"`).join(', ')
  return [
    '---',
    `title: ${prompt.title}`,
    `tags: [${tags}]`,
    `created_at: ${prompt.createdAt}`,
    `updated_at: ${prompt.updatedAt}`,
    '---',
    '',
    prompt.body
  ].join('\n')
}

function uniqueFilePath(dir: string, baseName: string): string {
  let candidate = path.join(dir, `${baseName}.md`)
  let i = 1
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}-${i}.md`)
    i += 1
  }
  return candidate
}

export function exportPrompt(id: string): string {
  const prompt = getPrompt(id)
  if (!prompt) throw new Error('PROMPT_NOT_FOUND')
  const { exportPath } = getConfig()
  fs.mkdirSync(exportPath, { recursive: true })
  const filePath = uniqueFilePath(exportPath, slugify(prompt.title) || 'prompt')
  fs.writeFileSync(filePath, promptToMarkdown(prompt), 'utf-8')
  return filePath
}

export function exportAllPrompts(): string[] {
  const prompts = listPrompts()
  return prompts.map((p) => exportPrompt(p.id))
}
