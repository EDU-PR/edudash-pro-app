#!/usr/bin/env npx ts-node
/**
 * Invite Aftercare Parents Script
 * 
 * This script sends invitation emails to aftercare parents who don't have accounts yet.
 * It uses Supabase's inviteUserByEmail which:
 * 1. Creates the user in auth.users
 * 2. Sends an email with a magic link to set their password
 * 3. Once they click the link, they can set their password and are logged in
 * 
 * It also sends a custom welcome email via Resend with:
 * - Request for Google email for early app access
 * - WhatsApp group link for community support
 * 
 * Usage:
 *   npx tsx scripts/invite-aftercare-parents.ts
 *   npx tsx scripts/invite-aftercare-parents.ts --dry-run
 *   npx tsx scripts/invite-aftercare-parents.ts --email=specific@email.com
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY=REDACTED
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const COMMUNITY_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

// Redirect URL for after password is set - points to parent sign-up completion
const REDIRECT_URL = 'https://www.edudashpro.org.za/landing?flow=password-set&redirect=/dashboard/parent';

// WhatsApp Group Link for EduDash Pro Community
const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/FQVPXqY6daRLIonPjQqZTv';

// Email sender
const FROM_EMAIL = 'EduDash Pro <noreply@edudashpro.org.za>';

interface AftercareParent {
  id: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_phone: string;
  child_first_name: string;
  child_last_name: string;
  child_grade: string;
  status: string;
  preschool_id: string;
  parent_user_id: string | null;
}

interface InviteResult {
  email: string;
  success: boolean;
  userId?: string;
  error?: string;
  welcomeEmailSent?: boolean;
}

/**
 * Generate the welcome email HTML with Google email request and WhatsApp link
 */
