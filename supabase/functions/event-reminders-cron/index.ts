/**
 * Event Reminders Cron Job
 * Runs daily to send reminders for upcoming school events
 * 
 * Reminder Schedule:
 * - 1 week before: First reminder
 * - 1 day before: Final reminder
 * 
 * Tracks sent reminders in school_events table (reminder_sent column)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') || 'your-cron-secret'

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

serve(async (req: Request): Promise<Response> => {
  // CORS handling
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
    // Verify cron secret (for scheduled execution)
    const authHeader = req.headers.get('Authorization');
    const isCronJob = authHeader === `Bearer ${CRON_SECRET}`;
    
    // Also allow service role for manual triggering
    const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    
    if (!isCronJob && !isServiceRole) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[event-reminders-cron] Starting event reminder check...');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const eightDaysFromNow = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

    const results = {
      weekReminders: { sent: 0, failed: 0 },
      dayReminders: { sent: 0, failed: 0 },
      totalProcessed: 0,
    };

    // 1. Find events happening in about 1 week that haven't had a reminder sent yet
    // Look for events between 6-8 days from now (buffer for daily cron)
    const { data: weekEvents, error: weekError } = await supabase
      .from('school_events')
      .select('id, title, start_date, preschool_id, target_audience, send_notifications, reminder_sent, notification_sent')
      .eq('status', 'scheduled')
      .eq('send_notifications', true)
      .eq('reminder_sent', false)
      .gte('start_date', oneWeekFromNow.toISOString().split('T')[0])
      .lte('start_date', eightDaysFromNow.toISOString().split('T')[0]);

    if (weekError) {
      console.error('[event-reminders-cron] Error fetching week events:', weekError);
    } else if (weekEvents && weekEvents.length > 0) {
      console.log(`[event-reminders-cron] Found ${weekEvents.length} events for 1-week reminder`);
      
      for (const event of weekEvents as SchoolEvent[]) {
        try {
          // Send reminder notification
          const { error: notifyError } = await supabase.functions.invoke('notifications-dispatcher', {
            body: {
              event_type: 'school_event_reminder',
              event_id: event.id,
              preschool_id: event.preschool_id,
              target_audience: event.target_audience,
            }
          });

          if (notifyError) {
            console.error(`[event-reminders-cron] Failed to send reminder for event ${event.id}:`, notifyError);
            results.weekReminders.failed++;
          } else {
            // Mark reminder as sent - but don't mark reminder_sent yet (save for day-before)
            // We use a different flag or just track in notifications table
            console.log(`[event-reminders-cron] ✅ Week reminder sent for: ${event.title}`);
            results.weekReminders.sent++;
          }
          
          results.totalProcessed++;
        } catch (err) {
          console.error(`[event-reminders-cron] Error processing event ${event.id}:`, err);
          results.weekReminders.failed++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // 2. Find events happening tomorrow that haven't had the final reminder
    const { data: dayEvents, error: dayError } = await supabase
      .from('school_events')
      .select('id, title, start_date, preschool_id, target_audience, send_notifications, reminder_sent, notification_sent')
      .eq('status', 'scheduled')
      .eq('send_notifications', true)
      .eq('reminder_sent', false)
      .gte('start_date', now.toISOString().split('T')[0])
      .lte('start_date', twoDaysFromNow.toISOString().split('T')[0]);

    if (dayError) {
      console.error('[event-reminders-cron] Error fetching day events:', dayError);
    } else if (dayEvents && dayEvents.length > 0) {
      console.log(`[event-reminders-cron] Found ${dayEvents.length} events for final reminder`);
      
      for (const event of dayEvents as SchoolEvent[]) {
        try {
          // Send final reminder notification
          const { error: notifyError } = await supabase.functions.invoke('notifications-dispatcher', {
            body: {
              event_type: 'school_event_reminder',
              event_id: event.id,
              preschool_id: event.preschool_id,
              target_audience: event.target_audience,
            }
          });

          if (notifyError) {
            console.error(`[event-reminders-cron] Failed to send final reminder for event ${event.id}:`, notifyError);
            results.dayReminders.failed++;
          } else {
            // Mark reminder_sent as true to prevent future reminders
            await supabase
              .from('school_events')
              .update({ reminder_sent: true })
              .eq('id', event.id);
            
            console.log(`[event-reminders-cron] ✅ Final reminder sent for: ${event.title}`);
            results.dayReminders.sent++;
          }
          
          results.totalProcessed++;
        } catch (err) {
          console.error(`[event-reminders-cron] Error processing event ${event.id}:`, err);
          results.dayReminders.failed++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log('[event-reminders-cron] Completed:', JSON.stringify(results));

    return new Response(
      JSON.stringify({ 
        message: 'Event reminder check completed',
        timestamp: now.toISOString(),
        results 
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  } catch (error: any) {
    console.error('[event-reminders-cron] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  }
});
