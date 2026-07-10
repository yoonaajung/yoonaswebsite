# yoonaswebsite

Monorepo with two apps:

- `server/` — Node/Fastify API in TypeScript (ESM, `"type": "module"`, `NodeNext` module resolution).
- `mobile/` — Expo React Native app in TypeScript (Expo SDK 57, React Native 0.86).

## Cursor Cloud specific instructions

The startup update script runs `npm install` in both `server/` and `mobile/` (guarded by the presence of each `package.json`), so dependencies for both apps are already installed when a session begins. `node_modules` and the npm cache are preserved in the VM snapshot, so `npm install` is a near-instant no-op on a warm start.

Per-app commands (run from inside the app folder, e.g. `cd server` or `cd mobile`):

- Typecheck: `npm run typecheck` (both apps) — equivalent to `npx tsc --noEmit`.
- `server/`: `npm run dev` (tsx watch, listens on `PORT`, default `3000`, host `0.0.0.0`). `npm run build` → `dist/`, `npm start` runs the build. Endpoints: `GET /`, `GET /health`, `POST /echo`.
- `mobile/`: `npm start` / `npx expo start` launches Metro (default port `8081`). Use `npx expo start --web` for a browser preview (web deps `react-dom`, `react-native-web`, `@expo/metro-runtime` are installed). There is no iOS/Android emulator in the VM; preview via web, or bundle-check with `curl "localhost:8081/index.bundle?platform=android&dev=true"`.

Non-obvious gotchas:

- `create-expo-app` can hang on a network/telemetry step after files are written; that is a scaffolding-time issue only and does not affect running the app.
- When starting Expo non-interactively, set `CI=1` (disables watch/interactive prompts). Metro serving in `--offline` mode avoids network stalls.
- `mobile/` uses a TypeScript version newer than what `@typescript-eslint`/some tools officially support; `tsc --noEmit` still passes cleanly.
