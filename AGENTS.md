# Hormus Repo Instructions

## Product Context

Hormus is a developer-first Electron database client. The current implementation is a Phase 1 desktop app with live PostgreSQL/MySQL connections, Monaco for SQL editing, AG Grid for result rendering, and a shadcn/ui-based React interface.

Primary product docs:
- `docs/PRODUCT_REQUIEMENTS.md`
- `docs/CURRENT_STATE.md`

## UI Component Policy

Use shadcn/ui components for UI controls and layout chrome.

- Reuse or extend primitives in `src/components/ui` for buttons, badges, cards, inputs, labels, checkboxes, selects, separators, scroll areas, tabs, resizable panels, and similar UI elements.
- Do not add raw `button`, `input`, `select`, `checkbox`, tab, scrollbar, panel/card, or resize-handle markup in feature components. If a primitive is missing, add a shadcn/ui-style primitive under `src/components/ui` first, then consume it from the feature component.
- Monaco Editor and AG Grid are approved specialized widgets. Their surrounding toolbar, tabs, panels, buttons, scrollable containers, and status badges should still use shadcn/ui primitives.
- Prefer neutral default action/status colors. Connection colors can identify the active connection, but should not tint general primary buttons or status badges unless explicitly required.
- Keep shadcn theme tokens in `src/index.css` aligned with the dark desktop palette. Avoid hard-coded blue/purple action colors unless the product requirement specifically calls for them.

## Implementation Notes

- Use `rg` for searches.
- Use `apply_patch` for manual edits.
- Preserve the existing Electron + React + Vite + TypeScript structure.
- Run `npm run build` after UI or shared contract changes when feasible.
- Do not revert unrelated user changes in the working tree.
