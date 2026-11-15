import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'fs'
import path from 'path'
import { normalizePromptTags } from '../shared/prompt-tags'
import type { PromptCategory, PromptItem, PromptRevision } from '../shared/types'

const MAX_REVISIONS_PER_PROMPT = 50

let db: DatabaseSync | null = null

function dbPath(): string {
  return path.join(app.getPath('userData'), 'aibench.db')
}

export function getDbPath(): string {
  return dbPath()
}

export function getDb(): DatabaseSync {
  if (db) return db
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  db = new DatabaseSync(dbPath())
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_categories (
      name TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_revisions_prompt
      ON prompt_revisions (prompt_id, id);
  `)
  return db
}

export function closeDb(): void {
  try {
    db?.close()
  } catch {
    // Already closed or never opened; nothing to release.
  }
  db = null
}

export function getStats(): { prompts: number; categories: number; revisions: number } {
  const database = getDb()
  const count = (table: string): number => {
    const row = database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as
      | { n: number | bigint }
      | undefined
    return Number(row?.n ?? 0)
  }
  return {
    prompts: count('prompts'),
    categories: count('prompt_categories'),
    revisions: count('prompt_revisions')
  }
}

/**
 * Consistent snapshot of the live database, safe while the app keeps writing.
 * `VACUUM INTO` writes a compact copy instead of copying a possibly half-written
 * file with an open journal.
 */
export function exportSnapshot(target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.rmSync(target, { force: true })
  getDb().exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
}

export function checkIntegrity(): string {
  const rows = getDb().prepare('PRAGMA integrity_check').all() as Array<Record<string, unknown>>
  const messages = rows
    .map((row) => String(Object.values(row)[0] ?? ''))
    .filter((message) => message && message.toLowerCase() !== 'ok')
  return messages.length === 0 ? 'ok' : messages.join('; ')
}

export function countOrphanRevisions(): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM prompt_revisions r
       LEFT JOIN prompts p ON p.id = r.prompt_id
       WHERE p.id IS NULL`
    )
    .get() as { n: number | bigint } | undefined
  return Number(row?.n ?? 0)
}

export function repairOrphanRevisions(): number {
  const result = getDb()
    .prepare('DELETE FROM prompt_revisions WHERE prompt_id NOT IN (SELECT id FROM prompts)')
    .run()
  return Number(result.changes)
}

export function listOverLimitPrompts(): Array<{ promptId: string; title: string; count: number }> {
  const rows = getDb()
    .prepare(
      `SELECT r.prompt_id AS promptId, COUNT(*) AS n, p.title AS title
       FROM prompt_revisions r
       LEFT JOIN prompts p ON p.id = r.prompt_id
       GROUP BY r.prompt_id
       HAVING n > ?
       ORDER BY n DESC`
    )
    .all(MAX_REVISIONS_PER_PROMPT) as Array<{ promptId: string; n: number | bigint; title: string | null }>
  return rows.map((row) => ({
    promptId: row.promptId,
    title: row.title ?? row.promptId,
    count: Number(row.n)
  }))
}

export function trimRevisionsToLimit(): number {
  const database = getDb()
  const prompts = database
    .prepare('SELECT DISTINCT prompt_id AS promptId FROM prompt_revisions')
    .all() as Array<{ promptId: string }>
  const trim = database.prepare(
    `DELETE FROM prompt_revisions
     WHERE prompt_id = ?
       AND id < (
         SELECT id FROM prompt_revisions WHERE prompt_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?
       )`
  )
  let removed = 0
  withTransaction(() => {
    for (const prompt of prompts) {
      removed += Number(
        trim.run(prompt.promptId, prompt.promptId, MAX_REVISIONS_PER_PROMPT - 1).changes
      )
    }
  })
  return removed
}

