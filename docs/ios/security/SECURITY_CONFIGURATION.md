# Security Configuration Guide

This document explains how to configure sensitive information (API keys, secrets, etc.) for the TRIX 3D Companion iOS app.

## WeChat Sign In Configuration

The app requires WeChat App ID and App Secret for WeChat Sign In functionality. **NEVER commit actual credentials to version control.**

### Configuration Methods (in order of priority):

#### Method 1: Environment Variables (Recommended for CI/CD)

1. Copy the example environment file:
   ```bash
   cd ios/TRIX3DCompanion
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```
   WECHAT_APP_ID=your_actual_app_id_here
   WECHAT_APP_SECRET=your_actual_app_secret_here
   ```

3. Configure your IDE or CI/CD system to load these environment variables:
   - **Xcode**: Edit Scheme → Run → Arguments → Environment Variables
   - **CI/CD**: Set environment variables in your CI/CD platform settings

#### Method 2: Info.plist (For Local Development)

1. Open `Resources/Info.plist`
2. Find the `WECHAT_APP_ID` key
3. Replace `YOUR_WECHAT_APP_ID` with your actual App ID

**NOTE:** App Secret should NEVER be stored in Info.plist for security reasons. Always use environment variables for secrets.

### Security Best Practices

1. **Never commit credentials to git:**
   - `.env` files are already in `.gitignore`
   - Use placeholder values in Info.plist that you commit
   - Replace placeholders with real values locally (Info.plist changes won't be committed)

2. **Use different credentials per environment:**
   - Development: Use test/sandbox credentials
   - Production: Use production credentials via CI/CD secrets

3. **Rotate credentials regularly:**
   - If credentials are accidentally exposed, rotate them immediately
   - Use WeChat Open Platform console to regenerate App Secret

### Validation

The app will log a warning on startup if WeChat credentials are not configured:

```
WeChatSignInService: WeChat is not configured.
Please set WECHAT_APP_ID and WECHAT_APP_SECRET environment variables
or add WECHAT_APP_ID to Info.plist.
WeChat Sign In will be disabled until properly configured.
```

If you see this warning, WeChat Sign In will be disabled but the app will still function normally.

### Troubleshooting

**Q: I set the environment variables but still see the warning**

A: Make sure your IDE/CI system is loading the `.env` file. In Xcode, you need to manually add environment variables in the Scheme settings.

**Q: Can I store App Secret in Info.plist?**

A: NO! Info.plist is committed to version control. App Secret should only be stored in environment variables or secure secret management systems.

**Q: How do I configure credentials for App Store builds?**

A: Use your CI/CD system's secret management (e.g., GitHub Secrets, Bitrise Env Vars) to inject environment variables during the build process.

## Contact

For security concerns, contact: security@trix3d.com
