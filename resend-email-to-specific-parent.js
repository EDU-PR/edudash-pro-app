#!/usr/bin/env node

/**
 * Resend Parent Approval Email to Specific Email
 * 
 * Usage: node resend-email-to-specific-parent.js <email>
 * Example: node resend-email-to-specific-parent.js parent@example.com
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Email template matching parent-approval.ts
function generateParentApprovalEmail(data) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your EduDash Pro Account is Ready!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  
  <!-- Full-width gradient header -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">🎉 Registration Approved!</h1>
    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.95); font-size: 16px;">Welcome to EduDash Pro</p>
  </div>

  <!-- Content -->
  <div style="max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Main content -->
    <div style="padding: 30px 20px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">Dear ${data.guardianName},</p>
      
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #555; line-height: 1.6;">
        Great news! <strong>${data.studentName}'s</strong> registration at <strong>${data.schoolName}</strong> has been approved! 
        We've created your parent account so you can access your child's progress, assignments, and more.
      </p>

      <!-- Account details box -->
      <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666; font-weight: 600;">YOUR ACCOUNT</p>
        <p style="margin: 0; font-size: 15px; color: #333;">
          <strong>Email:</strong> ${data.email}
        </p>
      </div>

      <!-- Set password button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.resetPasswordUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
          Set Your Password
        </a>
      </div>

      <!-- Install PWA section -->
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
        <h2 style="margin: 0 0 15px 0; color: white; font-size: 22px; font-weight: 600;">📱 Install Our Mobile App</h2>
        <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.95); font-size: 15px; line-height: 1.5;">
          Get the best experience with our mobile app. Access from any device, anytime!
        </p>
        <a href="${data.pwaUrl}" 
           style="display: inline-block; background: white; color: #f5576c; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
          Install App Now
        </a>
      </div>

      <!-- App store badges -->
      <div style="text-align: center; margin: 30px 0;">
        <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">Download from:</p>
        <div style="display: inline-block; margin: 0 10px;">
          <img src="https://edudashpro.org.za/images/google-play-badge.png" 
               alt="Get it on Google Play" 
               style="height: 50px; opacity: 0.7;" />
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">Coming Soon</p>
        </div>
        <div style="display: inline-block; margin: 0 10px;">
          <img src="https://edudashpro.org.za/images/app-store-badge.png" 
               alt="Download on the App Store" 
               style="height: 50px; opacity: 0.7;" />
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">Coming Soon</p>
        </div>
      </div>

      <!-- What's next -->
      <div style="margin: 30px 0;">
        <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #333;">What's Next?</h3>
        <ol style="margin: 0; padding-left: 20px; color: #555; font-size: 15px; line-height: 1.8;">
          <li>Click the "Set Your Password" button above</li>
          <li>Create a secure password for your account</li>
          <li>Log in and explore your dashboard</li>
          <li>Install the app for quick access on your phone</li>
        </ol>
      </div>

      <!-- Help section -->
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
          <strong>Need Help?</strong>
        </p>
        <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.6;">
          If you have any questions or need assistance, please contact your school directly or reach out to our support team.
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
        Best regards,<br>
        <strong>The EduDash Pro Team</strong>
      </p>
      <p style="margin: 0; font-size: 12px; color: #999;">
        © ${new Date().getFullYear()} EduDash Pro. All rights reserved.
      </p>
    </div>

  </div>

</body>
</html>
  `.trim();
}

async function main() {
  const targetEmail = process.argv[2];

  if (!targetEmail) {
    console.error('❌ Usage: node resend-email-to-specific-parent.js <email>');
    console.error('   Example: node resend-email-to-specific-parent.js parent@example.com');
    process.exit(1);
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`🔍 Looking for parent account: ${targetEmail}\n`);

  // Check if parent exists
  const { data: parent, error: parentError } = await supabase
    .from('profiles')
    .select(`
      id,
      auth_user_id,
      email,
      first_name,
      last_name,
      preschool_id,
      created_at
    `)
    .eq('email', targetEmail)
    .eq('role', 'parent')
    .maybeSingle();

  if (parentError) {
    console.error('❌ Error fetching parent:', parentError.message);
    process.exit(1);
  }

  if (!parent) {
    console.error(`❌ No parent account found for: ${targetEmail}`);
    console.log('\n💡 Tip: Make sure the email is correct and the account has been created.');
    process.exit(1);
  }

  console.log(`✅ Found parent account:`);
  console.log(`   Name: ${parent.first_name} ${parent.last_name}`);
  console.log(`   Email: ${parent.email}`);
  console.log(`   Created: ${new Date(parent.created_at).toLocaleString()}\n`);

  try {
    // Get associated students
    const { data: students } = await supabase
      .from('students')
      .select('first_name, last_name')
      .eq('parent_id', parent.id)
      .limit(1);

    const studentName = students && students.length > 0
      ? `${students[0].first_name} ${students[0].last_name}`
      : 'your child';

    // Get school name
    const { data: preschool } = await supabase
      .from('preschools')
      .select('name')
      .eq('id', parent.preschool_id)
      .maybeSingle();

    const schoolName = preschool?.name || 'Your School';

    console.log(`📚 Student: ${studentName}`);
    console.log(`🏫 School: ${schoolName}\n`);

    // Generate email
    const guardianName = `${parent.first_name} ${parent.last_name}`.trim() || parent.email;
    const resetPasswordUrl = `${supabaseUrl}/reset-password?email=${encodeURIComponent(parent.email)}`;
    const pwaUrl = 'https://edudashpro.org.za';

    const emailHtml = generateParentApprovalEmail({
      guardianName,
      studentName,
      email: parent.email,
      schoolName,
      resetPasswordUrl,
      pwaUrl,
    });

    console.log('📧 Sending approval email...');

    // Send email via Edge Function
    const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        to: parent.email,
        subject: '🎉 Registration Approved - Your EduDash Pro Account is Ready!',
        body: emailHtml,
        is_html: true,
        confirmed: true,
      },
    });

    if (emailError) {
      console.error(`❌ Failed to send email: ${emailError.message}`);
      process.exit(1);
    } else {
      console.log(`✅ Email sent successfully to ${parent.email}!`);
      console.log('\n📬 The parent should receive the email shortly with instructions to set their password.');
    }

  } catch (error) {
    console.error(`❌ Error processing parent: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
