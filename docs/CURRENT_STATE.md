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
- Maximized query workspace layout with a fixed viewport shell, scrollable database-object sidebar, and resizable editor/results split.
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
- Query execution supports full-editor execution and selective execution when SQL text is selected.
- `Cmd+Enter` on macOS and `Ctrl+Enter` on Windows/Linux run the same execution path as the Run Query button.
- Multi-statement editor contents are split and executed in order; the final statement's result is displayed.
- SQL line and block comments are stripped before execution while preserving comment-like text inside quoted strings.
- Row-returning `SELECT` / `WITH` statements are paginated at the backend with a default page size of 100 rows.
- Result pagination fetches pages from the database on demand instead of loading the full result set into renderer memory.
- Results are normalized for renderer display and shown in AG Grid using the app's dark theme.
- Results grid column widths are estimated from returned page values and column names instead of enforcing a large fixed minimum.
- Results panel has an unclosable Output tab and a closable Results tab.
- Output tab stores an in-memory run history scoped to the active query editor tab, including query text, row summary, errors, and timestamps.
- Successful row-returning query runs switch to the Results tab; errors switch to the Output tab.
- Query editor tabs can be created, closed, and renamed inline from the tab bar.
- Query history is stored per connection.
- The production build passes with:

```bash
npm run build
```

## Current Limitations

- The read-only guard is still prefix-based. It now checks each prepared statement, but it should not be treated as a production-grade SQL safety parser yet.
- MySQL query execution still enables `multipleStatements`, which increases the importance of replacing the prefix guard with real SQL parsing before relying on it for production safety.
- Query tab state is global in the backend and stored under a shared renderer localStorage key, so per-connection/per-window isolation is incomplete.
- Result pagination currently wraps row-returning `SELECT` / `WITH` statements as subqueries. This may not support every dialect-specific statement form, ordering edge case, or statement with side effects inside a CTE.
- Pagination uses offset/limit and a separate count query; it is not streaming or cursor-based.
- There is no query cancellation, timeout handling, or streaming.
- Basic autocomplete is not implemented.
- Workspace table/object search is visible but not wired.
- Clicking tables in the schema explorer does not yet generate or run queries.
- Views and functions are placeholders in the schema explorer.
- Table description support exists in the backend contract, but the UI does not expose it yet.
- CSV export and copy affordances are not implemented.
- Output run history is in-memory renderer state and is not persisted across reloads.
- One query editor tab is a logical UI session only. Database connections are opened per query execution, so temp tables, open transactions, and DB session variables do not persist between runs.
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
4. Add cancellation and timeout behavior to query execution.
5. Add a dev command that runs the renderer and Electron shell together.
6. Add focused tests for storage migration, credential handling, IPC validation, and read-only query safety.
7. Add bundle splitting for Monaco and AG Grid.
8. Add packaging workflow after the core query path is safer.
