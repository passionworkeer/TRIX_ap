# Phase 6G OAuth Login - Quick Reference

> **Quick start guide for developers integrating OAuth login system**

---

## Files Created

### Service Layer (6 files, 1,796 lines)

```
ios/TRIX3DCompanion/Core/Services/
├── AppleSignInServiceProtocol.swift      (123 lines) - Protocol & types
├── AppleSignInService.swift              (254 lines) - Apple implementation
├── WeChatSignInServiceProtocol.swift     (133 lines) - Protocol & types
├── WeChatSignInService.swift             (419 lines) - WeChat implementation
├── OAuthManagerProtocol.swift            (155 lines) - Protocol & types
└── OAuthManager.swift                    (712 lines) - Unified manager
```

### UI Updates (1 file modified)

```
ios/TRIX3DCompanion/Features/Auth/Views/
└── LoginView.swift                       (added OAuth buttons)
```

### Documentation (3 files)

```
ios/
├── OAUTH_SETUP_GUIDE.md                  - Setup instructions
├── OAUTH_IMPLEMENTATION_SUMMARY.md       - Implementation details
└── OAUTH_QUICK_REFERENCE.md              - This file
```

---

## Usage Examples

### 1. Sign In with Apple

```swift
import AuthenticationServices

// In your view or view model
Task {
    guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
          let window = windowScene.windows.first else { return }

    let result = await OAuthManager.shared.signIn(
        with: .apple,
        presentationAnchor: window
    )

    switch result {
    case .success(let user):
        print("Signed in as: \(user.username)")
    case .failure(let error):
        print("Error: \(error.localizedDescription)")
    }
}
```

### 2. Sign In with WeChat

```swift
// In your view or view model
Task {
    let result = await OAuthManager.shared.signIn(with: .wechat)

    switch result {
    case .success(let user):
        print("Signed in as: \(user.username)")
    case .failure(let error):
        print("Error: \(error.localizedDescription)")
    }
}
```

### 3. Link Account

```swift
// User is already logged in with email
Task {
    let result = await OAuthManager.shared.linkAccount(
        provider: .apple,
        presentationAnchor: window
    )

    switch result {
    case .success:
        print("Apple account linked!")
    case .failure(let error):
        print("Failed: \(error.localizedDescription)")
    }
}
```

### 4. Get Linked Accounts

```swift
Task {
    let result = await OAuthManager.shared.fetchLinkedAccounts()

    switch result {
    case .success(let accounts):
        print("Linked accounts: \(accounts.count)")
        for account in accounts {
            print("- \(account.provider.displayName): \(account.email ?? "No email")")
        }
    case .failure(let error):
        print("Error: \(error.localizedDescription)")
    }
}
```

### 5. Unlink Account

```swift
Task {
    let result = await OAuthManager.shared.unlinkAccount(accountID: "abc123")

    switch result {
    case .success:
        print("Account unlinked")
    case .failure(let error):
        print("Failed: \(error.localizedDescription)")
    }
}
```

### 6. Handle URL Callbacks (Required)

```swift
// In AppDelegate.swift (iOS 12 and earlier)
func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
) -> Bool {
    return OAuthManager.shared.handleOpenURL(url)
}

// In SceneDelegate.swift (iOS 13+)
func scene(
    _ scene: UIScene,
    openURLContexts URLContexts: Set<UIOpenURLContext>
) {
    for context in URLContexts {
        _ = OAuthManager.shared.handleOpenURL(context.url)
    }
}
```

---

## Configuration Checklist

### Xcode Setup

- [ ] Add "Sign in with Apple" capability
  - Target → Signing & Capabilities → + Capability → Sign In with Apple

- [ ] Add WeChat URL scheme to Info.plist
  ```xml
  <key>CFBundleURLTypes</key>
  <array>
      <dict>
          <key>CFBundleURLSchemes</key>
          <array>
              <string>YOUR_WECHAT_APP_ID</string>
          </array>
      </dict>
  </array>
  ```

- [ ] Add WeChat query schemes to Info.plist
  ```xml
  <key>LSApplicationQueriesSchemes</key>
  <array>
      <string>weixin</string>
      <string>wechat</string>
  </array>
  ```

### WeChat SDK Integration

- [ ] Download WeChat Open SDK 1.9.2+
- [ ] Add to Xcode project:
  - `libWeChatSDK.a`
  - `WXApi.h`
  - `WXApiObject.h`
- [ ] Update `WeChatSignInService.swift`:
  ```swift
  private static let weChatAppID = "YOUR_WECHAT_APP_ID"
  private static let weChatAppSecret = "YOUR_WECHAT_APP_SECRET"
  ```
- [ ] Replace placeholder SDK calls with actual SDK

### Backend Setup

