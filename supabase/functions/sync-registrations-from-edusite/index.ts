// @ts-nocheck
/**
 * Sync Registrations from EduSitePro to EduDashPro
 * 
 * This function pulls registration requests from EduSitePro (CMS platform)
 * and syncs them to the EduDashPro local registration_requests table.
 * 
 * The organization_id is determined by the school_slug from EduSitePro URL.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fallback static mapping of school slugs to organization IDs
// Used when dynamic lookup fails
const SCHOOL_SLUG_TO_ORG_ID: Record<string, string> = {
  'young-eagles': 'ba79097c-1b93-4b48-bcbe-df73878ab4d1',
  // Add more school mappings as needed
};

// Cache for dynamic slug-to-org mappings
const slugToOrgCache: Record<string, string> = {};

/**
 * Look up organization ID by tenant_slug from preschools table
 */
async function getOrgIdBySlug(supabase: ReturnType<typeof createClient>, slug: string): Promise<string | null> {
  // Check cache first
  if (slugToOrgCache[slug]) {
    return slugToOrgCache[slug];
  }
  
  // Check static mapping
  if (SCHOOL_SLUG_TO_ORG_ID[slug]) {
    return SCHOOL_SLUG_TO_ORG_ID[slug];
  }
  
  // Try dynamic lookup from preschools table
  try {
    const { data: preschool } = await supabase
      .from('preschools')
      .select('id')
      .eq('tenant_slug', slug)
      .maybeSingle();
    
    if (preschool?.id) {
      slugToOrgCache[slug] = preschool.id;
      return preschool.id;
    }
    
    // Try by name (slug with dashes replaced by spaces)
    const { data: preschoolByName } = await supabase
      .from('preschools')
      .select('id')
      .ilike('name', slug.replace(/-/g, ' '))
      .maybeSingle();
    
    if (preschoolByName?.id) {
      slugToOrgCache[slug] = preschoolByName.id;
      return preschoolByName.id;
    }
  } catch (e) {
    console.error(`[sync-from-edusite] Error looking up slug ${slug}:`, e);
  }
  
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const edusiteUrl = Deno.env.get('EDUSITE_SUPABASE_URL') || 'https://bppuzibjlxgfwrujzfsz.supabase.co';
    const edusiteServiceKey = Deno.env.get('EDUSITE_SUPABASE_SERVICE_ROLE_KEY');

    // Check if EduSitePro sync is configured
    if (!edusiteServiceKey) {
      console.warn('[sync-from-edusite] EDUSITE_SUPABASE_SERVICE_ROLE_KEY not set - sync feature disabled');
      // Return success with message instead of error - this allows the app to work without EduSitePro integration
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'EduSitePro sync is not configured. Only local registrations are available.',
          synced: 0,
          updated: 0,
          skipped: 0,
          deleted: 0,
          total: 0,
          edusite_configured: false,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const edusiteClient = createClient(edusiteUrl, edusiteServiceKey);

    // Parse request body for optional organization_id filter
    let organizationIdFilter: string | null = null;
    try {
      const body = await req.json();
      organizationIdFilter = body?.organization_id || null;
    } catch {
      // No body provided, sync all
    }

    console.log('[sync-from-edusite] Starting sync', organizationIdFilter ? `for org: ${organizationIdFilter}` : 'for all orgs');

    // Fetch registrations from EduSitePro
    let query = edusiteClient
      .from('registration_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // If we have a filter, we need to find registrations by school_slug
    // EduSitePro stores school_slug which maps to organization_id in EduDashPro
    
    const { data: edusiteRegistrations, error: fetchError } = await query;

    if (fetchError) {
      console.error('[sync-from-edusite] Error fetching from EduSitePro:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch from EduSitePro', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-from-edusite] Found ${edusiteRegistrations?.length || 0} registrations in EduSitePro`);

    let synced = 0;
    let updated = 0;
    let skipped = 0;
    let deleted = 0;

    // Process each EduSitePro registration
    for (const reg of edusiteRegistrations || []) {
      try {
        // Determine organization_id from multiple sources
        let orgId = reg.organization_id || reg.school_id;
        
        // If school_slug is provided, use dynamic lookup
        if (reg.school_slug) {
          const slugOrgId = await getOrgIdBySlug(supabase, reg.school_slug);
          if (slugOrgId) {
            orgId = slugOrgId;
          }
        }
        
        // If org filter is set, skip registrations for other orgs
        if (organizationIdFilter && orgId !== organizationIdFilter) {
          skipped++;
          continue;
        }

        // Skip if no organization ID could be determined
        if (!orgId) {
          console.warn(`[sync-from-edusite] Skipping registration ${reg.id}: no organization_id (slug: ${reg.school_slug})`);
          skipped++;
          continue;
        }

        // Check if already synced to EduDashPro
        const { data: existing } = await supabase
          .from('registration_requests')
          .select('id, status, updated_at')
          .eq('edusite_id', reg.id)
          .maybeSingle();

        const registrationData = {
          organization_id: orgId,
          guardian_name: reg.guardian_name || `${reg.guardian_first_name || ''} ${reg.guardian_last_name || ''}`.trim(),
          guardian_first_name: reg.guardian_first_name,
          guardian_last_name: reg.guardian_last_name,
          guardian_email: reg.guardian_email?.toLowerCase(),
          guardian_phone: reg.guardian_phone,
          guardian_address: reg.guardian_address,
          guardian_id_document_url: reg.guardian_id_document_url,
          student_first_name: reg.student_first_name || reg.child_first_name,
          student_last_name: reg.student_last_name || reg.child_last_name,
          student_dob: reg.student_dob || reg.student_date_of_birth || reg.child_date_of_birth,
          student_gender: reg.student_gender || reg.child_gender,
          student_grade: reg.student_grade || reg.child_grade,
          student_allergies: reg.student_allergies || reg.child_allergies,
          student_medical_conditions: reg.student_medical_conditions || reg.child_medical_conditions,
          student_birth_certificate_url: reg.student_birth_certificate_url,
          student_clinic_card_url: reg.student_clinic_card_url,
          documents_uploaded: reg.documents_uploaded,
          documents_deadline: reg.documents_deadline,
          registration_fee_amount: reg.registration_fee_amount,
          registration_fee_paid: reg.registration_fee_paid,
          payment_method: reg.payment_method,
          payment_verified: reg.payment_verified,
          proof_of_payment_url: reg.proof_of_payment_url,
          campaign_applied: reg.campaign_applied,
          discount_amount: reg.discount_amount,
          status: reg.status || 'pending',
          reviewed_by: reg.reviewed_by,
          reviewed_date: reg.reviewed_date,
          rejection_reason: reg.rejection_reason,
          emergency_contact_name: reg.emergency_contact_name,
          emergency_contact_phone: reg.emergency_contact_phone,
          emergency_contact_relation: reg.emergency_contact_relation,
          synced_from_edusite: true,
          edusite_id: reg.id,
          synced_at: new Date().toISOString(),
        };

        if (existing) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('registration_requests')
            .update(registrationData)
            .eq('id', existing.id);

          if (updateError) {
            console.error(`[sync-from-edusite] Error updating ${reg.id}:`, updateError);
          } else {
            updated++;
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('registration_requests')
            .insert(registrationData);

          if (insertError) {
            console.error(`[sync-from-edusite] Error inserting ${reg.id}:`, insertError);
          } else {
            synced++;
          }
        }
      } catch (regError) {
        console.error(`[sync-from-edusite] Error processing registration ${reg.id}:`, regError);
      }
    }

    // Optionally: Mark deleted registrations (ones in EduDashPro but no longer in EduSitePro)
    // This is commented out to be safe - uncomment if you want soft deletes
    /*
    if (organizationIdFilter) {
      const edusiteIds = (edusiteRegistrations || []).map(r => r.id);
      const { data: localRegs } = await supabase
        .from('registration_requests')
        .select('id, edusite_id')
        .eq('organization_id', organizationIdFilter)
        .eq('synced_from_edusite', true);
      
      for (const local of localRegs || []) {
        if (local.edusite_id && !edusiteIds.includes(local.edusite_id)) {
          await supabase
            .from('registration_requests')
            .update({ status: 'deleted' })
            .eq('id', local.id);
          deleted++;
        }
      }
    }
    */

    const result = {
      success: true,
      message: `Sync complete: ${synced} new, ${updated} updated, ${skipped} skipped, ${deleted} removed`,
      synced,
      updated,
      skipped,
      deleted,
      total: edusiteRegistrations?.length || 0,
    };

    console.log('[sync-from-edusite] Sync result:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-from-edusite] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
