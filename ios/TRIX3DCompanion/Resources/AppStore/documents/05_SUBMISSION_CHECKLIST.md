# TRIX 3D Companion - App Store Connect Submission Checklist

## App Information

### Basic App Details
| Field | Value | Status |
|-------|-------|--------|
| **App Name** | TRIX 3D Companion | ✅ Ready |
| **Subtitle** | Study Focus & Social Learning | ✅ Ready |
| **Bundle ID** | com.trix3d.companion | ✅ Configured |
| **SKU** | TRI3DC001 | ✅ Ready |
| **Version** | 1.0.0 | ✅ Ready |
| **Primary Language** | English | ✅ Ready |

---

## App Store Information

### 1. App Information

#### General Information
- [ ] **App Name**: TRIX 3D Companion
  - English: TRIX 3D Companion
  - 简体中文: TRIX 3D 伙伴
  - 繁體中文: TRIX 3D 夥伴

- [ ] **Subtitle** (30 chars max)
  - English: Study Focus & Social Learning
  - 简体中文: 学习专注与社交
  - 繁體中文: 學習專注與社交

- [ ] **Category**: Education (Primary)

- [ ] **Secondary Category**: Social Networking

- [ ] **Content Copyright**: © 2026 TRIX 3D Team

---

## 2. Age Rating

### Age Rating Questionnaire Answers

#### Violent/Restrictive Content
- [ ] **Contains cartoon or fantasy violence?** → **NO**
- [ ] **Contains realistic violence?** → **NO**
- [ ] **Contains profanity or crude humor?** → **NO**
- [ ] **Contains mature/suggestive content?** → **NO**
- [ ] **Contains horror/fearsome content?** → **NO**
- [ ] **Contains gambling?** → **NO**
- [ ] **Contains drugs/alcohol/tobacco?** → **NO**

#### User Generated Content
- [ ] **Allows user-generated content?** → **YES**
  - [ ] **Can users communicate?** → **YES** (Chat feature)
  - [ ] **Can content be made public?** → **NO** (Private only)
  - [ ] **Is there content filtering?** → **YES**
  - [ ] **Can users report abuse?** → **YES**
  - [ ] **Is content moderated?** → **YES**

#### Children
- [ ] **Primarily directed at children under 13?** → **NO**

#### Privacy/Data Collection
- [ ] **Collects personal data?** → **YES** (Email for account)
- [ ] **Shares data with third parties?** → **NO**
- [ ] **Uses device advertising ID?** → **NO**
- [ ] **Collects location data?** → **YES** (With consent only)

#### Commerce
- [ ] **Contains in-app purchases?** → **YES**
- [ ] **Contains third-party ads?** → **NO**

### Final Age Rating
**Expected Rating**: 4+ (Contains no objectionable material)

---

## 3. App Privacy

### Privacy Details in App Store Connect

#### Data Collection
- [ ] **Contact Info** (Email)
  - **Purpose**: Account creation, authentication
  - **Used for**: Product functionality, Account management
  - **Linked to user**: Yes
  - **Tracking**: No
  - **Third party sharing**: No

- [ ] **User Content** (Messages, Photos)
  - **Purpose**: Chat functionality
  - **Used for**: Product functionality
  - **Linked to user**: Yes
  - **Tracking**: No
  - **Third party sharing**: No

- [ ] **Location** (Precise & Approximate)
  - **Purpose**: Location discovery & sharing
  - **Used for**: Product functionality, Analytics
  - **Linked to user**: Yes
  - **Tracking**: No
  - **Third party sharing**: No

- [ ] **Usage Data** (Study sessions, Points)
  - **Purpose**: Points system, Statistics
  - **Used for**: Product functionality, Analytics
  - **Linked to user**: Yes
  - **Tracking**: No
  - **Third party sharing**: No

#### Privacy Policy URL
- [ ] **English**: https://trix3d.com/privacy?lang=en
- [ ] **简体中文**: https://trix3d.com/privacy?lang=zh-hans
- [ ] **繁體中文**: https://trix3d.com/privacy?lang=zh-hant

---

## 4. Pricing and Availability

### Distribution
- [ ] **Countries**: All territories (Worldwide)
- [ ] **Price**: Free (with in-app purchases)

