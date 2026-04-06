# Hormus Session Handoff

Date: 2026-03-30

## Current State

The repo now contains a working phase-1 desktop scaffold for Hormus:

- React + Vite renderer
- Electron main/preload shell
- Shared Zod IPC contract
- Mock desktop backend for connections, schemas, history, query tabs, and results
- Two-window model:
  - Collection Manager window
  - Query Workspace window per connection

The app builds successfully with:

```bash
npm run build
```

Electron currently launches with:

```bash
npm run start:electron
```

## Product Decisions Captured

These were updated in the PRD and implemented in the UI:

- App opens first to `Collection Manager`
- User creates / edits / deletes / chooses connections there
- Query editor lives in a separate screen/window per connection
- Query workspace layout:
  - top-left schema selector
  - left-side tree/object explorer
  - top half query editor
  - bottom half results grid
- One window per connection remains the intended desktop model

## Design Decisions Taken

The visual direction was pushed closer to Linear:

- flatter overall shell instead of stacked cards
- tighter spacing and smaller radii
- darker neutral palette with restrained accent color
- denser list rows and sidebar structure
- more consistent local shadcn-style primitives for:
  - buttons
  - cards
  - badges
  - inputs
  - selects

This is still an interpretation of Linear, not a full clone.

## Important Files

- PRD updates:
  - `docs/PRODUCT_REQUIEMENTS.md`
- Electron:
  - `electron/main.ts`
  - `electron/preload.ts`
- Shared contract:
  - `src/shared/ipc.ts`
- Mock backend:
  - `src/shared/mock-backend.ts`
  - `src/shared/mock-data.ts`
- Window context:
  - `src/lib/window-context.ts`
- Renderer state:
  - `src/store/use-app-store.ts`
- Main screens:
  - `src/components/collection-manager.tsx`
  - `src/components/query-workspace.tsx`
- UI primitives:
  - `src/components/ui/*`
- Global visual tokens:
  - `src/index.css`

## Known Limitations

- Data is still mocked in the desktop backend
- No real database adapters yet
- No secure credential storage yet
- No Electron dev workflow that runs Vite and Electron together with hot reload
- Monaco + AG Grid keep the renderer bundle large
- Collection Manager is improved visually, but still less refined than the query workspace
- The object tree is currently shallow and mocked, not a true lazy hierarchical explorer

## Recommended Next Steps

1. Implement real connection persistence and secure credential storage.
2. Add real `PostgresAdapter` and `MySQLAdapter`.
3. Replace mock IPC handlers with adapter-backed services.
4. Add Electron dev orchestration for a proper local desktop dev loop.
5. Continue the Linear-style polish pass:
   - tighter Collection Manager list/detail UI
   - cleaner workspace header/breadcrumb toolbar
   - richer object tree hierarchy and interactions
6. Split renderer chunks to reduce bundle size.

## Notes For Future Sessions

- Electron build output is under:
  - `dist-electron/electron/main.js`
  - `dist-electron/electron/preload.js`
- Vite uses a relative base path so built assets load correctly in Electron.
- If Electron opens a blank window again, first verify:
  - `npm run build` completed
  - `dist/index.html` exists
  - `dist-electron/electron/main.js` exists

