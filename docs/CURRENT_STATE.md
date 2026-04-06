# Hormus Current State

Date: 2026-04-06

## Summary

Hormus is currently a Phase 1 desktop scaffold with first-pass live database integration. It is not yet a complete MVP, but it has moved beyond the older mocked-backend state.

Implemented foundations:

- React + Vite + TypeScript renderer.
- Electron main and preload entrypoints.
- Shared Zod-validated IPC contract between renderer and main process.
- Collection Manager as the app landing screen.
- Collection Manager with a saved-connections sidebar and new/edit connection form.
- One query workspace window per selected connection.
- Zustand renderer state hydrated through the desktop API.
- Monaco SQL editor.
- AG Grid results table.
- Tailwind-based dark desktop shell with local shadcn-style primitives.
- Live PostgreSQL and MySQL query execution via `pg` and `mysql2`.
- Live schema/table metadata loading for PostgreSQL and MySQL.
- Basic table description IPC/backend support.
- Local persisted connections, history, and results.
- Credential persistence using Electron `safeStorage` when available, with a plaintext fallback when encryption is unavailable.
- Username/password authentication metadata and per-connection color assignment.
- Connection testing from the create/edit form using the live Electron database drivers.

## Key Files

- Product requirements: `docs/PRODUCT_REQUIEMENTS.md`
- App README: `README.md`
- Electron main process: `electron/main.ts`
- Electron preload API: `electron/preload.cts`
- Desktop backend orchestration: `electron/backend.ts`
- PostgreSQL/MySQL access: `electron/db.ts`
- Local storage and credential handling: `electron/storage.ts`
- Shared IPC contract and schemas: `src/shared/ipc.ts`
- Renderer state store: `src/store/use-app-store.ts`
- Window routing helpers: `src/lib/window-context.ts`
- Desktop API helper: `src/lib/desktop.ts`
- Collection Manager UI: `src/components/collection-manager.tsx`
- Query Workspace UI: `src/components/query-workspace.tsx`
- Query editor: `src/components/query-editor.tsx`
- Results grid: `src/components/results-grid.tsx`
- Visual tokens: `src/index.css`

## What Works

- App boots into Collection Manager.
- Users can create, edit, and delete PostgreSQL/MySQL connection records.
- Users can assign one of 10 colors to a saved connection.
- Users can test form credentials before saving a connection.
- Users can filter saved connections in the Collection Manager sidebar.
- Stored connections are persisted locally.
- Passwords are stored outside the public connection shape and decoded only in the Electron backend.
- Opening a connection creates or focuses a workspace window for that connection.
- Opened workspaces display the selected connection color.
- Workspace loads schemas and base tables from the live database.
- Query execution runs against the selected live connection.
- Results are normalized for renderer display and shown in AG Grid.
- Query history is stored per connection.
- The production build passes with:

```bash
npm run build
```

## Current Limitations

- The read-only guard is prefix-based and does not safely parse multi-statement SQL. It should not be treated as a production-grade write-protection mechanism yet.
- MySQL query execution enables `multipleStatements`, which increases the importance of fixing the read-only guard before relying on it.
- Query tab state is global in the backend and stored under a shared renderer localStorage key, so per-connection/per-window isolation is incomplete.
- There is no query cancellation, timeout handling, streaming, or server-side pagination.
- There is no enforced row limit yet.
- Multi-statement result handling is minimal and mainly returns the final MySQL result set.
- Basic autocomplete and keyboard shortcuts are not implemented.
- Workspace table/object search is visible but not wired.
- Clicking tables in the schema explorer does not yet generate or run queries.
- Views and functions are placeholders in the schema explorer.
- Table description support exists in the backend contract, but the UI does not expose it yet.
- CSV export and copy affordances are not implemented.
- There is no Electron dev orchestration command that runs Vite and Electron together with hot reload.
- There is no automated test suite configured.
- Packaging for macOS and Windows is not implemented.
- Monaco and AG Grid keep the renderer bundle large; the current build emits a chunk-size warning.

## Verification

Last verified on 2026-04-06:

```bash
npm run build
```

Result: build passes.

Build warning: Vite reports the renderer bundle is larger than 500 kB after minification. This is expected for the current Monaco + AG Grid setup and should be addressed with chunk splitting later.

Electron GUI launch was not verified during this review.

## Recommended Next Steps

1. Fix read-only enforcement with real SQL statement parsing or by disabling multi-statements for guarded connections.
2. Make query tabs and results truly scoped per connection/window.
3. Wire schema explorer interactions: table click, describe table, and query generation.
4. Add row limits, cancellation, and timeout behavior to query execution.
5. Add a dev command that runs the renderer and Electron shell together.
6. Add focused tests for storage migration, credential handling, IPC validation, and read-only query safety.
7. Add bundle splitting for Monaco and AG Grid.
8. Add packaging workflow after the core query path is safer.