### In-App Purchases
| Product Name | Product ID | Type | Price Tier |
|--------------|------------|------|------------|
| 100 Points | com.trix3d.points.100 | Consumable | Tier 1 ($0.99) |
| 500 Points | com.trix3d.points.500 | Consumable | Tier 3 ($2.99) |
| 1000 Points | com.trix3d.points.1000 | Consumable | Tier 5 ($4.99) |
| Monthly Premium | com.trix3d.premium.monthly | Auto-Renewable | Tier 6 ($6.99) |
| Yearly Premium | com.trix3d.premium.yearly | Auto-Renewable | Tier 9 ($49.99) |

---

## 5. App Information

### Promotional Text (170 chars max)
```
English: Transform your study habits with smart focus tracking, social features, and rewards. Join thousands of motivated learners today!
简体中文: 通过智能专注跟踪、社交功能和奖励系统改变您的学习习惯。今天就加入数千名充满动力的学习者！
繁體中文: 透過智慧專注追蹤、社交功能和獎勵系統改變您的學習習慣。今天就加入數千名充滿動力的學習者！
```

### Description
- [ ] **English**: Copy from `03_DESCRIPTIONS.md`
- [ ] **简体中文**: Copy from `03_DESCRIPTIONS.md`
- [ ] **繁體中文**: Copy from `03_DESCRIPTIONS.md`

### Keywords (100 chars max)
```
English: study, learning, timer, focus, productivity, chat, education
简体中文: 学习, 计时器, 专注, 教育, 学生, 考试
繁體中文: 學習, 計時器, 專注, 教育, 學生, 考試
```

### Support URL
- [ ] **URL**: https://trix3d.com/support

### Marketing URL
- [ ] **URL**: https://trix3d.com

---

## 6. Build Information

### Upload Requirements
- [ ] **Build File**: .ipa file exported from Xcode
- [ ] **Version**: 1.0.0
- [ ] **Build Number**: 1
- [ ] **Provisioning Profile**: App Store distribution
- [ ] **Code Signing**: Apple Distribution certificate

### App Thinning
- [ ] **Universal device support**: iPhone + iPad
- [ ] **64-bit only**: Yes

### Export Instructions
```bash
# Using Xcode Organizer
1. Product → Archive
2. Wait for archive to complete
3. Window → Organizer
4. Select archive → Distribute App
5. Choose "App Store Connect"
6. Upload
```

---

## 7. App Store Assets

### 7.1 App Icon
- [ ] **1024 x 1024** PNG (no transparency)
- [ ] Follows design specs in `01_ICON_SPECS.md`

### 7.2 Screenshots

#### iPhone 6.7" Display (iPhone 14 Pro Max)
| Scene | File | Status |
|-------|------|--------|
| Home | iPhone_14_Pro_Max_6.7_01_Home.png | ⬜ Upload |
| Timer | iPhone_14_Pro_Max_6.7_02_Timer.png | ⬜ Upload |
| Chat | iPhone_14_Pro_Max_6.7_03_Chat.png | ⬜ Upload |
| Voice | iPhone_14_Pro_Max_6.7_04_Voice.png | ⬜ Upload |
| Map | iPhone_14_Pro_Max_6.7_05_Map.png | ⬜ Upload |
| Camera | iPhone_14_Pro_Max_6.7_06_Camera.png | ⬜ Upload |
| Store | iPhone_14_Pro_Max_6.7_07_Store.png | ⬜ Upload |
| Profile | iPhone_14_Pro_Max_6.7_08_Profile.png | ⬜ Upload |

#### iPhone 6.1" Display (iPhone 14/14 Pro)
| Scene | File | Status |
|-------|------|--------|
| Home | iPhone_14_6.1_01_Home.png | ⬜ Upload |
| [Repeat same scenes] | | |

#### iPhone 5.4" Display (iPhone 13 mini)
| Scene | File | Status |
|-------|------|--------|
| Home | iPhone_13_mini_5.4_01_Home.png | ⬜ Upload |
| [Repeat same scenes] | | |

### 7.3 App Preview Videos (Optional)
- [ ] **15-30 seconds** optional preview video
- [ ] Format: .mov
- [ ] Resolution: Match device screenshots
- [ ] Status: Not required for initial submission

---

## 8. Review Information

### Test Account
```
Email: test@trix3d.com
Password: Test1234!
```

