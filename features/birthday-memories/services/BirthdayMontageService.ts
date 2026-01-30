import { assertSupabase } from '@/lib/supabase';

interface MontageJob {
  id: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  output_path?: string | null;
  error_message?: string | null;
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
}
