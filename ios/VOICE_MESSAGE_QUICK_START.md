# Voice Message Quick Start Guide

## Quick Implementation (5 Steps)

### 1. Add Voice Button to Chat Input

```swift
// In your chat input toolbar
HStack {
    TextField("Message", text: $messageText)

    if messageText.isEmpty {
        Button {
            showRecordingUI = true
        } label: {
            Image(systemName: "mic.fill")
        }
    }
}
```

### 2. Present Recording UI

```swift
.sheet(isPresented: $showRecordingUI) {
    VoiceRecordingButton(
        onRecordingComplete: { audioURL in
            // Handle recording
            handleVoiceMessage(audioURL)
            showRecordingUI = false
        },
        onCancelled: {
            showRecordingUI = false
        }
    )
}
```

### 3. Handle Recording

```swift
func handleVoiceMessage(_ url: URL) {
    let message = Message(
        type: .voice,
        audioURL: url,
        duration: getDuration(url)
    )
    messages.append(message)
}
```

### 4. Display Voice Messages

```swift
VoiceMessageBubble(
    audioURL: message.audioURL,
    duration: message.duration,
    isIncoming: message.isIncoming
)
```

### 5. Done!

That's it! Voice messages are now working.

---

## Complete Example

See `VoiceMessageIntegrationExample.swift` for a complete working example.

## Testing Checklist

- [ ] Microphone permission request appears
- [ ] Recording starts on long press
- [ ] Recording indicator shows
- [ ] Timer updates correctly
- [ ] Swipe up cancels recording
- [ ] Recording stops at 60 seconds
- [ ] Play/pause works
- [ ] Waveform displays
- [ ] Progress updates
- [ ] Time formatting correct
- [ ] Error messages display
- [ ] Temporary files cleaned up

## Common Issues

**Q: Recording fails immediately**
A: Check microphone permission in Settings > Privacy > Microphone

**Q: No sound during playback**
A: Check device volume and ensure audio session is configured

**Q: Recording doesn't stop at 60 seconds**
A: Ensure timer is running and `updateDuration()` is being called

## Next Steps

1. Integrate with your message model
2. Connect to your API for uploading
3. Add error handling
4. Test on real devices
5. Add any custom features

## Files Created

1. `VoiceRecordingButton.swift` - Recording UI
2. `VoiceMessageView.swift` - Playback UI
3. `AVAudioPlayer+Extensions.swift` - Utilities
4. Test files for TDD
5. Documentation and examples

---

**Questions?** Check `VOICE_MESSAGE_IMPLEMENTATION.md` for detailed docs.
