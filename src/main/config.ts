import { app } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { AppConfig, Framework, ThemeMode } from '../shared/types'

const CONFIG_FILE = 'config.json'

function defaultFrameworks(): Framework[] {
  const home = os.homedir()
  return [
    {
      id: 'cursor',
      name: 'Cursor',
      path: path.join(home, '.cursor', 'skills'),
      builtIn: true
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      path: path.join(home, '.claude', 'skills'),
      builtIn: true
    },
    {
      id: 'codex',
      name: 'Codex CLI',
      path: path.join(home, '.agents', 'skills'),
      builtIn: true
    },
    {
      id: 'hermes',
      name: 'Hermes',
      path: path.join(home, '.hermes', 'skills'),
      builtIn: true
    },
    {
      id: 'openclaw',
      name: 'OpenClaw',
      path: path.join(home, '.openclaw', 'skills'),
      builtIn: true
    }
  ]
}

function mergeFrameworks(configured?: Framework[]): Framework[] {
  const defaults = defaultFrameworks()
  if (!configured) return defaults

  const byId = new Map(configured.map((framework) => [framework.id, framework]))
  const oldCodexPath = path.join(os.homedir(), '.codex', 'skills')
  const mergedBuiltIns = defaults.map((framework) => ({
    ...framework,
    ...byId.get(framework.id),
    path:
      framework.id === 'codex' && byId.get(framework.id)?.path === oldCodexPath
        ? framework.path
        : byId.get(framework.id)?.path ?? framework.path,
    name:
      framework.id === 'codex' && byId.get(framework.id)?.name === 'Codex'
        ? framework.name
        : byId.get(framework.id)?.name ?? framework.name,
    builtIn: true
  }))
  const custom = configured.filter((framework) => !defaults.some((item) => item.id === framework.id))

  return [...mergedBuiltIns, ...custom]
}

function defaultConfig(): AppConfig {
  const dataDir = app.getPath('userData')
  return {
    frameworks: defaultFrameworks(),
    archivePath: path.join(dataDir, 'archive'),
    exportPath: path.join(dataDir, 'exports', 'prompts'),
    theme: 'system'
  }
}

let cached: AppConfig | null = null

function configPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE)
}

export function getConfig(): AppConfig {
  if (cached) return cached
  const filePath = configPath()
  if (fs.existsSync(filePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<AppConfig>
      cached = { ...defaultConfig(), ...raw, frameworks: mergeFrameworks(raw.frameworks) }
      return cached
    } catch {
      cached = defaultConfig()
      return cached
    }
  }
  cached = defaultConfig()
  saveConfig(cached)
  return cached
}

export function saveConfig(config: AppConfig): AppConfig {
  const dir = app.getPath('userData')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf-8')
  cached = config
  return config
}

export function updateConfig(partial: Partial<AppConfig>): AppConfig {
  const next = { ...getConfig(), ...partial }
  if (partial.frameworks) next.frameworks = partial.frameworks
  return saveConfig(next)
}

export function getFramework(frameworkId: string): Framework | undefined {
  return getConfig().frameworks.find((f) => f.id === frameworkId)
}

export function ensureDataDirs(): void {
  const config = getConfig()
  fs.mkdirSync(config.archivePath, { recursive: true })
  fs.mkdirSync(config.exportPath, { recursive: true })
  for (const fw of config.frameworks) {
    fs.mkdirSync(fw.path, { recursive: true })
  }
}

export function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  return 'light'
}
