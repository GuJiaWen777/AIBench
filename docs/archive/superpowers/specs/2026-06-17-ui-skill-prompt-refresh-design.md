# AIBench UI, Prompt Cards, and Skill Archive Design

Date: 2026-06-17

## Goal

Make AIBench feel more like a focused desktop workbench for browsing and managing local Agent skills and prompts.

This change covers four user-visible outcomes:

- Prompts are browsed as cards that show title, tags, and content preview.
- Prompt cards expose a copy action in the top-right corner.
- Skills include built-in framework entries for Cursor, Claude Code, Codex, Hermes, and OpenClaw.
- Archive management moves under the Skills page instead of occupying a top-level sidebar item.

## Prompt Experience

The Prompts view becomes a card-first browser.

The top of the page contains search, tag filters, New, and Export All actions. The body is a responsive grid of prompt cards. Each card shows:

- title
- tags
- body preview
- updated date
- a top-right copy button

Clicking the card opens the existing editing workflow in a modal. Editing keeps the current fields: title, tags, body, save, export, and delete. Copying from the card copies the full prompt body without opening the editor.

Empty states remain explicit: if no prompts match filters, show a quiet empty message and keep the New action available.

## Skills And Archive

The top-level sidebar keeps Skills, Prompts, and Settings. Archive is removed as a top-level item.

Inside Skills, add a two-tab switch:

- Skills: the current framework-based skill browser, installer, creator, editor, and move-to-archive flow.
- Archive: the existing archive list, restore, conflict overwrite, and permanent delete flow.

Archive restore continues to use all configured frameworks as restore targets. Successful restore refreshes the Skills list through the existing IPC change notification.

## Framework Defaults

The default built-in frameworks are:

- Cursor: `~/.cursor/skills`
- Claude Code: `~/.claude/skills`
- Codex: `~/.codex/skills`
- Hermes: `~/.hermes/skills`
- OpenClaw: `~/.openclaw/skills`

Existing user config is migrated by merging missing built-in frameworks into the configured framework list. Existing custom frameworks and edited built-in paths are preserved.

## Visual Direction

The UI should remain a dense desktop utility, not a landing page. Styling changes should:

- keep cards at 8px radius or less
- use neutral surfaces with restrained accent color
- make toolbar actions easy to scan
- avoid nested cards
- preserve light and dark themes
- keep text from overflowing buttons or cards

## Implementation Boundaries

This design should not change the SQLite prompt schema, IPC channel names, archive storage format, or skill file format.

The likely code changes are:

- `src/main/config.ts` for default frameworks and config migration
- `src/renderer/src/components/Sidebar.tsx` to remove top-level Archive
- `src/renderer/src/App.tsx` to stop routing a top-level archive view
- `src/renderer/src/views/PromptsView.tsx` for card browsing and modal editing
- `src/renderer/src/views/SkillsView.tsx` to host Skills and Archive tabs
- `src/renderer/src/views/ArchiveView.tsx` may be reused or embedded without changing archive behavior
- `src/renderer/src/index.css` for shared utility styling

## Verification

Run:

- `npm run typecheck`
- `npm run build`

Manually verify:

- Prompt cards render title, preview, tags, and copy button.
- Copy button copies full body without opening editor.
- Prompt editing still saves, exports, and deletes.
- Skills page shows Skills and Archive tabs.
- Archive no longer appears in the sidebar.
- Built-in framework list includes Codex, Hermes, and OpenClaw without losing existing configured frameworks.
