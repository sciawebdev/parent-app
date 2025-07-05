import { supabase } from '../supabaseClient'; // Import from centralized client
import { User } from '@supabase/supabase-js';

// Register FCM token for the current user
export async function registerFCM(user: User, isMobile: boolean = false): Promise<void> {
  try {
    console.log('🔔 FCM registration starting...');
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('FCM registration timeout after 10 seconds')), 10000)
    );
    
    const registrationPromise = async () => {
      // Only import Firebase when actually needed
      const { requestNotificationPermission } = await import('../config/firebase');
      
      console.log('🔔 Requesting notification permission...');
      const token = await requestNotificationPermission();
      
      if (!token) {
        console.log('❌ Failed to get FCM token');
        return;
      }

      console.log('✅ FCM token received:', token.substring(0, 20) + '...');

      // Store token in database
      const platform = isMobile ? 'android' : 'web';
      console.log(`💾 Storing FCM token for ${platform}...`);
      
      const { error } = await supabase
        .from('device_tokens')
        .upsert({
          user_id: user.id,
          token: token,
          platform: platform,
          user_type: 'parent', // Explicitly set user_type
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,platform'
        });

      if (error) {
        console.error('❌ Error storing FCM token:', error.message);
        return;
      }

      console.log('✅ FCM token successfully registered and stored');
    };

    // Race the registration against the timeout
    await Promise.race([registrationPromise(), timeoutPromise]);
    
  } catch (error) {
    console.error('❌ FCM registration error (non-critical):', error.message);
    // Don't re-throw - this should not break the app
  }
}

// Send a test notification to verify FCM setup
async function sendTestNotification(supabaseClient: any, userId: string): Promise<void> {
  try {
    console.log('🧪 Sending test notification...');
    
    const { error } = await supabaseClient
      .from('scheduled_notifications')
      .insert({
        user_id: userId,
        title: 'Welcome to SCA Parent App!',
        message: 'Push notifications are now working correctly.',
        type: 'welcome',
        scheduled_for: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Error scheduling test notification:', error.message);
      return;
    }

    console.log('✅ Test notification scheduled successfully');
    
  } catch (error) {
    console.error('❌ Test notification error:', error);
  }
}

// Listen for foreground messages
export async function setupForegroundMessageListener(): Promise<void> {
  try {
    const { setupForegroundMessageListener } = await import('../config/firebase');
    await setupForegroundMessageListener();
    console.log('✅ Foreground message listener setup complete');
  } catch (error) {
    console.error('❌ Error setting up foreground message listener:', error);
  }
} 