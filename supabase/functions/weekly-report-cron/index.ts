/**
 * Weekly Report Cron Job
 * Runs every Sunday at 6 PM to generate reports for all students
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') || 'your-cron-secret'

serve(async (req: Request): Promise<Response> => {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    console.log('[weekly-report-cron] Starting weekly report generation...')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Calculate week range (previous Monday to Friday)
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek + 6
    const lastMonday = new Date(today)
    lastMonday.setDate(today.getDate() - daysToLastMonday)
    const lastFriday = new Date(lastMonday)
    lastFriday.setDate(lastMonday.getDate() + 4)

    const weekStart = lastMonday.toISOString().split('T')[0]
    const weekEnd = lastFriday.toISOString().split('T')[0]

    console.log(`[weekly-report-cron] Week range: ${weekStart} to ${weekEnd}`)

    // Get active students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, parent_id')
      .eq('status', 'active')
      .not('parent_id', 'is', null)

    if (studentsError || !students || students.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active students found' }),
        { status: 200 }
      )
    }

    console.log(`[weekly-report-cron] Found ${students.length} active students`)

    const results = {
      total: students.length,
      success: 0,
      failed: 0,
      skipped: 0,
    }

    // Generate reports for each student
    for (const student of students) {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-weekly-report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            studentId: student.id,
            weekStart,
            weekEnd,
          }),
        })

        if (response.ok) {
          results.success++
        } else {
          results.failed++
        }
      } catch (error) {
        console.error(`Error for student ${student.id}:`, error)
        results.failed++
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('[weekly-report-cron] Completed:', results)

    return new Response(
      JSON.stringify({ message: 'Weekly report generation completed', weekStart, weekEnd, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[weekly-report-cron] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
