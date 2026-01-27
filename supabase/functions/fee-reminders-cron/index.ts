/**
 * Fee Reminders Cron Job
 *
 * Sends fee due soon notifications to parents/guardians 3 days before due date.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') || 'your-cron-secret';

interface FeeRow {
  id: string;
  student_id: string;
  due_date: string;
  amount: number | null;
  final_amount: number | null;
  status: string;
  student?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    parent_id?: string | null;
    guardian_id?: string | null;
    preschool_id?: string | null;
  } | null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
    const isCronJob = token === CRON_SECRET;

    let isValidServiceRole = false;
    if (token && !isServiceRole && !isCronJob) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        isValidServiceRole = payload.role === 'service_role';
      } catch {
        // ignore
      }
    }

    if (!isCronJob && !isServiceRole && !isValidServiceRole) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 3);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const { data: fees, error } = await supabase
      .from('student_fees')
      .select(
        `
        id,
        student_id,
        due_date,
        amount,
        final_amount,
        status,
        student:students!student_fees_student_id_fkey(
          id,
          first_name,
          last_name,
          parent_id,
          guardian_id,
          preschool_id
        )
      `
      )
      .in('status', ['pending', 'overdue', 'partially_paid'])
      .eq('due_date', targetDateStr);

    if (error) throw error;

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
    };

    const schoolNameCache = new Map<string, string>();

    for (const fee of (fees || []) as FeeRow[]) {
      results.processed++;
      const student = fee.student;
      if (!student) continue;

      const recipients = [student.parent_id, student.guardian_id].filter(Boolean) as string[];
      if (recipients.length === 0) continue;

      const preschoolId = student.preschool_id || null;
      let schoolName = 'your school';
      if (preschoolId) {
        if (schoolNameCache.has(preschoolId)) {
          schoolName = schoolNameCache.get(preschoolId) || schoolName;
        } else {
          const { data: school } = await supabase
            .from('preschools')
            .select('name')
            .eq('id', preschoolId)
            .maybeSingle();
          if (school?.name) {
            schoolName = school.name;
            schoolNameCache.set(preschoolId, school.name);
          }
        }
      }

      const amount = fee.final_amount ?? fee.amount ?? 0;
      const childName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'your child';

      try {
        await supabase.functions.invoke('notifications-dispatcher', {
          body: {
            event_type: 'fee_due_soon',
            user_ids: recipients,
            preschool_id: preschoolId,
            student_id: student.id,
            include_email: true,
            include_push: true,
            custom_payload: {
              child_name: childName,
              due_date: targetDateStr,
              amount,
              days_until: 3,
              school_name: schoolName,
            },
          },
        });
        results.sent++;
      } catch (err) {
        console.error('[fee-reminders-cron] Failed to send reminder:', err);
        results.failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        target_date: targetDateStr,
        results,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[fee-reminders-cron] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
