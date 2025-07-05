import { requestNotificationPermission } from '../config/firebase';

// Register FCM token for current user
export async function registerFCMToken(supabaseClient: any): Promise<void> {
  try {
    console.log('🔔 Registering FCM token...');
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      console.log('❌ No authenticated user found');
      return;
    }

    // Request notification permission and get FCM token
    const token = await requestNotificationPermission();
    
    if (!token) {
      console.log('❌ No FCM token received');
      return;
    }

    console.log('✅ FCM Token received:', token);

    // Store token in database
    const { error } = await supabaseClient
      .from('device_tokens')
      .upsert({
        user_id: user.id,
        device_token: token,
        device_type: 'web',
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,device_type'
      });

    if (error) {
      console.log('❌ Error storing FCM token:', error.message);
      
      // Even if database storage fails, the token is still valid for Firebase Console testing
      console.log('💡 Token is still valid for testing via Firebase Console');
      console.log('🔑 Your FCM token:', token);
    } else {
      console.log('✅ FCM token stored successfully');
      console.log('🎉 Push notifications are now enabled!');
    }
    
  } catch (error) {
    console.error('❌ Error registering FCM token:', error);
    console.log('💡 This might be due to missing VAPID key or browser permissions');
  }
}

// Function to manually copy FCM token for testing
export async function copyFCMTokenForTesting(): Promise<string | null> {
  try {
    const token = await requestNotificationPermission();
    if (token) {
      console.log('🔑 FCM Token for testing:', token);
      
      // Try to copy to clipboard if available
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(token);
        console.log('📋 Token copied to clipboard!');
      }
      
      return token;
    }
    return null;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
} 