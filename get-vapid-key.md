# 🔑 Get VAPID Key from Firebase Console

## 📋 **Quick Steps:**

1. **🌐 Open Firebase Console:**
   ```
   https://console.firebase.google.com/project/sca-parent-app/settings/cloudmessaging
   ```

2. **📍 Find "Web configuration" section**
   - Scroll down on the Cloud Messaging page
   - Look for "Web configuration" section

3. **🔧 Generate Key Pair:**
   - Click "Generate key pair" button
   - Copy the generated key (starts with "B...")
   - This is your VAPID key!

4. **📝 Update Firebase Config:**
   - Open: `src/config/firebase.ts`
   - Find line: `vapidKey: 'your-vapid-key'`
   - Replace with: `vapidKey: 'YOUR_ACTUAL_VAPID_KEY'`

5. **🔄 Rebuild & Deploy:**
   ```bash
   npm run build
   npx cap run android --target ZD2228FJT5
   ```

## 🎯 **What Will Happen:**
- ✅ App will request notification permissions
- ✅ FCM token will be generated and logged
- ✅ Push notifications will work!
- ✅ You can test via Firebase Console

## 💡 **Alternative Testing:**
- Even without VAPID key, in-app notifications work perfectly
- You can use Firebase Console with device FCM token for testing 