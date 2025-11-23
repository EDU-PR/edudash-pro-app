const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

(async () => {
  console.log('💳 Updating Sam Doe payment status...\n');
  
  const { error } = await supabase
    .from('students')
    .update({
      registration_fee_amount: 500.00,
      registration_fee_paid: true,
      payment_verified: true,
      payment_date: new Date().toISOString()
    })
    .eq('first_name', 'Sam')
    .eq('last_name', 'Doe');
  
  if (error) {
    console.log('❌ Error:', error);
  } else {
    console.log('✅ Sam Doe payment updated');
    
    // Verify
    const { data: sam } = await supabase
      .from('students')
      .select('first_name, last_name, registration_fee_amount, registration_fee_paid, payment_verified, payment_date')
      .eq('first_name', 'Sam')
      .eq('last_name', 'Doe')
      .single();
    
    console.log('\n✅ Updated payment data:');
    console.log(sam);
  }
})();
