# Phase 6G: OAuth Login System - Setup Guide

> **Overview**: This guide covers the setup and integration of Apple Sign In and WeChat Sign In for the TRIX 3D Companion iOS app.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Apple Sign In Setup](#apple-sign-in-setup)
3. [WeChat Sign In Setup](#wechat-sign-in-setup)
4. [App Configuration](#app-configuration)
5. [Backend Integration](#backend-integration)
6. [Testing](#testing)
7. [Security Considerations](#security-considerations)

---

## Architecture Overview

### Created Files

```
ios/TRIX3DCompanion/Core/Services/
├── AppleSignInServiceProtocol.swift      # Apple Sign In protocol and types
├── AppleSignInService.swift              # Apple Sign In implementation
├── WeChatSignInServiceProtocol.swift     # WeChat Sign In protocol and types
├── WeChatSignInService.swift             # WeChat Sign In implementation
├── OAuthManagerProtocol.swift            # OAuth manager protocol and types
└── OAuthManager.swift                    # Unified OAuth manager
```

### Key Components

1. **AppleSignInService**: Handles Sign in with Apple using AuthenticationServices framework
2. **WeChatSignInService**: Handles WeChat OAuth using WeChat OpenPlatform SDK
3. **OAuthManager**: Unified manager for all OAuth providers with account linking support
4. **LoginView**: Updated UI with Apple and WeChat sign-in buttons

---

## Apple Sign In Setup

### Step 1: Configure Apple Developer Account

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to: **Certificates, Identifiers & Profiles** → **Identifiers**
3. Select your app bundle ID
4. Enable **Sign In with Apple** capability
5. Configure **Return URLs** and **Services**

### Step 2: Add Capability in Xcode

1. Open your Xcode project
2. Select the target (TRIX3DCompanion)
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability**
5. Add **Sign In with Apple**

### Step 3: Configure Associated Domains (Optional)

For web authentication and password autofill:

```xml
<!-- Info.plist -->
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:api.trix3d.com</string>
</array>
```

### Step 4: Update Entitlements

Ensure your `.entitlements` file includes:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.applesignin</key>
    <array>
        <string>Default</string>
    </array>
</dict>
</plist>
```

---

## WeChat Sign In Setup

### Step 1: Register WeChat OpenPlatform Account

1. Go to [WeChat Open Platform](https://open.weixin.qq.com/)
2. Register as a developer
3. Create a mobile app
4. Get your **AppID** and **AppSecret**

### Step 2: Configure App Info

In WeChat Open Platform console:

- **App Name**: TRIX 3D Companion
- **Bundle ID**: com.trix3d.companion
- **Package Name**: com.trix3d.companion (if using React Native/Flutter)
- **Signature**: MD5 of your app signature (use WeChat signature tool)

### Step 3: Download WeChat SDK

1. Download [WeChat Open SDK 1.9.2+](https://open.weixin.qq.com/cgi-bin/showdocument?action=dir_list&t=resource/res_list&verify=1&id=open1419319164&token=&lang=zh_CN)
2. Extract and add to your Xcode project:
   - `libWeChatSDK.a`
   - `WXApi.h`
   - `WXApiObject.h`

### Step 4: Configure SDK

Update `WeChatSignInService.swift`:

```swift
private static let weChatAppID = "YOUR_WECHAT_APP_ID"
private static let weChatAppSecret = "YOUR_WECHAT_APP_SECRET"
```

Replace placeholders with actual values from WeChat Open Platform.

### Step 5: Configure URL Scheme

In `Info.plist`, add URL scheme for WeChat callback:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLName</key>
        <string>weixin</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>YOUR_WECHAT_APP_ID</string>
        </array>
    </dict>
</array>
```

### Step 6: Configure LSApplicationQueriesSchemes

Allow WeChat URL scheme queries:

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>weixin</string>
    <string>wechat</string>
</array>
```

---

## App Configuration

### Update AppDelegate.swift

```swift
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Initialize WeChat SDK
        WeChatSignInService.shared // Triggers registration
        return true
    }

    // For iOS 12 and earlier
    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        // Handle WeChat callback
        return OAuthManager.shared.handleOpenURL(url)
    }
}
```

### Update SceneDelegate.swift (iOS 13+)

```swift
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        window = UIWindow(windowScene: windowScene)
        // Setup root view controller
    }

    func scene(
        _ scene: UIScene,
        openURLContexts URLContexts: Set<UIOpenURLContext>
    ) {
        // Handle WeChat callback for iOS 13+
        for context in URLContexts {
            _ = OAuthManager.shared.handleOpenURL(context.url)
        }
    }
}
```

---

## Backend Integration

### API Endpoints

Your backend should implement the following endpoints:

#### Apple Sign In

```
POST /auth/apple
{
  "identity_token": "JWT",
  "authorization_code": "code",
  "user_identifier": "001234.abcd1234abcd1234abcd1234abcd1234.1234"
}

Response:
{
  "user": { ... },
  "session": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": "2024-..."
  }
}
```

**Backend Tasks:**
1. Verify Apple JWT signature using Apple's public keys
2. Extract `sub` (user identifier) and `email` from token
3. Check if user exists in database
4. If not, create new user account
5. Generate and return session tokens

#### WeChat Sign In

```
POST /auth/wechat
{
  "openid": "oXXXX...",
  "access_token": "token"
}

