# Hormus

Phase 1 desktop scaffold for a developer-first database client based on [`docs/PRODUCT_REQUIEMENTS.md`](./docs/PRODUCT_REQUIEMENTS.md).

## Included

- Bun/Vite React + TypeScript scaffold
- Electron main + preload foundation
- Zod-validated IPC contract shared between renderer and main process
- Tailwind setup with a shadcn-style component layer
- Linear-inspired desktop UI shell
- Live Electron backend for PostgreSQL and MySQL connections
- Secure local credential persistence via Electron storage
- Renderer state hydrated through desktop API instead of direct mock imports

## Run

1. Install dependencies with `bun install` or `npm install`
2. Run the renderer with `bun run dev` or `npm run dev`
3. Build both renderer and Electron entrypoints with `npm run build`
4. Launch Electron against the built output with `npm run start:electron`

## Notes

The app now opens with an empty connection list by default. Add a real PostgreSQL or MySQL connection from the Collection Manager, then open its query workspace in Electron.
