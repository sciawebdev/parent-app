# SCA Parent Communication App - Signed APK Installation Guide

## 📱 **APK File Details**

- **File Name**: `SCA-Parent-App-Signed.apk`
- **Size**: 6.4 MB (6,743,678 bytes)
- **Build Date**: July 6, 2025
- **Version**: 1.0
- **Package ID**: `com.saratchandra.scaparentapp`

## 🔐 **Signing Information**

- **Keystore**: `sca-parent-app.keystore`
- **Key Alias**: `sca-parent-app`
- **Certificate**: RSA 2048-bit
- **Validity**: 10,000 days (until ~2052)

## 📋 **Installation Instructions**

### For Android Devices:

1. **Enable Unknown Sources** (if not already enabled):
   - Go to Settings → Security → Unknown Sources
   - Enable "Allow installation of apps from unknown sources"

2. **Install the APK**:
   - Transfer `SCA-Parent-App-Signed.apk` to your Android device
   - Open the file using a file manager
   - Tap "Install" when prompted
   - Follow the on-screen instructions

3. **First Launch**:
   - Open the SCA Parent App
   - Grant necessary permissions when prompted:
     - Internet access
     - Push notifications
     - Storage (if needed)

### For Distribution:

- **Direct Share**: Send the APK file via email, cloud storage, or messaging apps
- **QR Code**: Generate a QR code linking to the APK file for easy download
- **Web Download**: Host the APK on a web server for direct download

## ⚠️ **Important Notes**

1. **Security**: This APK is signed with a development certificate. For production distribution, consider using a proper release certificate.

2. **Permissions**: The app requires:
   - Internet access (for API calls and push notifications)
   - Push notification permissions
   - Storage access (for caching)

3. **Compatibility**: 
   - Minimum Android version: API 22 (Android 5.1)
   - Target Android version: API 34 (Android 14)
   - Tested on: Moto g82 (API 33)

4. **Features Included**:
   - ✅ Push notifications (FCM)
   - ✅ User authentication
   - ✅ Dashboard with marks and attendance
   - ✅ Calendar view
   - ✅ Admin console
   - ✅ CSV import functionality

## 🔧 **Troubleshooting**

### Installation Issues:
- **"App not installed"**: Check if Unknown Sources is enabled
- **"Parse error"**: Ensure the APK file is not corrupted
- **"Insufficient storage"**: Free up space on device

### App Issues:
- **No notifications**: Check notification permissions in device settings
- **Login problems**: Verify internet connection and server status
- **App crashes**: Clear app data and cache, then reinstall

## 📞 **Support**

For technical support or issues with the app, contact the development team.

---

**Generated**: July 6, 2025  
**Build Environment**: Windows 10, Capacitor 7, Android Gradle Plugin 