/**
 * Debug Script: Find User by Email Pattern
 * 
 * Searches for users matching a pattern
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findUser() {
  console.log('🔍 Searching for users with "katso" or "youngeagles" in email...\n');

  const { data: authUsers, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }

  // Search for katso or youngeagles
  const matches = authUsers.users.filter(u => 
    u.email?.toLowerCase().includes('katso') || 
    u.email?.toLowerCase().includes('youngeagle') ||
    u.email?.toLowerCase().includes('young')
  );

  if (matches.length === 0) {
    console.log('No users found matching "katso" or "youngeagles"');
    
    // List all users for reference
    console.log('\n📋 All users in the system:');
    authUsers.users.forEach(u => {
      console.log(`   - ${u.email} (${u.id.slice(0,8)}...)`);
    });
  } else {
    console.log(`Found ${matches.length} matching users:`);
    matches.forEach(u => {
      console.log(`   - ${u.email}`);
      console.log(`     ID: ${u.id}`);
      console.log(`     Created: ${u.created_at}`);
      console.log(`     Last sign in: ${u.last_sign_in_at || 'Never'}`);
      console.log('');
    });
  }

  // Also check profiles table
  console.log('\n📋 Checking profiles table for similar patterns...');
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, preschool_id, organization_id')
    .or('email.ilike.%katso%,email.ilike.%youngeagle%,full_name.ilike.%katso%');

  if (pError) {
    console.error('Profile search error:', pError.message);
  } else if (profiles && profiles.length > 0) {
    console.log(`Found ${profiles.length} matching profiles:`);
    profiles.forEach((p: any) => {
      console.log(`   - ${p.email || 'No email'} | ${p.full_name || 'No name'}`);
      console.log(`     Role: ${p.role}, Preschool: ${p.preschool_id?.slice(0,8) || 'None'}...`);
    });
  } else {
    console.log('No matching profiles found');
  }

  // Check preschools for "youngeagles"
  console.log('\n📋 Checking for "Young Eagles" preschool...');
  const { data: preschools, error: psError } = await supabase
    .from('preschools')
    .select('id, name, status')
    .ilike('name', '%young%');

  if (psError) {
    console.error('Preschool search error:', psError.message);
  } else if (preschools && preschools.length > 0) {
    console.log(`Found ${preschools.length} matching preschools:`);
    for (const ps of preschools) {
      console.log(`   - ${ps.name} (${ps.id})`);
      console.log(`     Status: ${ps.status || 'Not set'}`);
      
      // Get teachers at this preschool
      const { data: teachers } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('preschool_id', ps.id)
        .eq('role', 'teacher');
      
      if (teachers && teachers.length > 0) {
        console.log(`     Teachers at this preschool:`);
        teachers.forEach((t: any) => {
          console.log(`       - ${t.email} (${t.full_name || 'No name'})`);
        });
      }
    }
  } else {
    console.log('No "Young Eagles" preschool found');
    
    // List all preschools
    const { data: allPs } = await supabase
      .from('preschools')
      .select('id, name');
    
    console.log('\n   All preschools:');
    allPs?.forEach((ps: any) => {
      console.log(`   - ${ps.name}`);
    });
  }
}

findUser().catch(console.error);
