# Industrial Command Desk Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign AIBench as a polished industrial command desk without changing application behavior.

**Architecture:** Keep all IPC/data contracts unchanged. Update shared CSS utilities and renderer view class names so existing workflows render with the new visual language.

**Tech Stack:** Electron, React, TypeScript, Tailwind CSS, electron-vite.

---

### Task 1: Shared Visual System

**Files:**
- Modify: `src/renderer/src/index.css`

- [ ] Replace the neutral utility look with Industrial Command Desk surfaces, controls, cards, and side filters.
- [ ] Preserve all existing class names used by views.
- [ ] Add small reusable classes for page shells, headers, metadata, and work grids.

### Task 2: Global Dock

**Files:**
- Modify: `src/renderer/src/components/Sidebar.tsx`

- [ ] Restyle the global dock with stronger brand treatment and bottom settings placement.
- [ ] Preserve routing behavior and button labels.

### Task 3: Workspace Views

**Files:**
- Modify: `src/renderer/src/views/SkillsView.tsx`
- Modify: `src/renderer/src/views/PromptsView.tsx`
- Modify: `src/renderer/src/views/SettingsView.tsx`

- [ ] Update page headers to use the shared command header style.
- [ ] Update rails and cards to use the new workbench classes.
- [ ] Keep all existing actions and state transitions.

### Task 4: Verification

**Files:**
- All modified files.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Commit with message `Redesign renderer command desk UI`.
- [ ] Push to `origin/main`.
