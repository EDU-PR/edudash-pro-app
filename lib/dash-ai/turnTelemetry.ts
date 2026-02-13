export interface DashTurnTelemetry {
  conversation_id: string | null;
  turn_id: string;
  mode: string;
  tier: string | null;
  voice_provider: string | null;
  fallback_reason: string | null;
  latency_ms: number | null;
  source?: string;
}

export function createDashTurnId(prefix = 'dash_turn'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildDashTurnTelemetry(input: {
  conversationId?: string | null;
  turnId?: string | null;
  mode?: string | null;
  tier?: string | null;
  voiceProvider?: string | null;
  fallbackReason?: string | null;
  latencyMs?: number | null;
  source?: string;
}): DashTurnTelemetry {
  return {
    conversation_id: input.conversationId || null,
    turn_id: input.turnId || createDashTurnId(),
    mode: input.mode || 'assistant',
    tier: input.tier || null,
    voice_provider: input.voiceProvider || null,
    fallback_reason: input.fallbackReason || null,
    latency_ms: typeof input.latencyMs === 'number' ? Math.max(0, Math.round(input.latencyMs)) : null,
    source: input.source,
  };
}
