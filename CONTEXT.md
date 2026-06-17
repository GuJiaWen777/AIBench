# AIBench

本地桌面工具，用于统一管理各 Agent 框架已安装的 Skill，以及个人常用 Prompt。

## Language

**Skill**:
一套供 Agent 调用的指令包，以目录形式存在，内含必需的 `SKILL.md` 文件。
_Avoid_: 插件, 扩展, rule

**Agent Framework**:
提供 Skill 安装目录与调用约定的 Agent 运行时，如 Cursor、Claude Code、Codex、Hermes。
_Avoid_: 平台, 编辑器

**Built-in Framework**:
App 预置路径与规则的 Agent Framework，v1 为 Cursor 和 Claude Code。
_Avoid_: 默认平台, 官方支持

**Custom Framework**:
用户自行命名并指定 Skill 根目录的 Agent Framework；App 按通用 `SKILL.md` 结构扫描，不校验框架特有字段。
_Avoid_: 第三方平台, 插件

**Skill Package**:
包含一个或多个 Skill 的 zip 压缩包，安装时需解压并识别其中的 `SKILL.md` 结构。
_Avoid_: 插件包, 安装包

**Skill Removal**:
将 Skill 从目标框架目录移出并放入归档区，而非永久删除。
_Avoid_: 卸载, 删除

**Archive**:
存放已移除 Skill 的本地目录，可从中恢复或彻底删除。
_Avoid_: 回收站, 垃圾桶

**Archive Record**:
Skill 归档时产生的元数据，记录原路径、来源 Framework 和移除时间，供 Archive 视图展示；恢复时仍由用户选择目标 Framework。
_Avoid_: 历史记录, 日志

**Prompt**:
用户自建的常用指令文本，含标题、正文和标签，存储于 App 本地数据库。
_Avoid_: 模板, snippet, 话术

**Tag**:
用户自定义的短标签，用于给 Prompt 分类和筛选，可自由创建、可复用。
_Avoid_: 分类, 文件夹, label

**Export**:
将 Prompt 从数据库导出为 Markdown 文件，便于肉眼阅读、备份或纳入版本管理；支持单条和全部导出，导出目录可在设置中自定义。
_Avoid_: 同步, 备份（泛称）

**Export Directory**:
Prompt 导出 Markdown 的目标文件夹，默认为 `%APPDATA%/AIBench/exports/prompts/`，用户可在设置中修改。
_Avoid_: 备份目录, 输出路径

**Workspace**:
App 主界面区域，由侧边栏切换 Skills、Prompts、Archive、Settings 四个视图。
_Avoid_: 页面, 模块

**Framework View**:
按 Agent Framework 分栏展示 Skill 列表；同一 Skill 在不同 Framework 中各自独立显示。
_Avoid_: 分 tab, 平台页

**Framework Copy**:
某个 Skill 在某一 Agent Framework 目录下的独立安装实例；编辑只作用于当前 Framework 的副本。
_Avoid_: 安装, 同步副本

**Prompt Editor**:
Prompts 视图中的主从布局：左侧列表选中项，右侧就地编辑标题、标签和正文。
_Avoid_: 弹窗编辑, 详情页

**Data Directory**:
App 存放本地数据库、配置和 Archive 的根目录，默认为 `%APPDATA%/AIBench/`。
_Avoid_: 安装目录, 用户目录

**Rescan**:
重新读取 Agent Framework 目录以更新 Skill 列表；App 启动时、文件变更时或用户手动触发。
_Avoid_: 刷新（UI 按钮泛称）, 同步
