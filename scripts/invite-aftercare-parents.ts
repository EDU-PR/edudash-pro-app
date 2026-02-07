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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const COMMUNITY_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

// Redirect URL for after password is set - points to parent sign-up completion
const REDIRECT_URL = 'https://www.edudashpro.org.za/landing?flow=password-set&redirect=/dashboard/parent';

// WhatsApp Group Link for EduDash Pro Community
const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/FQVPXqY6daRLIonPjQqZTv';

// Email sender
const FROM_EMAIL = 'EduDash Pro <support@edudashpro.org.za>';
const SUPPORT_EMAIL = 'support@edudashpro.org.za';

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

function renderBrandedEmail(options: {
  title: string;
  subtitle?: string;
  preheader?: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  secondaryCta?: { label: string; url: string };
}) {
  const preheader = options.preheader || options.title;
  const subtitle = options.subtitle
    ? `<p style="margin:0 0 16px 0;color:#475569;font-size:15px;line-height:1.6;">${options.subtitle}</p>`
    : '';
  const ctaHtml = options.cta
    ? `<div style="padding:8px 0 4px 0;">
        <a href="${options.cta.url}" style="display:inline-block;background:#00c4d6;color:#001018;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:14px;">
          ${options.cta.label}
        </a>
      </div>`
    : '';
  const secondaryCtaHtml = options.secondaryCta
    ? `<div style="padding-top:6px;">
        <a href="${options.secondaryCta.url}" style="color:#0ea5e9;text-decoration:none;font-weight:600;font-size:14px;">
          ${options.secondaryCta.label}
        </a>
      </div>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${options.title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#eef2f7;color:#0f172a;">
    <div style="display:none;font-size:1px;color:#eef2f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#eef2f7;padding:20px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#0b1220;padding:24px 32px;">
                <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.2px;">EduDash Pro</div>
                <div style="margin-top:6px;color:#94a3b8;font-size:12px;letter-spacing:0.5px;">AI-powered education platform</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#0f172a;">${options.title}</h1>
                ${subtitle}
                <div style="color:#334155;font-size:15px;line-height:1.7;">${options.bodyHtml}</div>
                ${ctaHtml}
                ${secondaryCtaHtml}
                <div style="margin-top:24px;padding:14px 16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                  <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">
                    Need help? Reply to this email or contact us at
                    <a href="mailto:${SUPPORT_EMAIL}" style="color:#0ea5e9;text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#0f172a;padding:16px 24px;text-align:center;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} EduDash Pro. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Generate the welcome email HTML with Google email request and WhatsApp link
 */
function generateWelcomeEmailHTML(parentName: string, childName: string): string {
  const bodyHtml = `
<p>Hi ${parentName},</p>
<p>Thank you for registering <strong>${childName}</strong> for our aftercare program. We're excited to have your family join our community.</p>
<p>You will receive a separate email with a link to set your password and access your parent dashboard.</p>
<div style="background:#e3f2fd;border:1px solid #bfdbfe;border-radius:10px;padding:14px;margin:14px 0;">
  <p style="margin:0;color:#1e40af;"><strong>Early access request:</strong> Reply with your Gmail address so we can add you to Google Play testing.</p>
</div>
<p>Stay connected by joining the WhatsApp community.</p>
<p><strong>What’s next:</strong></p>
<ul style="margin:0 0 0 18px;padding:0;color:#475569;">
  <li>Set your password using the next email.</li>
  <li>Reply with your Gmail address for early access.</li>
  <li>Join the WhatsApp group for announcements.</li>
  <li>Complete payment if not already done.</li>
</ul>
  `.trim();

  return renderBrandedEmail({
    title: 'Welcome to EduDash Pro Aftercare',
    subtitle: `${childName} is registered`,
    preheader: 'Set your password and join the community',
    bodyHtml,
    cta: { label: 'Join WhatsApp Group', url: WHATSAPP_GROUP_LINK },
    secondaryCta: { label: 'Open EduDash Pro', url: 'https://www.edudashpro.org.za/sign-in' },
  });
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
    console.log('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
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
