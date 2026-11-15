import { app } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { AppConfig, Framework } from '../shared/types'

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
let configSource: 'file' | 'backup' | 'default' = 'default'
let configInvalid = false

function configPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE)
}

export function configFilePath(): string {
  return configPath()
}

export function dataDirPath(): string {
  return app.getPath('userData')
}

export function getConfigStatus(): { source: 'file' | 'backup' | 'default'; invalid: boolean } {
  getConfig()
  return { source: configSource, invalid: configInvalid }
}

export function reloadConfig(): AppConfig {
  cached = null
  return getConfig()
}

function readConfigFile(filePath: string): AppConfig | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<AppConfig>
    return { ...defaultConfig(), ...raw, frameworks: mergeFrameworks(raw.frameworks) }
  } catch {
    return null
  }
}

export function getConfig(): AppConfig {
  if (cached) return cached
  const filePath = configPath()
  const primary = readConfigFile(filePath)
  if (primary) {
    cached = primary
    configSource = 'file'
    configInvalid = false
    return cached
  }

  const fallback = readConfigFile(`${filePath}.bak`)
  const invalid = fs.existsSync(filePath)
  configSource = fallback ? 'backup' : 'default'
  configInvalid = invalid
  cached = fallback ?? defaultConfig()
  if (!fallback) {
    saveConfig(cached)
    // saveConfig() reports a healthy file; keep the fallback status we just
    // detected so the health check can still surface it.
    configSource = 'default'
    configInvalid = invalid
  }
  return cached
}

export function saveConfig(config: AppConfig): AppConfig {
  const dir = app.getPath('userData')
  fs.mkdirSync(dir, { recursive: true })
  const target = configPath()
  const temp = `${target}.tmp`
  const serialized = JSON.stringify(config, null, 2)
  fs.writeFileSync(temp, serialized, 'utf-8')
  try {
    if (fs.existsSync(target)) fs.copyFileSync(target, `${target}.bak`)
    fs.renameSync(temp, target)
  } catch {
    // Some antivirus/file-lock setups reject rename; fall back to a direct write.
    fs.writeFileSync(target, serialized, 'utf-8')
    fs.rmSync(temp, { force: true })
  }
  cached = config
  configSource = 'file'
  configInvalid = false
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
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.mkdirSync(config.archivePath, { recursive: true })
  fs.mkdirSync(config.exportPath, { recursive: true })
}
