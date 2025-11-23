#!/usr/bin/env node

/**
 * Send parent approval email via web API
 * This uses the Next.js API route instead of direct Supabase access
 */

async function main() {
  const email = process.argv[2] || 'dipsroboticsgm@gmail.com';
  
  console.log(`📧 Sending parent approval email to: ${email}\n`);

  // Assuming web app is running on localhost:3000
  const apiUrl = 'http://localhost:3000/api/send-parent-approval-email';
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Failed:', result.error || 'Unknown error');
      process.exit(1);
    }

    console.log('✅ Success!', result.message);
    if (result.details) {
      console.log('\nDetails:', JSON.stringify(result.details, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the web app is running on http://localhost:3000');
    process.exit(1);
  }
}

main();
