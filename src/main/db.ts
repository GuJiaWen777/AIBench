import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { PromptItem } from '../shared/types'

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
    )
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
  const id = crypto.randomUUID()
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
