import { _electron as electron } from 'playwright-core'
import type { ElectronApplication, Page } from 'playwright-core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const projectRoot = path.resolve(import.meta.dirname, '../..')

const BUILT_IN_FRAMEWORKS = [
  { id: 'cursor', name: 'Cursor' },
  { id: 'claude-code', name: 'Claude Code' },
  { id: 'codex', name: 'Codex CLI' },
  { id: 'hermes', name: 'Hermes' },
  { id: 'openclaw', name: 'OpenClaw' }
] as const

export interface E2eFixture {
  dataDir: string
  backupDir: string
  frameworks: Record<string, string>
}

function writeSkill(dir: string, name: string, description: string, body: string): void {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`,
    'utf-8'
  )
}

/**
 * Builds an isolated userData directory so e2e runs never touch the real
 * %APPDATA%/AIBench data or the user's installed skills.
 */
export function createFixture(): E2eFixture {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibench-e2e-'))
  const backupDir = path.join(dataDir, 'backups')
  fs.mkdirSync(backupDir, { recursive: true })

  const frameworks: Record<string, string> = {}
  for (const framework of BUILT_IN_FRAMEWORKS) {
    frameworks[framework.id] = path.join(dataDir, 'frameworks', framework.id, 'skills')
    fs.mkdirSync(frameworks[framework.id], { recursive: true })
  }

  writeSkill(
    path.join(frameworks['claude-code'], 'code-review'),
    'code-review',
    '审查代码改动并列出风险',
    '# Code Review'
  )
  writeSkill(
    path.join(frameworks.cursor, 'code-review'),
    'code-review',
    '审查代码改动并列出风险',
    '# Code Review\n\nCursor copy'
  )

  fs.writeFileSync(
    path.join(dataDir, 'config.json'),
    JSON.stringify(
      {
        frameworks: BUILT_IN_FRAMEWORKS.map((framework) => ({
          ...framework,
          path: frameworks[framework.id],
          builtIn: true
        })),
        archivePath: path.join(dataDir, 'archive'),
        exportPath: path.join(dataDir, 'exports', 'prompts'),
        theme: 'light'
      },
      null,
      2
    ),
    'utf-8'
  )

  return { dataDir, backupDir, frameworks }
}

export function removeFixture(fixture: E2eFixture): void {
  fs.rmSync(fixture.dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}

async function findMainWindow(app: ElectronApplication): Promise<Page> {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    for (const candidate of app.windows()) {
      if ((await candidate.locator('.top-nav').count()) > 0) return candidate
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('主窗口没有在 20 秒内完成渲染')
}

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
}

export async function launchApp(fixture: E2eFixture): Promise<LaunchedApp> {
  const app = await electron.launch({
    args: [projectRoot],
    cwd: projectRoot,
    env: {
      ...(process.env as Record<string, string>),
      AIBENCH_USER_DATA: fixture.dataDir
    }
  })
  const page = await findMainWindow(app)
  // Native alert/confirm would block the renderer; tests assert on DOM state.
  await page.evaluate(() => {
    window.alert = () => {}
    window.confirm = () => true
  })
  return { app, page }
}

export async function waitFor(
  condition: () => boolean,
  timeoutMs = 15_000,
  label = 'condition'
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`等待超时：${label}`)
}
