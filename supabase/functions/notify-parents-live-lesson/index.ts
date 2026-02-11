/**
 * Notify Parents Live Lesson Edge Function
 * 
 * Sends push/email notifications to parents when a live lesson starts or is scheduled.
 * Called from the live lesson start flow (teacher side).
 * 
 * Expected body: { classId, className, lessonTitle, teacherName, meetingUrl, scheduledStart, isScheduled }
 * Auth: Bearer token required
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { classId, className, lessonTitle, teacherName, meetingUrl, scheduledStart, isScheduled } = body;

    if (!classId || !lessonTitle) {
      return new Response(JSON.stringify({ error: 'Missing required fields: classId, lessonTitle' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[notify-parents-live-lesson] Sending notifications:', {
      classId,
      className,
      lessonTitle,
      isScheduled,
    });

    // Get students in this class
    const { data: students } = await supabase
      .from('students')
      .select('id, parent_id')
      .eq('class_id', classId)
      .eq('status', 'active');

    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'No students in class' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get unique parent IDs
    const parentIds = [...new Set(students.map(s => s.parent_id).filter(Boolean))];

    if (parentIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'No parents linked' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Send notification to each parent via notifications-dispatcher
    const eventType = isScheduled ? 'live_lesson_scheduled' : 'live_lesson_started';
    const title = isScheduled
      ? `📅 Live Lesson Scheduled: ${lessonTitle}`
      : `🔴 Live Lesson Now: ${lessonTitle}`;
    const message = isScheduled
      ? `${teacherName || 'Teacher'} has scheduled a live lesson "${lessonTitle}" for ${className || 'your child\'s class'}.`
      : `${teacherName || 'Teacher'} has started a live lesson "${lessonTitle}" in ${className || 'your child\'s class'}. Join now!`;

    let notified = 0;
    let failed = 0;

    for (const parentId of parentIds) {
      try {
        await supabase.functions.invoke('notifications-dispatcher', {
          body: {
            event_type: eventType,
            user_id: parentId,
            title,
            body: message,
            data: {
              class_id: classId,
              meeting_url: meetingUrl,
              lesson_title: lessonTitle,
              scheduled_start: scheduledStart,
            },
          },
        });
        notified++;
      } catch (notifyErr) {
        console.warn('[notify-parents-live-lesson] Failed to notify parent:', parentId, notifyErr);
        failed++;
      }
    }

    console.log('[notify-parents-live-lesson] Done:', { notified, failed, total: parentIds.length });

    return new Response(
      JSON.stringify({ success: true, notified, failed, total: parentIds.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[notify-parents-live-lesson] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
