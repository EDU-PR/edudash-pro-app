/**
 * notify-parents-live-lesson Edge Function
 *
 * Sends push/in-app notifications to all parents in a class when a teacher
 * starts or schedules a live video lesson, including the meeting URL.
 */
import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { classId, className, lessonTitle, teacherName, meetingUrl, scheduledStart, isScheduled } = body;

    if (!classId || !meetingUrl) {
      return new Response(
        JSON.stringify({ error: 'classId and meetingUrl are required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    // Get all students in this class
    const { data: students, error: studentsError } = await supabase
      .from('class_students')
      .select('student_id')
      .eq('class_id', classId);

    if (studentsError) {
      console.error('[notify-parents-live-lesson] Error fetching class students:', studentsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch class roster' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'No students in class' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const studentIds = students.map((s: any) => s.student_id);

    // Find parent IDs linked to these students
    const { data: parents, error: parentsError } = await supabase
      .from('student_parents')
      .select('parent_id')
      .in('student_id', studentIds);

    if (parentsError) {
      console.error('[notify-parents-live-lesson] Error fetching parents:', parentsError);
    }

    const parentIds = [...new Set((parents || []).map((p: any) => p.parent_id))];

    if (parentIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'No parents linked to class students' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    // Get push tokens for these parents
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', parentIds);

    const title = isScheduled
      ? `📅 Live Lesson Scheduled: ${className || 'Your Class'}`
      : `🔴 Live Lesson Starting: ${className || 'Your Class'}`;

    const notificationBody = isScheduled
      ? `${teacherName || 'Teacher'} has scheduled "${lessonTitle || 'a lesson'}" for ${scheduledStart || 'soon'}.`
      : `${teacherName || 'Teacher'} is starting "${lessonTitle || 'a lesson'}" now. Tap to join!`;

    // Insert in-app notifications for all parents
    const notifications = parentIds.map((parentId: string) => ({
      user_id: parentId,
      title,
      body: notificationBody,
      type: 'live_lesson',
      data: {
        class_id: classId,
        meeting_url: meetingUrl,
        lesson_title: lessonTitle,
        teacher_name: teacherName,
        is_scheduled: isScheduled,
      },
      read: false,
      created_at: new Date().toISOString(),
    }));

    const { error: notifyError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifyError) {
      console.error('[notify-parents-live-lesson] Notification insert error:', notifyError);
    }

    // Send push notifications via the notifications-dispatcher if available
    if (tokens && tokens.length > 0) {
      try {
        const pushTokens = tokens.map((t: any) => t.token);
        // Use Expo push notifications API
        const pushMessages = pushTokens.map((pushToken: string) => ({
          to: pushToken,
          title,
          body: notificationBody,
          data: {
            type: 'live_lesson',
            class_id: classId,
            meeting_url: meetingUrl,
          },
          sound: 'default',
          priority: 'high',
        }));

        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pushMessages),
        });
      } catch (pushError) {
        console.error('[notify-parents-live-lesson] Push send error:', pushError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: parentIds.length,
        push_tokens: tokens?.length || 0,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[notify-parents-live-lesson] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
