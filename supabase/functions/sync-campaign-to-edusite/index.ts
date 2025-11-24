// Edge Function: sync-campaign-to-edusite
// Syncs marketing campaigns from EduDashPro → EduSitePro

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: any;
  old_record: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: CampaignPayload = await req.json();
    console.log('[sync-campaign-to-edusite] Received payload:', payload.type, payload.record?.id);

    // Get EduSitePro credentials from environment
    const edusiteUrl = Deno.env.get('EDUSITE_SUPABASE_URL');
    const edusiteKey = Deno.env.get('EDUSITE_SERVICE_ROLE_KEY');

    if (!edusiteUrl || !edusiteKey) {
      throw new Error('EduSitePro credentials not configured');
    }

    const edusiteClient = createClient(edusiteUrl, edusiteKey);

    const campaign = payload.record;

    // Map preschool_id (EduDashPro) to organization_id (EduSitePro)
    const { data: orgMapping } = await edusiteClient
      .from('organizations')
      .select('id, name')
      .eq('name', 'Young Eagles') // We'll need to enhance this with proper mapping
      .single();

    if (!orgMapping) {
      console.log('[sync-campaign-to-edusite] No matching organization found in EduSitePro');
      return new Response(
        JSON.stringify({ success: false, error: 'Organization not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const campaignData = {
      id: campaign.id, // Keep same ID for tracking
      organization_id: orgMapping.id,
      name: campaign.name,
      campaign_type: campaign.campaign_type,
      description: campaign.description,
      terms_conditions: campaign.terms_conditions,
      target_audience: campaign.target_audience,
      target_classes: campaign.target_classes,
      discount_type: campaign.discount_type,
      discount_value: campaign.discount_value,
      max_discount_amount: campaign.max_discount_amount,
      promo_code: campaign.promo_code,
      max_redemptions: campaign.max_redemptions,
      current_redemptions: campaign.current_redemptions,
      min_purchase_amount: campaign.min_purchase_amount,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      auto_apply: campaign.auto_apply,
      auto_apply_conditions: campaign.auto_apply_conditions,
      active: campaign.active,
      featured: campaign.featured,
    };

    if (payload.type === 'INSERT' || payload.type === 'UPDATE') {
      // Upsert to EduSitePro
      const { error: upsertError } = await edusiteClient
        .from('marketing_campaigns')
        .upsert(campaignData, { onConflict: 'id' });

      if (upsertError) {
        console.error('[sync-campaign-to-edusite] Upsert error:', upsertError);
        throw upsertError;
      }

      console.log(`[sync-campaign-to-edusite] ✅ ${payload.type} synced:`, campaign.id);
    } else if (payload.type === 'DELETE') {
      // Delete from EduSitePro
      const { error: deleteError } = await edusiteClient
        .from('marketing_campaigns')
        .delete()
        .eq('id', payload.old_record.id);

      if (deleteError) {
        console.error('[sync-campaign-to-edusite] Delete error:', deleteError);
        throw deleteError;
      }

      console.log('[sync-campaign-to-edusite] ✅ DELETE synced:', payload.old_record.id);
    }

    return new Response(
      JSON.stringify({ success: true, operation: payload.type }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[sync-campaign-to-edusite] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
