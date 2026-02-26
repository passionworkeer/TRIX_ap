# Voice Message Implementation

## Overview

This document describes the voice message functionality implemented for TRIX 3D Companion iOS app.

## Features

### 1. Voice Recording (`VoiceRecordingButton.swift`)

**Components:**
- `VoiceRecordingButton`: SwiftUI view with long-press recording
- `VoiceRecordingViewModel`: Manages recording state and AVAudioRecorder
- `RecordingState`: Enum tracking recording lifecycle

**Key Features:**
- Long press to start recording
- Real-time duration display
- Visual recording indicator with pulse animation
- Swipe up to cancel gesture
- Automatic stop at maximum duration (60 seconds)
- Microphone permission handling
- Temporary file management with auto-cleanup

**Usage Example:**

```swift
struct ChatView: View {
    var body: some View {
        VStack {
            // ... chat messages ...

            VoiceRecordingButton(
                onRecordingComplete: { audioURL in
                    // Send the voice message
                    sendMessage(audioURL: audioURL)
                },
                onCancelled: {
                    print("Recording cancelled")
                }
            )
        }
    }
}
```

### 2. Voice Message Playback (`VoiceMessageView.swift`)

**Components:**
- `VoiceMessageView`: Displays voice message with controls
- `VoiceMessageViewModel`: Manages playback state and AVAudioPlayer
- `VoiceMessageBubble`: Complete message bubble with alignment

**Key Features:**
- Play/pause toggle
- Waveform visualization (50 bars)
- Progress tracking with time display
- Seek functionality
- Incoming/outgoing message styling
- Error handling and display

**Usage Example:**

```swift
// Incoming message
VoiceMessageBubble(
    audioURL: message.audioURL,
    duration: message.duration,
    isIncoming: true
)

// Outgoing message
VoiceMessageBubble(
    audioURL: message.audioURL,
    duration: message.duration,
    isIncoming: false
)
```

### 3. Audio Player Extensions (`AVAudioPlayer+Extensions.swift`)

**Extensions:**
- `AVAudioPlayer.player(from:)` - Initialize from URL
- `AVAudioPlayer.player(from:completion:)` - Async initialization
- `AVAudioPlayer.player(from:)` - Initialize from Data
- Chaining methods: `withRate()`, `withVolume()`, `withLoops()`
- `TimeInterval.formattedDuration` - Format seconds as MM:SS

**Error Types:**
- `AudioPlayerError.fileNotFound` - File doesn't exist
- `AudioPlayerError.invalidData` - Invalid audio data
- `AudioPlayerError.playerCreationFailed` - Player init failed
- `AudioPlayerError.playbackFailed` - Playback error

**Usage Example:**

```swift
do {
    let player = try AVAudioPlayer.player(from: audioURL)
    player.play()
} catch {
    print("Failed to play audio: \(error)")
}
```

## Audio Configuration

### Recording Settings
- **Format**: MPEG-4 AAC (.m4a)
- **Sample Rate**: 44100 Hz
- **Channels**: 1 (Mono)
- **Quality**: Medium (AVAudioQuality.medium)
- **Max Duration**: 60 seconds

### File Management
- **Temp Directory**: `Documents/temp_recordings/`
- **File Naming**: `recording_{UUID}.m4a`
- **Auto Cleanup**: Files older than 1 hour are removed

## Permissions

### Microphone Permission
Required for voice recording. Already configured in `Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>需要麦克风权限来录制语音消息</string>
```

### Permission Flow
1. User long-presses recording button
2. App checks permission status
3. If not granted, requests permission
4. If denied, shows error message
5. If granted, starts recording

## Architecture

### MVVM Pattern
- **View**: SwiftUI components
- **ViewModel**: `@ObservableObject` managing state
- **Model**: AVAudioRecorder/AVAudioPlayer (Apple frameworks)

### State Management
- `@Published` properties for reactive UI updates
- `@StateObject` for ViewModels in views
- `@MainActor` for UI thread safety

### Error Handling
- Swift `Error` protocol with `LocalizedError`
- User-friendly error messages in Chinese
- Graceful degradation on failures

## Testing

