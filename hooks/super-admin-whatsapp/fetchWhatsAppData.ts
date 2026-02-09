import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { WhatsAppConnection, WhatsAppTemplate, WhatsAppMetrics } from './types';

export interface WhatsAppFetchResult {
  isConfigured: boolean;
  connections: WhatsAppConnection[];
  templates: WhatsAppTemplate[];
  metrics: WhatsAppMetrics | null;
}

const EMPTY_RESULT: WhatsAppFetchResult = {
  isConfigured: false,
  connections: [],
  templates: [],
  metrics: null,
};

/**
 * Fetches WhatsApp Business config, connections, templates, and metrics.
 * Returns structured result or empty defaults on error.
 */
export async function fetchWhatsAppData(): Promise<WhatsAppFetchResult> {
  try {
    const { data: dbConfig, error: configError } = await assertSupabase()
      .from('whatsapp_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (configError && configError.code !== 'PGRST116' && !configError.message.includes('does not exist')) {
      logger.error('WhatsApp config error:', configError);
    }

    if (!dbConfig) {
      return EMPTY_RESULT;
    }

    const { data: connectionsData } = await assertSupabase()
      .from('whatsapp_connections')
      .select(`
        id, school_id, phone_number, business_account_id, status,
        last_sync, message_count, webhook_verified, created_at, updated_at,
        preschools:school_id(name)
      `)
      .order('created_at', { ascending: false });

    const connections: WhatsAppConnection[] = (connectionsData || []).map((c: any) => ({
      id: c.id,
      school_id: c.school_id,
      school_name: c.preschools?.name || 'Unknown School',
      phone_number: c.phone_number,
      business_account_id: c.business_account_id,
      status: c.status,
      last_sync: c.last_sync,
      message_count: c.message_count || 0,
      webhook_verified: c.webhook_verified || false,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    const { data: templatesData } = await assertSupabase()
      .from('whatsapp_templates')
      .select('*')
      .order('created_at', { ascending: false });

    const templates: WhatsAppTemplate[] = (templatesData || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      language: t.language,
      status: t.status,
      components: t.components || [],
      created_at: t.created_at,
    }));

    const metrics: WhatsAppMetrics = {
      total_connections: connections.length,
      active_connections: connections.filter(c => c.status === 'connected').length,
      messages_sent_today: 0,
      messages_sent_month: 0,
      delivery_rate: 0,
      read_rate: 0,
      response_rate: 0,
      failed_messages: 0,
    };

    return { isConfigured: true, connections, templates, metrics };
  } catch (error) {
    logger.error('Failed to fetch WhatsApp data:', error);
    return EMPTY_RESULT;
  }
}
