---
applyTo: "services/**/*.ts"
---

# TypeScript Services Instructions

## File Size Limits
- Services/Utilities: ≤500 lines
- Split immediately if file exceeds limits or has 3+ distinct responsibilities

## Agent Tool Development
- Register all agent tools in `services/modules/DashToolRegistry.ts`
- Tools must specify risk level and input schema
- All agent actions must use registered tools; avoid direct external service calls
- Wrap external services as tools in the registry

## Agent Architecture
- Core agent logic is in `services/AgentOrchestrator.ts` (Plan-Act-Reflect loop)
- All agent actions and decisions are tracked via telemetry in Supabase (`ai_events`, `ai_feedback`, `ai_task_runs`)
- Use `DashToolRegistry` for tool execution

## Code Organization Patterns
- Extract logic into custom hooks; keep UI components pure
- Isolate all API calls in service files
- Centralize related types in type files, split by domain if needed
- Use Container/Presentational pattern for separation of concerns
