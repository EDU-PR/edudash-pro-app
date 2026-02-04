# Copilot Instructions for EduDash Pro

## Project Overview

**EduDash Pro** is a multi-tenant, mobile-first educational platform with advanced security, agentic AI features, and strict role-based access control (RBAC).

**Architecture:**
- **Mobile**: React Native + Expo (iOS/Android/Web via `expo-router`)
- **Web**: Next.js 14 App Router (separate codebase in `/web`)
- **Backend**: Supabase (PostgreSQL with RLS, Auth, Edge Functions)
- **AI**: Claude (Anthropic), OpenAI GPT-4, Gemini
- **Payments**: PayFast (South Africa)
- **Video/Calls**: Daily.co WebRTC integration
- **Analytics**: PostHog, custom telemetry

**Multi-Tenant Model:**
- Each preschool is a tenant (`preschool_id` / `organization_id`)
- All tables enforce tenant isolation via RLS policies
- Super-Admin role exists at platform level (bypasses RLS for monitoring)

## Key Architectural Patterns

### 1. Hybrid Mobile + Web Architecture
- **Mobile app** (`/app`, `/components`, `/services`): Expo Router, React Native
- **Web app** (`/web/src`): Next.js 14 with App Router, TailwindCSS
- **Shared logic**: Database types (`lib/database.types.ts`), RBAC utilities, AI service clients
- Both platforms use same Supabase backend with identical auth flow

### 2. Multi-Tenant with RLS
- **Tenant Isolation**: Every sensitive table has `preschool_id` or `organization_id`
- **RLS Policies**: SQL migrations enforce row-level security (see `migrations/`)
- **Helper Function**: `current_user_org_id()` in SQL determines user's tenant from JWT
- **Super-Admin Bypass**: Super-admins use service role for cross-tenant operations

### 3. Agentic AI System
- **Orchestrator**: `services/AgentOrchestrator.ts` runs Plan-Act-Reflect loop
- **Tool Registry**: `services/dash-ai/DashToolRegistry.ts` - all tools registered with risk levels
- **AI Proxy**: `supabase/functions/ai-proxy/` - Edge Function proxies Claude API with quota/PII checks
- **Streaming**: Web uses SSE; mobile uses HTTP polling (WebSocket planned Phase 2)
- **Telemetry**: All AI actions logged to `ai_events`, `ai_task_runs` tables

### 4. RBAC System
- **Roles**: `super_admin`, `principal`, `teacher`, `parent`, `student`
- **Permissions**: Defined in `lib/rbac/roles-permissions.json` (machine-readable)
- **Usage**: Import `roleHasPermission` from `lib/rbac/types.ts`
- **Enhanced Profiles**: `fetchEnhancedUserProfile()` returns profile with `hasRole()`, `hasCapability()` methods
- **Validation**: Run `npx tsx lib/rbac/validate.ts` to verify system integrity

### 5. Authentication Flow
- **Context**: `contexts/AuthContext.tsx` manages `user`, `session`, `profile`, `permissions`
- **Session Manager**: `lib/sessionManager.ts` handles login/logout/refresh
- **Route Guards**: `hooks/useRouteGuard.ts` enforces auth + mobile-web restrictions
- **Web Client**: `web/src/lib/supabase/client.ts` uses `@supabase/ssr` for Next.js (singleton)
- **Mobile Client**: `lib/supabase.ts` uses standard `@supabase/supabase-js` (`assertSupabase()`)

### 6. Supabase Edge Functions
All functions use `Deno.serve()` pattern with CORS handling:
- **AI Services**: `ai-proxy` (Claude/OpenAI proxying with quota), `ai-gateway`, `ai-usage`
- **Payment Webhooks**: `payfast-webhook`, `payments-webhook`, `revenuecat-webhook`
- **Sync Services**: Bi-directional sync with external edusite platform
- **Notifications**: `send-push`, `notifications-dispatcher`, `push-queue-processor`
- **Daily.co**: `daily-token`, `daily-rooms` (video call token generation)
- **Health**: Include `/health` endpoints for monitoring

