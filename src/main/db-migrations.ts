import type { DatabaseSync } from 'node:sqlite'

/** Bump when adding an entry to MIGRATIONS. Stored in PRAGMA user_version. */
export const SCHEMA_VERSION = 1

interface Migration {
  version: number
  up: (database: DatabaseSync) => void
}

/**
 * Ordered, append-only migrations. Version 1 matches the schema that older
 * builds created with CREATE TABLE IF NOT EXISTS, so it is safe to run on an
 * existing database and simply stamps user_version = 1.
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up(database) {
      database.exec(`
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
    }
  }
]

export function readSchemaVersion(database: DatabaseSync): number {
  const row = database.prepare('PRAGMA user_version').get() as
    | { user_version?: number | bigint }
    | undefined
  return Number(row?.user_version ?? 0)
}

/**
 * Applies every migration newer than the file's user_version, each in its own
 * transaction. An unknown-higher version is rejected instead of being opened
 * by an older build that could corrupt data it does not understand.
 */
export function migrate(database: DatabaseSync): void {
  const current = readSchemaVersion(database)
  if (current > SCHEMA_VERSION) {
    throw new Error(`DB_SCHEMA_TOO_NEW:${current}`)
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue
    database.exec('BEGIN IMMEDIATE')
    try {
      migration.up(database)
      database.exec(`PRAGMA user_version = ${migration.version}`)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }
}
