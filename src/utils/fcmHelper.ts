import { supabase } from '../supabaseClient'; // Import from centralized client
import { User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

// Register FCM token for the current user
export async function registerFCM(user: User, isMobile: boolean = false): Promise<void> {
  try {
    console.log('🔔 FCM registration starting...');
    
    // Detect platform: use native plugin on Android/iOS, fallback to web implementation otherwise
    const platform = Capacitor.getPlatform();
    const useNative = platform === 'android' || platform === 'ios';

    if (useNative) {
      // 🟢 Native path using Capacitor Firebase Messaging
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

      // Request permission (Android 13+)
      const permStatus = await FirebaseMessaging.requestPermissions();
      if (permStatus.receive !== 'granted') {
        console.log('❌ Native FCM permission not granted');
        return;
      }

      // Get token from the native layer
      const { token } = await FirebaseMessaging.getToken();
      if (!token) {
        console.log('❌ Failed to obtain native FCM token');
        return;
      }

      console.log('✅ Native FCM token received:', token.substring(0, 20) + '...');

      // Store token in DB (upsert keeps single record per user & platform)
      await supabase
        .from('device_tokens')
        .upsert({
          user_id: user.id,
          token,
          platform,
          user_type: 'parent',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id, platform' });

      // Optional: foreground listener so notifications arrive while app open
      FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
        console.log('📨 Foreground notification:', notification);
      });

      console.log('✅ Native FCM token stored successfully');
      return; // finished native path ✅
    }

    // 🟡 Web fallback (existing logic)
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
          onConflict: 'user_id, platform'
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
export async function sendTestNotification(supabaseClient: any): Promise<void> {
  try {
    console.log('🧪 Sending test notification...');
    
    const { data, error } = await supabaseClient.functions.invoke('schedule_notifications', {
      body: {
        title: 'Welcome to SCA Parent App!',
        message: 'Push notifications are now working correctly.',
        type: 'announcement', // Ensure this is a valid type in your system
        // recipients logic is handled inside the edge function for 'all parents'
      }
    });

    if (error) {
      console.error('❌ Error invoking test notification function:', error.message);
      return;
    }

    console.log('✅ Test notification function invoked successfully:', data);
    
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