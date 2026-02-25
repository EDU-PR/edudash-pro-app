# AGENTS.md

## Cursor Cloud specific instructions

### Project Structure

This is a monorepo with three products:

| Directory | Product | Port | Dev Command |
|-----------|---------|------|-------------|
| `/` (root) | React Native/Expo mobile app | 8081 (native) / 8082 (web mode) | `npm start` (native) or `npm run web:dev` (web mode) |
| `/web/` | Next.js 16 web dashboard (PWA) | 3000 | `cd web && npm run dev` |
| `/soa-web/` | Soil of Africa portal (Next.js 14) | 3001 | `cd soa-web && npm run dev` |

### Node.js Version

Node.js 20 is required (`.nvmrc` and `package.json` engines field). The VM has nvm configured with `nvm use 20` in `~/.bashrc`.

### Running Services

- **Web dashboard** is the primary testable service in the cloud VM: `cd web && npm run dev`
- **Mobile app in web mode** can be tested in the cloud VM via `WEB_PORT=8082 npx expo start --web --port 8082` (runs on port 8082). First bundle takes ~30s for 5200+ modules. This renders the React Native app in the browser using `react-native-web`.
- **Mobile app on device** requires a physical device with an Expo dev client build (`npm start` runs Metro on port 8081).
- **Backend** is cloud-hosted Supabase (project ID: `lvvvjywrmpcqrpvuptdi`). No local database to manage.
- Supabase credentials (URL + anon key) are already in `eas.json` and used by `.env`/`.env.local` files.

### Lint / Test / Typecheck

Standard commands from `package.json`:

- **Root**: `npm run lint`, `npm test`, `npm run typecheck`
- **Web**: `cd web && npm run lint`, `cd web && npm run typecheck`
- **SOA**: `cd soa-web && npm run lint`

Root lint has a `--max-warnings 200` threshold (currently ~170 warnings). The `npm run lint` command first runs `validate:progress-bars` (which audits web progress bar safety) then eslint; a failure from `validate:progress-bars` is pre-existing and does not indicate new issues. Web lint has 6 pre-existing errors. Web typecheck has 7 pre-existing errors in `src/app/display/page.tsx`.

Typecheck (`npm run typecheck`) requires 8 GB heap via `NODE_OPTIONS=--max-old-space-size=8192` (already set in the `typecheck` script). Running bare `npx tsc --noEmit` without the extra memory will OOM on this codebase.

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
- The Expo web build uses custom stubs in `lib/stubs/` for native-only modules (ads, biometrics, RevenueCat, etc.). If you see module resolution errors when running Expo web, check `metro.config.js` for the stub mappings.
- Auth session is stored in localStorage under key `edudash-auth-session`. For automated browser testing, you can authenticate via the Supabase API and inject the session JSON into localStorage.
- The `organization_members` table has no `status` column. Use `membership_status` for membership state or `seat_status` for seat-based access. Queries filtering on `status` will return 400.
- Database migrations can be applied via psql: `PGPASSWORD=hHFgMNhsfdUKUEkA psql -h aws-0-ap-southeast-1.pooler.supabase.com -p 6543 -U postgres.lvvvjywrmpcqrpvuptdi -d postgres -c "$(cat <migration_file>)"`