## Developer Workflows

### Mobile Development
```bash
# Install dependencies
npm install

# Start Expo dev server (localhost only for Android port forwarding)
npm start

# Android emulator (with automatic port forwarding + app launch)
npm run dev:android

# iOS simulator
npm run ios

# Clear cache and restart (fixes most build issues)
npm run start:clear
```

### Web Development
```bash
cd web

# Install dependencies
npm install

# Start Next.js dev server (port 3000)
npm run dev

# Build for production
npm run build

# Preview build
npm run preview
```

### Database Migrations
```bash
# Create new migration
supabase migration new <descriptive_name>

# Lint SQL (REQUIRED before push)
npm run lint:sql

# Push to remote (NO --local flag)
supabase db push

# Verify no drift
supabase db diff
```

### RBAC Validation
```bash
# Validate roles and permissions
npx tsx lib/rbac/validate.ts

# Expected output: "🎉 All validations passed! RBAC system is ready."
```

### Build Android APK/AAB
```bash
# Development APK (local build)
npm run build:android:apk

# Production AAB (EAS cloud build)
npm run build:android:aab

# Preview build
npm run build:android:preview
```

### Testing & Quality
```bash
# Run tests
npm test

# Type checking (ALWAYS use with elevated memory)
NODE_OPTIONS='--max_old_space_size=8192' npm run typecheck

# Strict type checking (for new code)
NODE_OPTIONS='--max_old_space_size=8192' npm run typecheck:strict

# Lint with auto-fix
npm run lint:fix

# Format code
npm run format

# Check for console.log statements
npm run check:console

# Check file sizes (WARP.md compliance)
npm run check:file-sizes
```

**CRITICAL:** Always run typecheck with `NODE_OPTIONS='--max_old_space_size=8192'` before committing. The codebase is large and will run out of memory with default Node settings.

## Project-Specific Conventions

### File Organization
- **React Native components**: `/components/<domain>/<Component>.tsx`
- **Next.js components**: `/web/src/components/<domain>/<Component>.tsx`
- **Services**: `/services/<ServiceName>.ts` (mobile-focused, ≤500 lines)
- **Hooks**: `/hooks/use<HookName>.ts` (≤200 lines)
  - **Modular hooks**: For complex features (e.g., Dash AI), split into subfolder with focused hooks:
    - `hooks/dash-assistant/useDashConversation.ts` - Message state & streaming
    - `hooks/dash-assistant/useDashTutorMode.ts` - Quiz logic & grading
    - `hooks/dash-assistant/useDashVoice.ts` - Voice recording & TTS
    - `hooks/dash-assistant/useDashAI.ts` - AI client & prompts
    - Main orchestrator hook imports and composes these
- **Context**: `/contexts/<Name>Context.tsx`
- **Types**: `/lib/database.types.ts` (auto-generated), custom types in service files
- **Utilities**: `/lib/utils/<util-name>.ts`, `/web/src/lib/utils/<util-name>.ts`

### Styling Patterns
- **Mobile**: React Native `StyleSheet.create()` at bottom of file
- **Web**: TailwindCSS utility classes
- **Theming**: Use `useTheme()` context for mobile, Tailwind dark mode for web
- **Split Large Styles**: If StyleSheet >200 lines, extract to `<Component>.styles.ts`

### AI Integration
- **NEVER call AI APIs directly from client** - always use Edge Functions
- **Always use** `supabase/functions/ai-proxy/` Edge Function for AI calls
- **Client SDK**: `services/dash-ai/DashAIClient.ts` wraps Edge Function calls
- **Streaming**: Use `onChunk` callback for SSE streaming on web
- **Tool Calls**: Register in `services/dash-ai/DashToolRegistry.ts` with `claudeToolDefinition`
- **Quota**: Enforced at Edge Function level based on user tier

