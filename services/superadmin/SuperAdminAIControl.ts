import { assertSupabase } from '@/lib/supabase';

export type SuperAdminAIMode = 'assistant' | 'copilot' | 'full';

export type SuperAdminAIControlState = {
  id: number;
  owner_user_id: string | null;
  autonomy_enabled: boolean;
  autonomy_mode: SuperAdminAIMode;
  auto_execute_low: boolean;
  auto_execute_medium: boolean;
  auto_execute_high: boolean;
  require_confirm_navigation: boolean;
  updated_at: string;
  updated_by: string | null;
};

const CONTROL_TABLE = 'superadmin_ai_control';
const CACHE_TTL_MS = 30_000;

const DEFAULT_STATE: SuperAdminAIControlState = {
  id: 1,
  owner_user_id: null,
  autonomy_enabled: false,
  autonomy_mode: 'assistant',
  auto_execute_low: true,
  auto_execute_medium: false,
  auto_execute_high: false,
  require_confirm_navigation: false,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export class SuperAdminAIControl {
  private static cache: { data: SuperAdminAIControlState; fetchedAt: number } | null = null;

  static clearCache() {
    this.cache = null;
  }

  static async getControlState(options?: { force?: boolean }): Promise<SuperAdminAIControlState> {
    const now = Date.now();
    if (!options?.force && this.cache && now - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.data;
    }

    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from(CONTROL_TABLE)
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const resolved = data ? (data as SuperAdminAIControlState) : DEFAULT_STATE;
      this.cache = { data: resolved, fetchedAt: now };
      return resolved;
    } catch (error) {
      console.warn('[SuperAdminAIControl] Failed to load control state:', error);
      this.cache = { data: DEFAULT_STATE, fetchedAt: now };
      return DEFAULT_STATE;
    }
  }

  static async claimOwnership(userId: string): Promise<SuperAdminAIControlState> {
    const updated = await this.updateControlState({
      owner_user_id: userId,
    }, userId, { force: true });

    if (!updated.owner_user_id || updated.owner_user_id !== userId) {
      throw new Error('Ownership could not be claimed');
    }

    return updated;
  }

  static async updateControlState(
    patch: Partial<SuperAdminAIControlState>,
    userId: string,
    options?: { force?: boolean }
  ): Promise<SuperAdminAIControlState> {
    const supabase = assertSupabase();
    const payload = {
      ...patch,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(CONTROL_TABLE)
      .update(payload)
      .eq('id', 1)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('AI control record missing');
    }

    const resolved = data as SuperAdminAIControlState;
    this.cache = { data: resolved, fetchedAt: Date.now() };
    return resolved;
  }

  static async isOwner(userId?: string | null): Promise<boolean> {
    if (!userId) return false;
    const state = await this.getControlState();
    return !!state.owner_user_id && state.owner_user_id === userId;
  }
}
