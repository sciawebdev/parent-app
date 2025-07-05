const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xxwpbyxymzubrkfaojac.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4d3BieXh5bXp1YnJrZmFvamFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NDIyNDgsImV4cCI6MjA2NzExODI0OH0.fgmNbzEhJb2-9gtSTkbfNVEKBQ1yz34dHKqwZE0xIbo';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔑 Admin Access Grant Script\n');

// Function to grant admin access to a user by email
async function grantAdminAccess(userEmail) {
  try {
    console.log(`🔍 Finding user: ${userEmail}`);

    // Get user from auth.users
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log('❌ Error getting current user:', authError.message);
      console.log('');
      console.log('📝 Manual steps to grant admin access:');
      console.log('1. Tell me your login email');
      console.log('2. I\'ll add you as admin in the database');
      console.log('3. Refresh the app to see Admin Panel');
      return;
    }

    if (!user) {
      console.log('❌ No user currently logged in');
      return;
    }

    const userId = user.id;
    const email = user.email;

    console.log(`✅ Found user: ${email} (ID: ${userId})`);

    // Check if already in teachers table
    const { data: existingTeacher, error: checkError } = await supabase
      .from('teachers')
      .select('id, name, role')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (checkError && !checkError.message.includes('No rows')) {
      throw checkError;
    }

    if (existingTeacher) {
      console.log('👨‍🏫 User already in teachers table:', existingTeacher);
      
      if (existingTeacher.role === 'admin') {
        console.log('✅ User already has admin access!');
        console.log('🔄 Try refreshing the app to see Admin Panel');
        return;
      } else {
        // Update existing record to admin
        const { error: updateError } = await supabase
          .from('teachers')
          .update({ role: 'admin' })
          .eq('auth_user_id', userId);

        if (updateError) throw updateError;
        
        console.log('✅ Updated existing teacher to admin role');
        console.log('🔄 Refresh the app to see Admin Panel');
        return;
      }
    }

    // Add new admin user to teachers table
    const teacherData = {
      auth_user_id: userId,
      name: email.split('@')[0] + ' (Admin)',
      email: email,
      role: 'admin',
      subject: 'Administration',
      phone: '000-000-0000',
      created_at: new Date().toISOString()
    };

    console.log('🏗️ Creating admin record...');

    const { data: newTeacher, error: insertError } = await supabase
      .from('teachers')
      .insert([teacherData])
      .select()
      .single();

    if (insertError) {
      console.log('❌ Error creating admin record:', insertError.message);
      
      // If table doesn't exist, we'll create it
      if (insertError.message.includes('relation "teachers" does not exist')) {
        console.log('📝 Teachers table doesn\'t exist. Creating basic record...');
        
        // Try to create with minimal fields
        const { error: simpleInsertError } = await supabase
          .from('teachers')
          .insert([{
            auth_user_id: userId,
            role: 'admin'
          }]);

        if (simpleInsertError) {
          console.log('❌ Still failed:', simpleInsertError.message);
          console.log('');
          console.log('💡 MANUAL SOLUTION:');
          console.log('1. Your User ID:', userId);
          console.log('2. Your Email:', email);
          console.log('3. I need to manually add this to the database');
          return;
        }
      } else {
        throw insertError;
      }
    }

    console.log('✅ Successfully granted admin access!');
    console.log('📧 Admin Email:', email);
    console.log('🆔 User ID:', userId);
    console.log('');
    console.log('🎉 ADMIN ACCESS GRANTED!');
    console.log('🔄 Refresh your app to see the Admin Panel');
    console.log('🔔 You can now test notifications!');

  } catch (error) {
    console.error('❌ Error granting admin access:', error.message);
    console.log('');
    console.log('📞 Tell me your email and I\'ll add you manually');
  }
}

// Run the script
grantAdminAccess(); 