Response:
{
  "user": { ... },
  "session": { ... }
}
```

**Backend Tasks:**
1. Exchange OpenID and access token for user info from WeChat
2. Verify token validity
3. Check if user exists in database
4. If not, create new user account
5. Generate and return session tokens

#### Account Linking

```
POST /user/oauth/link
{
  "provider": "apple",  // or "wechat"
  "token": "..."
}

POST /user/oauth/unlink
{
  "provider": "apple",
  "account_id": "..."
}

GET /user/oauth/accounts
Response: [
  {
    "id": "...",
    "provider": "apple",
    "provider_user_id": "...",
    "email": "...",
    "is_primary": true,
    "linked_at": "2024-..."
  }
]
```

---

## Testing

### Apple Sign In Testing

1. **Sandbox Testing**:
   - Go to Apple Developer → **Users and Access** → **Sandbox**
   - Create sandbox testers (max 100)
   - Use sandbox accounts for testing

2. **Test Flow**:
   - Tap "Sign in with Apple"
   - Choose "Share My Email" or "Hide My Email"
   - Complete authentication
   - Verify user creation in backend

3. **Revocation Testing**:
   - Go to Settings → [Your Name] → Password & Security → Apps Using Apple ID
   - Revoke app access
   - Test credential state change handling

### WeChat Sign In Testing

1. **Development Testing**:
   - Use WeChat developer account
   - Register test device UDID in WeChat console
   - Sign app with development certificate

2. **Test Flow**:
   - Ensure WeChat app is installed
   - Tap "Sign in with WeChat"
   - Approve authorization in WeChat
   - Verify callback and token exchange

3. **Error Scenarios**:
   - WeChat not installed
   - User cancels authorization
   - Network timeout
   - Invalid token

---

## Security Considerations

### Apple Sign In

1. **Token Verification**:
   - Always verify JWT signature on backend
   - Use Apple's public keys (rotate automatically)
   - Check `iss` is `https://appleid.apple.com`
   - Check `aud` matches your bundle ID
   - Check `exp` is not expired

2. **Code Verification**:
   - Exchange `authorization_code` server-side
   - Use for initial authentication only
   - Never reuse authorization codes

3. **User Privacy**:
   - Handle "Hide My Email" properly
   - Store email relay addresses correctly
   - Respect user privacy preferences

### WeChat Sign In

1. **Secret Management**:
   - Never store `AppSecret` in client app
   - Keep on backend only
   - Use environment variables

2. **Token Storage**:
   - Store tokens in Keychain (iOS)
   - Use encrypted storage on backend
   - Implement token rotation

3. **API Security**:
   - Use HTTPS for all API calls
   - Validate all tokens server-side
   - Implement rate limiting

### General Security

1. **SSL Pinning**: Implement certificate pinning for production
2. **Code Obfuscation**: Use Swift obfuscation for sensitive constants
3. **Regular Audits**: Review OAuth implementation regularly
4. **Revocation Handling**: Implement proper credential revocation flow

---

## Troubleshooting

### Apple Sign In Issues

**Problem**: "Sign in with Apple is not available"
- **Solution**: Enable capability in Xcode → Signing & Capabilities

**Problem**: Invalid credential state
- **Solution**: Check bundle ID matches Apple Developer account

**Problem**: Email is nil
- **Solution**: User chose "Hide My Email" - handle relay address

### WeChat Sign In Issues

**Problem**: "WeChat is not installed"
- **Solution**: Install WeChat app or check URL scheme configuration

**Problem**: Invalid response from WeChat
- **Solution**: Verify AppID and AppSecret are correct

**Problem**: Callback not triggered
- **Solution**: Check URL scheme and AppDelegate/SceneDelegate setup

---

## Next Steps

1. ✅ Implement Apple Sign In service
2. ✅ Implement WeChat Sign In service
3. ✅ Create OAuthManager
4. ✅ Update LoginView UI
5. ⬜ Add to Xcode project
6. ⬜ Configure capabilities in Xcode
7. ⬜ Replace placeholder WeChat credentials
8. ⬜ Implement backend OAuth endpoints
9. ⬜ Test with sandbox accounts
10. ⬜ Deploy to production

---

## References

- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [WeChat Open Platform Documentation](https://open.weixin.qq.com/cgi-bin/showdocument?action=dir_list&t=resource/res_list&verify=1&id=open1419319164&token=&lang=zh_CN)
- [AuthenticationServices Framework](https://developer.apple.com/documentation/authenticationservices)

---

**Created**: 2026-02-26
**Phase**: 6G - Login System Extensions
**Status**: Implementation Complete, Configuration Pending
