# TODO

后续功能候选，按投入产出排序。完成一项后，把说明移入 README 的功能列表并从本文件删除。

## 1. 跨 Framework 同步中心

- 新增独立视图：行是 Skill 目录名，列是 Framework。
- 每个格子显示未安装 / 一致 / 有差异 / 版本较旧，点击查看差异。
- 支持「同步全部差异」和按行 / 按列批量同步。
- 复用 `skills.copies`、`skills.diff`、`skills.sync` 的现有实现。

## 2. Skill 体检（Lint）

- 扩展 health-service：frontmatter 规范、description 是否足够具体、脚本风险、引用文件缺失、重复 Skill。
- 每条问题给出文件位置与修复建议；可安全修复的项复用现有 fix 机制。
- 与健康检查共用报告和界面。

## 3. Prompt 导入 / Git 同步

- 从 Markdown / JSON 导入 Prompt，识别标题、分类和正文。
- 允许用户指定一个本地目录（可放在 iCloud / OneDrive / Syncthing）作为同步目录。
- 进阶：接入 Git 仓库，自动提交和拉取，处理简单冲突。
- 先做本地目录同步，避免账号授权与冲突合并带来的复杂度。

## 4. 使用数据

- 记录收藏、最近使用时间和复制次数。
- 列表支持按最近使用 / 复制次数排序，快捷入口优先展示常用 Prompt。
- 需要一条新的数据库迁移。

## 工程改进

- 自动更新（electron-updater）与安装包签名。
- 界面文案 i18n（当前为中文硬编码）。
