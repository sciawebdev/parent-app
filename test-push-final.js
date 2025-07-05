const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xxwpbyxymzubrkfaojac.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4d3BieXh5bXp1YnJrZmFvamFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NDIyNDgsImV4cCI6MjA2NzExODI0OH0.fgmNbzEhJb2-9gtSTkbfNVEKBQ1yz34dHKqwZE0xIbo';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧪 FINAL PUSH NOTIFICATION TEST');
console.log('=================================\n');

async function testPushNotifications() {
  try {
    console.log('📋 Test 1: Create High-Priority Notification');
    
    const testNotification = {
      type: 'alert',
      title: '🚨 PUSH TEST: Emergency Alert',
      description: 'If you receive this as a PUSH notification (outside the app), then push notifications are working perfectly! 🎉',
      priority: 'high'
    };

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert(testNotification)
      .select()
      .single();

    if (error) {
      console.log('❌ Error creating notification:', error);
      return;
    }

    console.log('✅ Notification created successfully!');
    console.log('📋 Notification ID:', notification.id);
    console.log('🎯 Title:', notification.title);
    console.log('📝 Description:', notification.description);
    console.log('⚡ Priority:', notification.priority);
    
    console.log('\n🔔 TESTING INSTRUCTIONS:');
    console.log('========================');
    console.log('1. 📱 Check your Android device NOW');
    console.log('2. 🔍 Look for a push notification in the notification panel');
    console.log('3. 📢 Should see: "🚨 PUSH TEST: Emergency Alert"');
    console.log('4. 🎉 If you see it → PUSH NOTIFICATIONS WORKING!');
    console.log('5. ❌ If not visible → Check steps below');
    
    console.log('\n🛠️ TROUBLESHOOTING:');
    console.log('===================');
    console.log('• Check if app is running in foreground (close app first)');
    console.log('• Verify notification permissions are enabled');
    console.log('• Check device notification settings');
    console.log('• Look in app for FCM token in console log');
    
    console.log('\n📊 Test completed at:', new Date().toLocaleString());
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testPushNotifications(); 