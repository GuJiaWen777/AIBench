import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { SCHEMA_VERSION, migrate, readSchemaVersion } from '../src/main/db-migrations.ts'

function tableNames(db: DatabaseSync): string[] {
  return (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as Array<{
      name: string
    }>
  ).map((row) => row.name)
}

test('migrates a fresh database to the current schema version', () => {
  const db = new DatabaseSync(':memory:')
  try {
    migrate(db)
    assert.equal(readSchemaVersion(db), SCHEMA_VERSION)
    assert.deepEqual(tableNames(db), ['prompt_categories', 'prompt_revisions', 'prompts'])
  } finally {
    db.close()
  }
})

test('keeps existing rows when upgrading a legacy database', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(`
      CREATE TABLE prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO prompts VALUES ('p1', 'Legacy', 'body', '[]', '2026-01-01', '2026-01-01');
    `)
    assert.equal(readSchemaVersion(db), 0)

    migrate(db)

    assert.equal(readSchemaVersion(db), SCHEMA_VERSION)
    const row = db.prepare('SELECT title FROM prompts WHERE id = ?').get('p1') as
      | { title: string }
      | undefined
    assert.equal(row?.title, 'Legacy')
  } finally {
    db.close()
  }
})

test('running migrate twice is a no-op', () => {
  const db = new DatabaseSync(':memory:')
  try {
    migrate(db)
    migrate(db)
    assert.equal(readSchemaVersion(db), SCHEMA_VERSION)
    db.prepare(
      "INSERT INTO prompt_categories (name, created_at) VALUES ('开发', '2026-01-01')"
    ).run()
    const count = db.prepare('SELECT COUNT(*) AS n FROM prompt_categories').get() as {
      n: number
    }
    assert.equal(Number(count.n), 1)
  } finally {
    db.close()
  }
})

test('rejects a database written by a newer app version', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`)
    assert.throws(() => migrate(db), /DB_SCHEMA_TOO_NEW/)
    assert.equal(readSchemaVersion(db), SCHEMA_VERSION + 1)
  } finally {
    db.close()
  }
})
