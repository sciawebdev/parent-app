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

// 🔧 FIREBASE CONFIGURATION
// Set to true to re-enable Firebase and push notifications
// Set to false to prevent app loading hang (current setting)
const FIREBASE_ENABLED = true; // ✅ RE-ENABLED: Loading issue resolved

// ✅ FIREBASE NOW SAFE TO ENABLE
// The loading issue was caused by database schema mismatch, not Firebase
// Firebase initialization is now safe to use without causing app hangs

// DO NOT initialize Firebase immediately - only when needed
// This prevents the app loading hang
let app: any = null;
let messaging: any = null;
let analytics: any = null;

// Lazy initialization function
const initializeFirebaseIfNeeded = () => {
  if (!FIREBASE_ENABLED) {
    console.log('🔔 Firebase initialization disabled to prevent loading hang');
    console.log('ℹ️ To enable: Set FIREBASE_ENABLED=true in src/config/firebase.ts');
    return null;
  }
  
  if (!app) {
    console.log('🔥 Initializing Firebase...');
    try {
      app = initializeApp(firebaseConfig);
      messaging = getMessaging(app);
      analytics = getAnalytics(app);
      console.log('✅ Firebase initialized successfully');
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      return null;
    }
  }
  return { app, messaging, analytics };
};

// Function to request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  try {
    if (!FIREBASE_ENABLED) {
      console.log('🔔 Firebase notifications disabled - skipping permission request');
      console.log('ℹ️ To enable: Set FIREBASE_ENABLED=true in src/config/firebase.ts');
      return null;
    }

    const firebase = initializeFirebaseIfNeeded();
    if (!firebase) {
      console.log('❌ Firebase not available');
      return null;
    }

    // Check if we're in a secure context (HTTPS or localhost)
    if (!('serviceWorker' in navigator)) {
      console.log('Service workers are not supported by this browser');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      
      try {
        // Register service worker for Firebase messaging
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service worker registered successfully');
        
        // Get FCM token with custom service worker
        const token = await getToken(firebase.messaging, {
          vapidKey: 'BLGtuKwdH_LVWmiMB-XQzhN8ZCeBJbgNMcT1Xh4XMmDTwUOrSHGl-9DxVHBNTrKSxchAQUmTQAsMwIJMUNj2YbE',
          serviceWorkerRegistration: registration
        });
        
        if (token) {
          console.log('✅ FCM Token:', token);
          return token;
        } else {
          console.log('❌ No registration token available.');
          return null;
        }
      } catch (swError) {
        console.warn('Service worker registration failed, trying without custom worker:', swError);
        
        // Fallback: try without custom service worker (for development)
        try {
          const token = await getToken(firebase.messaging, {
            vapidKey: 'BLGtuKwdH_LVWmiMB-XQzhN8ZCeBJbgNMcT1Xh4XMmDTwUOrSHGl-9DxVHBNTrKSxchAQUmTQAsMwIJMUNj2YbE'
          });
          
          if (token) {
            console.log('✅ FCM Token (fallback):', token);
            return token;
          }
        } catch (fallbackError) {
          console.log('❌ FCM token generation failed:', fallbackError.message);
          
          // Check if we're in development mode
          if (window.location.hostname === 'localhost' || window.location.protocol === 'http:') {
            console.log('ℹ️ Push notifications require HTTPS in production. Currently in development mode.');
          }
          return null;
        }
      }
    } else {
      console.log('Notification permission denied.');
      return null;
    }
  } catch (error) {
    console.error('An error occurred while retrieving token: ', error);
    return null;
  }
};

// Listen for foreground messages
export const setupForegroundMessageListener = () => {
  if (!FIREBASE_ENABLED) {
    console.log('🔔 Firebase foreground messages disabled');
    console.log('ℹ️ To enable: Set FIREBASE_ENABLED=true in src/config/firebase.ts');
    return;
  }

  const firebase = initializeFirebaseIfNeeded();
  if (!firebase) {
    console.log('❌ Firebase not available for foreground messages');
    return;
  }

  onMessage(firebase.messaging, (payload) => {
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

// Export lazy getters instead of initialized instances
export const getFirebaseApp = () => {
  const firebase = initializeFirebaseIfNeeded();
  return firebase?.app || null;
};

export const getFirebaseMessaging = () => {
  const firebase = initializeFirebaseIfNeeded();
  return firebase?.messaging || null;
};

export const getFirebaseAnalytics = () => {
  const firebase = initializeFirebaseIfNeeded();
  return firebase?.analytics || null;
};

// Export configuration status
export const isFirebaseEnabled = () => FIREBASE_ENABLED; 