function generateWelcomeEmailHTML(parentName: string, childName: string): string {
  const currentYear = new Date().getFullYear();
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to EduDash Pro Aftercare</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <!-- Header -->
  <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎓 EduDash Pro</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Community School Aftercare</p>
  </div>
  
  <!-- Main Content -->
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
    
    <h2 style="color: #333; margin-top: 0;">Welcome, ${parentName}! 👋</h2>
    
    <p>Thank you for registering <strong>${childName}</strong> for our Aftercare program! We're excited to have your family join our community.</p>
    
    <p>You'll receive a separate email shortly with a link to <strong>set your password</strong> and access your parent dashboard.</p>
    
    <!-- Google Email Request Section -->
    <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2196f3;">
      <h3 style="color: #1565c0; margin-top: 0;">📱 Get Early Access to Our Mobile App!</h3>
      <p style="margin-bottom: 15px;">We're launching the EduDash Pro mobile app soon! To get <strong>early access</strong>, we need your <strong>Google email address</strong> (Gmail) for app testing.</p>
      <p style="margin-bottom: 15px;"><strong>Why Google email?</strong> The app testing platform (Google Play) requires a Gmail address to send you the app before public release.</p>
      <p style="margin-bottom: 0;">
        <strong>Please reply to this email</strong> with your Google/Gmail address, or if you don't have one, let us know and we'll add you when the app goes public.
      </p>
    </div>
    
    <!-- WhatsApp Section -->
    <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #4caf50;">
      <h3 style="color: #2e7d32; margin-top: 0;">💬 Join Our WhatsApp Community!</h3>
      <p style="margin-bottom: 15px;">Stay connected with other parents, get updates, and receive important announcements by joining our WhatsApp group:</p>
      <a href="${WHATSAPP_GROUP_LINK}" style="display: inline-block; background: #25d366; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        �� Join WhatsApp Group
      </a>
    </div>
    
    <!-- What's Next Section -->
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e0e0e0;">
      <h3 style="color: #333; margin-top: 0;">📋 What's Next?</h3>
      <ol style="margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 10px;"><strong>Set your password</strong> using the link in the next email</li>
        <li style="margin-bottom: 10px;"><strong>Reply with your Google email</strong> for early app access</li>
        <li style="margin-bottom: 10px;"><strong>Join our WhatsApp group</strong> for community updates</li>
        <li style="margin-bottom: 0;"><strong>Complete your payment</strong> if not already done</li>
      </ol>
    </div>
    
    <!-- Support -->
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      Questions? Reply to this email or contact us at <a href="mailto:support@edudashpro.org.za" style="color: #667eea;">support@edudashpro.org.za</a>
    </p>
    
    <p style="margin-top: 30px;">
      Warm regards,<br>
      <strong>The EduDash Pro Team</strong> 🌟
    </p>
    
  </div>
  
  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>EduDash Pro Community School Aftercare<br>
    © ${currentYear} EduDash Pro. All rights reserved.</p>
  </div>
  
</body>
</html>`;
}

/**
 * Send welcome email via Resend API
 */
async function sendWelcomeEmail(
  email: string,
  parentName: string,
  childName: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.log('    ⚠️  RESEND_API_KEY not set - skipping welcome email');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const subject = `🎓 Welcome to EduDash Pro Aftercare - ${childName} is registered!`;
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: subject,
        html: generateWelcomeEmailHTML(parentName, childName),
        reply_to: 'support@edudashpro.org.za',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`    ⚠️  Resend API error: ${errorText}`);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log(`    ✅ Welcome email sent (Resend ID: ${result.id})`);
    return { success: true };
  } catch (error: any) {
    console.log(`    ⚠️  Welcome email failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const skipWelcomeEmail = args.includes('--skip-welcome-email');
const specificEmail = args.find(a => a.startsWith('--email='))?.split('=')[1];

async function main() {
  console.log('\n🎓 EduDash Pro - Aftercare Parent Invitation Script');
  console.log('='.repeat(60));

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    console.log('\nSet it with:');
    console.log('  export SUPABASE_SERVICE_ROLE_KEY=REDACTED
    process.exit(1);
  }

  // Create admin client with service role key
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`\n📍 Target School: EduDash Pro Community School (${COMMUNITY_SCHOOL_ID})`);
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No invitations will be sent');
  }
  if (skipWelcomeEmail) {
    console.log('📧 Welcome emails will be skipped');
  }
  if (specificEmail) {
    console.log(`📧 Targeting specific email: ${specificEmail}`);
  }

  // Step 1: Fetch aftercare registrations without linked parent accounts
  console.log('\n📋 Step 1: Fetching aftercare registrations without accounts...');
  
  let query = supabaseAdmin
    .from('aftercare_registrations')
    .select('*')
    .eq('preschool_id', COMMUNITY_SCHOOL_ID)
    .is('parent_user_id', null)
    .not('status', 'eq', 'cancelled');

  if (specificEmail) {
    query = query.eq('parent_email', specificEmail.toLowerCase());
  }

  const { data: registrations, error: fetchError } = await query;

  if (fetchError) {
    console.error('❌ Error fetching registrations:', fetchError.message);
    process.exit(1);
  }

  if (!registrations || registrations.length === 0) {
    console.log('✅ No aftercare parents without accounts found.');
    process.exit(0);
  }

  console.log(`\n📊 Found ${registrations.length} registration(s) without linked accounts:\n`);

  // Display the parents to be invited
  registrations.forEach((reg, idx) => {
    console.log(`  ${idx + 1}. ${reg.parent_first_name} ${reg.parent_last_name}`);
    console.log(`     📧 Email: ${reg.parent_email}`);
    console.log(`     📱 Phone: ${reg.parent_phone}`);
    console.log(`     👶 Child: ${reg.child_first_name} ${reg.child_last_name} (Grade ${reg.child_grade})`);
    console.log(`     💳 Status: ${reg.status}`);
    console.log('');
  });

  if (isDryRun) {
    console.log('🔍 DRY RUN - Would send invitations to the above parents.');
    console.log('   Run without --dry-run to send actual invitations.');
    process.exit(0);
  }

  // Step 2: Check for existing accounts
  console.log('\n📋 Step 2: Checking for existing accounts...');
  
  const emails = registrations.map(r => r.parent_email.toLowerCase());
  const { data: existingProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .in('email', emails);

  const existingEmails = new Set((existingProfiles || []).map(p => p.email?.toLowerCase()));

  // Step 3: Send invitations
  console.log('\n📋 Step 3: Sending invitation emails...\n');
  
  const results: InviteResult[] = [];

  for (const reg of registrations) {
    const email = reg.parent_email.toLowerCase();
    const fullName = `${reg.parent_first_name} ${reg.parent_last_name}`;
    const childFullName = `${reg.child_first_name} ${reg.child_last_name}`;
    
    console.log(`  Processing: ${fullName} <${email}>`);

    // Check if account already exists
    if (existingEmails.has(email)) {
      console.log(`    ⚠️  Account already exists - linking instead`);
      
      // Find existing profile and link it
      const existingProfile = existingProfiles?.find(p => p.email?.toLowerCase() === email);
      if (existingProfile) {
        const { error: linkError } = await supabaseAdmin
          .from('aftercare_registrations')
          .update({ parent_user_id: existingProfile.id })
          .eq('id', reg.id);

        if (linkError) {
          results.push({ email, success: false, error: `Link failed: ${linkError.message}` });
        } else {
          results.push({ email, success: true, userId: existingProfile.id });
          console.log(`    ✅ Linked to existing account: ${existingProfile.id}`);
        }
      }
      continue;
    }

    // Send invitation email using Supabase Auth
    try {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: REDIRECT_URL,
          data: {
            // User metadata that will be available in the auth.users.raw_user_meta_data
            full_name: fullName,
            first_name: reg.parent_first_name,
            last_name: reg.parent_last_name,
            phone: reg.parent_phone,
            role: 'parent',
            organization_id: COMMUNITY_SCHOOL_ID,
            invited_from: 'aftercare_registration',
            aftercare_registration_id: reg.id,
            child_name: childFullName,
          },
        }
      );

      if (inviteError) {
        console.log(`    ❌ Invite failed: ${inviteError.message}`);
        results.push({ email, success: false, error: inviteError.message });
        continue;
      }

      const userId = inviteData.user?.id;
      console.log(`    ✅ Invitation sent! User ID: ${userId}`);

      // Create profile for the new user
      if (userId) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            email: email,
            full_name: fullName,
            first_name: reg.parent_first_name,
            last_name: reg.parent_last_name,
            phone: reg.parent_phone,
            role: 'parent',
            organization_id: COMMUNITY_SCHOOL_ID,
            preschool_id: COMMUNITY_SCHOOL_ID, // Also set preschool_id for compatibility
          });

        if (profileError) {
          console.log(`    ⚠️  Profile creation failed: ${profileError.message}`);
          // Don't fail - user can still sign in and profile can be created on first login
        } else {
          console.log(`    ✅ Profile created`);
        }

        // Link aftercare registration to the new user
        const { error: linkError } = await supabaseAdmin
          .from('aftercare_registrations')
          .update({ parent_user_id: userId })
          .eq('id', reg.id);

        if (linkError) {
          console.log(`    ⚠️  Registration link failed: ${linkError.message}`);
        } else {
          console.log(`    ✅ Registration linked`);
        }

        // Create student record for the child
        const { error: studentError } = await supabaseAdmin
          .from('students')
          .insert({
            first_name: reg.child_first_name,
            last_name: reg.child_last_name,
            date_of_birth: reg.child_date_of_birth || null,
            grade: reg.child_grade,
            preschool_id: COMMUNITY_SCHOOL_ID,
            parent_id: userId,
            guardian_id: userId,
            is_active: true,
            status: 'active',
            medical_conditions: reg.child_medical_conditions || null,
            allergies: reg.child_allergies || null,
            emergency_contact_name: reg.emergency_contact_name,
            emergency_contact_phone: reg.emergency_contact_phone,
            emergency_contact_relation: reg.emergency_contact_relation,
          });

        if (studentError) {
          console.log(`    ⚠️  Student creation failed: ${studentError.message}`);
        } else {
          console.log(`    ✅ Student record created for ${reg.child_first_name}`);
        }

        // Send welcome email with Google email request and WhatsApp link
        let welcomeEmailSent = false;
        if (!skipWelcomeEmail) {
          const welcomeResult = await sendWelcomeEmail(email, reg.parent_first_name, childFullName);
          welcomeEmailSent = welcomeResult.success;
        }

        results.push({ email, success: true, userId, welcomeEmailSent });
      } else {
        results.push({ email, success: true });
      }
    } catch (error: any) {
      console.log(`    ❌ Exception: ${error.message}`);
      results.push({ email, success: false, error: error.message });
    }

    console.log('');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 INVITATION SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const welcomeEmailsSent = results.filter(r => r.welcomeEmailSent).length;
  
  console.log(`\n✅ Successful: ${successful.length}`);
  successful.forEach(r => {
    const emailFlag = r.welcomeEmailSent ? ' 📧' : '';
    console.log(`   - ${r.email} (${r.userId})${emailFlag}`);
  });
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    failed.forEach(r => console.log(`   - ${r.email}: ${r.error}`));
  }

  console.log(`\n📧 Welcome emails sent: ${welcomeEmailsSent}`);

  console.log('\n📧 What happens next:');
  console.log('   1. Parents receive Supabase invitation email to set their password');
  console.log('   2. Parents receive welcome email with Google email request & WhatsApp link');
  console.log('   3. After setting password, they can log in to EduDash Pro');
  
  console.log('\n✨ Done!\n');
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
