# Copilot Instructions for EduDash Pro

## Project Overview

- **EduDash Pro** is a multi-tenant educational platform with advanced security, agentic AI features, and strict role-based access control (RBAC).
- Backend: **Supabase** (Postgres, Auth, Functions), custom SQL migrations, Row-Level Security (RLS) on all sensitive tables.
- Frontend: React Native (Expo), custom scripts, WhatsApp integration, and AI-powered workflows.
- Agentic AI: Implements Plan-Act-Reflect loop, tool registry, and telemetry for all agent actions.

## Key Architectural Patterns

- **Agentic AI System**: The core agent logic is in `services/AgentOrchestrator.ts`, which runs a Plan-Act-Reflect loop. Agents use tools via the `DashToolRegistry` (`services/modules/DashToolRegistry.ts`).
- **Tool Registry**: All agent tools are registered and executed through `DashToolRegistry`. Tools must specify risk level and input schema. See `AgentTool` interface for details.
- **Telemetry & Feedback**: All agent actions, decisions, and errors are tracked in Supabase tables (`ai_events`, `ai_feedback`, `ai_task_runs`). RLS policies enforce tenant isolation. See `supabase/migrations/20251013081717_agent-telemetry-foundation.sql`.
- **RBAC**: Permissions and roles are defined in `lib/rbac/roles-permissions.json` and TypeScript helpers in `lib/rbac/types.ts`. Always use these utilities for access checks.
- **Database Migrations**: SQL scripts in `scripts/` must be run in strict order (see `scripts/README.md`). Security and educational schemas are separated for clarity and safety.
- **Supabase Integration**: All data, auth, and functions managed via Supabase. RLS is always enabled. See `supabase/README.md` for setup.
- **AI Features**: Quotas and feature flags managed in DB (`user_ai_tiers`, `feature_flags`).

## Developer Workflows

- **Agent Tooling**: To add or update agent tools, edit `services/modules/DashToolRegistry.ts`. Register tools with clear input schema and risk level.
- **Agent Telemetry**: All agent actions are logged in Supabase (`ai_events`). Use SQL migrations in `supabase/migrations/` to update schema.
- **RBAC Validation**: Run `npx tsx lib/rbac/validate.ts` to validate role/permission logic. Output: `🎉 All validations passed! RBAC system is ready.`
- **Database Setup**: Follow order in `scripts/README.md` to initialize/reset DB. SuperAdmin must exist before enhancements.
- **Local Dev**: Use `npm install` and `npm start` for React Native app. For file picker support, run `npm run prebuild` first.
- **Supabase Functions**: Use Supabase CLI for local dev and deployment. See `supabase/README.md` for CLI usage.
- **Build/Deploy**: Android builds use EAS (`npm run build:android:apk` or `npm run build:android:aab`).
- **Testing**: Use scripts in `scripts/` and test helpers in `test-*.js`.

## Project-Specific Conventions

- **Agent Prompts**: System instructions are prepended to user prompts. Use `getUserEditablePrompt` and related utilities in `web/src/lib/utils/prompt-filter.ts` to filter/edit prompts.
- **Tool Use**: All agent actions must use registered tools. Avoid direct calls to external services; wrap them as tools in the registry.
- **Access Control**: Always use RBAC helpers, never hardcoded role checks.
- **SQL Scripts**: Source of truth for schema/security. Never edit DB manually.
- **Feature Flags & AI Quotas**: Managed in DB, not code.
- **SuperAdmin**: Always `superadmin@edudashpro.org.za` with 2FA enabled.
- **Fix Unrelated Errors**: When working on a task, if you encounter unrelated errors or issues in the codebase, fix them as part of your changes to improve overall code quality.

## Integration Points

- **Supabase**: All data, auth, and functions managed via Supabase. RLS always enabled.
- **AI Services**: Quota-controlled, tied to user roles/tiers in DB. See `lib/ai/capabilities.ts` for tier/capability matrix.
- **WhatsApp Integration**: See `components/whatsapp/DashWhatsAppConnector.tsx` for agent-powered onboarding and suggestions.
- **PDF Export**: See `web/src/lib/utils/pdf-export.ts` for agent-driven PDF generation.

