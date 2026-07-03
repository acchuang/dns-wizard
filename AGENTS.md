# dns-wizard

## Purpose

DNS management desktop app. Tauri (Rust backend + React/Vite frontend).

## Ownership

Independent Tauri project. Two build systems: Cargo (Rust) + npm (JS).

## Local Contracts

- Tauri v2 desktop app. Rust backend in `src-tauri/`, React/Vite frontend in `src/`.
- TypeScript via `tsconfig.json`.
- No test or lint config yet.

## Work Guidance

- Dev: `npm run tauri dev`
- Build: `npm run tauri build`
- Frontend type-check: `npx tsc --noEmit`
- Rust check: `cd src-tauri && cargo check`

## Child DOX Index

| Path | Purpose |
|---|---|
| `src-tauri/` | Rust backend via Tauri |
