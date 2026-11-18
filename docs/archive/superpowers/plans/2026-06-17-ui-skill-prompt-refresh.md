# UI Skill Prompt Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh AIBench so prompts browse as cards, archive lives under Skills, and default frameworks include Codex, Hermes, and OpenClaw.

**Architecture:** Keep the existing IPC and storage contracts. Make renderer changes in the existing view files and add one small config migration in the main process.

**Tech Stack:** Electron, React, TypeScript, Tailwind CSS, electron-vite.

---

### Task 1: Default Framework Migration

**Files:**
- Modify: `src/main/config.ts`

- [ ] Add built-in defaults for Cursor, Claude Code, Codex, Hermes, and OpenClaw.
- [ ] Merge missing built-ins into existing `config.json` while preserving existing paths and custom frameworks.
- [ ] Run `npm run typecheck`.

### Task 2: Skills Owns Archive

**Files:**
- Modify: `src/renderer/src/components/Sidebar.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/views/ArchiveView.tsx`
- Modify: `src/renderer/src/views/SkillsView.tsx`

- [ ] Remove Archive from top-level sidebar routing.
- [ ] Add `Skills` and `Archive` tabs inside `SkillsView`.
- [ ] Reuse archive restore and delete behavior inside the Skills page.
- [ ] Run `npm run typecheck`.

### Task 3: Prompt Card Browser

**Files:**
- Modify: `src/renderer/src/views/PromptsView.tsx`

- [ ] Replace the split list/editor layout with a top toolbar and card grid.
- [ ] Show title, tags, preview, updated date, and a top-right copy action on each card.
- [ ] Open editing in a modal when a card is clicked.
- [ ] Keep save, export, delete, tag editing, and full-body copy behavior.
- [ ] Run `npm run typecheck`.

### Task 4: UI Polish

**Files:**
- Modify: `src/renderer/src/index.css`
- Touch view files only where class names need alignment.

- [ ] Tighten shared card radius to 8px.
- [ ] Add utility classes for segmented controls, toolbar surfaces, and icon buttons.
- [ ] Keep light and dark themes readable.
- [ ] Run `npm run build`.

### Task 5: Final Verification And Commit

**Files:**
- All modified files.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Check `git diff`.
- [ ] Commit the implementation with message `Refresh prompt and skill management UI`.
