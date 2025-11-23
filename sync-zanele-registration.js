const https = require('https');

const EDUDASH_URL = 'https://lvvvjywrmpcqrpvuptdi.supabase.co'\;
const EDUDASH_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzc4MzgsImV4cCI6MjA2ODYxMzgzOH0.mjXejyRHPzEJfMlhW46TlYI0qw9mtoSRJZhGsCkuvd8';

const registrationData = {
  edusite_id: 'd2993a49-f5c7-4281-93ef-3e32038d2fc0',
  school_id: '6b92f8a5-48e7-4865-b85f-4b92c174e0ef', // Young Eagles
  guardian_email: 'Zanelelwndl@gmail.com',
  guardian_name: 'Zanele',
  guardian_phone: '0724479339',
  student_first_name: 'Olivia',
  student_last_name: 'Makunyane',
  student_dob: '2022-10-28',
  student_gender: 'female',
  preferred_class: 'Panda',
  preferred_start_date: '2026-01-12',
  status: 'approved',
  registration_fee_amount: 200.00,
  registration_fee_paid: true,
  payment_verified: true
};

console.log('🔄 Syncing Zanele\'s registration to EduDashPro...');
console.log('📧 Email:', registrationData.guardian_email);
console.log('👶 Student:', registrationData.student_first_name, registrationData.student_last_name);

const postData = JSON.stringify(registrationData);

const options = {
  hostname: 'lvvvjywrmpcqrpvuptdi.supabase.co',
  port: 443,
  path: '/rest/v1/registration_requests',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': EDUDASH_ANON,
    'Authorization': `Bearer ${EDUDASH_ANON}`,
    'Prefer': 'return=representation'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 201) {
      console.log('✅ Registration synced successfully!');
      console.log('📝 Created in EduDashPro registration_requests table');
      console.log('\n🎯 Next step: Trigger sync-registration-to-edudash Edge Function');
      console.log('   This will create the parent account and student profile');
    } else {
      console.error('❌ Error:', res.statusCode);
      console.error(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.write(postData);
req.end();
