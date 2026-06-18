# AIBench

本地 Agent Skill 与 Prompt 管理桌面工具（Electron）。

## 功能

- **Skills**：按 Agent Framework 分栏浏览；安装文件夹 / zip；新建与编辑；归档与恢复
- **Prompts**：SQLite 存储；卡片浏览；点击卡片复制正文；右上角打开编辑；分类标签管理；导出 Markdown
- **内置 Framework**：Codex CLI、Cursor、Claude Code、Hermes、OpenClaw；可添加 Custom Framework
- **设置**：Framework 路径、归档目录、导出目录、深浅色主题

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## Release

```bash
npm run release
```

Windows 产物输出到 `release/`，包括安装包、便携版和 zip 包。

数据目录默认：`%APPDATA%/AIBench/`

Codex CLI 默认 Skill 目录：`~/.agents/skills/`
