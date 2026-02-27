# APNs Push Notification Configuration Guide

## Overview

This document provides comprehensive guidance for configuring Apple Push Notification service (APNs) for the TRIX 3D Companion app.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Certificate Setup](#certificate-setup)
3. [Environment Configuration](#environment-configuration)
4. [Payload Templates](#payload-templates)
5. [Backend Integration](#backend-integration)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts & Access

- Apple Developer Program membership (paid)
- Access to [Apple Developer Portal](https://developer.apple.com)
- Team Agent or Admin role for certificate creation
- Backend server with APNs support

### Development Tools

- macOS with Xcode 15+
- OpenSSL (for certificate conversion)
- Push notification testing tool (e.g., Pusher, Knuff)

---

## Certificate Setup

### Step 1: Create App ID with Push Notification Capability

1. Navigate to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list)
2. Create new App ID or edit existing one:
   - **Bundle ID**: `com.trix3d.companion` (match your app's bundle identifier)
   - **Capabilities**: Enable "Push Notifications"
   - Click "Continue" and "Register"

### Step 2: Create APNs Certificates

#### Development Certificate (Sandbox)

1. Go to **Certificates** → **All**
2. Click "+" to create new certificate
3. Select **Apple Push Notification service SSL (Sandbox)**
4. Choose your App ID: `com.trix3d.companion`
5. Follow CSR (Certificate Signing Request) generation instructions:
   ```bash
   # Generate CSR using Keychain Access on macOS
   # Or use OpenSSL:
   openssl req -new -newkey rsa:2048 -nodes \
     -keyout apns_dev.key \
     -out apns_dev.csr \
     -subj "/emailAddress=dev@trix3d.com/CN=TRIX 3D Development/O=TRIX/C=CN"
   ```
6. Upload CSR and download certificate: `aps_development.cer`

#### Production Certificate

1. Repeat steps above for **Apple Push Notification service SSL (Production)**
2. Download: `aps_production.cer`

### Step 3: Convert Certificates to PEM Format

```bash
# Development Certificate
openssl x509 -in aps_development.cer -inform DER -out apns_dev_cert.pem -outform PEM
openssl pkcs12 -nocerts -out apns_dev_key.pem -in apns_dev.p12
cat apns_dev_cert.pem apns_dev_key.pem > apns_dev.pem

# Production Certificate
openssl x509 -in aps_production.cer -inform DER -out apns_prod_cert.pem -outform PEM
openssl pkcs12 -nocerts -out apns_prod_key.pem -in apns_prod.p12
cat apns_prod_cert.pem apns_prod_key.pem > apns_prod.pem
```

### Step 4: Store Certificates Securely

**CRITICAL SECURITY NOTES:**
- Never commit `.pem` or `.p12` files to version control
- Store certificates in secure key management system (AWS Secrets Manager, Azure Key Vault)
- Use environment variables or secret injection for backend deployment
- Rotate certificates annually (they expire after 1 year)

---

## Environment Configuration

### Development Environment

**APNs Server**: `api.sandbox.push.apple.com:443`

**Configuration File**: `apns-config.json` (see this file for details)

### Production Environment

**APNs Server**: `api.push.apple.com:443`

**Configuration File**: `apns-config.json` (see this file for details)

---

## Payload Templates

### Standard Notification

```json
{
  "aps": {
    "alert": {
      "title": "New Message",
      "body": "You have a new message from your study partner",
      "sound": "default"
    },
    "badge": 1
  }
}
```

### Silent Notification (Background Sync)

```json
{
  "aps": {
    "content-available": 1
  },
  "data": {
    "action": "sync_messages",
    "timestamp": "2026-02-27T12:00:00Z"
  }
}
```

### Rich Notification (with Image/Media)

```json
{
  "aps": {
    "alert": {
      "title": "Study Invitation",
      "body": "Alice invited you to join 'iOS Development Study Group'"
    },
    "sound": "default",
    "badge": 3,
    "mutable-content": 1,
    "category": "INVITATION"
  },
  "media-url": "https://api.trix3d.com/media/invite-image.jpg",
  "data": {
    "type": "study_invitation",
    "group_id": "group_123456",
    "sender_id": "user_789"
  }
}
```

### Location-Based Notification

```json
{
  "aps": {
    "alert": {
      "title": "Nearby Study Spot",
      "body": "A friend is studying at Starbucks - Main St"
    },
    "sound": "default",
    "badge": 1
  },
  "data": {
    "type": "location_share",
    "latitude": 39.9042,
    "longitude": 116.4074,
    "location_name": "Starbucks - Main St"
  }
}
```

### Actionable Notification

```json
{
  "aps": {
    "alert": {
      "title": "Friend Request",
      "body": "Bob wants to connect with you"
    },
    "sound": "default",
    "category": "FRIEND_REQUEST"
  },
  "data": {
    "type": "friend_request",
    "request_id": "req_123456",
    "user_id": "user_bob_789"
  }
}
```

**Note**: Notification categories must be registered in `AppDelegate.swift` with corresponding actions.

---

## Backend Integration

### APNs Protocol

**Recommended**: Use HTTP/2-based APNs Provider API (Token-based authentication)

#### Token-Based Authentication (Preferred)

**Advantages**:
- No certificate expiration management
- Stateless authentication
- Better performance

**Setup**:
1. Create APNs Key (.p8) in Apple Developer Portal
2. Key ID: 10-character identifier (e.g., `ABC12DEF34`)
3. Team ID: Your Apple Developer Team ID (e.g., `XYZ12ABC34`)
4. Store `.p8` file securely on backend

**Backend Implementation** (Pseudo-code):

```python
# Python example using apns2 library
from apns2.client import APNsClient
from apns2.payload import Payload

# Initialize client with .p8 key
client = APNsClient(
    key='/path/to/AuthKey_ABC12DEF34.p8',
    key_id='ABC12DEF34',
    team_id='XYZ12ABC34',
    topic='com.trix3d.companion',
    use_sandbox=False  # True for development
)

# Send notification
payload = Payload(
    alert="You have a new message",
    sound="default",
    badge=1
)

client.send_notification(
    device_token='user_device_token_here',
    payload=payload
)
```

#### Certificate-Based Authentication

**Legacy approach** - uses `.pem` certificates generated in Step 3.

```python
# Certificate-based authentication
client = APNsClient(
    certificate_path='/path/to/apns_prod.pem',
    use_sandbox=False
)
```

### Device Token Management

1. **App Registration** (iOS side):
   ```swift
   // In AppDelegate.swift
   func application(_ application: UIApplication,
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
       // Register for remote notifications
       UIApplication.shared.registerForRemoteNotifications()

       // Request user permission
       let center = UNUserNotificationCenter.current()
       center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
           if granted {
               print("User granted notification permission")
           }
       }

       return true
   }

   func application(_ application: UIApplication,
                    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
       let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
       print("APNs device token: \(token)")

       // Send token to backend
       ApiService.shared.registerDeviceToken(token: token) { result in
           switch result {
           case .success:
               print("Device token registered with backend")
           case .failure(let error):
               print("Failed to register device token: \(error)")
           }
       }
   }

   func application(_ application: UIApplication,
                    didFailToRegisterForRemoteNotificationsWithError error: Error) {
       print("Failed to register for remote notifications: \(error)")
   }
   ```

2. **Backend Storage**:
   - Store device tokens in database (associated with user account)
   - Handle token updates (tokens can change)
   - Implement token cleanup (remove invalid tokens)

### Error Handling

Common APNs error codes:

| Code | Description | Action |
|------|-------------|--------|
| 400 | Bad request | Check payload format |
| 403 | Invalid provider token | Verify APNs key/certificate |
| 404 | Invalid device token | Remove token from database |
| 410 | Device token unregistered | Token expired, remove from DB |
| 429 | Too many requests | Implement rate limiting |
| 500 | Internal server error | Retry with exponential backoff |
| 503 | Service unavailable | Retry later |

---

## Testing Guide

### Testing Tools

#### 1. **Pusher** (macOS app)
- GUI-based testing
- Supports both sandbox and production
- Download: https://github.com/noodlewerk/NWPusher

#### 2. **Knuff** (macOS app)
- Open-source push notification testing
- Download: https://github.com/KnuffApp/Knuff

#### 3. **Command Line (curl + HTTP/2)**

```bash
# Requires curl with HTTP/2 support
curl -v \
  -d '{"aps":{"alert":{"title":"Test","body":"Testing push notification"},"sound":"default"}}' \
  -H "apns-topic: com.trix3d.companion" \
  -H "apns-push-type: alert" \
  -H "apns-priority: 10" \
  -H "authorization: bearer YOUR_JWT_TOKEN" \
  --http2 \
  https://api.sandbox.push.apple.com/3/device/YOUR_DEVICE_TOKEN
```

### Testing Checklist

#### Development Testing

- [ ] App successfully registers for remote notifications
- [ ] Device token is received and logged
- [ ] Device token is sent to backend
- [ ] Backend can send notification to device
- [ ] Notification appears when app is in foreground
- [ ] Notification appears when app is in background
- [ ] Notification appears when app is terminated
- [ ] Tapping notification opens app correctly
- [ ] Badge count updates correctly
- [ ] Sound plays correctly

#### Production Testing

- [ ] Repeat all development tests with production certificates
- [ ] Test on physical device (not simulator)
- [ ] Test with different iOS versions
- [ ] Test with different device types (iPhone, iPad)
- [ ] Test silent notifications
- [ ] Test rich notifications with media
- [ ] Test actionable notifications with custom actions
- [ ] Test notification grouping (iOS 12+)
- [ ] Test critical alerts (requires special entitlement)

### Simulators vs Real Devices

**Important**: APNs does NOT work on iOS Simulator. You must use a physical device for testing.

---

## Troubleshooting

### Common Issues

#### 1. Not Receiving Notifications

**Symptoms**: Device registered successfully, but notifications don't arrive

**Possible Causes**:
- Wrong environment (sandbox vs production mismatch)
- Invalid or expired device token
- Invalid or expired APNs certificate
- Backend not sending to correct APNs server
- Firewall blocking APNs ports (443, 2197, 2195, 5223)

**Solutions**:
```bash
# Check if APNs servers are reachable
telnet api.sandbox.push.apple.com 443
telnet api.push.apple.com 443

# Verify certificate validity
openssl s_client -connect api.sandbox.push.apple.com:443 \
  -cert apns_dev.pem -key apns_dev_key.pem
```

#### 2. Device Token Not Received

**Symptoms**: `didFailToRegisterForRemoteNotificationsWithError` called

**Possible Causes**:
- App not properly signed with push notification capability
- Simulator being used (must use real device)
- Network connectivity issues
- Apple's APNs service temporarily unavailable

**Solutions**:
- Verify provisioning profile includes push notification capability
- Check Xcode signing & capabilities
- Test on physical device
- Check Apple System Status page

#### 3. Certificate Errors

**Symptoms**: Backend fails to connect to APNs with certificate

**Possible Causes**:
- Certificate expired (certificates expire after 1 year)
- Wrong certificate format (PEM vs P12)
- Certificate not properly concatenated
- Private key passphrase issue

**Solutions**:
```bash
# Verify certificate expiration
openssl x509 -in apns_dev.pem -noout -dates

# Verify certificate and key match
openssl x509 -noout -modulus -in apns_dev_cert.pem | openssl md5
openssl rsa -noout -modulus -in apns_dev_key.pem | openssl md5
# MD5 hashes should match
```

#### 4. Silent Notifications Not Working

**Symptoms**: `content-available: 1` notifications not received

**Possible Causes**:
- App not configured for background remote notifications
- System killed app due to resource constraints
- User disabled background app refresh

**Solutions**:
- Verify `UIBackgroundModes` includes `remote-notification` in Info.plist
- Test on device with sufficient resources
- Check Settings → General → Background App Refresh

### Debug Logging

Enable APNs debug logging in your app:

```swift
func application(_ application: UIApplication,
                didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // Enable APNs logging
    UserDefaults.standard.set(true, forKey: "APSLoggingEnabled")

    // ... rest of setup
    return true
}
```

View logs in Console.app (macOS) by filtering for your app's bundle ID.

---

## Security Best Practices

### Certificate Management

1. **Never commit certificates to version control**
   - Add `*.pem`, `*.p12`, `*.p8` to `.gitignore`
   - Use environment variables or secret management systems

2. **Rotate certificates regularly**
   - Set calendar reminder 2 weeks before expiration
   - Create new certificate before old one expires
   - Update backend with new certificate
   - Monitor for failures during transition

3. **Use separate certificates for environments**
   - Development: Sandbox certificate
   - Staging: Separate sandbox certificate
   - Production: Production certificate

### Backend Security

1. **Validate device tokens**
   - Check format (64 hex characters)
   - Verify token belongs to user before sending
   - Remove invalid tokens from database

2. **Rate limit notifications**
   - Prevent notification spam
   - Respect APNs rate limits
   - Implement per-user and global limits

3. **Encrypt sensitive data in notifications**
   - Don't send PII in notification payload
   - Use notification to trigger app to fetch data
   - Consider end-to-end encryption for sensitive content

### User Privacy

1. **Request permission appropriately**
   - Explain why you need notifications
   - Don't request on first launch
   - Allow users to opt-out

2. **Respect user preferences**
   - Honor notification settings
   - Provide granular control in app settings
   - Don't send marketing notifications without consent

---

## Monitoring & Analytics

### Metrics to Track

1. **Delivery Metrics**
   - Total notifications sent
   - Delivery success rate
   - Delivery failure rate (by error type)
   - Average delivery latency

2. **Engagement Metrics**
   - Notification open rate
   - Action button tap rate
   - Conversion rate (notification → in-app action)

3. **Technical Metrics**
   - Device token registration rate
   - Token invalidation rate
   - Certificate expiration countdown
   - APNs server response time

### Implementation

```python
# Backend logging example
import logging
from datetime import datetime

def send_push_notification(user_id, device_token, payload):
    start_time = datetime.now()

    try:
        response = apns_client.send_notification(device_token, payload)

        # Log success
        duration_ms = (datetime.now() - start_time).total_seconds() * 1000
        logging.info({
            'event': 'push_sent',
            'user_id': user_id,
            'device_token': device_token[:8] + '...',  # Partial token for privacy
            'success': True,
            'duration_ms': duration_ms,
            'timestamp': datetime.now().isoformat()
        })

        return response

    except Exception as e:
        # Log failure
        logging.error({
            'event': 'push_failed',
            'user_id': user_id,
            'device_token': device_token[:8] + '...',
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        })
        raise
```

---

## Compliance & Legal

### Data Protection

- **GDPR** (EU): Obtain explicit consent for notifications, allow easy opt-out
- **CCPA** (California): Honor "Do Not Sell" requests for notification data
- **PIPL** (China): Store notification data on servers in China if required

### App Store Review

Apple has specific requirements for push notifications:

1. **Permission Request**
   - Must explain why you need notifications
   - Don't request on first launch (unless critical feature)

2. **Content**
   - No spam or excessive notifications
   - Must provide value to user
   - Honor user preferences immediately

3. **Testing During Review**
   - Ensure notifications work during App Review
   - Provide demo account with notifications enabled
   - Document notification scenarios in review notes

---

## Resources

### Official Documentation

- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)
- [APNs Provider API](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns)
- [Generating a Remote Notification](https://developer.apple.com/documentation/usernotifications/generating_a_remote_notification)

### Third-Party Services

If you prefer not to manage APNs directly, consider these services:

- **Firebase Cloud Messaging (FCM)** - Cross-platform push notifications
- **Amazon SNS** - Scalable push notification service
- **OneSignal** - Easy-to-use push notification platform
- **Pusher Beams** - Developer-friendly push notifications

---

## Support

### Internal Support

- **Technical Issues**: Contact backend team
- **Certificate Management**: Contact DevOps team
- **User Complaints**: Check analytics dashboard first

### Apple Support

- [Apple Developer Forums](https://developer.apple.com/forums/)
- [Contact Apple Developer Support](https://developer.apple.com/support/)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-27 | Claude | Initial creation |

---

**Next Steps**:

1. Follow certificate setup steps to generate APNs certificates
2. Configure backend to use `apns-config.json`
3. Implement device token registration in app
4. Test notifications using tools mentioned in testing guide
5. Deploy to production with production certificates
