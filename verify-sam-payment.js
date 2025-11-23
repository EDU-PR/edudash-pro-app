const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

(async () => {
  console.log('🔍 Checking Sam Doe payment status...\n');
  
  // Find Sam Doe
  const { data: sam } = await supabase
    .from('students')
    .select('*')
    .eq('first_name', 'Sam')
    .eq('last_name', 'Doe')
    .single();
  
  if (!sam) {
    console.log('❌ Sam Doe not found');
    return;
  }
  
  console.log('Student:', sam);
  console.log('\n💳 Payment Status:');
  console.log('  registration_fee_amount:', sam.registration_fee_amount);
  console.log('  registration_fee_paid:', sam.registration_fee_paid);
  console.log('  payment_verified:', sam.payment_verified);
  console.log('  payment_date:', sam.payment_date);
  console.log('  status:', sam.status);
  
  // Check principal's financial view
  const preschoolId = sam.preschool_id;
  const { data: allStudents } = await supabase
    .from('students')
    .select('first_name, last_name, registration_fee_amount, registration_fee_paid, payment_verified, status')
    .eq('preschool_id', preschoolId);
  
  const paid = allStudents?.filter(s => (s.payment_verified || s.registration_fee_paid) && s.status === 'active') || [];
  const revenue = paid.reduce((sum, s) => sum + (parseFloat(s.registration_fee_amount || '0') || 0), 0);
  
  console.log('\n💰 Principal Dashboard will show:');
  console.log('  Paid registrations:', paid.length);
  console.log('  Revenue collected: R' + revenue.toFixed(2));
})();
