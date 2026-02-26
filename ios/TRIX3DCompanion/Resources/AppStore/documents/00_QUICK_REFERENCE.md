# TRIX 3D Companion - App Store Quick Reference

Quick reference guide for App Store submission and asset requirements.

---

## 🚀 Quick Start (5-Minute Overview)

### What You Need to Submit

| Asset | Quantity | Status |
|-------|----------|--------|
| **App Icon** | 11 sizes | ⬜ Pending |
| **Screenshots** | 3 devices × 8 scenes × 3 languages = 72 | ⬜ Pending |
| **Description** | 3 languages | ✅ Ready |
| **Privacy Policy** | 3 languages | ✅ Ready |
| **Build** | 1 .ipa file | ⬜ Pending |

---

## 📱 Device Specifications

### Required Screenshot Devices

| Device | Resolution | Screenshot Count |
|--------|-----------|------------------|
| iPhone 14 Pro Max (6.7") | 1290 x 2796 px | 8 |
| iPhone 14/14 Pro (6.1") | 1179 x 2556 px | 8 |
| iPhone 13 mini (5.4") | 1080 x 2340 px | 8 |

**Total: 24 screenshots per language × 3 languages = 72 screenshots**

---

## 🎨 Icon Sizes (All Required)

| Size | Usage |
|------|-------|
| 1024 × 1024 | App Store |
| 180 × 180 | iPhone @3x |
| 120 × 120 | iPhone @2x |
| 167 × 167 | iPad Pro @2x |
| 152 × 152 | iPad @2x |
| 76 × 76 | iPad @1x |

**Plus**: Spotlight, Settings, and Notification sizes

---

## 📝 Text Limits

### Character Counts

| Field | Max | English | 简体中文 | 繁體中文 |
|-------|-----|---------|----------|----------|
| **App Name** | 30 | 20 | 9 | 9 |
| **Subtitle** | 30 | 28 | 8 | 8 |
| **Keywords** | 100 | 100 | 37 | 37 |
| **Promotional Text** | 170 | 162 | 45 | 45 |
| **Description** | 4000 | ~2000 | ~1500 | ~1500 |

---

## 🌐 Localization

### Languages

| Code | Language | Region |
|------|----------|--------|
| en-US | English | United States |
| zh-Hans | 简体中文 | China |
| zh-Hant | 繁體中文 | Taiwan/Hong Kong |

---

## 🔐 Permissions Required

| Permission | Purpose | Required |
|------------|---------|----------|
| `NSCameraUsageDescription` | QR scanning, photos | Yes |
| `NSMicrophoneUsageDescription` | Voice messages | Yes |
| `NSLocationWhenInUseUsageDescription` | Study spots, location sharing | Yes |
| `NSPhotoLibraryUsageDescription` | Save/select photos | Yes |
| `NSPhotoLibraryAddUsageDescription` | Save photos | Yes |

---

## 📊 Age Rating

**Expected Rating: 4+**

| Question | Answer |
|----------|--------|
| Violent content | ❌ No |
| User-generated content | ✅ Yes (with filtering) |
| Third-party ads | ❌ No |
| In-app purchases | ✅ Yes |
| Collects location | ✅ Yes (with consent) |

---

## 💰 In-App Purchases

| Product | ID | Type | Price |
|---------|-----|------|-------|
| 100 Points | `com.trix3d.points.100` | Consumable | $0.99 |
| 500 Points | `com.trix3d.points.500` | Consumable | $2.99 |
| 1000 Points | `com.trix3d.points.1000` | Consumable | $4.99 |
| Monthly Premium | `com.trix3d.premium.monthly` | Auto-Renewable | $6.99 |
| Yearly Premium | `com.trix3d.premium.yearly` | Auto-Renewable | $49.99 |

---

## 🌐 URLs

| Type | URL |
|------|-----|
| **Privacy Policy** | https://trix3d.com/privacy |
| **Terms of Service** | https://trix3d.com/terms |
| **Support** | https://trix3d.com/support |
| **Marketing** | https://trix3d.com |

---

## 📋 Submission Checklist

### Pre-Submission
- [ ] All features tested on physical devices
- [ ] All 11 icon sizes created
- [ ] All 72 screenshots captured
- [ ] Privacy policy hosted online
- [ ] Terms of service hosted online
- [ ] Support page available
- [ ] Build archived and ready

### Technical
- [ ] No placeholder content
- [ ] No crashes or critical bugs
- [ ] All permissions in Info.plist
- [ ] 64-bit architecture only
- [ ] Meets App Store Review Guidelines

### Legal
- [ ] Copyright notice included
- [ ] No trademark infringement
- [ ] No copyrighted material without permission
- [ ] GDPR compliant
- [ ] CCPA compliant

---

## ⏱️ Timeline Estimate

| Task | Duration |
|------|----------|
| Icon design | 2-3 days |
| Screenshot capture | 1-2 days |
| Build upload | 1-2 hours |
| **Apple Review** | **24-72 hours** |

**Total: 4-7 days from start to approval**

---

## 🎯 Screenshot Scenes (8 Required)

1. **Home** - Main interface, quick stats
2. **Timer** - Study timer in action
3. **Chat** - Real-time messaging
4. **Voice** - Voice message playback
5. **Map** - Location discovery
6. **Camera** - Photo capture
7. **Store** - Points and rewards
8. **Profile** - User settings

---

## 📁 File Naming Convention

### Screenshots
```
[Language]/[Device]_[Scene].png

Examples:
en-US/iPhone_14_Pro_Max_6.7_01_Home.png
zh-Hans/iPhone_14_6.1_02_Timer.png
zh-Hant/iPhone_13_mini_5.4_03_Chat.png
```

### Icons
```
AppIcon-[Size].png

Examples:
AppIcon-1024.png
AppIcon-180.png
AppIcon-60@2x.png
```

---

## 🔧 Common Commands

### Archive and Upload
```bash
# Using Xcode
1. Product → Archive
2. Window → Organizer
3. Distribute App → App Store Connect
4. Upload
```

### Capture Screenshots (Simulator)
```bash
# Press Cmd+S while simulator is active
# Or use File > Save Screen
```

### Export Icons (Figma)
```
1. Design at 1024x1024
2. Export at 1x, 2x, 3x scales
3. Use PNG format
```

---

## 📞 Contacts

| Role | Email |
|------|-------|
| **Privacy** | privacy@trix3d.com |
| **Support** | support@trix3d.com |
| **Developer** | [Dev Email] |

---

## ⚠️ Common Rejection Reasons

1. **Incomplete metadata** - Fill all required fields
2. **Missing permissions** - Add all usage descriptions
3. **Placeholder content** - Use real content only
4. **Simulator screenshots** - Use device or Xcode-watermarked simulator
5. **Crash on launch** - Thoroughly test on devices
6. **Missing privacy policy** - Host before submission

---

## 📚 Full Documentation

| Document | Description |
|----------|-------------|
| `01_ICON_SPECS.md` | Complete icon design specifications |
| `02_SCREENSHOT_SPECS.md` | Screenshot requirements and scenes |
| `03_DESCRIPTIONS.md` | Bilingual app descriptions |
| `04_PRIVACY_POLICY.md` | Privacy policy template |
| `05_SUBMISSION_CHECKLIST.md` | Complete submission checklist |
| `06_LOCALIZATION_GUIDE.md` | Localization strategy and details |

---

## ✅ Final Check Before Submitting

- [ ] Read `05_SUBMISSION_CHECKLIST.md`
- [ ] All items marked complete
- [ ] Build tested on physical device
- [ ] Screenshots reviewed for quality
- [ ] All descriptions spell-checked
- [ ] Privacy policy URL accessible
- [ ] Test account credentials ready
- [ ] Review notes prepared

---

**Good luck with your submission! 🚀**

---

*Last Updated: February 26, 2026*
*Status: Ready for Asset Creation*
