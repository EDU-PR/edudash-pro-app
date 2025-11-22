// Edge Function to sync registration_requests from EduSitePro to EduDashPro
// This runs periodically (every 5 minutes via cron) or can be triggered manually

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Connect to EduDashPro (current project)
    const edudashUrl = Deno.env.get('SUPABASE_URL')!
    const edudashServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const edudashClient = createClient(edudashUrl, edudashServiceKey)

    // Connect to EduSitePro
    const edusiteUrl = Deno.env.get('EDUSITE_SUPABASE_URL')!
    const edusiteServiceKey = Deno.env.get('EDUSITE_SERVICE_ROLE_KEY')!
    const edusiteClient = createClient(edusiteUrl, edusiteServiceKey)

    console.log('🔄 Starting registration sync from EduSitePro to EduDashPro...')

    // Fetch all registrations from EduSitePro
    const { data: edusiteRegistrations, error: fetchError } = await edusiteClient
      .from('registration_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('❌ Error fetching from EduSitePro:', fetchError)
      throw fetchError
    }

    console.log(`📥 Found ${edusiteRegistrations?.length || 0} registrations in EduSitePro`)

    // Get existing synced IDs from EduDashPro
    const { data: existingRegistrations } = await edudashClient
      .from('registration_requests')
      .select('edusite_id')
      .not('edusite_id', 'is', null)

    const existingIds = new Set(existingRegistrations?.map(r => r.edusite_id) || [])
    console.log(`📊 Already synced: ${existingIds.size} registrations`)

    // Filter new registrations
    const newRegistrations = edusiteRegistrations?.filter(r => !existingIds.has(r.id)) || []
    console.log(`➕ New registrations to sync: ${newRegistrations.length}`)

    if (newRegistrations.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No new registrations to sync',
          synced: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Transform and insert new registrations
    const registrationsToInsert = newRegistrations.map(reg => ({
      id: crypto.randomUUID(), // New UUID for EduDashPro
      edusite_id: reg.id, // Store original EduSitePro ID
      organization_id: reg.organization_id,
      guardian_name: reg.guardian_name,
      guardian_email: reg.guardian_email,
      guardian_phone: reg.guardian_phone,
      guardian_address: reg.guardian_address,
      guardian_id_document_url: reg.guardian_id_document_url,
      student_first_name: reg.student_first_name,
      student_last_name: reg.student_last_name,
      student_dob: reg.student_dob,
      student_gender: reg.student_gender,
      student_birth_certificate_url: reg.student_birth_certificate_url,
      student_clinic_card_url: reg.student_clinic_card_url,
      documents_uploaded: reg.documents_uploaded || false,
      documents_deadline: reg.documents_deadline,
      registration_fee_amount: reg.registration_fee_amount,
      registration_fee_paid: reg.registration_fee_paid || false,
      payment_method: reg.payment_method,
      proof_of_payment_url: reg.proof_of_payment_url,
      campaign_applied: reg.campaign_applied,
      discount_amount: reg.discount_amount || 0,
      status: reg.status || 'pending',
      reviewed_by: reg.reviewed_by,
      reviewed_at: reg.reviewed_at,
      rejection_reason: reg.rejection_reason,
      synced_from_edusite: true,
      synced_at: new Date().toISOString(),
      created_at: reg.created_at,
    }))

    const { error: insertError } = await edudashClient
      .from('registration_requests')
      .insert(registrationsToInsert)

    if (insertError) {
      console.error('❌ Error inserting into EduDashPro:', insertError)
      throw insertError
    }

    console.log(`✅ Successfully synced ${newRegistrations.length} registrations`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${newRegistrations.length} registrations`,
        synced: newRegistrations.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Sync error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
