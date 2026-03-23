# Push Notification Testing Guide

## Overview

This document provides step-by-step instructions for testing APNs push notifications in the TRIX 3D Companion app.

---

## Prerequisites

Before testing push notifications, ensure you have:

- [ ] Physical iOS device (iPhone or iPad)
  - **Note**: Push notifications do NOT work on iOS Simulator
- [ ] Apple Developer Program membership
- [ ] APNs certificates or keys configured (see `README.md`)
- [ ] Backend server configured to send notifications
- [ ] Test device registered in provisioning profile
- [ ] Xcode 15+ installed on macOS

---

## Testing Setup

### 1. Device Configuration

#### Enable Development Testing

1. Connect your iOS device to Mac via USB
2. Open Xcode → Window → Devices and Simulators
3. Select your device
4. Ensure device is marked as "Development" (not just "Unknown")
5. Note your device's UDID for provisioning profile

#### Install Development Build

```bash
# Build and install app on device
cd ios/TRIX3DCompanion
xcodebuild -scheme TRIX3DCompanion \
  -destination 'platform=iOS,name=Your Device Name' \
  -configuration Debug \
  clean install
```

### 2. Backend Configuration

#### Update Backend with Device Token

Ensure your backend is configured to:
1. Accept device token registration
2. Store device tokens per user
3. Send test notifications to specific device tokens

#### Test Backend API

```bash
# Test device token registration endpoint
curl -X POST https://api.trix3d.com/api/v1/devices/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "device_token": "test_token_placeholder",
    "platform": "ios",
    "app_version": "1.0.0",
    "os_version": "17.0"
  }'
```

---

## Manual Testing with Tools

### Option 1: Pusher (macOS GUI App)

**Installation**:
1. Download from: https://github.com/noodlewerk/NWPusher/releases
2. Open Pusher.app
3. Allow network access if prompted

**Configuration**:

1. **Select Certificate**:
   - Click "Choose..." next to Certificate
   - Select your `apns_dev.pem` file (development)
   - Or select `apns_prod.pem` (production)

2. **Configure APNs Server**:
   - Development: `api.sandbox.push.apple.com`
   - Production: `api.push.apple.com`

3. **Enter Device Token**:
   - Get device token from app logs (see below)
   - Paste 64-character hex string into "Device Token" field

4. **Compose Payload**:
   ```json
   {
     "aps": {
       "alert": {
         "title": "Test Notification",
         "body": "This is a test from Pusher"
       },
       "sound": "default",
       "badge": 1
     }
   }
   ```

5. **Send Notification**:
   - Click "Send"
   - Check device for notification

**Getting Device Token from App**:

1. Launch app on device
2. Check Xcode console for log:
   ```
   APNs device token: abc123def456789...
   ```
3. Copy the 64-character token

### Option 2: Knuff (macOS GUI App)

**Installation**:
1. Download from: https://github.com/KnuffApp/Knuff/releases
2. Open Knuff.app

**Configuration**:

1. **Authentication Method**:
   - Certificate: Select `.pem` file
   - Token: Select `.p8` file and enter Key ID + Team ID

2. **Environment**:
   - Sandbox (Development) or Production

3. **Push Payload**:
   ```json
   {
     "aps": {
       "alert": {
         "title": "Test from Knuff",
         "body": "Testing push notification"
       },
       "sound": "default"
     }
   }
   ```

4. **Device Token**:
   - Enter device token from app logs

5. **Send**:
   - Click "Send Push"
   - Observe result on device

### Option 3: Command Line (curl + HTTP/2)

**Prerequisites**:
- curl with HTTP/2 support
- JWT token for APNs authentication (if using token-based auth)

**Generate JWT Token** (if using token-based auth):

```bash
# Using Python
pip install pyjwt cryptography

python3 << 'EOF'
import jwt
import time

key_id = "YOUR_KEY_ID"
team_id = "YOUR_TEAM_ID"
key_path = "/path/to/AuthKey_XXXXXXXXXX.p8"

with open(key_path, 'r') as f:
    key = f.read()

timestamp = int(time.time())
payload = {
    'iss': team_id,
    'iat': timestamp
}

token = jwt.encode(payload, key, algorithm='ES256', headers={'kid': key_id})
print(token)
EOF
```

**Send Notification**:

```bash
# Token-based authentication
curl -v \
  -d '{"aps":{"alert":{"title":"Test","body":"CLI test"},"sound":"default"}}' \
  -H "apns-topic: com.trix3d.companion" \
  -H "apns-push-type: alert" \
  -H "apns-priority: 10" \
  -H "authorization: bearer YOUR_JWT_TOKEN" \
  --http2 \
  https://api.sandbox.push.apple.com/3/device/YOUR_DEVICE_TOKEN

# Certificate-based authentication
curl -v \
  -d '{"aps":{"alert":{"title":"Test","body":"CLI test"},"sound":"default"}}' \
  -H "apns-topic: com.trix3d.companion" \
  -H "apns-push-type: alert" \
  -H "apns-priority: 10" \
  --cert /path/to/apns_dev.pem \
  --key /path/to/apns_dev_key.pem \
  --http2 \
  https://api.sandbox.push.apple.com/3/device/YOUR_DEVICE_TOKEN
```

**Expected Response**:

Success (201 Created):
```
< HTTP/2 201
< apns-id: ABCD-1234-EFGH-5678
```

Failure (400 Bad Request):
```json
{"reason": "BadDeviceToken"}
```

---

## Automated Testing

### Unit Tests

Create unit tests for notification handling:

```swift
import XCTest
@testable import TRIX3DCompanion

class PushNotificationTests: XCTestCase {

    func testNotificationPayloadParsing() {
        let payload: [String: Any] = [
            "aps": [
                "alert": [
                    "title": "Test",
                    "body": "Message"
                ]
            ],
            "data": [
                "type": "new_message",
                "message_id": "msg_123"
            ]
        ]

        let notification = PushNotification(payload: payload)

        XCTAssertEqual(notification.type, "new_message")
        XCTAssertEqual(notification.messageId, "msg_123")
        XCTAssertEqual(notification.title, "Test")
        XCTAssertEqual(notification.body, "Message")
    }

    func testDeviceTokenFormatting() {
        let tokenData = Data([0xab, 0xcd, 0xef, 0x12, 0x34])
        let formatted = tokenData.map { String(format: "%02.2hhx", $0) }.joined()

        XCTAssertEqual(formatted, "abcdef1234")
    }
}
```

### Integration Tests

Test notification flow from backend to app:

```swift
import XCTest

class PushNotificationIntegrationTests: XCTestCase {

    var sut: AppDelegate!

    override func setUp() {
        super.setUp()
        sut = AppDelegate()
    }

    func testDeviceTokenRegistration() {
        let expectation = self.expectation(description: "Device token registered")

        // Mock API service
        let mockApi = MockApiService()
        mockApi.registerDeviceTokenHandler = { token in
            XCTAssertEqual(token.count, 64)
            expectation.fulfill()
        }

        sut.apiService = mockApi

        // Simulate didRegisterForRemoteNotificationsWithDeviceToken
        let tokenData = Data(repeating: 0xab, count: 32)
        sut.application(UIApplication.shared,
                       didRegisterForRemoteNotificationsWithDeviceToken: tokenData)

        waitForExpectations(timeout: 5)
    }
}
```

---

## Test Scenarios Checklist

### Basic Functionality

- [ ] **App Registration**
  - App successfully registers for remote notifications
  - Device token is received and logged
  - Device token is sent to backend
  - Backend stores device token successfully

- [ ] **Foreground Notification**
  - Notification appears when app is in foreground
  - Custom UI is displayed (if implemented)
  - Tapping notification triggers correct action

- [ ] **Background Notification**
  - Notification appears when app is in background
  - Badge count updates correctly
  - Sound plays correctly
  - Tapping notification opens app to correct screen

- [ ] **Terminated App**
  - Notification appears when app is terminated
  - Tapping notification launches app
  - App navigates to correct screen
  - Data from notification is processed correctly

### Advanced Features

- [ ] **Silent Notifications**
  - App receives `content-available: 1` notification
  - Background fetch is triggered
  - Data is synced without user interaction
  - No visible notification is shown

- [ ] **Rich Notifications**
  - Image/video attachment is displayed
  - `mutable-content: 1` works correctly
  - Notification service extension processes content
  - Media downloads and displays correctly

- [ ] **Actionable Notifications**
  - Action buttons appear
  - Tapping action triggers correct handler
  - Background action works (without opening app)
  - Foreground action opens app with correct context

- [ ] **Notification Grouping**
  - Multiple notifications from same thread are grouped
  - Thread ID is correctly set
  - Summary text is displayed
  - Expanding group shows individual notifications

- [ ] **Badge Management**
  - Badge count increments on new notification
  - Badge clears when app opens
  - Badge reflects unread count accurately

### Edge Cases

- [ ] **Network Issues**
  - App handles registration failure gracefully
  - User sees appropriate error message
  - App retries registration later