## References
- RBAC: `lib/rbac/README.md`, `lib/rbac/types.ts`, `lib/rbac/roles-permissions.json`
- Database: `scripts/README.md`, `scripts/*.sql`
- Supabase: `supabase/README.md`, `.env.example`
- Agentic AI: `services/AgentOrchestrator.ts`, `services/modules/DashToolRegistry.ts`, `supabase/migrations/20251013081717_agent-telemetry-foundation.sql`
- Capabilities: `lib/ai/capabilities.ts`, `web/src/lib/ai/capabilities.ts`
- Prompt Filtering: `web/src/lib/utils/prompt-filter.ts`
- WhatsApp: `components/whatsapp/DashWhatsAppConnector.tsx`
- PDF Export: `web/src/lib/utils/pdf-export.ts`


## WARP.md Standards (NON-NEGOTIABLE)

### Database Operations
- **NEVER** use `supabase start` or local Docker instances
- **NEVER** execute SQL directly via Supabase Dashboard
- **ALWAYS** use `supabase migration new` for schema changes
- **ALWAYS** lint SQL with SQLFluff before push (`npm run lint:sql`)
- **ALWAYS** use `supabase db push` (no --local flag)
- **ALWAYS** verify no drift with `supabase db diff` after push

### File Size Standards
- Components: ≤400 lines (excluding StyleSheet)
- Screens: ≤500 lines (excluding StyleSheet)
- Services/Utilities: ≤500 lines
- Hooks: ≤200 lines
- Type definitions: ≤300 lines (except auto-generated)
- StyleSheet definitions: Use separate `styles.ts` for components >200 lines

### When to Split Files
Split immediately if ANY apply:
- File exceeds size limits
- File has 3+ distinct responsibilities
- StyleSheet exceeds 200 lines
- Component has 5+ render/helper functions
- Multiple developers frequently cause merge conflicts
- Code review takes >30 minutes due to file size

### Code Organization Patterns
1. **Container/Presentational**: Extract logic into custom hooks, keep UI components pure
2. **Hook Extraction**: Move complex state/effects to custom hooks
3. **Service Layer**: Isolate all API calls in service files
4. **Shared Components**: Extract reusable UI patterns to `components/`
5. **Type Files**: Centralize related types, split by domain if needed

### Documentation Organization
- **ONLY** `README.md`, `WARP.md`, and `ROAD-MAP.md` in project root
- **ALL** other markdown in `docs/` subdirectories:
  - `docs/deployment/` - Build guides, CI/CD, environment config
  - `docs/features/` - Feature specs, implementation guides
  - `docs/security/` - RLS policies, authentication, RBAC
  - `docs/database/` - Migration guides, schema docs
  - `docs/governance/` - Development standards, workflows
  - `docs/OBSOLETE/` - Archived documentation

### Security & Authentication
- **NEVER** modify authentication without approvals
- **NEVER** expose service role keys client-side
- **NEVER** call AI services directly from client
- **ALWAYS** maintain RLS policies for tenant isolation
- **ALWAYS** use `ai-proxy` Edge Function for AI calls

### Development Environment
- Production database used as development environment
- AdMob test IDs enforced in development
- Android-first testing approach
- Feature flags via environment variables

**Example: Checking permissions in code**
```typescript
import { roleHasPermission } from './lib/rbac/types';
if (roleHasPermission(user.role, 'manage_courses')) { /* ... */ }
```

**Example: Running RBAC validation**
```bash
npx tsx lib/rbac/validate.ts
```

**Example: Database migration workflow**
```bash
# Create migration
supabase migration new add_new_feature

# Lint SQL
npm run lint:sql

# Push to remote
supabase db push

# Verify no drift
supabase db diff
```

**Example: Splitting oversized component**
```typescript
// Before: components/TeacherDashboard.tsx (800 lines)
// After:
// components/dashboard/teacher/TeacherDashboard.tsx (300 lines)
// components/dashboard/teacher/TeacherStats.tsx (150 lines)
// components/dashboard/teacher/TeacherActions.tsx (120 lines)
// hooks/useTeacherDashboardState.ts (200 lines)
```
