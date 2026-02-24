# AGENTS.md

## Cursor Cloud specific instructions

### Project Structure

This is a monorepo with three products:

| Directory | Product | Port | Dev Command |
|-----------|---------|------|-------------|
| `/` (root) | React Native/Expo mobile app | 8081 | `npm start` |
| `/web/` | Next.js 16 web dashboard (PWA) | 3000 | `cd web && npm run dev` |
| `/soa-web/` | Soil of Africa portal (Next.js 14) | 3001 | `cd soa-web && npm run dev` |

### Node.js Version

Node.js 20 is required (`.nvmrc` and `package.json` engines field). The VM has nvm configured with `nvm use 20` in `~/.bashrc`.

### Running Services

- **Web dashboard** is the primary testable service in the cloud VM: `cd web && npm run dev`
- **Mobile app** requires a physical device with an Expo dev client build; Metro bundler can start with `npm start` but cannot render UI in the VM.
- **Backend** is cloud-hosted Supabase (project ID: `lvvvjywrmpcqrpvuptdi`). No local database to manage.
- Supabase credentials (URL + anon key) are already in `eas.json` and used by `.env`/`.env.local` files.

### Lint / Test / Typecheck

Standard commands from `package.json`:

- **Root**: `npm run lint`, `npm test`, `npm run typecheck`
- **Web**: `cd web && npm run lint`, `cd web && npm run typecheck`
- **SOA**: `cd soa-web && npm run lint`

Root lint has a `--max-warnings 200` threshold (currently ~175 warnings). Web lint has 6 pre-existing errors. Web typecheck has 7 pre-existing errors in `src/app/display/page.tsx`.

### Environment Files

- Root: `.env` (copied from `.env.example`, Supabase creds filled from `eas.json`)
- Web: `web/.env.local`
- SOA: `soa-web/.env.local`

These are gitignored. The Supabase anon key and URL are committed in `eas.json` as they are public (anon role only).

### Gotchas

- The web dev server (`next dev --webpack`) can take 10-15 seconds for first page compilation. `curl` may time out on the first request; wait for "Ready" in the dev server logs before testing.
- The `postinstall` script runs `patch-package` which applies patches from `/patches/`. If `npm install` fails, check that patches still apply cleanly.
- Three separate `npm install` are needed: root, `web/`, and `soa-web/` each have independent `node_modules`.
- The web app uses `--webpack` flag in its dev command (not Turbopack) due to compatibility needs.
