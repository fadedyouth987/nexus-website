const { createClient } = require('@supabase/supabase-js');

async function verifyUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Fetching users to verify...');
  const { data: users, error: fetchError } = await supabase.from('blueprint_users').select('id, email, plan, age_verified_at');
  
  if (fetchError || !users) {
    console.error('Failed to fetch users', fetchError);
    return;
  }

  for (const user of users) {
    const { error: updateError } = await supabase
      .from('blueprint_users')
      .update({
        plan: 'VAULT',
        age_verified_at: new Date().toISOString(),
        age_verification_method: 'SELF_ATTESTED'
      })
      .eq('id', user.id);
      
    if (updateError) {
      console.error(`Failed to update ${user.email}`, updateError);
    } else {
      console.log(`Updated ${user.email} -> VAULT + Age Verified!`);
    }
  }
}

verifyUser();