### Dash AI Architecture (Official Reference)
**Core Components:**
- **Orchestrator**: `services/AgentOrchestrator.ts` - Plan-Act-Reflect loop
- **AI Client**: `services/dash-ai/DashAIClient.ts` - Unified API for Claude/OpenAI/Gemini
- **Tool Registry**: `services/dash-ai/DashToolRegistry.ts` - All agent tools with risk levels
- **Voice ORB**: `hooks/dash-assistant/useDashVoice.ts` - TTS/STT implementation
- **Performance Doc**: `docs/features/DASH_AI_PERFORMANCE.md` - Required reading

**Modular Hook Architecture:**
```typescript
// hooks/dash-assistant/useDashConversation.ts - Message state, streaming, persistence
// hooks/dash-assistant/useDashTutorMode.ts - Quiz/practice mode, grading
// hooks/dash-assistant/useDashVoice.ts - Voice recording, TTS, budget tracking
// hooks/dash-assistant/useDashAI.ts - AI client initialization, model selection
// Main orchestrator composes these focused hooks
```

**Voice Features (TTS/STT):**
- Voice recording: 60s limit for free tier, unlimited for paid
- Budget tracking: Cached locally, synced every 5 minutes
- Audio format: M4A for iOS, WebM for Android
- Storage: Always store paths, not signed URLs (see Supabase Storage section)
- TTS: Azure Speech Service via `supabase/functions/tts-proxy/`

**When implementing Dash AI features:**
1. ✅ Check `docs/features/DASH_AI_PERFORMANCE.md` for patterns
2. ✅ Follow modular hook architecture (≤200 lines per hook)
3. ✅ Use debounced streaming (50ms batches)
4. ✅ Cache system prompts to avoid rebuilding
5. ✅ Lazy load AI clients on first use
6. ✅ Use FlashList for message lists (1000+ items)
7. ✅ Batch analytics events (30s or 10 events)

### Database Access
- **Web (Next.js)**: Use `createClient()` from `@/lib/supabase/client` (singleton pattern)
- **Mobile (Expo)**: Use `assertSupabase()` from `@/lib/supabase` (throws if unavailable)
- **Edge Functions**: Create new client with `SUPABASE_SERVICE_ROLE_KEY`
- **Always enforce RLS**: Use user's session token, never bypass unless super-admin operation

### Multi-Tenant Queries
```typescript
// Always filter by user's organization (RLS enforces this, but be explicit)
const { data } = await supabase
  .from('lessons')
  .select('*')
  .eq('preschool_id', userProfile.organization_id);
```

### Permission Checks
```typescript
import { roleHasPermission } from '@/lib/rbac/types';

// Check permission before action
if (!roleHasPermission(userRole, 'manage_courses')) {
  throw new Error('Insufficient permissions');
}

// Or use enhanced profile methods
if (!profile?.hasCapability('ai_lesson_generation')) {
  return <UpgradePrompt />;
}
```

### Error Handling
- **Mobile**: Use `ErrorBoundary.tsx` for component-level errors
- **Web**: Next.js error boundaries + custom error pages
- **Sentry**: Errors auto-captured via `sentry-expo` (mobile) and `@sentry/nextjs` (web)
- **Logging**: Use `lib/logger.ts` for structured logging (never `console.log`)

### Code Quality Rules
- **Always typecheck before committing**: Run `NODE_OPTIONS='--max_old_space_size=8192' npm run typecheck` to catch type errors
- **Fix unrelated errors**: If you encounter bugs/issues while working, fix them immediately
- **No console.log in production**: Use `logger` utilities (check with `npm run check:console`)
- **Type safety**: Avoid `any`, use proper TypeScript types
- **Component size limits**: See WARP.md section below - strictly enforced
- **Extract hooks**: Move complex state/effects to custom hooks (≤200 lines each)
- **Service layer**: Isolate all API calls in service files
- **Performance patterns**: See `docs/features/DASH_AI_PERFORMANCE.md` for optimization techniques:
  - Debounce streaming updates (50ms batches)
  - Cache system prompts to avoid rebuilding
  - Use FlashList for virtualized lists (1000+ items)
  - Lazy load heavy components and AI clients
  - Batch analytics events (every 30s or 10 events)

