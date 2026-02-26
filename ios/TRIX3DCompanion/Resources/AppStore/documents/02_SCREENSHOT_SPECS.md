# TRIX 3D Companion - Screenshot Design Specifications

## Overview
Complete screenshot requirements for TRIX 3D Companion iOS app App Store submission.

---

## Device Requirements

### Required Devices
| Device | Screen Size | Resolution (pts) | Resolution (px) | Scale |
|--------|-------------|------------------|-----------------|-------|
| **iPhone 14 Pro Max** | 6.7" | 430 x 932 | 1290 x 2796 | @3x |
| **iPhone 14/14 Pro** | 6.1" | 393 x 852 | 1179 x 2556 | @3x |
| **iPhone 13 mini** | 5.4" | 375 x 812 | 1080 x 2340 | @3x |

### Minimum Screenshots
- **Minimum**: 2 per device
- **Maximum**: 10 per device
- **Recommended**: 6-8 per device

---

## Screenshot Scenes (8 Core Scenes)

### Scene 1: Home / Main Tab (Required)
**Purpose**: Show app's main interface and core value proposition

**Content**:
- Main tab bar visible
- Welcome message with user name
- Quick stats (study time today, current points)
- Recent activity overview
- Clean, organized layout

**Caption**:
- EN: "Your study journey starts here"
- ZH: "您的学习之旅从这里开始"

---

### Scene 2: Study Timer (Required)
**Purpose**: Showcase core study functionality

**Content**:
- Active study timer display
- Session duration
- Points earned indicator
- Focus mode status
- Start/Stop controls

**Caption**:
- EN: "Track your focus time, earn rewards"
- ZH: "记录专注时间，获取奖励"

---

### Scene 3: Real-time Chat (Required)
**Purpose**: Show social/communication features

**Content**:
- Chat conversation view
- Message bubbles (sent/received)
- Voice message waveform
- Image attachment preview
- Typing indicator

**Caption**:
- EN: "Stay connected with study partners"
- ZH: "与学习伙伴保持联系"

---

### Scene 4: Voice Message Playback
**Purpose**: Highlight voice features

**Content**:
- Voice message player
- Waveform visualization
- Play/pause controls
- Playback speed options
- Duration display

**Caption**:
- EN: "Send and receive voice messages"
- ZH: "发送和接收语音消息"

---

### Scene 5: Map / Location (Required)
**Purpose**: Show location discovery feature

**Content**:
- Map view with study spots
- User location marker
- Nearby locations list
- Location detail card
- Distance indicators

**Caption**:
- EN: "Discover study spots nearby"
- ZH: "发现附近的学习地点"

---

### Scene 6: Camera / Snapshots
**Purpose**: Highlight photo capture feature

**Content**:
- Camera viewfinder
- Capture button
- Photo gallery strip
- Recent snapshots
- Filter options

**Caption**:
- EN: "Capture your study moments"
- ZH: "记录您的学习时刻"

---

### Scene 7: Points Store
**Purpose**: Show gamification/rewards system

**Content**:
- Current points balance
- Available rewards
- Point packages for purchase
- Subscription options
- Redeem buttons

**Caption**:
- EN: "Earn points, unlock premium features"
- ZH: "赚取积分，解锁高级功能"

---

### Scene 8: Profile / Settings
**Purpose**: Show user management features

**Content**:
- User profile card
- Stats overview (total study time, sessions)
- Settings menu
- Privacy options
- Account management

**Caption**:
- EN: "Personalize your experience"
- ZH: "个性化您的体验"

---

## Technical Specifications

### File Format
- **Format**: PNG or JPEG
- **Color Space**: sRGB
- **Compression**: High quality (PNG-24 or JPEG 90%+)
- **File Size**: Max 10MB per screenshot
- **Transparency**: Not supported (must be opaque)

### Device Captures
**IMPORTANT**: Must use actual device screenshots
- ✅ Physical device screenshots
- ✅ Simulator screenshots with "Xcode" watermark
- ❌ Plain simulator screenshots (without watermark)
- ❌ Mockups or renders

