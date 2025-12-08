import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read service role key from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const serviceKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const serviceKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : null;

if (!serviceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabaseUrl = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const email = 'relebogilekgobe55@gmail.com';
const newPassword = 'Relebogile123@';

console.log(`🔐 Resetting password for: ${email}`);

// Get user
const { data: users, error: fetchError } = await supabase.auth.admin.listUsers();

if (fetchError) {
  console.error('❌ Error fetching users:', fetchError);
  process.exit(1);
}

const user = users.users.find(u => u.email === email);

if (!user) {
  console.error(`❌ User not found: ${email}`);
  process.exit(1);
}

console.log(`✅ Found user: ${user.id}`);

// Update password
const { data, error } = await supabase.auth.admin.updateUserById(
  user.id,
  { password: newPassword }
);

if (error) {
  console.error('❌ Error updating password:', error);
  process.exit(1);
}

console.log('✅ Password updated successfully!');
console.log(`📧 Email: ${email}`);
console.log(`🔑 New password: ${newPassword}`);