## Integration Points

### Supabase
- **Database**: PostgreSQL with RLS enabled on all sensitive tables
- **Auth**: Email/password, Google OAuth, OTP, 2FA
- **Storage**: User uploads, attachments, profile images
- **Realtime**: Subscriptions for live updates (lessons, messages)
- **Edge Functions**: 50+ functions for AI, payments, webhooks, sync

### AI Services
- **Anthropic Claude**: Primary AI model (Claude 3.5 Sonnet, Claude 3 Haiku)
- **OpenAI**: GPT-4 for specific use cases
- **Gemini**: Alternative model for certain features
- **Quotas**: Managed in `user_ai_tiers` table by subscription tier
- **Capabilities**: Defined in `lib/ai/capabilities.ts`

### Payment Integration
- **PayFast**: South African payment gateway
- **Webhooks**: `supabase/functions/payfast-webhook/`
- **Subscription Tiers**: Free, Basic, Pro, Enterprise
- **Billing**: Managed via PayFast dashboard + Supabase tables

### Video Calls (Daily.co)
- **Token Generation**: `supabase/functions/daily-token/`
- **Room Management**: `supabase/functions/daily-rooms/`
- **Components**: `components/calls/VideoCallInterface.tsx`, `VoiceCallInterface.tsx`
- **Provider**: `components/calls/CallProvider.tsx` manages call state

### Notifications
- **Push Notifications**: Expo Notifications (mobile), Web Push (web)
- **Multi-Account**: `lib/NotificationRouter.ts` routes to correct user profile
- **Queue**: `supabase/functions/push-queue-processor/` for batch sending
- **Context**: `contexts/NotificationContext.tsx`

## References

### RBAC
- `lib/rbac/README.md` - System overview
- `lib/rbac/types.ts` - TypeScript helpers
- `lib/rbac/roles-permissions.json` - Permission matrix

### Database
- `scripts/README.md` - Setup order
- `scripts/01_enhanced_security_system.sql` - Core security tables
- `scripts/02_educational_schema.sql` - Educational platform tables
- `migrations/` - All schema changes

### Supabase
- `supabase/README.md` - CLI usage
- `supabase/functions/` - Edge Functions
- `.env.example` - Required environment variables

### Agentic AI
- `services/AgentOrchestrator.ts` - Main agent loop
- `services/dash-ai/DashToolRegistry.ts` - Tool registration
- `services/dash-ai/DashAIClient.ts` - API client
- `supabase/functions/ai-proxy/` - AI proxy Edge Function

### Capabilities & Features
- `lib/ai/capabilities.ts` - Mobile AI capabilities
- `web/src/lib/ai/capabilities.ts` - Web AI capabilities
- `docs/features/DASH_AI_PERFORMANCE.md` - Performance optimization guide

## Development Best Practices

### Supabase Storage
**CRITICAL:** Always store storage paths, never signed URLs:
```typescript
// ✅ CORRECT - Store the path (permanent reference)
await sendMessage({
  voiceUrl: result.storagePath,  // e.g., "user-id/voice_123.m4a"
});

// ❌ WRONG - Signed URLs expire (typically 1 hour)
await sendMessage({
  voiceUrl: result.publicUrl,  // Will break after expiry!
});

// Generate signed URLs on-demand for playback
const { data } = await supabase.storage
  .from('bucket_name')
  .createSignedUrl(storagePath, 3600);
```

