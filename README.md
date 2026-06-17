# AIBench

本地 Agent Skill 与 Prompt 管理桌面工具（Electron）。

## 功能

- **Skills**：按 Agent Framework 分栏浏览；安装文件夹 / zip；新建与编辑；归档与恢复
- **Prompts**：SQLite 存储；标题 + 标签 + 正文；复制到剪贴板；导出 Markdown
- **内置 Framework**：Cursor、Claude Code；可添加 Custom Framework
- **设置**：Framework 路径、归档目录、导出目录、主题

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

数据目录默认：`%APPDATA%/AIBench/`
