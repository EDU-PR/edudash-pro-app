const { createClient } = require('@supabase/supabase-js');

// Populate profiles table with sample data based on screenshots
async function populateProfiles() {
  const supabase = createClient(
    'https://lvvvjywrmpcqrpvuptdi.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzc4MzgsImV4cCI6MjA2ODYxMzgzOH0.mjXejyRHPzEJfMlhW46TlYI0qw9mtoSRJZhGsCkuvd8'
  );

  // Real profiles from your database
  const profiles = [
    {
      id: '19583dad-a4ee-42f1-8354-5e80bf090031',
      auth_user_id: 'a661cc72-98ae-4256-973f-4e476cd9f33d',
      email: 'king@youngeagles.org.za',
      first_name: 'Marrion',
      last_name: 'Makunyane',
      role: 'teacher',
      preschool_id: 'ba79097c-1b93-4b48-bcbe-df73878ab4d1',
      is_active: true,
      created_at: '2025-08-27T12:27:10.427314+00:00',
      updated_at: '2025-08-27T12:27:11.431044+00:00',
      last_login_at: '2025-08-27T12:27:11.431044+00:00'
    },
    {
      id: '32cce26f-c10f-4af4-8fb4-f77010755a1a',
      auth_user_id: '9bcfef71-5195-4156-89bb-d05eb62009ce',
      email: 'admin@youngeagles.org.za',
      first_name: 'Test',
      last_name: 'Parent',
      role: 'parent',
      preschool_id: 'ba79097c-1b93-4b48-bcbe-df73878ab4d1',
      is_active: true,
      created_at: '2025-08-30T17:03:32.988979+00:00',
      updated_at: '2025-08-30T17:03:33.401035+00:00',
      last_login_at: '2025-08-30T17:03:33.401035+00:00'
    },
    {
      id: '3884c8fd-ea74-43cd-bce6-6d0fbcd24110',
      auth_user_id: '77ebd134-e616-4011-bcf2-ccbe9751912a',
      email: 'elsha.pp91@gmail.com',
      first_name: 'Reeri',
      last_name: 'Anderson',
      role: 'principal',
      preschool_id: '2c37b53d-9092-46a2-955e-6f657368a756',
      is_active: true,
      created_at: '2025-09-01T22:42:04.971578+00:00',
      updated_at: '2025-09-01T22:42:05.170403+00:00',
      last_login_at: '2025-09-01T22:42:05.170403+00:00'
    },
    {
      id: '3bd86a31-7e78-4075-9d01-9e7606723dea',
      auth_user_id: '136cf31c-b37c-45c0-9cf7-755bd1b9afbf',
      email: 'elsha@youngeagles.org.za',
      first_name: 'Precious',
      last_name: 'Makunyane',
      role: 'principal',
      preschool_id: 'ba79097c-1b93-4b48-bcbe-df73878ab4d1',
      is_active: true,
      created_at: '2025-08-25T16:08:27.309991+00:00',
      updated_at: '2025-08-25T16:08:27.766491+00:00',
      last_login_at: '2025-08-25T16:08:27.766491+00:00'
    },
    {
      id: '48f8086a-3c88-44a2-adcd-570d97d3a580',
      auth_user_id: 'a1fd12d2-5f09-4a23-822d-f3071bfc544b', // This matches your log user ID!
      email: 'katso@youngeagles.org.za',
      first_name: 'Dimakatso',
      last_name: 'Mogashoa',
      role: 'teacher',
      preschool_id: 'ba79097c-1b93-4b48-bcbe-df73878ab4d1',
      is_active: true,
      created_at: '2025-08-26T11:57:03.259179+00:00',
      updated_at: '2025-08-26T11:57:04.292707+00:00',
      last_login_at: '2025-08-26T11:57:04.292707+00:00'
    },
    {
      id: 'bc427a5b-82b3-43dd-b095-0561b2ce8ee0',
      auth_user_id: 'b345de36-e132-4ce2-b3b5-32e7a2cf6558',
      email: 'zanele@edudashpro.org.za',
      first_name: 'Zanele',
      last_name: 'Maks',
      role: 'teacher',
      preschool_id: null,
      is_active: true,
      created_at: '2025-08-26T23:16:43.589525+00:00',
      updated_at: '2025-08-26T23:16:43.589525+00:00',
      last_login_at: '2025-08-26T23:16:43.589525+00:00'
    },
    {
      id: 'd0b2ab3a-4c60-4534-aaaf-5a67caa3b8ce',
      auth_user_id: 'd2df36d4-74bc-4ffb-883b-036754764265',
      email: 'superadmin@edudashpro.org.za',
      first_name: 'EduDash',
      last_name: 'Super Administrator',
      role: 'superadmin',
      preschool_id: null,
      is_active: true,
      created_at: '2025-08-25T10:41:08.817746+00:00',
      updated_at: '2025-08-26T17:29:41.350043+00:00',
      last_login_at: '2025-08-26T17:29:41.350043+00:00'
    }
  ];

  console.log('Attempting to insert profiles...');

  for (const profile of profiles) {
    console.log(`Inserting profile for ${profile.email}...`);
    
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profile, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error(`Error inserting ${profile.email}:`, _error);
    } else {
      console.log(`Successfully inserted ${profile.email}`);
    }
  }

  console.log('Finished populating profiles.');
  
  // Test the get_my_profile function
  console.log('\nTesting get_my_profile after population...');
  const { data: testProfile, error: testError } = await supabase
    .rpc('get_my_profile');
  
  console.log('Test result:', testProfile, 'Error:', testError);
}

populateProfiles().catch(console.error);
