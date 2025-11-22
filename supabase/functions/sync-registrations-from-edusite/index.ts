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

    // Get existing synced records from EduDashPro (with their full data)
    const { data: existingRegistrations } = await edudashClient
      .from('registration_requests')
      .select('id, edusite_id, status, reviewed_by, reviewed_at, rejection_reason, proof_of_payment_url, registration_fee_paid, payment_method, guardian_id_document_url, student_birth_certificate_url, student_clinic_card_url')
      .not('edusite_id', 'is', null)

    const existingMap = new Map(existingRegistrations?.map(r => [r.edusite_id, r]) || [])
    console.log(`📊 Already synced: ${existingMap.size} registrations`)

    // Separate registrations into: new (insert), existing (update), and unchanged
    const newRegistrations: any[] = []
    const registrationsToUpdate: any[] = []
    
    edusiteRegistrations?.forEach(edusiteReg => {
      const existing = existingMap.get(edusiteReg.id)
      
      if (!existing) {
        // New registration - needs to be inserted
        newRegistrations.push(edusiteReg)
      } else {
        // Existing registration - check if it needs updating
        const needsUpdate = 
          existing.status !== edusiteReg.status ||
          existing.reviewed_by !== edusiteReg.reviewed_by ||
          existing.reviewed_at !== edusiteReg.reviewed_at ||
          existing.rejection_reason !== edusiteReg.rejection_reason ||
          existing.proof_of_payment_url !== edusiteReg.proof_of_payment_url ||
          existing.registration_fee_paid !== edusiteReg.registration_fee_paid ||
          existing.payment_method !== edusiteReg.payment_method ||
          existing.guardian_id_document_url !== edusiteReg.guardian_id_document_url ||
          existing.student_birth_certificate_url !== edusiteReg.student_birth_certificate_url ||
          existing.student_clinic_card_url !== edusiteReg.student_clinic_card_url
        
        if (needsUpdate) {
          registrationsToUpdate.push({
            edudash_id: existing.id,
            edusite_data: edusiteReg
          })
        }
      }
    })

    console.log(`➕ New registrations to insert: ${newRegistrations.length}`)
    console.log(`🔄 Existing registrations to update: ${registrationsToUpdate.length}`)

    // Transform and insert new registrations (only if there are any)
    let insertedCount = 0
    if (newRegistrations.length > 0) {
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
      registration_fee_paid: reg.proof_of_payment_url ? true : (reg.registration_fee_paid || false),
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

    insertedCount = newRegistrations.length
    console.log(`✅ Successfully synced ${insertedCount} new registrations`)
    }

    // Update existing registrations that have changed
    let updatedCount = 0
    if (registrationsToUpdate.length > 0) {
      console.log(`🔄 Updating ${registrationsToUpdate.length} changed registrations...`)
      
      for (const { edudash_id, edusite_data } of registrationsToUpdate) {
        const { error: updateError } = await edudashClient
          .from('registration_requests')
          .update({
            status: edusite_data.status,
            reviewed_by: edusite_data.reviewed_by,
            reviewed_at: edusite_data.reviewed_at,
            rejection_reason: edusite_data.rejection_reason,
            proof_of_payment_url: edusite_data.proof_of_payment_url,
            registration_fee_paid: edusite_data.proof_of_payment_url ? true : edusite_data.registration_fee_paid,
            payment_method: edusite_data.payment_method,
            guardian_id_document_url: edusite_data.guardian_id_document_url,
            student_birth_certificate_url: edusite_data.student_birth_certificate_url,
            student_clinic_card_url: edusite_data.student_clinic_card_url,
            synced_at: new Date().toISOString(),
          })
          .eq('id', edudash_id)

        if (updateError) {
          console.error(`⚠️ Error updating record ${edudash_id}:`, updateError)
        } else {
          updatedCount++
        }
      }
      console.log(`✅ Successfully updated ${updatedCount} registrations`)
    }

    // Handle deletions: Remove ALL records from EduDashPro that no longer exist in EduSitePro
    // Build set of EduSite IDs that currently exist
    const edusiteIds = new Set(edusiteRegistrations?.map(r => r.id) || [])
    
    // Get ALL records from EduDashPro (both synced and non-synced) for comparison
    const { data: allEdudashRecords } = await edudashClient
      .from('registration_requests')
      .select('id, edusite_id, organization_id')

    console.log(`📊 EduDashPro has ${allEdudashRecords?.length || 0} total records`)
    console.log(`📊 EduSitePro has ${edusiteIds.size} records`)

    // Delete records that either:
    // 1. Have edusite_id set but it no longer exists in EduSitePro
    // 2. Have the same organization_id but no matching record in EduSitePro
    const recordsToDelete = allEdudashRecords?.filter(dashRecord => {
      // If it has edusite_id, check if that ID still exists in EduSitePro
      if (dashRecord.edusite_id) {
        return !edusiteIds.has(dashRecord.edusite_id)
      }
      // For records without edusite_id, we'll keep them (they might be created directly in EduDash)
      return false
    }) || []
    
    let deletedCount = 0
    if (recordsToDelete.length > 0) {
      console.log(`🗑️ Deleting ${recordsToDelete.length} records that no longer exist in EduSitePro`)
      console.log(`🗑️ IDs to delete:`, recordsToDelete.map(r => r.id))
      
      const { error: deleteError } = await edudashClient
        .from('registration_requests')
        .delete()
        .in('id', recordsToDelete.map(r => r.id))

      if (deleteError) {
        console.error('⚠️ Error deleting records:', deleteError)
      } else {
        deletedCount = recordsToDelete.length
        console.log(`✅ Deleted ${deletedCount} records`)
      }
    } else {
      console.log(`ℹ️ No records to delete - databases are in sync`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${insertedCount} new, updated ${updatedCount}, deleted ${deletedCount} records`,
        synced: insertedCount,
        updated: updatedCount,
        deleted: deletedCount,
        total_in_edusite: edusiteRegistrations?.length || 0,
        total_in_edudash_before: allEdudashRecords?.length || 0
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