### Frame Considerations
- No device frames (Apple will add automatically)
- Full screen content only
- Status bar visible (shows realism)
- Home indicator visible (for newer devices)

---

## Design Guidelines

### Visual Consistency
- **Color Scheme**: Consistent use of brand purple (#8B5CF6) and pink (#EC4899)
- **Typography**: Clear, readable at thumbnail sizes
- **Layout**: Balanced, not cluttered
- **Content**: Real data, not placeholder text

### Do's
✅ Use real app screenshots
✅ Show full screen including status bar
✅ Highlight key features in each screenshot
✅ Use consistent styling across all screenshots
✅ Include captions for each screenshot
✅ Show actual user data (sanitized)

### Don'ts
❌ Add device frames
❌ Include text overlays or callouts
❌ Use mockups or renders
❌ Show emulator/simulator without Xcode watermark
❌ Include other apps or UI elements
❌ Use placeholder content (Lorem ipsum)

---

## Localization

### English Screenshots
- Device language set to English
- All UI text in English
- App name: "TRIX 3D Companion"

### Chinese (Simplified) Screenshots
- Device language set to 简体中文
- All UI text in Simplified Chinese
- App name: "TRIX 3D 伙伴"

### Chinese (Traditional) Screenshots
- Device language set to 繁體中文
- All UI text in Traditional Chinese
- App name: "TRIX 3D 夥伴"

---

## File Naming Convention

```
screenshots/
├── en-US/
│   ├── iPhone_14_Pro_Max_6.7_01_Home.png
│   ├── iPhone_14_Pro_Max_6.7_02_Timer.png
│   ├── iPhone_14_Pro_Max_6.7_03_Chat.png
│   ├── ...
│   ├── iPhone_14_6.1_01_Home.png
│   ├── iPhone_13_mini_5.4_01_Home.png
│   └── ...
├── zh-Hans/
│   └── ... (same structure, Chinese UI)
└── zh-Hant/
    └── ... (same structure, Traditional Chinese UI)
```

---

## Screenshot Order (Recommended)

| Order | Scene | Priority |
|-------|-------|----------|
| 1 | Home / Main Tab | Required |
| 2 | Study Timer | Required |
| 3 | Real-time Chat | Required |
| 4 | Voice Message | High |
| 5 | Map / Location | High |
| 6 | Camera / Snapshots | Medium |
| 7 | Points Store | Medium |
| 8 | Profile / Settings | Low |

---

## Testing Checklist

### Pre-Submission Check
- [ ] All screenshots from actual devices (or simulator with Xcode watermark)
- [ ] Resolution matches device specifications exactly
- [ ] All screenshots in PNG or JPEG format
- [ ] File sizes under 10MB each
- [ ] No device frames added
- [ ] Status bar visible in all screenshots
- [ ] Consistent styling across all screenshots
- [ ] Captions prepared for all screenshots
- [ ] Localized screenshots for each language
- [ ] Screenshot order follows priority list

### Visual Quality Check
- [ ] Text is readable (especially at thumbnail sizes)
- [ ] Colors are accurate and consistent
- [ ] No artifacts or compression issues
- [ ] Proper aspect ratio maintained
- [ ] UI elements not cut off
- [ ] Home indicator visible (for iPhone X+)

---

## Tools for Screenshot Capture

### Recommended Tools
1. **Xcode Simulator** (with export)
   - File > Save Screen
   - Adds "Xcode" watermark automatically

2. **Physical Device Screenshots**
   - Press Power + Volume Up (iPhone X+)
   - Press Power + Home (iPhone 8 and earlier)

3. **Fastlane Snapshot** (Automated)
   - Automated screenshot capture
   - Multiple devices/languages
   - Consistent framing

### Screenshot Management Tools
- **App Store Connect**: Direct upload and management
- **Transporter**: Bulk upload tool
- **Fastlane**: Command-line upload automation

---

## References

- [Apple App Store Screenshots Guidelines](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications)

---

*Created: 2026-02-26*
*Last Updated: 2026-02-26*
