import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const EDUSITE_SUPABASE_URL = Deno.env.get('EDUSITE_SUPABASE_URL')!;
const EDUSITE_SERVICE_ROLE_KEY = Deno.env.get('EDUSITE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const { old_record } = await req.json();
    
    console.log('Syncing delete action to EduSitePro:', old_record);

    if (!old_record.edusite_id) {
      console.log('No edusite_id found, skipping delete sync');
      return new Response(
        JSON.stringify({ success: true, message: 'No edusite_id, skipped' }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
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

    // Delete registration from EduSitePro
    const { error: deleteError } = await edusiteClient
      .from('registration_requests')
      .delete()
      .eq('id', old_record.edusite_id);

    if (deleteError) {
      throw deleteError;
    }

    console.log('Successfully synced delete to EduSitePro');

    return new Response(
      JSON.stringify({ success: true, message: 'Delete synced to EduSitePro' }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error syncing delete:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
