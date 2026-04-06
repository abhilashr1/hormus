# Hormus

Hormus is a developer-first Electron database client for PostgreSQL and MySQL.

## Included

- Vite React + TypeScript renderer
- Electron main + preload process
- Zod-validated IPC contract shared between renderer and main process
- Tailwind setup with a shadcn-style component layer
- Linear-inspired desktop UI shell
- Live Electron backend for PostgreSQL and MySQL connections
- Secure local credential persistence via Electron storage
- Renderer state hydrated through desktop API instead of direct mock imports
- Electron Builder packaging for macOS, Windows, and Linux

## Development

Install dependencies:

```bash
npm install
```

Run the renderer dev server:

```bash
npm run dev
```

Build the renderer and Electron entrypoints:

```bash
npm run build
```

Launch Electron against the built output:

```bash
npm run start:electron
```

## Local Release Builds

Build distributables for the current platform:

```bash
npm run dist
```

Build a platform-specific release:

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
```

Release output is written to `release/`, which is intentionally ignored by Git.

Expected artifacts:

- macOS: `.dmg` and `.zip`
- Windows: NSIS `.exe`
- Linux: `.AppImage` and `.deb`

macOS builds use `build/icon.icns`, Windows builds use `build/icon.ico`, and Linux builds use `build/icon.png`.

## GitHub Releases

The release workflow in `.github/workflows/release.yml` runs when a version tag is pushed:

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions builds on macOS, Windows, and Ubuntu runners, then uploads the generated installers to the GitHub Release for that tag.

## Signing Notes

Current builds are unsigned except for macOS ad-hoc signing done by Electron Builder. This is usable for local testing and early internal downloads, but public releases should add:

- Apple Developer ID signing and notarization for macOS
- Authenticode signing for Windows
- Linux signing or checksum publishing if needed

## Notes

The app now opens with an empty connection list by default. Add a real PostgreSQL or MySQL connection from the Collection Manager, then open its query workspace in Electron.
