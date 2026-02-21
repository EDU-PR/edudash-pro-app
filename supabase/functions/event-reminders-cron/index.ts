/**
 * Event Reminders Cron Job (V2)
 *
 * Sends 3 reminder touchpoints for upcoming school events:
 * - 7 days
 * - 3 days
 * - 1 day
 *
 * Idempotency is tracked in school_event_reminder_logs.
 * school_events.reminder_sent is still updated on final (1-day) reminders for legacy compatibility.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY=REDACTED
const CRON_SECRET = Deno.env.get('CRON_SECRET') || 'your-cron-secret'
const DEFAULT_TIMEZONE = 'Africa/Johannesburg'

const REMINDER_THRESHOLDS = [
  { offsetDays: 7 as const, label: '7 days' },
  { offsetDays: 3 as const, label: '3 days' },
  { offsetDays: 1 as const, label: '1 day' },
]

interface SchoolEvent {
  id: string;
  title: string;
  start_date: string;
  preschool_id: string;
  target_audience: string[];
  send_notifications: boolean;
  reminder_sent: boolean;
  notification_sent: boolean;
}

function formatDateInTimezone(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

function normalizeDateOnly(value: string): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const candidate = raw.includes('T') ? raw.split('T')[0] : raw
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : ''
}

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return dateOnly
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function diffDays(fromDateOnly: string, toDateOnly: string): number {
  const from = new Date(`${fromDateOnly}T00:00:00.000Z`)
  const to = new Date(`${toDateOnly}T00:00:00.000Z`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return Number.NaN
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function resolveTargetRoles(targetAudience: string[] | null | undefined): Array<'parent' | 'teacher' | 'student'> {
  const audience = Array.isArray(targetAudience) ? targetAudience.map((a) => String(a || '').toLowerCase()) : ['all']

  if (audience.includes('all')) {
    return ['parent', 'teacher', 'student']
  }

  const roles: Array<'parent' | 'teacher' | 'student'> = []
  if (audience.includes('parents') || audience.includes('parent')) roles.push('parent')
  if (audience.includes('teachers') || audience.includes('teacher')) roles.push('teacher')
  if (audience.includes('students') || audience.includes('student')) roles.push('student')
  return roles
}

function roleToAudience(role: 'parent' | 'teacher' | 'student'): string[] {
  if (role === 'parent') return ['parents']
  if (role === 'teacher') return ['teachers']
  return ['students']
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const isCronJob = authHeader === `Bearer ${CRON_SECRET}`
    const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`

    if (!isCronJob && !isServiceRole) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const today = formatDateInTimezone(new Date(), DEFAULT_TIMEZONE)
    const maxWindowDate = addDays(today, 8)

    const results = {
      thresholds: {
        sevenDay: { sent: 0, skipped: 0, failed: 0 },
        threeDay: { sent: 0, skipped: 0, failed: 0 },
        oneDay: { sent: 0, skipped: 0, failed: 0 },
      },
      eventsProcessed: 0,
      remindersSent: 0,
      remindersSkipped: 0,
      remindersFailed: 0,
    }

    const { data: events, error: eventsError } = await supabase
      .from('school_events')
      .select('id, title, start_date, preschool_id, target_audience, send_notifications, reminder_sent, notification_sent')
      .eq('status', 'scheduled')
      .eq('send_notifications', true)
      .gte('start_date', today)
      .lte('start_date', maxWindowDate)

    if (eventsError) {
      console.error('[event-reminders-cron] Error fetching events:', eventsError)
      return new Response(JSON.stringify({ error: eventsError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    for (const event of (events || []) as SchoolEvent[]) {
      const eventDate = normalizeDateOnly(event.start_date)
      if (!eventDate) continue

      const daysUntil = diffDays(today, eventDate)
      const threshold = REMINDER_THRESHOLDS.find((item) => item.offsetDays === daysUntil)
      if (!threshold) continue

      const roles = resolveTargetRoles(event.target_audience)
      if (roles.length === 0) continue

      results.eventsProcessed += 1
      let sentForEvent = 0

      for (const role of roles) {
        const metricBucket =
          threshold.offsetDays === 7
            ? results.thresholds.sevenDay
            : threshold.offsetDays === 3
              ? results.thresholds.threeDay
              : results.thresholds.oneDay

        const { data: existingLog, error: existingLogError } = await supabase
          .from('school_event_reminder_logs')
          .select('id')
          .eq('event_id', event.id)
          .eq('reminder_offset_days', threshold.offsetDays)
          .eq('target_role', role)
          .maybeSingle()

        if (existingLogError) {
          // If log table is unavailable for any reason, continue to send (best effort).
          console.warn('[event-reminders-cron] Reminder log lookup failed; proceeding', {
            eventId: event.id,
            role,
            offset: threshold.offsetDays,
            error: existingLogError.message,
          })
        }

        if (existingLog?.id) {
          metricBucket.skipped += 1
          results.remindersSkipped += 1
          continue
        }

        const { error: notifyError } = await supabase.functions.invoke('notifications-dispatcher', {
          body: {
            event_type: 'school_event_reminder',
            event_id: event.id,
            preschool_id: event.preschool_id,
            target_audience: roleToAudience(role),
            context: {
              reminder_offset_days: threshold.offsetDays,
              reminder_label: threshold.label,
              target_role: role,
            },
          },
        })

        if (notifyError) {
          console.error('[event-reminders-cron] Reminder send failed', {
            eventId: event.id,
            role,
            offset: threshold.offsetDays,
            error: notifyError.message,
          })
          metricBucket.failed += 1
          results.remindersFailed += 1
          continue
        }

        const { error: logInsertError } = await supabase
          .from('school_event_reminder_logs')
          .insert({
            event_id: event.id,
            preschool_id: event.preschool_id,
            reminder_offset_days: threshold.offsetDays,
            reminder_label: threshold.label,
            target_role: role,
            metadata: {
              event_title: event.title,
              event_date: eventDate,
            },
          })

        if (logInsertError) {
          console.warn('[event-reminders-cron] Reminder log insert failed', {
            eventId: event.id,
            role,
            offset: threshold.offsetDays,
            error: logInsertError.message,
          })
        }

        metricBucket.sent += 1
        results.remindersSent += 1
        sentForEvent += 1

        await new Promise((resolve) => setTimeout(resolve, 120))
      }

      if (threshold.offsetDays === 1 && sentForEvent > 0) {
        await supabase
          .from('school_events')
          .update({ reminder_sent: true })
          .eq('id', event.id)
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Event reminder check completed',
        timestamp: new Date().toISOString(),
        timezone: DEFAULT_TIMEZONE,
        window: { from: today, to: maxWindowDate },
        results,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  } catch (error: any) {
    console.error('[event-reminders-cron] Fatal error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
