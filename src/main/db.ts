import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'fs'
import path from 'path'
import type { PromptCategory, PromptItem } from '../shared/types'

let db: DatabaseSync | null = null

function dbPath(): string {
  return path.join(app.getPath('userData'), 'aibench.db')
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
  `)
  return db
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
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
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
  ensureCategories(tags)
  getDb()
    .prepare(
      'INSERT INTO prompts (id, title, body, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, title, body, JSON.stringify(tags), now, now)
  return getPrompt(id)!
}

export function updatePrompt(
  id: string,
  title: string,
  body: string,
  tags: string[]
): PromptItem {
  const now = new Date().toISOString()
  ensureCategories(tags)
  getDb()
    .prepare('UPDATE prompts SET title = ?, body = ?, tags = ?, updated_at = ? WHERE id = ?')
    .run(title, body, JSON.stringify(tags), now, id)
  return getPrompt(id)!
}

export function deletePrompt(id: string): void {
  getDb().prepare('DELETE FROM prompts WHERE id = ?').run(id)
}

export function listTags(): string[] {
  const prompts = listPrompts()
  const set = new Set<string>()
  for (const p of prompts) for (const t of p.tags) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
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
  const saved = new Set(savedRows.map((row) => row.name))
  const counts = new Map<string, number>()

  for (const prompt of listPrompts()) {
    for (const tag of prompt.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  const names = new Set([...saved, ...counts.keys()])
  return [...names]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((name) => ({
      name,
      promptCount: counts.get(name) ?? 0,
      saved: saved.has(name)
    }))
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

  const existing = listPrompts()
  for (const prompt of existing) {
    if (!prompt.tags.includes(from)) continue
    const tags = [...new Set(prompt.tags.map((tag) => (tag === from ? to : tag)))]
    updatePrompt(prompt.id, prompt.title, prompt.body, tags)
  }

  getDb().prepare('DELETE FROM prompt_categories WHERE name = ?').run(from)
  createCategory(to)
  return listCategories()
}

export function deleteCategory(name: string): PromptCategory[] {
  const target = normalizeCategoryName(name)
  if (!target) throw new Error('INVALID_CATEGORY_NAME')

  for (const prompt of listPrompts()) {
    if (!prompt.tags.includes(target)) continue
    updatePrompt(
      prompt.id,
      prompt.title,
      prompt.body,
      prompt.tags.filter((tag) => tag !== target)
    )
  }

  getDb().prepare('DELETE FROM prompt_categories WHERE name = ?').run(target)
  return listCategories()
}
