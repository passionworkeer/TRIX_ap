# Voice Feature Documentation

## Overview

The Voice feature provides comprehensive audio playback and text-to-speech functionality for the TRIX 3D Companion app. It consists of two main components:

1. **Voice Player** - Play and control voice message recordings
2. **Text-to-Speech (TTS)** - Convert text to speech with customizable settings

## Architecture

### ViewModels

#### `VoicePlayerViewModel`

Manages audio playback state and controls.

**Key Features:**
- Play/Pause/Stop controls
- Progress tracking with seek functionality
- Playback rate adjustment (0.5x, 1.0x, 1.5x, 2.0x)
- Skip forward/backward (±15 seconds)
- Error handling and display

**Published Properties:**
- `playbackState: PlaybackState` - Current playback state
- `isPlaying: Bool` - Whether audio is playing
- `currentTime: TimeInterval` - Current playback position
- `totalDuration: TimeInterval` - Total audio duration
- `playbackRate: Float` - Current playback speed
- `progress: Double` - Playback progress (0.0 - 1.0)
- `errorMessage: String?` - Error message if any

**Main Methods:**
```swift
// Playback controls
func togglePlayPause() async
func play(url: URL) async
func play(data: Data, filename: String) async
func pause() async
func stop() async

// Navigation
func seek(to time: TimeInterval) async
func seek(to progress: Double) async
func skipForward(_ seconds: TimeInterval = 5.0) async
func skipBackward(_ seconds: TimeInterval = 5.0) async

// Speed control
func setPlaybackRate(_ rate: Float) async
func setPlaybackRate(_ rateOption: PlaybackRate) async
```

#### `TTSViewModel`

Manages text-to-speech functionality.

**Key Features:**
- Text-to-speech conversion
- Multiple language support
- Speech rate and pitch control
- Preset messages for common scenarios
- Enable/disable TTS

**Published Properties:**
- `isSpeaking: Bool` - Whether TTS is currently speaking
- `isEnabled: Bool` - Whether TTS is enabled
- `speechRate: Float` - Speech rate (0.0 - 1.0)
- `speechPitch: Float` - Speech pitch (0.5 - 2.0)
- `selectedLanguage: TTSLanguage` - Current language
- `availableLanguages: [TTSLanguage]` - Available languages
- `textToSpeak: String` - Text to be spoken
- `errorMessage: String?` - Error message if any

**Main Methods:**
```swift
// Speech controls
func speak(_ text: String) async
func speakCurrentText() async
func stop() async
func pause() async
func resume() async

// Settings
func setRate(_ rate: Float) async
func setPitch(_ pitch: Float) async
func setLanguage(_ language: TTSLanguage) async

// Presets
func speakPomodoroStart() async
func speakPomodoroComplete() async
func speakRestComplete() async
func speakDailyGoalReminder() async
func speakNewMessage() async
func speakFriendRequest() async
```

### Views

#### `VoiceMessagePlayerView`

Full-featured voice player UI with glassmorphism design.

**Features:**
- Large play/pause button with gradient
- Skip forward/backward buttons (±15s)
- Stop button
- Interactive progress bar with drag gesture
- Time display (current/total)
- Speed selector (0.5x - 2.0x)
- Error message display

**Usage:**
```swift
// With URL
VoiceMessagePlayerView(
    audioURL: URL(fileURLWithPath: "/path/to/audio.m4a")
)

// With data
VoiceMessagePlayerView(
    audioData: audioData,
    filename: "recording.m4a"
)
```

#### `CompactVoicePlayerView`

Compact version for inline use in lists or cards.

**Features:**
- Play/pause button
- Mini progress bar
- Time labels
- Speed control menu

**Usage:**
```swift
CompactVoicePlayerView(
    audioURL: URL(fileURLWithPath: "/path/to/audio.m4a")
)
```

#### `TTSControlView`

Full-featured TTS control panel.

**Features:**
- Enable/disable toggle
- Text input area with character count
- Language selector
- Speech rate slider
- Speech pitch slider
- Quick action buttons for preset messages
- Settings panel with all controls

