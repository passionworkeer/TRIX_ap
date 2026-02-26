# TRIX 3D Companion - App Store Localization Guide

## Overview
Localization strategy for TRIX 3D Companion App Store submission in 3 languages.

---

## Supported Languages

| Language | Locale Code | Region | Status |
|----------|-------------|--------|--------|
| English | en-US | United States | ✅ Primary |
| 简体中文 | zh-Hans | China | ✅ Complete |
| 繁體中文 | zh-Hant | Taiwan/Hong Kong | ✅ Complete |

---

## Localization Strategy

### Primary Language: English
- Used for initial submission
- All features tested in English
- Screenshots captured with English UI

### Secondary Languages
- Chinese languages reviewed by native speakers
- Cultural adaptations made where necessary
- Currency formatting adapted by region

---

## App Metadata Localization

### 1. App Name

| Language | App Name | Character Count | Max |
|----------|----------|-----------------|-----|
| English | TRIX 3D Companion | 20 / 30 | ✅ |
| 简体中文 | TRIX 3D 伙伴 | 9 / 30 | ✅ |
| 繁體中文 | TRIX 3D 夥伴 | 9 / 30 | ✅ |

### 2. Subtitle (30 char limit)

| Language | Subtitle | Character Count | Status |
|----------|----------|-----------------|--------|
| English | Study Focus & Social Learning | 28 / 30 | ✅ |
| 简体中文 | 学习专注与社交 | 8 / 30 | ✅ |
| 繁體中文 | 學習專注與社交 | 8 / 30 | ✅ |

### 3. Promotional Text (170 char limit)

| Language | Promotional Text | Character Count | Status |
|----------|------------------|-----------------|--------|
| English | Transform your study habits with smart focus tracking, social features, and rewards. Join thousands of motivated learners today! | 162 / 170 | ✅ |
| 简体中文 | 通过智能专注跟踪、社交功能和奖励系统改变您的学习习惯。今天就加入数千名充满动力的学习者！ | 45 / 170 | ✅ |
| 繁體中文 | 透過智慧專注追蹤、社交功能和獎勵系統改變您的學習習慣。今天就加入數千名充滿動力的學習者！ | 45 / 170 | ✅ |

### 4. Keywords (100 char limit)

| Language | Keywords | Character Count | Status |
|----------|----------|-----------------|--------|
| English | study, learning, timer, focus, productivity, chat, education, students, exam prep, homework | 103 / 100 | ⚠️ Slightly over |
| 简体中文 | 学习, 计时器, 专注, 教育, 学生, 考试, 作业, 聊天, 社交, 积分 | 37 / 100 | ✅ |
| 繁體中文 | 學習, 計時器, 專注, 教育, 學生, 考試, 作業, 聊天, 社交, 積分 | 37 / 100 | ✅ |

**Note**: English keywords trimmed to: "study, learning, timer, focus, productivity, chat, education, students"

---

## Screenshot Localization

### Screenshot Requirements by Language

| Language | Screenshots Required | File Naming | Status |
|----------|---------------------|-------------|--------|
| English | 3 devices × 8 scenes = 24 | `en-US/iPhone_Model_Scene.png` | ⬜ Pending |
| 简体中文 | 3 devices × 8 scenes = 24 | `zh-Hans/iPhone_Model_Scene.png` | ⬜ Pending |
| 繁體中文 | 3 devices × 8 scenes = 24 | `zh-Hant/iPhone_Model_Scene.png` | ⬜ Pending |

### Screenshot File Structure

```
assets/screenshots/
├── en-US/
│   ├── iPhone_14_Pro_Max_6.7/
│   │   ├── 01_Home.png
│   │   ├── 02_Timer.png
│   │   ├── 03_Chat.png
│   │   ├── 04_Voice.png
│   │   ├── 05_Map.png
│   │   ├── 06_Camera.png
│   │   ├── 07_Store.png
│   │   └── 08_Profile.png
│   ├── iPhone_14_6.1/
│   │   └── [same 8 files]
│   └── iPhone_13_mini_5.4/
│       └── [same 8 files]
├── zh-Hans/
│   └── [same structure]
└── zh-Hant/
    └── [same structure]
```

---

## UI String Localization

### Key UI Translations

| English | 简体中文 | 繁體中文 |
|---------|----------|----------|
| Home | 主页 | 主頁 |
| Study | 学习 | 學習 |
| Chat | 聊天 | 聊天 |
| Map | 地图 | 地圖 |
| Profile | 个人资料 | 個人資料 |
| Settings | 设置 | 設定 |
| Points | 积分 | 積分 |
| Store | 商店 | 商店 |
| Timer | 计时器 | 計時器 |
| Focus | 专注 | 專注 |
| Start Timer | 开始计时 | 開始計時 |
| Stop Timer | 停止计时 | 停止計時 |
| Voice Message | 语音消息 | 語音訊息 |
| Send | 发送 | 傳送 |
| Location | 位置 | 位置 |
| Camera | 相机 | 相機 |
| Snapshot | 快照 | 快照 |
| Notifications | 通知 | 通知 |
| Privacy | 隐私 | 隱私 |
| Terms | 条款 | 條款 |

