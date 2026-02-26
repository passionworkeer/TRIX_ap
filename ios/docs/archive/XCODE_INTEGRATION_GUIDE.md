# Xcode Project Integration Guide

## Files to Add to Project

### Add to TRIX3DCompanion Target

Add the following files to your Xcode project:

```
TRIX3DCompanion/
├── Shared/Extensions/
│   └── AVAudioPlayer+Extensions.swift
│
└── Features/Chat/Views/
    ├── VoiceRecordingButton.swift
    ├── VoiceMessageView.swift
    └── VoiceMessageIntegrationExample.swift (optional)
```

### Add to TRIX3DCompanionTests Target

Add the test files to your test target:

```
TRIX3DCompanionTests/
├── AVAudioPlayer+ExtensionsTests.swift
├── VoiceRecordingButtonTests.swift
└── VoiceMessageViewTests.swift
```

---

## Xcode Project Setup

### Option 1: Add Files via Xcode IDE

1. Right-click on `Shared/Extensions` group
2. Select "Add Files to TRIX3DCompanion..."
3. Navigate to and select `AVAudioPlayer+Extensions.swift`
4. Ensure "Copy items if needed" is unchecked (files already in project)
5. Ensure "Add to target: TRIX3DCompanion" is checked
6. Click "Add"

7. Right-click on `Features/Chat/Views` group
8. Repeat for voice-related Swift files
9. Add test files to TRIX3DCompanionTests target

### Option 2: Via Command Line (if using .xcodeproj)

```bash
# Navigate to iOS directory
cd /e/desktop/trix-3d-companion/ios

# If using xcodebuild or need to reference files:
# Files are already in the correct structure
# Just need to add them to Xcode project file
```

---

## Verify Project Configuration

### Check Build Settings

1. Select TRIX3DCompanion target
2. Check "Build Phases" > "Compile Sources"
3. Verify these files are listed:
   - AVAudioPlayer+Extensions.swift
   - VoiceRecordingButton.swift
   - VoiceMessageView.swift

4. Select TRIX3DCompanionTests target
5. Verify test files are listed

---

## Build and Test

### Build Project

```bash
# From ios directory
xcodebuild -project TRIX3DCompanion.xcodeproj \
  -scheme TRIX3DCompanion \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  clean build
```

### Run Tests

```bash
xcodebuild test \
  -project TRIX3DCompanion.xcodeproj \
  -scheme TRIX3DCompanion \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

---

## Permissions Verification

### Info.plist Check

Ensure these entries exist in `Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>需要麦克风权限来录制语音消息</string>
```

If not present, add it. (Already configured in current project)

---

## Framework Dependencies

Ensure these frameworks are linked:

1. Select TRIX3DCompanion target
2. Go to "Build Phases" > "Link Binary With Libraries"
3. Verify these are present:
   - AVFoundation.framework
   - SwiftUI.framework
   - Combine.framework
   - Foundation.framework

All should already be linked (standard iOS frameworks)

---

## Usage in Existing Views

### Update ChatDetailView

Add voice recording to existing `ChatDetailView.swift`:

```swift
// Add state variable
@State private var showRecordingUI = false

// Update input toolbar
var inputArea: some View {
    // ... existing code ...

    // Add voice button when text is empty
    if messageText.isEmpty {
        Button {
            showRecordingUI = true
        } label: {
            Image(systemName: "mic.fill")
                .font(.title2)
                .foregroundColor(.purple)
        }
    }
}

// Add sheet modifier
.sheet(isPresented: $showRecordingUI) {
    VoiceRecordingButton(
        onRecordingComplete: { url in
            Task {
                await chatService.sendVoiceMessage(url)
            }
            showRecordingUI = false
        },
        onCancelled: {
            showRecordingUI = false
        }
    )
}
```

### Update MessageCell

Modify `MessageCell` to display voice messages:

```swift
// In MessageCell body
if message.messageType == .audio {
    VoiceMessageBubble(
        audioURL: URL(fileURLWithPath: message.mediaUri ?? ""),
        duration: TimeInterval(message.mediaMetadata?.duration ?? 0),
        isIncoming: message.sender != .user
    )
}
```

---

## Troubleshooting Xcode Issues

### Issue: Files Not Found

**Solution**: Ensure files were added to correct target in Xcode

### Issue: Compile Errors

**Solution**:
1. Clean build folder (Cmd+Shift+K)
2. Clean build folder (Shift+Cmd+K)
3. Rebuild

### Issue: Tests Not Running

**Solution**:
1. Verify test files are in test target
2. Check test target settings
3. Enable "Enable Testability" in build settings

### Issue: Module Not Found

**Solution**:
1. Check import statements: `import TRIX3DCompanion`
2. Verify target membership
3. Clean and rebuild

---

## Project Structure After Integration

```
TRIX3DCompanion/
├── App/
│   ├── AppState.swift
│   ├── ContentView.swift
│   └── TRIX3DCompanionApp.swift
│
├── Core/
│   ├── Network/
│   ├── Services/
│   └── Storage/
│
├── Features/
│   ├── Auth/
│   ├── Chat/
│   │   └── Views/
│   │       ├── ChatDetailView.swift (existing)
│   │       ├── VoiceRecordingButton.swift ⭐ NEW
│   │       ├── VoiceMessageView.swift ⭐ NEW
│   │       └── VoiceMessageIntegrationExample.swift ⭐ NEW
│   └── Home/
│
├── Shared/
│   ├── Components/
│   ├── Extensions/
│   │   └── AVAudioPlayer+Extensions.swift ⭐ NEW
│   └── Models/
│
└── Resources/
    └── Info.plist
```

---

## Minimum iOS Version

The implementation requires:
- iOS 15.0+
- Xcode 14.0+
- Swift 5.7+

Verify deployment target in project settings:
1. Select TRIX3DCompanion target
2. "General" > "Minimum Deployments"
3. Set "iOS" to "15.0" or higher

---

## Next Steps After Integration

1. Build and run on simulator
2. Test on physical device (required for microphone)
3. Verify permission request appears
4. Test recording and playback
5. Run unit tests
6. Integrate with backend API
7. Test end-to-end flow

---

## Support Files Created

Documentation for reference:
- `VOICE_MESSAGE_IMPLEMENTATION.md` - Technical documentation
- `VOICE_MESSAGE_QUICK_START.md` - Quick integration guide
- `IMPLEMENTATION_SUMMARY.md` - Implementation overview

Example code:
- `VoiceMessageIntegrationExample.swift` - Complete working example

Test files:
- `AVAudioPlayer+ExtensionsTests.swift`
- `VoiceRecordingButtonTests.swift`
- `VoiceMessageViewTests.swift`

---

**Last Updated**: 2026-02-26
**Xcode Version**: Compatible with Xcode 14.0+
**iOS Target**: iOS 15.0+
