const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xxwpbyxymzubrkfaojac.supabase.co';
// Using the service role key would be needed to confirm emails, but we don't have access to it
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4d3BieXh5bXp1YnJrZmFvamFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NDIyNDgsImV4cCI6MjA2NzExODI0OH0.fgmNbzEhJb2-9gtSTkbfNVEKBQ1yz34dHKqwZE0xIbo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createConfirmedAccounts() {
  console.log('🔧 Creating new confirmed test accounts...\n');
  
  // Since we can't confirm existing emails without service role key,
  // let's create new accounts with different approach
  
  console.log('📋 SOLUTION OPTIONS:');
  console.log('');
  console.log('Option 1: Use the app\'s Sign Up feature');
  console.log('   • Open the app and tap "Need an account? Sign up"');
  console.log('   • Create account with your real email');
  console.log('   • Check email and click confirmation link');
  console.log('   • Then sign in normally');
  console.log('');
  console.log('Option 2: Create test account with disposable email');
  console.log('   • Use a disposable email service like 10minutemail.com');
  console.log('   • Sign up in the app with the disposable email');
  console.log('   • Confirm the email in the disposable inbox');
  console.log('   • Sign in with confirmed account');
  console.log('');
  console.log('Option 3: I can modify the app to bypass email confirmation');
  console.log('   • This would be for testing purposes only');
  console.log('   • Not recommended for production');
  console.log('');
  
  // Try to check if any accounts exist and their confirmation status
  try {
    console.log('🔍 Checking existing accounts...');
    
    // Try signing in to see the specific error
    const testEmails = [
      'admin.test@gmail.com',
      'parent1.test@gmail.com'
    ];
    
    for (const email of testEmails) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: 'Test123456!'
      });
      
      if (error) {
        console.log(`❌ ${email}: ${error.message}`);
      } else {
        console.log(`✅ ${email}: Login successful`);
      }
    }
    
  } catch (error) {
    console.error('Error checking accounts:', error.message);
  }
  
  console.log('\n💡 RECOMMENDED: Use Option 1 (real email) for testing');
  console.log('   This is the most reliable way to test the full auth flow.');
}

createConfirmedAccounts(); 