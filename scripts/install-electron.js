#!/usr/bin/env node
/**
 * 备用安装脚本：当 electron postinstall 因网络/解压失败时手动运行
 *   npm run install:electron
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')

async function main() {
  const { downloadArtifact } = require('@electron/get')
  const AdmZip = require('adm-zip')
  const { version } = require(path.join(electronDir, 'package.json'))

  const platform = process.platform
  const arch = process.arch
  console.log(`下载 Electron ${version} (${platform}-${arch})…`)

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform,
    arch,
    force: process.env.force_no_cache === 'true'
  })
  console.log('已下载:', zipPath)

  const distPath = path.join(electronDir, 'dist')
  fs.rmSync(distPath, { recursive: true, force: true })
  fs.mkdirSync(distPath, { recursive: true })

  const zip = new AdmZip(zipPath)
  zip.extractAllTo(distPath, true)

  const platformPath = platform === 'win32' ? 'electron.exe' : 'electron'
  const exePath = path.join(distPath, platformPath)
  if (!fs.existsSync(exePath)) {
    throw new Error(`解压后未找到 ${platformPath}`)
  }

  fs.writeFileSync(path.join(electronDir, 'path.txt'), platformPath)
  fs.writeFileSync(path.join(distPath, 'version'), `v${version}`)
  console.log('Electron 安装完成:', exePath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
