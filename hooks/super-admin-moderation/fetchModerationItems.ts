import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { ModerationItem } from '@/lib/screen-styles/super-admin-moderation.styles';

/**
 * Fetches moderation items from the database via RPC.
 * Returns transformed ModerationItem[] or throws on error.
 */
export async function fetchModerationItems(params: {
  status: string;
  severity: string;
  type: string;
  limit?: number;
}): Promise<ModerationItem[]> {
  const { data, error } = await assertSupabase()
    .rpc('get_moderation_items', {
      p_status: params.status === 'all' ? null : params.status,
      p_severity: params.severity === 'all' ? null : params.severity,
      p_content_type: params.type === 'all' ? null : params.type,
      p_limit: params.limit ?? 100,
    });

  if (error) {
    logger.error('Moderation items fetch error:', error);
    throw new Error('Failed to fetch moderation items');
  }

  if (!data) {
    logger.debug('No moderation items found in database');
    return [];
  }

  const items: ModerationItem[] = data.map((item: any) => ({
    id: item.id,
    type: item.content_type,
    title: item.title,
    content: item.content,
    author_id: item.author_id,
    author_name: item.author_name,
    author_email: item.author_email,
    school_id: item.school_id,
    school_name: item.school_name,
    status: item.status,
    flags: item.flags || [],
    report_count: item.report_count || 0,
    created_at: item.created_at,
    flagged_at: item.flagged_at,
    severity: item.severity,
    auto_flagged: item.auto_flagged || false,
    reviewed_by: item.reviewed_by,
    reviewed_at: item.reviewed_at,
    review_notes: item.review_notes,
  }));

  logger.debug(`Loaded ${items.length} moderation items from database`);
  return items;
}
