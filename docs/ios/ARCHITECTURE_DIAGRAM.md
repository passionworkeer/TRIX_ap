# Voice Message Architecture Diagram

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SwiftUI Views                             │
│                                                               │
│  ┌──────────────────────┐    ┌──────────────────────┐      │
│  │ VoiceRecordingButton │    │  VoiceMessageView    │      │
│  │                      │    │                      │      │
│  │  - Long press UI     │    │  - Play/pause UI     │      │
│  │  - Recording overlay │    │  - Waveform bars     │      │
│  │  - Cancel gesture    │    │  - Progress bar      │      │
│  │  - Timer display     │    │  - Time display      │      │
│  └──────────────────────┘    └──────────────────────┘      │
│           │                            │                     │
└───────────┼────────────────────────────┼─────────────────────┘
            │                            │
            ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     ViewModels                               │
│                                                               │
│  ┌──────────────────────┐    ┌──────────────────────┐      │
│  │ RecordingViewModel   │    │  MessageViewModel    │      │
│  │                      │    │                      │      │
│  │  @Published state    │    │  @Published state    │      │
│  │  - recordingState    │    │  - isPlaying         │      │
│  │  - duration          │    │  - currentTime       │      │
│  │  - hasPermission     │    │  - playbackProgress  │      │
│  │                      │    │  - waveformSamples   │      │
│  └──────────────────────┘    └──────────────────────┘      │
│           │                            │                     │
└───────────┼────────────────────────────┼─────────────────────┘
            │                            │
            ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   AVFoundation                               │
│                                                               │
│  ┌──────────────────────┐    ┌──────────────────────┐      │
│  │   AVAudioRecorder    │    │   AVAudioPlayer      │      │
│  │                      │    │                      │      │
│  │  - record()          │    │  - play()            │      │
│  │  - stop()            │    │  - pause()           │      │
│  │  - delegate          │    │  - stop()            │      │
│  └──────────────────────┘    └──────────────────────┘      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         AVAudioPlayer+Extensions                     │  │
│  │                                                       │  │
│  │  - player(from: URL)                                 │  │
│  │  - player(from: Data)                                │  │
│  │  - play(completion:)                                 │  │
│  │  - withRate(), withVolume(), withLoops()             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    File System                               │
│                                                               │
│  Documents/temp_recordings/                                  │
│  ├── recording_{UUID1}.m4a                                  │
│  ├── recording_{UUID2}.m4a                                  │
│  └── ... (auto-cleanup after 1 hour)                        │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Recording Flow

```
User Long Press
      │
      ▼
Check Permission ──────► No Permission ──────► Request Permission
      │                                                 │
      │ Yes                                             │
      ▼                                                 ▼
Configure Audio Session ◄─────────────────────────── Granted
      │
      ▼
Create AVAudioRecorder
      │
      ▼
Start Recording
      │
      ▼
Update Timer (0.1s interval)
      │
      ├──► Update Duration
      ├──► Update Progress
      └──► Check Max Duration (60s)
                │
                ▼
          User Release or Max Duration
                │
                ▼
          Stop Recording
                │
                ├──► Save to temp file
                └──► Return URL to caller
```

### Playback Flow

```
User Tap Play
      │
      ▼
Create AVAudioPlayer (if needed)
      │
      ▼
Load Audio File
      │
      ├──► Success ──────► Start Playback
      │                         │
      │                         ▼
      │                    Update Timer (0.1s)
      │                         │
      │                         ├──► Update currentTime
      │                         ├──► Update progress
      │                         └──► Update waveform
      │                                   │
      │                                   ▼
      │                              Playback Complete
      │                                   │
      │                                   ▼
      │                              Reset State
      │
      └──► Failure ──────► Show Error
```

## State Management

### Recording State Machine

```
         ┌─────────┐
         │  idle   │
         └────┬────┘
              │ startRecording()
              ▼
         ┌─────────┐
         │preparing│
         └────┬────┘
              │ recorder created
              ▼
    ┌─────────────────┐
    │   recording     │◄──────┐
    │  (progress: X)  │       │ timer update
    └────────┬────────┘───────┘
             │
     ┌───────┴────────┐
     │                │
     ▼                ▼
┌─────────┐     ┌─────────┐
│finished │     │cancelled│
│  (URL)  │     └─────────┘
└─────────┘
```

### Playback State Machine