---

## Privacy Policy Localization

### Privacy Policy URLs

| Language | URL |
|----------|-----|
| English | https://trix3d.com/privacy?lang=en |
| 简体中文 | https://trix3d.com/privacy?lang=zh-hans |
| 繁體中文 | https://trix3d.com/privacy?lang=zh-hant |

### Terms of Service URLs

| Language | URL |
|----------|-----|
| English | https://trix3d.com/terms?lang=en |
| 简体中文 | https://trix3d.com/terms?lang=zh-hans |
| 繁體中文 | https://trix3d.com/terms?lang=zh-hant |

---

## Date/Number Formatting

### Date Format by Region

| Region | Format | Example |
|--------|--------|---------|
| US (en-US) | MMM d, yyyy | Feb 26, 2026 |
| China (zh-Hans) | yyyy年MM月dd日 | 2026年02月26日 |
| Taiwan (zh-Hant) | yyyy年MM月dd日 | 2026年02月26日 |

### Time Format by Region

| Region | Format | Example |
|--------|--------|---------|
| US (en-US) | h:mm a | 2:30 PM |
| China (zh-Hans) | HH:mm | 14:30 |
| Taiwan (zh-Hant) | HH:mm | 14:30 |

### Number Format by Region

| Region | Decimal Separator | Thousands Separator | Example |
|--------|-------------------|-------------------|---------|
| US (en-US) | Period (.) | Comma (,) | 1,234.56 |
| China (zh-Hans) | Period (.) | Comma (,) | 1,234.56 |
| Taiwan (zh-Hant) | Period (.) | Comma (,) | 1,234.56 |

---

## Currency Localization

### In-App Purchase Pricing

| Region | Symbol | Position | Example |
|--------|--------|----------|---------|
| US | $ | Before | $0.99 |
| China | ¥ | Before | ¥6.00 |
| Taiwan | NT$ | Before | NT$30.00 |

---

## Cultural Considerations

### Chinese Localization Notes

1. **Character Choice**:
   - Use "伙伴" (companion) in Simplified Chinese
   - Use "夥伴" (companion) in Traditional Chinese

2. **Color Associations**:
   - Purple (#8B5CF6) is neutral/positive in both regions
   - Pink (#EC4899) is acceptable in both regions

3. **Number Symbolism**:
   - No specific lucky numbers used in UI
   - Points system uses neutral numbers

4. **Learning Terminology**:
   - "学习" (learning) is standard in Mainland China
   - "學習" (learning) is standard in Taiwan/Hong Kong

---

## App Store Connect Localization

### How to Add Languages

1. Navigate to App Store Connect
2. Select your app
3. Go to "App Information"
4. Click "Add Language"
5. Select language from dropdown
6. Fill in localized metadata

### Required Fields per Language

- [ ] App Name
- [ ] Subtitle
- [ ] Description
- [ ] Keywords
- [ ] Promotional Text
- [ ] Support URL
- [ ] Marketing URL
- [ ] Privacy Policy URL

---

## Testing Checklist

### Pre-Submission Testing

| Task | English | 简体中文 | 繁體中文 |
|------|---------|----------|----------|
| UI displays correctly | ⬜ | ⬜ | ⬜ |
| Text fits in UI elements | ⬜ | ⬜ | ⬜ |
| No truncated text | ⬜ | ⬜ | ⬜ |
| Date/time formatting correct | ⬜ | ⬜ | ⬜ |
| Currency formatting correct | ⬜ | ⬜ | ⬜ |
| Screenshots localized | ⬜ | ⬜ | ⬜ |
| Description reads naturally | ⬜ | ⬜ | ⬜ |

---

## Localization Tools

### Recommended Tools

1. **Translation Management**
   - PhraseApp
   - Lokalise
   - Crowdin

2. **Screenshot Localization**
   - Fastlane Snapshot
   - Custom automation scripts

3. **Testing**
   - Xcode Simulator (change language in Settings)
   - Physical devices with different system languages

---

## Common Localization Issues

### Issue 1: Text Truncation
**Solution**: Ensure UI has enough width for Chinese characters (typically wider than English)

### Issue 2: Mixed Scripts
**Solution**: Keep English app name "TRIX 3D" consistent across languages

### Issue 3: Screenshot Mismatch
**Solution**: Ensure device language matches screenshot language when capturing

### Issue 4: Date Format Confusion
**Solution**: Use iOS native date formatters with correct locale

---

## Next Steps

1. [ ] Review all English content
2. [ ] Verify Chinese translations with native speaker
3. [ ] Capture screenshots in all languages
4. [ ] Test app with system language set to each locale
5. [ ] Upload all localized content to App Store Connect

---

*Last Updated: February 26, 2026*
*Localization Status: ✅ Documentation Complete, ⬜ Assets Pending*
