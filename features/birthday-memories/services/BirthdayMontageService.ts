import { assertSupabase } from '@/lib/supabase';

export interface MontageJob {
  id: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  output_path?: string | null;
  error_message?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  sent_at?: string | null;
  sent_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export class BirthdayMontageService {
  static async queue(eventId: string): Promise<MontageJob | null> {
    const { data, error } = await assertSupabase().functions.invoke('birthday-montage', {
      body: { action: 'queue', payload: { event_id: eventId } },
    });

    if (error || !data?.success) {
      console.error('[BirthdayMontage] queue failed', error || data);
      return null;
    }

    return data.data as MontageJob;
  }

  static async status(eventId: string): Promise<MontageJob | null> {
    const { data, error } = await assertSupabase().functions.invoke('birthday-montage', {
      body: { action: 'status', payload: { event_id: eventId } },
    });

    if (error || !data?.success) {
      console.error('[BirthdayMontage] status failed', error || data);
      return null;
    }

    return data.data as MontageJob;
  }

  static async approveAndSend(eventId: string): Promise<MontageJob | null> {
    const { data, error } = await assertSupabase().functions.invoke('birthday-montage', {
      body: { action: 'approve', payload: { event_id: eventId } },
    });

    if (error || !data?.success) {
      console.error('[BirthdayMontage] approve failed', error || data);
      return null;
    }

    return data.data as MontageJob;
  }

  static async getViewUrl(eventId: string): Promise<string | null> {
    const { data, error } = await assertSupabase().functions.invoke('birthday-montage', {
      body: { action: 'get_view_url', payload: { event_id: eventId } },
    });

    if (error || !data?.success || !data.url) {
      console.error('[BirthdayMontage] getViewUrl failed', error || data);
      return null;
    }

    return data.url as string;
  }
}
