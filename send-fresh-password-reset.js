const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lvvvjywrmpcqrpvuptdi.supabase.co'\;
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE3NTk2MjIsImV4cCI6MjA0NzMzNTYyMn0.WUaKDTlj3j7bFNyKTL5jgZ-9tVXR1OxJvJw5c4LBxfA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function sendPasswordReset() {
  const email = 'dipsroboticsgm@gmail.com';
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 SENDING FRESH PASSWORD RESET EMAIL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Email:', email);
  console.log('🔗 Redirect to: https://edudashpro.org.za/reset-password');
  console.log('');

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://edudashpro.org.za/reset-password',
  });

  if (error) {
    console.error('❌ ERROR:', error.message);
    console.error('');
    console.error('Possible reasons:');
    console.error('• User does not exist');
    console.error('• Email service not configured');
    console.error('• Rate limit exceeded');
    process.exit(1);
  }

  console.log('✅ SUCCESS! Password reset email sent!');
  console.log('');
  console.log('📬 NEXT STEPS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Check inbox: dipsroboticsgm@gmail.com');
  console.log('2. Check spam/junk folder if not in inbox');
  console.log('3. Email subject will vary based on Supabase template');
  console.log('4. Click the password reset link/button');
  console.log('5. You will be redirected to: https://edudashpro.org.za/reset-password');
  console.log('6. Set new password and submit');
  console.log('');
  console.log('⚠️  IMPORTANT:');
  console.log('• Link expires in 1 hour');
  console.log('• Link can only be used once');
  console.log('• If link expires, run this script again');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

sendPasswordReset().catch(console.error);
