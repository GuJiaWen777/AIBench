# Industrial Command Desk Redesign

Date: 2026-06-18

## Goal

Give AIBench a distinctive production-grade interface while keeping its current workflows intact.

## Direction

The visual direction is Industrial Command Desk: a compact local control surface for managing Agent skills and prompts. It should feel deliberate, dense, technical, and polished.

## Scope

This redesign is renderer-only. It does not change data models, IPC channels, skill formats, prompt storage, or app routing.

## Requirements

- Keep the compact global dock with Skills, Prompts, and Settings.
- Preserve Skills platform filtering, archive tab, install, create, edit, and archive actions.
- Preserve Prompts category filtering, category management, card copy, create, edit, export, and delete actions.
- Preserve Settings behavior, including immediate theme switching.
- Improve light and dark themes as first-class appearances.
- Use a cohesive visual language: command-surface backgrounds, stronger section headers, refined cards, compact controls, and clear active states.
- Avoid marketing-page styling, oversized heroes, decorative blobs, and low-density layouts.

## Files

- `src/renderer/src/index.css`
- `src/renderer/src/components/Sidebar.tsx`
- `src/renderer/src/views/SkillsView.tsx`
- `src/renderer/src/views/PromptsView.tsx`
- `src/renderer/src/views/SettingsView.tsx`

## Verification

Run:

- `npm run typecheck`
- `npm run build`

Manual checks:

- Light theme has readable contrast and visible hierarchy.
- Dark theme is not just inverted; cards, rails, and controls have clear surfaces.
- Skills and Prompts still default to All.
- Theme buttons still switch immediately.