- [ ] **Permission Denial**
  - App handles permission denial gracefully
  - User can enable notifications later in Settings
  - App continues to function without notifications

- [ ] **Token Updates**
  - App handles device token changes
  - Backend updates stored token
  - Old token is invalidated

- [ ] **Large Payloads**
  - App handles maximum payload size (4KB)
  - Large notifications are truncated gracefully
  - Critical data is not lost

### Environment Testing

- [ ] **Development Environment**
  - Sandbox certificates work
  - `api.sandbox.push.apple.com` is reachable
  - Notifications arrive in < 1 second

- [ ] **Production Environment**
  - Production certificates work
  - `api.push.apple.com` is reachable
  - Notifications arrive reliably

### Device Coverage

- [ ] **iPhone**
  - Test on multiple iPhone models
  - Test on different iOS versions (14, 15, 16, 17)
  - Test on different screen sizes

- [ ] **iPad**
  - Notifications display correctly on iPad
  - Action sheets display properly

- [ ] **Different States**
  - Device locked
  - Device unlocked
  - Low power mode enabled
  - Do not disturb enabled

---

## Testing Specific Notification Types

### New Message Notification

```json
{
  "aps": {
    "alert": {
      "title": "New Message",
      "subtitle": "From Alice",
      "body": "Hey, want to study together?"
    },
    "sound": "default",
    "badge": 3,
    "thread-id": "conversation_123"
  },
  "data": {
    "type": "new_message",
    "message_id": "msg_456",
    "conversation_id": "conversation_123",
    "sender_id": "user_alice"
  }
}
```

**Test Steps**:
1. Send notification from backend
2. Verify notification appears with correct title/body
3. Tap notification
4. Verify app opens to correct conversation
5. Verify message is displayed

### Friend Request Notification

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
    "request_id": "req_789",
    "user_id": "user_bob"
  }
}
```

**Test Steps**:
1. Send notification with `FRIEND_REQUEST` category
2. Verify "Accept" and "Decline" buttons appear
3. Test "Accept" button → verify friend request is accepted
4. Test "Decline" button → verify friend request is declined
5. Test tapping notification body → verify friend request detail screen opens

### Silent Sync Notification

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

**Test Steps**:
1. Put app in background
2. Send silent notification
3. Verify app performs background fetch
4. Verify data is synced without user interaction
5. Verify no visible notification is shown

### Location Share Notification

```json
{
  "aps": {
    "alert": {
      "title": "Friend Nearby",
      "body": "Alice is at Starbucks - Main St"
    },
    "sound": "default",
    "category": "LOCATION"
  },
  "data": {
    "type": "location_share",
    "user_id": "user_alice",
    "latitude": 39.9042,
    "longitude": 116.4074,
    "location_name": "Starbucks - Main St"
  }
}
```

**Test Steps**:
1. Send location notification
2. Verify "View on Map" and "Share My Location" buttons appear
3. Test "View on Map" → verify map opens with friend's location
4. Test "Share My Location" → verify location share flow initiates

---

## Debugging

### Enable APNs Logging

In `AppDelegate.swift`:

```swift
func application(_ application: UIApplication,
                didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // Enable verbose APNs logging
    UserDefaults.standard.set(true, forKey: "APSLoggingEnabled")

    // Log launch options
    if let remoteNotification = launchOptions?[.remoteNotification] as? [String: Any] {
        print("App launched from notification: \(remoteNotification)")
    }

    return true
}
```

### View Console Logs

1. Open Xcode
2. Window → Devices and Simulators
3. Select your device
4. Click "Open Console"
5. Filter by process name: `TRIX3DCompanion`
6. Look for APNs-related logs

### Common Log Messages

**Success**:
```
APNs device token: abc123def456789...
Device token registered with backend
```

**Failure**:
```
Failed to register for remote notifications: Error Domain=NSCocoaErrorDomain Code=3000
```

**Solutions**:
- Code 3000: Invalid provisioning profile
- Code 3001: No APNs entitlement
- Code 3010: Simulator not supported (use real device)

### Check Certificate Validity

```bash
# Verify certificate expiration
openssl x509 -in apns_dev.pem -noout -dates

# Verify certificate and key match
openssl x509 -noout -modulus -in apns_dev_cert.pem | openssl md5
openssl rsa -noout -modulus -in apns_dev_key.pem | openssl md5
# Hashes should match
```

### Test APNs Connectivity

```bash
# Test connection to APNs servers
telnet api.sandbox.push.apple.com 443
telnet api.push.apple.com 443

# If connection fails, check:
# - Firewall settings
# - Network connectivity
# - DNS resolution
```

---

## Performance Testing

### Latency Measurement

Test notification delivery latency:

```swift
class NotificationLatencyTest {
    var sendTime: Date?

