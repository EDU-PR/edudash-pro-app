import { createClient } from '@supabase/supabase-js';

const edusiteUrl = 'https://bppuzibjlxgfwrujzfsz.supabase.co'\;
const edusiteKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwcHV6aWJqbHhnZndydWpmZnN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTA3NTk4MywiZXhwIjoyMDQ2NjUxOTgzfQ.pVOPCe_qMu2VDokAr8vTcAyX6t0AUwSZPXX3gFfLTyw';

const edudashUrl = 'https://lvvvjywrmpcqrpvuptdi.supabase.co'\;
const edudashAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzEwODAwMDUsImV4cCI6MjA0NjY1NjAwNX0.DORiaSvJGz0eZwqF7Sv3NHt-TDbO2WThI6SgIRQXREI';

const edusiteClient = createClient(edusiteUrl, edusiteKey);

// Get registration ID
const { data: registration, error } = await edusiteClient
  .from('registration_requests')
  .select('id')
  .eq('guardian_email', 'dipsroboticsgm@gmail.com')
  .single();

if (error) {
  console.error('Error finding registration:', error);
  process.exit(1);
}

console.log('Registration ID:', registration.id);

// Trigger edge function
const response = await fetch(`${edudashUrl}/functions/v1/sync-registration-to-edudash`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${edudashAnonKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ registration_id: registration.id }),
});

const result = await response.json();
console.log('Result:', JSON.stringify(result, null, 2));