### Hook Composition Pattern
For complex features, split into focused hooks and compose:
```typescript
// hooks/dash-assistant/useDashConversation.ts (≤200 lines)
export function useDashConversation() {
  // Message state, streaming, persistence
  return { messages, sendMessage, streamingContent };
}

// hooks/dash-assistant/useDashAI.ts (≤300 lines)
export function useDashAI() {
  // AI client, model selection, prompt building
  return { callAI, selectModel, buildPrompt };
}

// Main orchestrator hook
export function useDashAssistant() {
  const conversation = useDashConversation();
  const ai = useDashAI();
  // Compose and coordinate
}
```

### Alert Modals
**NEVER use `Alert.alert`** - always use `AlertModal` or `useAlertModal` hook for consistent UX across platforms.

### Documentation References
**ALWAYS consult official documentation** when working with:
- **Dash AI Features**: See `docs/features/DASH_AI_PERFORMANCE.md` for architecture, patterns, and optimization techniques
- **Voice ORB (TTS/STT)**: Check `hooks/dash-assistant/useDashVoice.ts` and related voice components for implementation patterns
- **AI Integration**: Refer to `services/dash-ai/` and `supabase/functions/ai-proxy/` for proper API usage
- **Performance Patterns**: Follow established patterns in `DASH_AI_PERFORMANCE.md` before inventing new approaches

### Database-First Problem Solving
**CRITICAL PRINCIPLE:** If code requires a database column that doesn't exist and that column is semantically important:

```typescript
// ❌ WRONG - Working around missing column
const userId = message.sender_id || message.user_id || message.created_by;

// ✅ CORRECT - Add the missing column via migration
// 1. Create migration: supabase migration new add_user_id_to_messages
// 2. Add column with proper constraints and indexes
// 3. Update code to use the correct column
const userId = message.user_id;
```

**Why this matters:**
- Missing columns indicate incomplete schema design
- Code workarounds create technical debt
- Proper columns enable database-level constraints and indexing
- RLS policies require correct columns for security

**Process:**
1. Identify the missing column (e.g., `user_id`, `organization_id`, `status`)
2. Create migration with proper data type, constraints, and indexes
3. Lint SQL: `npm run lint:sql`
4. Push migration: `supabase db push`
5. Update code to use the new column
6. Remove any workarounds or fallbacks


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

## Examples

### Permission Check
```typescript
import { roleHasPermission } from '@/lib/rbac/types';

// Before performing action
if (!roleHasPermission(user.role, 'manage_courses')) {
  throw new Error('Insufficient permissions');
}
```

### Database Migration
```bash
# 1. Create migration
supabase migration new add_lesson_templates

# 2. Edit SQL file in migrations/

# 3. Lint
npm run lint:sql

# 4. Push
supabase db push

# 5. Verify
supabase db diff
```

### Splitting Oversized Component
```typescript
// Before: components/TeacherDashboard.tsx (800 lines)
// After:
// components/dashboard/teacher/TeacherDashboard.tsx (300 lines)
// components/dashboard/teacher/TeacherStats.tsx (150 lines)
// components/dashboard/teacher/TeacherActions.tsx (120 lines)
// hooks/useTeacherDashboardState.ts (200 lines)
```

### AI Service Call
```typescript
import { DashAIClient } from '@/services/dash-ai/DashAIClient';

const aiClient = new DashAIClient({
  supabaseClient: supabase,
  getUserProfile: () => profile,
});

const response = await aiClient.callAIService({
  action: 'generate_lesson',
  content: 'Create a lesson about photosynthesis',
  stream: true,
  onChunk: (chunk) => console.log(chunk),
});
```

### Multi-Tenant Query
```typescript
// Supabase client automatically enforces RLS
const { data: lessons } = await supabase
  .from('lessons')
  .select('*')
  .eq('preschool_id', profile.organization_id) // Explicit filter
  .eq('is_active', true);
```
