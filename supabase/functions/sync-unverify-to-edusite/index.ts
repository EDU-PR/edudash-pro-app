import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const EDUSITE_SUPABASE_URL = Deno.env.get('EDUSITE_SUPABASE_URL')!;
const EDUSITE_SERVICE_ROLE_KEY = Deno.env.get('EDUSITE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const { record } = await req.json();
    
    console.log('Syncing unverify action to EduSitePro:', record);

    if (!record.edusite_id) {
      throw new Error('No edusite_id found for sync');
    }

    // Create Supabase client for EduSitePro
    const edusiteClient = createClient(
      EDUSITE_SUPABASE_URL,
      EDUSITE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Update registration in EduSitePro
    const { error: updateError } = await edusiteClient
      .from('registration_requests')
      .update({
        payment_verified: false,
        payment_date: null,
        status: 'pending',
        reviewed_date: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', record.edusite_id);

    if (updateError) {
      throw updateError;
    }

    console.log('Successfully synced unverify to EduSitePro');

    return new Response(
      JSON.stringify({ success: true, message: 'Unverify synced to EduSitePro' }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error syncing unverify:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
