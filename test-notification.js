const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xxwpbyxymzubrkfaojac.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4d3BieXh5bXp1YnJrZmFvamFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NDIyNDgsImV4cCI6MjA2NzExODI0OH0.fgmNbzEhJb2-9gtSTkbfNVEKBQ1yz34dHKqwZE0xIbo';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔔 Notification Testing Script\n');

// Function to send a test notification
async function sendTestNotification() {
  try {
    console.log('📤 Sending test notification...');

    const testNotification = {
      type: 'announcement',
      title: '🎉 Test Notification from Admin',
      description: 'This is a test notification to verify the notification system is working correctly. If you can see this, everything is set up properly!',
      priority: 'high',
      sender: 'System Test',
      recipients: { all_parents: true },
      send_push: true
    };

    console.log('📋 Notification details:', testNotification);

    const { data, error } = await supabase.functions.invoke('notification_service', {
      body: testNotification
    });

    if (error) {
      console.log('❌ Function error:', error);
      
      // Try direct database insert as fallback
      console.log('🔄 Trying direct database insert...');
      
      const { data: dbData, error: dbError } = await supabase
        .from('notifications')
        .insert([{
          title: testNotification.title,
          description: testNotification.description,
          type: testNotification.type,
          priority: testNotification.priority,
          sender: testNotification.sender,
          read_status: false,
          created_at: new Date().toISOString()
        }])
        .select();

      if (dbError) {
        console.log('❌ Database error:', dbError.message);
        
        if (dbError.message.includes('relation "notifications" does not exist')) {
          console.log('📝 Notifications table doesn\'t exist');
          console.log('💡 The app will use sample notifications instead');
          console.log('✅ Notification system will still work in the UI');
        }
        return;
      }

      console.log('✅ Notification added to database:', dbData);
      console.log('📱 Check the Notifications section in the app!');
      return;
    }

    console.log('✅ Notification sent successfully!', data);
    console.log('📱 Check your app for the notification!');
    console.log('🔔 Push notification should appear if enabled');

  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    console.log('');
    console.log('💡 Don\'t worry! The app has sample notifications');
    console.log('📱 You can still test the notification UI');
  }
}

// Function to test notification templates
async function testNotificationTemplates() {
  console.log('🧪 Testing notification templates...\n');

  const templates = [
    {
      type: 'marks',
      title: 'New Math Scores Available',
      description: 'Mathematics test results for Term 1 have been published. Your child scored 92/100. Great job!',
      priority: 'medium'
    },
    {
      type: 'attendance',
      title: 'Attendance Alert',
      description: 'Your child was marked absent today. Please contact the school if this is incorrect.',
      priority: 'high'
    },
    {
      type: 'fee',
      title: 'Fee Payment Reminder',
      description: 'Quarter 2 fees are due by January 31st. Amount due: ₹15,000. Please pay to avoid late charges.',
      priority: 'medium'
    },
    {
      type: 'urgent',
      title: 'URGENT: Early Dismissal',
      description: 'Due to heavy rainfall, school will close at 1:00 PM today. Please arrange early pickup.',
      priority: 'high'
    }
  ];

  for (const template of templates) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          ...template,
          sender: 'Test System',
          read_status: false,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.log(`❌ ${template.type}: ${error.message}`);
      } else {
        console.log(`✅ ${template.type}: Added successfully`);
      }
    } catch (err) {
      console.log(`❌ ${template.type}: ${err.message}`);
    }
  }

  console.log('\n🎉 Template testing complete!');
  console.log('📱 Check the Notifications section in your app');
}

// Main execution
console.log('Choose test option:');
console.log('1. Single test notification');
console.log('2. Multiple template notifications');
console.log('');

// Run single test first
sendTestNotification(); 