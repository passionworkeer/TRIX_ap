# Push Notifications Quick Reference

## Quick Start

### 1. Get Device Token (iOS)

```swift
// In TRIXApplicationDelegate.swift
func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
) -> Bool {
    Task { @MainActor in
        try? await PushNotificationService.shared.registerForRemoteNotifications()
    }
    return true
}

func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
) {
    Task { @MainActor in
        PushNotificationService.shared.didRegisterForRemoteNotifications(withDeviceToken: deviceToken)
    }
}

func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
) {
    PushNotificationService.shared.didFailToRegisterForRemoteNotifications(error: error)
}
```

### 2. Send Notification (Backend)

```python
# Python example
from apns2.client import APNsClient
from apns2.payload import Payload

client = APNsClient(
    key='/path/to/AuthKey.p8',
    key_id='YOUR_KEY_ID',
    team_id='YOUR_TEAM_ID',
    topic='com.trix3d.companion',
    use_sandbox=True  # False for production
)

payload = Payload(alert="Hello!", sound="default", badge=1)
client.send_notification(device_token, payload)
```

### 3. Handle Notification (iOS)

```swift
// PushNotificationService handles all notification states internally.
// Deep link to conversation screen from notification:
UNUserNotificationCenter.current().delegate = PushNotificationService.shared
```

---

## Common Payloads

### Simple Alert

```json
{
  "aps": {
    "alert": "Hello World",
    "sound": "default",
    "badge": 1
  }
}
```

### Rich Alert

```json
{
  "aps": {
    "alert": {
      "title": "Title",
      "subtitle": "Subtitle",
      "body": "Body text"
    },
    "sound": "default",
    "badge": 1
  }
}
```

### Silent (Background)

```json
{
  "aps": {
    "content-available": 1
  },
  "data": {
    "action": "sync"
  }
}
```

### With Actions

```json
{
  "aps": {
    "alert": "Message",
    "category": "MESSAGE"
  }
}
```

### With Media

```json
{
  "aps": {
    "alert": "Message",
    "mutable-content": 1
  },
  "media-url": "https://example.com/image.jpg"
}
```

---

## APNs Servers

| Environment | Server | Port |
|-------------|--------|------|
| Development | `api.sandbox.push.apple.com` | 443 |
| Production | `api.push.apple.com` | 443 |

---

## Certificate vs Token Auth

### Certificate-Based (Legacy)

**Pros**: Simple setup
**Cons**: Expires annually, requires certificate management

**Setup**:
1. Create certificate in Apple Developer Portal
2. Download `.cer` file
3. Convert to `.pem`:
   ```bash
   openssl x509 -in aps_development.cer -inform DER -out cert.pem -outform PEM
   openssl pkcs12 -nocerts -out key.pem -in key.p12
   cat cert.pem key.pem > apns.pem
   ```

### Token-Based (Recommended)

**Pros**: No expiration, better performance
**Cons**: Requires `.p8` key management

**Setup**:
1. Create APNs Key in Apple Developer Portal
2. Download `.p8` file (can't re-download!)
3. Note Key ID (10 characters)
4. Note Team ID

---

## Testing Tools

| Tool | Platform | Type |
|------|----------|------|
| Pusher | macOS | GUI |
| Knuff | macOS | GUI |
| curl + HTTP/2 | CLI | Command Line |

---

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| BadDeviceToken | Invalid token | Remove from DB |
| InvalidProviderToken | Bad JWT | Check key/cert |
| Unregistered | Token expired | Remove from DB |
| DeviceTokenNotForTopic | Wrong bundle ID | Check topic |
| TopicDisallowed | Missing capability | Enable in Xcode |

---

## Notification Categories

Define in `PushNotificationService.swift` (manages categories automatically via NotificationManager):

```swift
// Notification categories are registered in NotificationManager
// Use PushNotificationService.shared.handleNotificationAction(category:action:) for action handling
```

---

## Payload Size Limits

| Type | Max Size |
|------|----------|
| Regular | 4 KB (4096 bytes) |
| VoIP | 5 KB (5120 bytes) |

**Tip**: Keep payloads small. Use notifications to trigger app to fetch data.

---

## Best Practices

### 1. Request Permission at Right Time

❌ **Don't**: Request on first launch
✅ **Do**: Request when user performs action that needs notifications

### 2. Handle All App States

- Foreground: Show custom UI or notification
- Background: Show system notification
- Terminated: Show system notification, handle on launch

### 3. Respect User Preferences

```swift
UNUserNotificationCenter.current().getNotificationSettings { settings in
    switch settings.authorizationStatus {
    case .authorized:
        // Can send notifications
    case .denied:
        // Don't ask again, direct to Settings
    case .notDetermined:
        // Can request permission
    default:
        break
    }
}
```

### 4. Manage Badge Count

```swift
// Clear badge on app open (handled automatically by TRIXApplicationDelegate)
// Badge is managed by PushNotificationService.shared based on unread count
```

### 5. Test on Real Device

⚠️ **Important**: APNs does NOT work on iOS Simulator. Always test on physical device.

---

## Debug Checklist

- [ ] Using real device (not simulator)
- [ ] App signed with push capability
- [ ] Provisioning profile includes push
- [ ] Correct environment (sandbox/prod)
- [ ] Device token valid (64 hex chars)
- [ ] Certificate not expired
- [ ] Backend using correct server
- [ ] Firewall allows APNs ports

---

## Useful Commands

```bash
# Check certificate expiration
openssl x509 -in apns.pem -noout -dates

# Test APNs connectivity
telnet api.sandbox.push.apple.com 443

# Send test notification (curl)
curl -v \
  -d '{"aps":{"alert":"Test"}}' \
  -H "apns-topic: com.trix3d.companion" \
  --http2 \
  https://api.sandbox.push.apple.com/3/device/TOKEN
```

---

## Notification Flow

```
1. App launches
   ↓
2. Request user permission
   ↓
3. Register with APNs
   ↓
4. Receive device token
   ↓
5. Send token to backend
   ↓
6. Backend stores token
   ↓
7. Event triggers notification
   ↓
8. Backend sends to APNs
   ↓
9. APNs delivers to device
   ↓
10. App receives notification
   ↓
11. Handle based on app state
```

---

## Resources

- [APNs Documentation](https://developer.apple.com/documentation/usernotifications)
- [Payload Reference](https://developer.apple.com/documentation/usernotifications/generating_a_remote_notification)
- [Error Codes](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/handling_notification_responses_from_apns)

---

**最后更新**: 2026-04-04
