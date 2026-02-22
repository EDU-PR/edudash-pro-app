import { track } from '@/lib/analytics';

export const DASH_TELEMETRY_EVENTS = {
  RESPONSE_COMMITTED: 'dash.response_committed',
  RESPONSE_PRESERVED_AFTER_TOOL_ERROR: 'dash.response_preserved_after_tool_error',
  TOOL_CAPS_DEGRADED: 'dash.tool_caps_degraded',
  DUPLICATE_THINKING_INDICATOR_BLOCKED: 'dash.duplicate_thinking_indicator_blocked',
  INTENT_ROUTE_SELECTED: 'dash.intent_route_selected',
} as const;

export type DashTelemetryEventName =
  (typeof DASH_TELEMETRY_EVENTS)[keyof typeof DASH_TELEMETRY_EVENTS];

export function trackDashTelemetry(
  event: DashTelemetryEventName,
  payload: Record<string, unknown> = {},
): void {
  track(event as any, payload);
}