### Unit Tests
- `AVAudioPlayer+ExtensionsTests.swift`
  - Initialization tests
  - Error handling tests
  - Duration formatting tests

- `VoiceRecordingButtonTests.swift`
  - Permission tests
  - State transition tests
  - File management tests

- `VoiceMessageViewTests.swift`
  - Playback state tests
  - Progress tracking tests
  - Time formatting tests
  - Error handling tests

## Integration

### Adding to ChatView

```swift
struct ChatView: View {
    @State private var showRecordingUI = false

    var body: some View {
        VStack {
            ScrollView {
                ForEach(messages) { message in
                    if message.type == .voice {
                        VoiceMessageBubble(
                            audioURL: message.audioURL!,
                            duration: message.duration ?? 0,
                            isIncoming: message.sender != .currentUser
                        )
                    }
                }
            }

            // Input toolbar
            HStack {
                // Text input field
                TextField("Message", text: $messageText)

                // Voice recording button
                Button {
                    showRecordingUI = true
                } label: {
                    Image(systemName: "mic.fill")
                }
            }
        }
        .sheet(isPresented: $showRecordingUI) {
            VoiceRecordingButton(
                onRecordingComplete: { url in
                    uploadVoiceMessage(url)
                    showRecordingUI = false
                },
                onCancelled: {
                    showRecordingUI = false
                }
            )
        }
    }
}
```

## Performance Considerations

### Memory Management
- ViewModels are `@StateObject` (not `@ObservedObject`)
- Proper cleanup in `deinit`
- Timer cleanup on stop/destroy
- Weak references in closures

### File I/O
- Temporary files cleaned up automatically
- Batch cleanup of old files (1 hour threshold)
- Efficient file I/O with async operations

### Audio Session
- Configured as `.record` category during recording
- Deactivated when not recording
- Proper error handling for session conflicts

## Future Enhancements

### Potential Features
1. Real-time waveform analysis during recording
2. Audio amplitude visualization
3. Playback speed control (0.5x, 1x, 1.5x, 2x)
4. Voice-to-text transcription
5. Audio compression options
6. Playback position scrubbing
7. Background playback support
8. Audio file encryption

### Known Limitations
- Waveform is currently simulated (not from actual audio data)
- No audio level meter during recording
- No playback speed controls
- No background playback
- Waveform generation could be CPU-intensive for long audio

## Troubleshooting

### Common Issues

**Issue**: Recording fails immediately
- **Solution**: Check microphone permission in Settings

**Issue**: Playback fails
- **Solution**: Verify file URL is valid and file exists

**Issue**: No sound during playback
- **Solution**: Check device volume and ringer switch

**Issue**: App crashes when accessing audio
- **Solution**: Ensure audio session is properly configured

## Files Created

### Source Files
1. `/ios/TRIX3DCompanion/Features/Chat/Views/VoiceRecordingButton.swift` (16.2 KB)
2. `/ios/TRIX3DCompanion/Features/Chat/Views/VoiceMessageView.swift` (13.1 KB)
3. `/ios/TRIX3DCompanion/Shared/Extensions/AVAudioPlayer+Extensions.swift` (5.7 KB)

### Test Files
1. `/ios/TRIX3DCompanionTests/VoiceRecordingButtonTests.swift` (3.7 KB)
2. `/ios/TRIX3DCompanionTests/VoiceMessageViewTests.swift` (5.9 KB)
3. `/ios/TRIX3DCompanionTests/AVAudioPlayer+ExtensionsTests.swift` (3.1 KB)

### Documentation
1. `/ios/VOICE_MESSAGE_IMPLEMENTATION.md` (this file)

## References

- [AVAudioRecorder Documentation](https://developer.apple.com/documentation/avfaudio/avaudiorecorder)
- [AVAudioPlayer Documentation](https://developer.apple.com/documentation/avfaudio/avaudioplayer)
- [AVAudioSession Documentation](https://developer.apple.com/documentation/avfaudio/avaudiosession)
- [SwiftUI File Dialog](https://developer.apple.com/documentation/swiftui/filedialog)

---

**Created**: 2026-02-26
**Version**: 1.0.0
**Author**: TRIX 3D Companion Team
