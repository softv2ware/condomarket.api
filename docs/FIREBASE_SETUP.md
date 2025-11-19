# Firebase Push Notifications Setup

This guide explains how to set up Firebase Cloud Messaging (FCM) for push notifications in the CondoMarket API.

## Prerequisites

1. A Firebase project (create one at [Firebase Console](https://console.firebase.google.com/))
2. Firebase Admin SDK credentials

## Setup Steps

### 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard to create your project

### 2. Generate Service Account Credentials

1. In your Firebase project, go to **Project Settings** (gear icon)
2. Navigate to the **Service Accounts** tab
3. Click **Generate New Private Key**
4. Save the downloaded JSON file securely (DO NOT commit this to version control)

### 3. Configure Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

**Important Notes:**
- The `FIREBASE_PRIVATE_KEY` must include the full key with newlines (`\n`)
- Keep the quotes around the private key
- Never commit these credentials to version control
- Add `.env.local` to your `.gitignore` file

### 4. Client-Side Integration

Your mobile/web clients need to:

1. **Initialize Firebase** in the client app
2. **Get FCM token** when the app starts or user logs in
3. **Register the token** with the API:

```typescript
// Example client-side code
const fcmToken = await messaging.getToken();

// Register with API
await fetch('/api/notifications/devices', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token: fcmToken,
    deviceType: 'ios', // or 'android', 'web'
    deviceName: 'iPhone 13 Pro',
  }),
});
```

4. **Handle token refresh** and update the API when the token changes

## API Endpoints

### Device Management

#### Register Device Token
```http
POST /notifications/devices
Authorization: Bearer {token}
Content-Type: application/json

{
  "token": "FCM_DEVICE_TOKEN",
  "deviceType": "ios",
  "deviceName": "iPhone 13 Pro"
}
```

#### Get User's Devices
```http
GET /notifications/devices
Authorization: Bearer {token}
```

#### Unregister Device Token
```http
DELETE /notifications/devices/{token}
Authorization: Bearer {token}
```

### Notification Preferences

Users can control which notification types they receive via push:

```http
PATCH /notifications/preferences
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "ORDER_PLACED",
  "channel": "PUSH",
  "enabled": false
}
```

## How It Works

1. **Notification Creation**: When a notification is created via `NotificationsService.create()`, the service:
   - Checks user preferences for the notification type
   - Filters enabled channels (IN_APP, EMAIL, PUSH)
   - If PUSH is enabled, retrieves all user's registered device tokens
   - Sends push notifications to all devices via Firebase

2. **Automatic Sending**: Push notifications are sent automatically when:
   - Orders are placed/confirmed/completed
   - Bookings are requested/confirmed
   - Chat messages are received
   - Reviews are posted
   - Any system notification is created

3. **Multi-Device Support**: Users can register multiple devices (phone, tablet, web) and receive notifications on all of them.

## Testing Push Notifications

### 1. Manual Test via API

```http
POST /notifications
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "userId": "user-id-to-notify",
  "type": "SYSTEM_ANNOUNCEMENT",
  "title": "Test Notification",
  "message": "This is a test push notification",
  "channels": ["PUSH"],
  "data": {
    "customField": "customValue"
  }
}
```

### 2. Verify in Logs

Check the application logs for:
```
[FirebaseService] Push notification sent successfully to token: xxxxx...
[NotificationsService] Push notification sent to user xxx: 1 succeeded, 0 failed
```

### 3. Client-Side Verification

Ensure your client app:
- Has proper FCM configuration
- Requests notification permissions
- Handles incoming messages
- Displays notifications correctly

## Platform-Specific Setup

### iOS (APNs)
1. Upload your APNs authentication key to Firebase Console
2. Configure your iOS app with the appropriate bundle ID
3. Request notification permissions in your app

### Android (FCM)
1. Add `google-services.json` to your Android app
2. Configure Firebase in your `build.gradle`
3. Request notification permissions in your app

### Web (FCM)
1. Add `firebase-messaging-sw.js` service worker
2. Configure `vapidKey` in your web app
3. Request notification permissions from the browser

## Troubleshooting

### Push notifications not sending

1. **Check Firebase credentials**: Verify environment variables are set correctly
2. **Check device tokens**: Ensure devices are registered (`GET /notifications/devices`)
3. **Check user preferences**: Verify PUSH channel is enabled for the notification type
4. **Check logs**: Look for errors in application logs
5. **Verify Firebase project**: Ensure FCM is enabled in Firebase Console

### Invalid token errors

- Token may have expired or been revoked
- User may have uninstalled the app
- Token may have been refreshed on the client side
- The service automatically logs invalid tokens for debugging

### No notifications received on client

1. **Check permissions**: Ensure app has notification permissions
2. **Check FCM configuration**: Verify client-side Firebase setup
3. **Check foreground/background**: Test both app states
4. **Check notification handling**: Ensure client handles incoming messages

## Security Best Practices

1. **Never commit credentials**: Keep Firebase credentials in `.env.local` only
2. **Rotate keys regularly**: Generate new service account keys periodically
3. **Limit token access**: Only authenticated users can register their own tokens
4. **Validate tokens**: The API validates token ownership before deletion
5. **Use HTTPS**: Always use secure connections for API calls

## Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [FCM Architecture Overview](https://firebase.google.com/docs/cloud-messaging/server)
- [Best Practices for FCM](https://firebase.google.com/docs/cloud-messaging/concept-options)