export function listDuplicateTitles(): Array<{ title: string; count: number }> {
  const rows = getDb()
    .prepare(
      `SELECT TRIM(title) AS title, COUNT(*) AS n
       FROM prompts
       GROUP BY LOWER(TRIM(title))
       HAVING n > 1
       ORDER BY n DESC`
    )
    .all() as Array<{ title: string; n: number | bigint }>
  return rows.map((row) => ({ title: row.title, count: Number(row.n) }))
}

function parseTags(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : []
  } catch {
    return []
  }
}

function rowToPrompt(row: {
  id: string
  title: string
  body: string
  tags: string
  created_at: string
  updated_at: string
}): PromptItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tags: parseTags(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

let transactionDepth = 0

function withTransaction<T>(fn: () => T): T {
  const database = getDb()
  if (transactionDepth > 0) {
    transactionDepth += 1
    try {
      return fn()
    } finally {
      transactionDepth -= 1
    }
  }

  database.exec('BEGIN IMMEDIATE')
  transactionDepth = 1
  try {
    const result = fn()
    database.exec('COMMIT')
    return result
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  } finally {
    transactionDepth = 0
  }
}

function insertRevision(prompt: PromptItem): void {
  const database = getDb()
  database
    .prepare(
      'INSERT INTO prompt_revisions (prompt_id, title, body, tags, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      prompt.id,
      prompt.title,
      prompt.body,
      JSON.stringify(prompt.tags),
      new Date().toISOString()
    )
  database
    .prepare(
      `DELETE FROM prompt_revisions
       WHERE prompt_id = ?
         AND id < (
           SELECT id FROM prompt_revisions WHERE prompt_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?
         )`
    )
    .run(prompt.id, prompt.id, MAX_REVISIONS_PER_PROMPT - 1)
}

export function listPrompts(query?: string, tag?: string): PromptItem[] {
  const rows = getDb().prepare('SELECT * FROM prompts ORDER BY updated_at DESC').all() as Array<{
    id: string
    title: string
    body: string
    tags: string
    created_at: string
    updated_at: string
  }>
  let items = rows.map(rowToPrompt)
  if (tag) items = items.filter((p) => p.tags.includes(tag))
  if (query?.trim()) {
    const q = query.trim().toLowerCase()
    items = items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    )
  }
  return items
}

export function getPrompt(id: string): PromptItem | null {
  const row = getDb().prepare('SELECT * FROM prompts WHERE id = ?').get(id) as
    | {
        id: string
        title: string
        body: string
        tags: string
        created_at: string
        updated_at: string
      }
    | undefined
  return row ? rowToPrompt(row) : null
}

