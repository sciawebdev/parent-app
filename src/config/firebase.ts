import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBrrueHosiplhO1ulOiWDwoEmiWc64OgSs",
  authDomain: "sca-parent-app.firebaseapp.com",
  projectId: "sca-parent-app",
  storageBucket: "sca-parent-app.firebasestorage.app",
  messagingSenderId: "755833998507",
  appId: "1:755833998507:android:fe955f958cc1f67bb6bbee"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
const messaging = getMessaging(app);

// Initialize Analytics
const analytics = getAnalytics(app);

// Function to request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: 'BLGtuKwdH_LVWmiMB-XQzhN8ZCeBJbgNMcT1Xh4XMmDTwUOrSHGl-9DxVHBNTrKSxchAQUmTQAsMwIJMUNj2YbE ' // Replace with your VAPID key from Firebase Console
      });
      
      if (token) {
        console.log('FCM Token:', token);
        // Send token to your server for storing/targeting
        return token;
      } else {
        console.log('No registration token available.');
      }
    } else {
      console.log('Notification permission denied.');
    }
  } catch (error) {
    console.error('An error occurred while retrieving token. ', error);
  }
};

// Listen for foreground messages
export const setupForegroundMessageListener = () => {
  onMessage(messaging, (payload) => {
    console.log('Message received in foreground: ', payload);
    
    // Show notification or update UI
    if (payload.notification) {
      // You can show a custom notification here
      new Notification(payload.notification.title || 'New Notification', {
        body: payload.notification.body,
        icon: payload.notification.icon
      });
    }
  });
};

export { app, messaging, analytics }; 