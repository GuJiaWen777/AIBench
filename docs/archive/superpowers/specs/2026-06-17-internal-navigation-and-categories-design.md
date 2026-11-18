# Internal Navigation And Prompt Categories Design

Date: 2026-06-17

## Goal

Reduce empty space in the global sidebar and make filtering feel native to each workspace.

## Navigation

The global sidebar only switches top-level work areas: Skills, Prompts, and Settings. It should be compact.

Skills owns an internal platform sidebar. The default selected platform is All, which shows skills from every configured framework. Selecting a framework narrows the grid to that framework. Create and install actions use the selected concrete framework; when All is selected, the UI asks the user to choose a platform first by disabling those actions.

Prompts owns an internal category sidebar. The default selected category is All, which shows every prompt. Uncategorized shows prompts with no tags. Selecting a category narrows the card grid to prompts with that category tag.

## Category Management

Prompt categories are managed as first-class records, while remaining compatible with existing prompt tags.

The app stores categories in `prompt_categories`. The visible category list is the union of:

- saved categories
- tags currently used by prompts

Users can:

- create a category
- rename a category, which also renames that tag across all prompts
- delete a category, which removes that tag from all prompts
- see prompt counts per category

Deleting a category does not delete prompts.

## Verification

Run:

- `npm run typecheck`
- `npm run build`

Manually verify:

- Skills opens with All selected and shows skills from every framework.
- Skills framework sidebar can narrow to one platform.
- Prompts opens with All selected and shows every prompt.
- Prompt category sidebar can narrow by tag and show uncategorized prompts.
- Category create, rename, and delete update the sidebar and affected prompt tags.
