# Contributing To Hormus

Hormus is an Electron database client focused on a fast desktop workflow for PostgreSQL and MySQL. Contributions are welcome, but the project is still early and the review bar is intentionally practical: changes should be scoped, verifiable, and aligned with the product direction already documented in this repo.

## Before You Start

Read these first:

- `README.md`
- `docs/PRODUCT_REQUIEMENTS.md`
- `docs/CURRENT_STATE.md`

For architectural context, prefer the public docs in the repo over implementation guesswork. If you want to propose a large feature, open an issue before writing a large PR.

## Development Setup

Requirements:

- Node.js `25.7.0` from `.nvmrc`
- npm

Install dependencies:

```bash
npm install
```

Run the core checks:

```bash
npm run check
```

Useful commands:

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
```

## Pull Request Expectations

Open small, focused pull requests whenever possible.

A good PR should:

- explain the problem being solved
- describe the approach taken
- include clear verification steps
- include screenshots or short video for UI changes
- update docs when user-visible behavior changes

Before opening a PR, run:

```bash
npm run check
```

## Coding Standards

- Preserve the existing Electron + React + Vite + TypeScript structure.
- Reuse or extend primitives in `src/components/ui` for standard controls and layout chrome.
- Do not add raw `button`, `input`, or `select` markup in feature components. Add or extend a UI primitive first when needed.
- Keep UI changes aligned with the product and state docs.
- Do not mix unrelated refactors into functional PRs.
- Prefer clear, boring logic over clever abstractions.

## Testing Expectations

At minimum:

- bug fixes should include a regression test when there is a stable place to add one
- changes to shared query logic should add or update unit tests
- changes to IPC contracts, Electron backend behavior, or database providers should be verified explicitly in the PR description

## Areas That Need Extra Care

These changes need especially strong verification:

- `src/shared/ipc.ts`
- `electron/storage.ts`
- `electron/db.ts`
- `electron/providers/*`
- query execution, pagination, or read-only enforcement

## Feature Scope

Generally welcome:

- bug fixes
- targeted UX improvements
- performance improvements with clear measurement
- documentation improvements
- tests and tooling improvements

Discuss first:

- new database engines
- large design overhauls
- major state-management rewrites
- storage format changes
- security-sensitive changes

## Reporting Bugs

Include:

- operating system
- Hormus version or commit SHA
- database type and version
- exact reproduction steps
- expected behavior
- actual behavior
- screenshots or logs when useful

## Security

Do not open public issues for security-sensitive problems involving credentials, storage, or unsafe query execution paths. Use the process documented in `SECURITY.md`.