export function createPrompt(title: string, body: string, tags: string[]): PromptItem {
  const now = new Date().toISOString()
  const id = randomUUID()
  const normalizedTags = normalizePromptTags(tags)
  ensureCategories(normalizedTags)
  getDb()
    .prepare(
      'INSERT INTO prompts (id, title, body, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, title, body, JSON.stringify(normalizedTags), now, now)
  return getPrompt(id)!
}

export function updatePrompt(
  id: string,
  title: string,
  body: string,
  tags: string[],
  recordRevision = true
): PromptItem {
  const existing = getPrompt(id)
  if (!existing) throw new Error('PROMPT_NOT_FOUND')
  const now = new Date().toISOString()
  const normalizedTags = normalizePromptTags(tags)
  const changed =
    existing.title !== title ||
    existing.body !== body ||
    JSON.stringify(existing.tags) !== JSON.stringify(normalizedTags)
  return withTransaction(() => {
    if (recordRevision && changed) insertRevision(existing)
    ensureCategories(normalizedTags)
    getDb()
      .prepare('UPDATE prompts SET title = ?, body = ?, tags = ?, updated_at = ? WHERE id = ?')
      .run(title, body, JSON.stringify(normalizedTags), now, id)
    return getPrompt(id)!
  })
}

export function deletePrompt(id: string): void {
  withTransaction(() => {
    getDb().prepare('DELETE FROM prompt_revisions WHERE prompt_id = ?').run(id)
    getDb().prepare('DELETE FROM prompts WHERE id = ?').run(id)
  })
}

export function listRevisions(promptId: string): PromptRevision[] {
  const rows = getDb()
    .prepare('SELECT * FROM prompt_revisions WHERE prompt_id = ? ORDER BY id DESC')
    .all(promptId) as Array<{
    id: number
    prompt_id: string
    title: string
    body: string
    tags: string
    created_at: string
  }>
  return rows.map((row) => ({
    id: row.id,
    promptId: row.prompt_id,
    title: row.title,
    body: row.body,
    tags: parseTags(row.tags),
    createdAt: row.created_at
  }))
}

export function restoreRevision(promptId: string, revisionId: number): PromptItem {
  const row = getDb()
    .prepare('SELECT * FROM prompt_revisions WHERE id = ? AND prompt_id = ?')
    .get(revisionId, promptId) as
    | { id: number; title: string; body: string; tags: string }
    | undefined
  if (!row) throw new Error('REVISION_NOT_FOUND')
  return updatePrompt(promptId, row.title, row.body, parseTags(row.tags), true)
}

function normalizeCategoryName(name: string): string {
  return name.trim()
}

function ensureCategories(tags: string[]): void {
  const now = new Date().toISOString()
  const stmt = getDb().prepare(
    'INSERT OR IGNORE INTO prompt_categories (name, created_at) VALUES (?, ?)'
  )
  for (const tag of tags) {
    const name = normalizeCategoryName(tag)
    if (name) stmt.run(name, now)
  }
}

export function listCategories(): PromptCategory[] {
  const savedRows = getDb()
    .prepare('SELECT name FROM prompt_categories ORDER BY name ASC')
    .all() as Array<{ name: string }>
  const counts = new Map<string, number>()

  for (const prompt of listPrompts()) {
    for (const tag of prompt.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  const names = new Set([...savedRows.map((row) => row.name), ...counts.keys()])
  return [...names]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((name) => ({ name, promptCount: counts.get(name) ?? 0 }))
}

export function createCategory(name: string): PromptCategory[] {
  const next = normalizeCategoryName(name)
  if (!next) throw new Error('INVALID_CATEGORY_NAME')
  getDb()
    .prepare('INSERT OR IGNORE INTO prompt_categories (name, created_at) VALUES (?, ?)')
    .run(next, new Date().toISOString())
  return listCategories()
}

export function renameCategory(oldName: string, newName: string): PromptCategory[] {
  const from = normalizeCategoryName(oldName)
  const to = normalizeCategoryName(newName)
  if (!from || !to) throw new Error('INVALID_CATEGORY_NAME')
  if (from === to) return listCategories()

  return withTransaction(() => {
    for (const prompt of listPrompts()) {
      if (!prompt.tags.includes(from)) continue
      const tags = [...new Set(prompt.tags.map((tag) => (tag === from ? to : tag)))]
      updatePrompt(prompt.id, prompt.title, prompt.body, tags, false)
    }

    getDb().prepare('DELETE FROM prompt_categories WHERE name = ?').run(from)
    getDb()
      .prepare('INSERT OR IGNORE INTO prompt_categories (name, created_at) VALUES (?, ?)')
      .run(to, new Date().toISOString())
    return listCategories()
  })
}

export function deleteCategory(name: string): PromptCategory[] {
  const target = normalizeCategoryName(name)
  if (!target) throw new Error('INVALID_CATEGORY_NAME')

  return withTransaction(() => {
    for (const prompt of listPrompts()) {
      if (!prompt.tags.includes(target)) continue
      updatePrompt(
        prompt.id,
        prompt.title,
        prompt.body,
        prompt.tags.filter((tag) => tag !== target),
        false
      )
    }

    getDb().prepare('DELETE FROM prompt_categories WHERE name = ?').run(target)
    return listCategories()
  })
}
