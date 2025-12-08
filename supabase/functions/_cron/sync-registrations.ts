// Cron job to automatically sync registrations every 5 minutes
// Supabase will call this endpoint on schedule

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (_req) => {
  try {
    // Call the sync function
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-registrations-from-edusite`
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()
    console.log('✅ Cron sync completed:', result)

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Cron sync failed:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