- [ ] Implement `POST /auth/apple` endpoint
- [ ] Implement `POST /auth/wechat` endpoint
- [ ] Implement `POST /user/oauth/link` endpoint
- [ ] Implement `POST /user/oauth/unlink` endpoint
- [ ] Implement `GET /user/oauth/accounts` endpoint

### Apple Developer Setup

- [ ] Enable Sign in with Apple in Apple Developer Portal
- [ ] Configure Services and Return URLs
- [ ] Add Associated Domains (if needed)

---

## Common Tasks

### Check if Provider is Available

```swift
if OAuthManager.shared.isProviderAvailable(.apple) {
    // Show Apple Sign In button
}

if OAuthManager.shared.isProviderAvailable(.wechat) {
    // Show WeChat Sign In button
}
```

### Get Available Providers

```swift
let providers = OAuthManager.shared.availableProviders
// [.apple, .wechat] or subset based on availability
```

### Check for Linked Accounts

```swift
if OAuthManager.shared.hasLinkedAccounts {
    // User has linked OAuth accounts
}
```

### Refresh Token

```swift
let result = await OAuthManager.shared.refreshToken(for: .wechat)
```

---

## Error Handling

### Common Errors

```swift
switch error {
case .invalidCredentials:
    // Invalid email/password

case .tokenExpired:
    // OAuth token expired, need to re-authenticate

case .validationError(let message):
    // Validation error with message

case .networkError(let underlying):
    // Network error

default:
    // Other errors
}
```

### WeChat-Specific Errors

```swift
switch error {
case .notInstalled:
    // WeChat app not installed
    // Show message to user

case .notSupported:
    // WeChat SDK not configured

case .cancelled:
    // User cancelled sign-in

default:
    // Handle other errors
}
```

### Apple-Specific Errors

```swift
switch error {
case .notAvailable:
    // Sign in with Apple not available (iOS < 13)

case .cancelled:
    // User cancelled sign-in

case .credentialRevoked:
    // User revoked Apple ID access

default:
    // Handle other errors
}
```

---

## Testing Checklist

### Manual Testing

**Apple Sign In:**
- [ ] Tap "Sign in with Apple"
- [ ] Choose "Share My Email"
- [ ] Verify sign-in succeeds
- [ ] Log out and try "Hide My Email"
- [ ] Test revocation (Settings → Apple ID → Apps Using Apple ID)

**WeChat Sign In:**
- [ ] Tap "Sign in with WeChat"
- [ ] Approve in WeChat app
- [ ] Verify callback is received
- [ ] Verify token exchange succeeds
- [ ] Test without WeChat installed

**Account Linking:**
- [ ] Sign in with email
- [ ] Link Apple account
- [ ] Link WeChat account
- [ ] View linked accounts
- [ ] Unlink one account
- [ ] Verify primary account protection

---

## Architecture

### Service Hierarchy

```
OAuthManager (Unified)
    ├── AppleSignInService (Apple)
    └── WeChatSignInService (WeChat)
```

### Data Flow

```
User Action
    ↓
OAuthManager
    ↓
Provider Service (Apple/WeChat)
    ↓
OAuth UI / App Switch
    ↓
Callback Processing
    ↓
Backend API
    ↓
Session Tokens
    ↓
AuthService Update
```

---

## Debugging

### Enable Logging

```swift
// In your app initialization
#if DEBUG
OAuthManager.shared.delegate = self // Implement delegate for callbacks
#endif
```

### Check Configuration

```swift
// Check Apple availability
print("Apple available: \(OAuthManager.shared.isProviderAvailable(.apple))")

// Check WeChat availability
print("WeChat available: \(OAuthManager.shared.isProviderAvailable(.wechat))")

// Check WeChat installation
print("WeChat installed: \(WeChatSignInService.shared.isInstalled)")

// Check SDK version
if let version = WeChatSignInService.shared.sdkVersion {
    print("WeChat SDK version: \(version)")
}
```

### Common Issues

**Problem**: Apple Sign In not available
- **Solution**: Enable capability in Xcode → Signing & Capabilities

**Problem**: WeChat callback not triggered
- **Solution**: Check URL scheme configuration and AppDelegate/SceneDelegate setup

**Problem**: Token not saved
- **Solution**: Check Keychain access and app entitlements

---

## Next Steps

1. ✅ Implementation complete
2. ⏳ Configure Xcode capabilities
3. ⏳ Integrate WeChat SDK
4. ⏳ Implement backend endpoints
5. ⏳ Test with sandbox accounts
6. ⏳ Deploy to production

---

## Support

- **Setup Guide**: See `OAUTH_SETUP_GUIDE.md`
- **Implementation Details**: See `OAUTH_IMPLEMENTATION_SUMMARY.md`
- **Apple Documentation**: https://developer.apple.com/sign-in-with-apple/
- **WeChat Documentation**: https://open.weixin.qq.com/

---

**Version**: 1.0
**Created**: 2026-02-26
**Status**: Implementation Complete
