const { createClient } = require('@supabase/supabase-js');

const edudash = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

(async () => {
  console.log('🔄 Triggering sync from EduSitePro to EduDashPro...\n');
  
  const { data, error } = await edudash.functions.invoke('sync-registrations-from-edusite', {
    body: {}
  });
  
  if (error) {
    console.log('❌ Error:', error);
  } else {
    console.log('✅ Sync result:', data);
  }
})();