### Demo Notes
```
TRIX 3D Companion is a study companion app featuring:

Core Features:
1. Study Timer with Points System
   - Start a timer from Home tab
   - Points are awarded for completed sessions

2. Real-time Chat
   - Use test account to send messages
   - Try voice message recording and playback
   - Send image attachments

3. Location Discovery
   - View nearby study spots on Map tab
   - Share location with friends

4. Photo Capture
   - Take snapshots from Camera tab
   - View snapshot gallery

5. Points Store
   - View available point packages
   - Browse subscription options

Note: In-app purchases are functional but free for review purposes using test account.
```

### Review Notes
```
This app requires:
- Internet connection for chat and sync
- Location permission for map features
- Camera permission for photo capture
- Microphone permission for voice messages
- Photo library permission for saving photos

All permissions are optional except camera (for core feature).

No third-party ads or analytics that share user data.
```

---

## 9. Version Information

### What's New (Version 1.0.0)
```
Initial Release! 🎉

We're excited to launch TRIX 3D Companion with:
• Smart study timer with points system
• Real-time chat with voice messages
• Location discovery for study spots
• Photo capture and sharing
• Personalized profiles and stats

Start your learning journey today!
```

---

## 10. Compliance

### GDPR Compliance
- [ ] Privacy policy posted for EU users
- [ ] Data export functionality available
- [ ] Right to deletion implemented
- [ ] Cookie policy not applicable (native app)

### CCPA Compliance
- [ ] Do Not Sell My Information link
- [ ] California residents can opt-out
- [ ] Data deletion rights available

### COPPA Compliance
- [ ] App is not intended for under 13
- [ ] Age verification implemented
- [ ] Parental consent features available

---

## 11. Pre-Submission Checklist

### Technical
- [ ] All features work without crashes
- [ ] No placeholder content or Lorem Ipsum
- [ ] All permissions requested in Info.plist
- [ ] Background modes properly configured
- [ ] App works on all supported iOS versions
- [ ] 64-bit architecture only
- [ ] No private APIs used
- [ ] No deprecated APIs

### Content
- [ ] All screenshots from real devices
- [ ] All text localized properly
- [ ] No offensive or inappropriate content
- [ ] No copyrighted material without permission
- [ ] No references to competing platforms

### Legal
- [ ] Privacy policy URL valid
- [ ] Terms of Service URL valid
- [ ] Support URL valid
- [ ] Copyright notice included
- [ ] No trademark infringement

### Testing
- [ ] Tested on physical devices
- [ ] Tested on different iOS versions
- [ ] Tested on different screen sizes
- [ ] Tested with poor network conditions
- [ ] Tested with permissions denied
- [ ] Test account ready for review

---

## 12. Post-Submission

### Monitor for Review Status
- [ ] Wait for Apple review (typically 24-48 hours)
- [ ] Check for rejection reasons
- [ ] Respond to review requests promptly

### If Rejected
- [ ] Read rejection message carefully
- [ ] Fix all issues mentioned
- [ ] Resubmit with explanation of fixes
- [ ] Consider escalation if unfair rejection

### If Approved
- [ ] Prepare launch announcement
- [ ] Update social media
- [ ] Monitor App Store reviews
- [ ] Prepare first update plan

---

## Submission Timeline

### Estimated Time to Approval
| Step | Duration |
|------|----------|
| Prepare assets | 1-2 days |
| Upload build | 1-2 hours |
| Submit for review | 30 minutes |
| **Apple Review** | **24-72 hours** |
| Total | **2-5 days** |

### Urgent Submission (Expedited Review)
- [ ] Request expedited review if:
  - Time-sensitive event
  - Bug fix critical to users
  - Alignment with iOS release

---

## Contact Information

### Apple Developer Relations
- **Developer Account**: [Your Apple Developer Email]
- **Team ID**: [Your Team ID]
- **Seller Name**: [Your Seller Name]

### App Support
- **Support Email**: support@trix3d.com
- **Privacy Email**: privacy@trix3d.com
- **Website**: https://trix3d.com

---

**Submission Checklist Version**: 1.0
**Last Updated**: February 26, 2026
**Status**: ⬜ Not Started / 🟡 In Progress / ✅ Complete / ❌ Failed

---

*Good luck with your submission! 🚀*