**Usage:**
```swift
TTSControlView(
    viewModel: customTTSViewModel // Optional
)
```

#### `CompactTTSControlView`

Compact TTS control for minimal UI footprint.

**Features:**
- Toggle switch
- Language display
- Speed indicator with menu

**Usage:**
```swift
CompactTTSControlView(
    viewModel: customTTSViewModel // Optional
)
```

#### `MiniTTSButton`

Minimal toggle button for quick TTS on/off.

**Usage:**
```swift
MiniTTSButton()
```

## Design System

### Colors

The Voice feature uses the app's color system:

- **Primary**: Purple (`#8B5CF6`) - Main action buttons, active states
- **Secondary**: Pink (`#EC4899`) - Gradients, accents
- **Text**: Uses semantic colors (`.textPrimary`, `.textSecondary`, `.textTertiary`)
- **Background**: Glassmorphism with `.ultraThinMaterial`

### Glassmorphism Effect

All panels use the `glassPanel()` modifier:

```swift
.padding(16)
.glassPanel(cornerRadius: 20)
```

This creates:
- Frosted glass background
- Gradient border overlay
- Subtle shadow
- Rounded corners

### Typography

- **Headlines**: `.headline` - Section titles
- **Body**: `.body` - Main content
- **Caption**: `.caption` - Labels, time displays
- **Monospaced**: `.system(.caption, design: .monospaced)` - Time labels

### Spacing

- **Section spacing**: 20pt
- **Element spacing**: 12-16pt
- **Padding**: 16pt (default), 8pt (compact)

## Integration Examples

### Example 1: Voice Message in Chat

```swift
struct ChatMessageView: View {
    let message: Message

    var body: some View {
        if message.type == .voice {
            CompactVoicePlayerView(
                audioURL: message.audioURL
            )
        }
    }
}
```

### Example 2: TTS for Study Timer

```swift
struct StudyTimerView: View {
    @StateObject private var ttsViewModel = TTSViewModel()

    var body: some View {
        VStack {
            // Timer UI...

            Button("开始专注") {
                Task {
                    await ttsViewModel.speakPomodoroStart()
                }
            }
        }
    }
}
```

### Example 3: Combined Voice Player + TTS

```swift
struct LecturePlayerView: View {
    @StateObject private var playerViewModel = VoicePlayerViewModel()
    @StateObject private var ttsViewModel = TTSViewModel()

    var body: some View {
        VStack(spacing: 20) {
            // Voice player
            VoiceMessagePlayerView(
                audioURL: lectureAudioURL,
                viewModel: playerViewModel
            )

            // TTS for notes
            TTSControlView(
                viewModel: ttsViewModel
            )
        }
    }
}
```

## Error Handling

Both ViewModels include error handling:

```swift
@Published var errorMessage: String?

// In your view
if let error = viewModel.errorMessage {
    Text(error)
        .foregroundColor(.red)
}
```

Clear errors:
```swift
viewModel.clearError()
```

## Accessibility

All views include:
- Semantic button labels
- Accessibility traits
- VoiceOver support
- Dynamic type support

## Dependencies

The Voice feature depends on:

- `VoicePlaybackService` - Audio playback service
- `TTSService` - Text-to-speech service
- `AVFoundation` - Audio framework
- `Combine` - Reactive programming

## Performance Considerations

1. **Memory Management**: ViewModels properly cleanup in `deinit`
2. **Timer Management**: Progress timers are stopped when not needed
3. **Async Operations**: All heavy operations use async/await
4. **State Management**: Uses `@MainActor` for UI updates

## Future Enhancements

Potential improvements:
- Waveform visualization for audio files
- Playlist support
- Background playback
- Custom audio effects (reverb, equalizer)
- Voice recording integration
- Offline voice downloading

## Testing

Preview all components in Xcode:
```swift
#Preview("Voice Player") {
    VoiceMessagePlayerView(
        audioURL: URL(fileURLWithPath: "/tmp/audio.m4a")
    )
}

#Preview("TTS Control") {
    TTSControlView()
}
```

## License

Part of the TRIX 3D Companion project.
