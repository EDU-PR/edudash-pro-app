const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

(async () => {
  console.log('🔍 Finding all students and their payment data...\n');
  
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, preschool_id, registration_fee_amount, registration_fee_paid, payment_verified, payment_date, status, preschools(name)')
    .limit(10);
  
  console.log('Students:', JSON.stringify(students, null, 2));
  
  // Find Young Eagles preschool
  const { data: preschools } = await supabase
    .from('preschools')
    .select('id, name')
    .ilike('name', '%young%eagles%');
  
  console.log('\n🏫 Young Eagles preschool:', preschools);
})();