    func sendTestNotification() {
        sendTime = Date()

        // Send notification from backend
        ApiService.shared.sendTestNotification { result in
            // Notification will arrive on device
        }
    }

    func didReceiveNotification() {
        guard let sendTime = sendTime else { return }
        let latency = Date().timeIntervalSince(sendTime)
        print("Notification latency: \(latency * 1000) ms")
    }
}
```

**Expected Latency**:
- Development (Sandbox): 500ms - 2s
- Production: < 1s

### Throughput Testing

Test sending multiple notifications:

```python
# Backend script
import time
from apns2.client import APNsClient

client = APNsClient(...)

for i in range(100):
    payload = Payload(alert=f"Test {i}")
    client.send_notification(device_token, payload)
    time.sleep(0.1)  # 10 per second

# Monitor for:
# - Rate limiting by Apple
# - Delivery failures
# - Latency increase
```

---

## Troubleshooting Guide

### Issue: Not Receiving Notifications

**Checklist**:
1. Using physical device (not simulator)?
2. App properly signed with push capability?
3. Correct environment (sandbox vs production)?
4. Device token valid and current?
5. Backend using correct APNs server?
6. Firewall allowing APNs ports (443, 2197)?

**Debug Steps**:
```bash
# 1. Verify device token in logs
# 2. Check backend logs for send attempts
# 3. Test with Pusher/Knuff to isolate backend vs app issue
# 4. Check Apple System Status page
# 5. Try different device
```

### Issue: Device Token Not Received

**Checklist**:
1. App has push notification capability?
2. Provisioning profile includes push?
3. Network connectivity working?
4. Apple's APNs service available?

**Debug Steps**:
```swift
func application(_ application: UIApplication,
                didFailToRegisterForRemoteNotificationsWithError error: Error) {
    print("Registration failed: \(error)")
    print("Error domain: \(error._domain)")
    print("Error code: \((error as NSError).code)")
}
```

### Issue: Certificate Errors

**Checklist**:
1. Certificate not expired?
2. Correct certificate for environment?
3. PEM file properly formatted?
4. Private key included in PEM?

**Debug Steps**:
```bash
# Verify certificate
openssl x509 -in apns_dev.pem -text -noout

# Test connection
openssl s_client -connect api.sandbox.push.apple.com:443 \
  -cert apns_dev.pem -key apns_dev_key.pem
```

---

## Regression Testing

Before each release, run through this checklist:

- [ ] All notification types work correctly
- [ ] Action buttons function properly
- [ ] Silent notifications trigger background sync
- [ ] Rich notifications display media
- [ ] Badge management works correctly
- [ ] Notifications work on all supported iOS versions
- [ ] Notifications work on all device types (iPhone/iPad)
- [ ] Performance is acceptable (< 1s latency)
- [ ] Error handling is graceful
- [ ] Analytics are tracked correctly

---

## Test Report Template

```markdown
# Push Notification Test Report

**Date**: 2026-02-27
**Tester**: Your Name
**App Version**: 1.0.0
**iOS Version**: 17.0
**Device**: iPhone 15 Pro

## Test Results

### Basic Functionality
- [x] Device token registration
- [x] Foreground notification
- [x] Background notification
- [x] Terminated app notification

### Advanced Features
- [x] Silent notifications
- [x] Rich notifications with media
- [x] Actionable notifications
- [x] Notification grouping
- [x] Badge management

### Edge Cases
- [x] Network issues
- [x] Permission denial
- [x] Token updates

## Issues Found

1. **Issue**: Badge not clearing on app open
   - **Severity**: Medium
   - **Steps to Reproduce**: ...
   - **Expected**: Badge clears to 0
   - **Actual**: Badge remains at 3

## Performance

- Average latency: 750ms
- Success rate: 98%
- Failure rate: 2% (invalid tokens)

## Conclusion

Push notifications are working as expected with minor issues noted.
Ready for release after badge issue is fixed.
```

---

## Additional Resources

- [Apple Push Notification Service Documentation](https://developer.apple.com/documentation/usernotifications)
- [Testing Push Notifications](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns)
- [Pusher GitHub Repository](https://github.com/noodlewerk/NWPusher)
- [Knuff GitHub Repository](https://github.com/KnuffApp/Knuff)

---

## Contact

For issues with push notification testing:
- **Technical Issues**: Contact backend team
- **Certificate Issues**: Contact DevOps team
- **Apple Support**: [Contact Apple Developer Support](https://developer.apple.com/support/)
