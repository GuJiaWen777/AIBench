import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { BACKUP_MANIFEST_FILE, BACKUP_SKILLS_DIR } from '../../src/shared/backup-manifest.ts'
import { launchApp, createFixture, removeFixture, waitFor } from './helpers.ts'
import type { E2eFixture, LaunchedApp } from './helpers.ts'

let fixture: E2eFixture
let launched: LaunchedApp

before(
  async () => {
    fixture = createFixture()
    launched = await launchApp(fixture)
  },
  { timeout: 60_000 }
)

after(async () => {
  await launched?.app.close()
  if (fixture) removeFixture(fixture)
})

test('启动后进入 Skills 视图，并列出各 Framework 的 Skill', { timeout: 60_000 }, async () => {
  const { page } = launched

  assert.equal(await page.locator('.nav-tabs button').count(), 2)
  assert.equal(
    await page.locator('[data-testid="nav-skills"]').getAttribute('aria-current'),
    'page'
  )

  await page.waitForSelector('.list-card .row-item')
  const rows = page.locator('.list-card .row-item')
  assert.equal(await rows.count(), 2)
  assert.equal(await rows.first().locator('.row-title').textContent(), 'code-review')

  const frameworkNames = await page
    .locator('.list-card .row-item .row-meta')
    .allTextContents()
  assert.deepEqual(frameworkNames.map((name) => name.trim()).sort(), ['Claude Code', 'Cursor'])
})

test('新建 Prompt 保存后进入列表', { timeout: 60_000 }, async () => {
  const { page } = launched

  await page.click('[data-testid="nav-prompts"]')
  await page.click('[data-testid="prompt-new"]')
  await page.fill('[data-testid="prompt-title"]', 'E2E 示例 Prompt')
  await page.fill('[data-testid="prompt-body"]', '请总结下面的内容：{{text}}')
  await page.click('[data-testid="prompt-save"]')

  await page.waitForFunction(
    () => document.querySelector('[role="dialog"] .modal-title')?.textContent === '编辑 Prompt'
  )
  await page.getByRole('button', { name: '关闭' }).click()

  const card = page.locator('article.card', { hasText: 'E2E 示例 Prompt' })
  await card.waitFor()
  assert.equal(await card.count(), 1)
  assert.match((await card.textContent()) ?? '', /请总结下面的内容/)
})

test('设置中切换深浅色主题立即生效', { timeout: 60_000 }, async () => {
  const { page } = launched

  await page.click('[data-testid="nav-settings"]')
  await page.click('[data-testid="theme-dark"]')
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'))

  await page.click('[data-testid="theme-light"]')
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))
})

test('导出备份生成包含 Skill 的 zip', { timeout: 60_000 }, async () => {
  const { app, page } = launched
  const target = path.join(fixture.backupDir, 'e2e-backup.zip')

  await app.evaluate(async (electron, filePath) => {
    const dialog = electron.dialog as unknown as {
      showSaveDialog: () => Promise<{ canceled: boolean; filePath: string }>
    }
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, target)

  await page.click('[data-testid="backup-create"]')
  await waitFor(() => fs.existsSync(target) && fs.statSync(target).size > 0, 20_000, '备份文件')

  const zip = new AdmZip(target)
  const manifest = JSON.parse(zip.readAsText(BACKUP_MANIFEST_FILE)) as {
    format: string
    counts: { skills: number }
  }
  assert.equal(manifest.format, 'aibench-backup')
  assert.equal(manifest.counts.skills, 2)
  assert.ok(zip.getEntry(`${BACKUP_SKILLS_DIR}/claude-code/code-review/SKILL.md`))
})