```
         ┌─────────┐
         │ stopped │
         └────┬────┘
              │ togglePlayback()
              ▼
         ┌─────────┐
         │ playing │◄──────┐
         └────┬────┘       │ togglePlayback()
              │            │
              ▼            │
         ┌─────────┐       │
         │ paused  │───────┘
         └────┬────┘
              │ stopPlayback()
              ▼
         ┌─────────┐
         │ stopped │
         └─────────┘
```

## File Structure

```
TRIX3DCompanion/
│
├── Features/Chat/Views/
│   ├── VoiceRecordingButton.swift
│   │   ├── VoiceRecordingViewModel
│   │   ├── VoiceRecordingButton (View)
│   │   └── RecordingState (Enum)
│   │
│   ├── VoiceMessageView.swift
│   │   ├── VoiceMessageViewModel
│   │   ├── VoiceMessageView (View)
│   │   ├── VoiceMessageBubble (View)
│   │   └── WaveformBar (View)
│   │
│   ├── VoiceMessageIntegrationExample.swift
│       └── Integration examples
│
├── Features/Voice/Views/
│   ├── TTSControlView.swift
│   ├── VoiceMessagePlayerView.swift
│   └── VoiceFeatureIntegrationExample.swift
│
├── Shared/Extensions/
│   └── AVAudioPlayer+Extensions.swift
│       ├── AudioPlayerError (Enum)
│       ├── AVAudioPlayer extensions
│       └── TimeInterval extensions
│
└── Resources/
    └── Info.plist
        └── NSMicrophoneUsageDescription
```

## Error Handling Flow

```
Operation
    │
    ├─── Try Execution
    │        │
    │        ├─── Success ────► Return Result
    │        │
    │        └─── Failure ────► Catch Error
    │                              │
    │                              ▼
    │                         Map to AudioPlayerError
    │                              │
    │                              ├─── .fileNotFound
    │                              ├─── .invalidData
    │                              ├─── .playerCreationFailed
    │                              └─── .playbackFailed
    │                                     │
    └─────────────────────────────────────┴───► Update errorMessage
                                                 │
                                                 ▼
                                            Display to User
```

## Memory Management

```
View Lifecycle:
───────────────

Create View
    │
    ▼
@StateObject creates ViewModel
    │
    ▼
ViewModel initializes resources
    │
    ├─── AVAudioPlayer
    ├─── Timer
    └─── Cancellables
          │
          ▼
    View Active (Playing/Recording)
          │
          ▼
    User dismisses view
          │
          ▼
    ViewModel.deinit
          │
          ├─── Stop player
          ├─── Invalidate timer
          └─── Cancel subscriptions
```

## Permission Flow

```
App Launch
    │
    ▼
Check AVAudioSession.recordPermission
    │
    ├─── .granted ──────► hasPermission = true
    │
    ├─── .denied ───────► hasPermission = false
    │                        │
    │                        ▼
    │                   Show settings prompt
    │
    └─── .undetermined ──► Request Permission
                              │
                              ├─── Granted ──► hasPermission = true
                              │
                              └─── Denied ───► hasPermission = false
                                                   │
                                                   ▼
                                              Show error
```

---

## Integration Points

### 1. Chat Input Integration

```
ChatDetailView
    │
    ├─── Input Toolbar
    │        │
    │        ├─── Text Field
    │        ├─── Attachment Button
    │        └─── Voice Button ◄── VoiceRecordingButton
    │                                   │
    │                                   ▼
    │                            Recording Sheet
    │                                   │
    │                                   ▼
    │                            onRecordingComplete
    │                                   │
    │                                   ▼
    │                            Upload & Send
    │
    └─── Messages List
             │
             └─── VoiceMessageBubble ◄── VoiceMessageView (Features/Chat/Views)
```

### 2. Voice Feature Integration

```
Features/Voice/Views/
    ├─── VoiceMessagePlayerView ◄── Reusable TTS/voice playback player
    ├─── TTSControlView ◄── Text-to-speech control panel
    └─── VoiceFeatureIntegrationExample.swift
```

### 3. Message Model Integration

### 2. Message Model Integration

```
ChatMessage
    │
    ├─── type: .audio
    ├─── mediaUri: "file://..."
    ├─── mediaMetadata:
    │        └─── duration: Int
    │
    └─── ▼
    VoiceMessageBubble
         └─── VoiceMessageView
              └─── VoiceMessageViewModel
                   └─── AVAudioPlayer
```

---

**Architecture Pattern**: MVVM with SwiftUI
**Concurrency**: Async/Await + Combine
**State Management**: @Published + @StateObject
**Testing**: TDD with XCTest

**Last Updated**: 2026-03-31
