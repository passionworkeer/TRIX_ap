//
//  VoiceMessageIntegrationExample.swift
//  TRIX3DCompanion
//
//  Created by TRIX 3D Companion Team
//  Example: How to integrate voice message functionality into existing chat views
//

import SwiftUI

// MARK: - Enhanced Chat Detail View with Voice Messages

/// Example showing how to integrate voice recording into existing ChatDetailView
extension ChatDetailView {

    /// Enhanced input area with voice recording support
    func inputAreaWithVoice(
        messageText: Binding<String>,
        isInputFocused: FocusState<Bool>,
        showRecordingUI: Binding<Bool>,
        onRecordingComplete: @escaping (URL) -> Void
    ) -> some View {
        HStack(alignment: .bottom, spacing: 12) {
            // Attachment button
            Button(action: { }) {
                Image(systemName: "plus.circle.fill")
                    .font(.title2)
                    .foregroundColor(.purple)
            }

            // Text input
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Type a message...", text: messageText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .focused(isInputFocused)
                    .lineLimit(1...6)

                // Voice button (shown when text is empty)
                if messageText.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button {
                        showRecordingUI.wrappedValue = true
                    } label: {
                        Image(systemName: "mic.fill")
                            .font(.title2)
                            .foregroundColor(.purple)
                    }
                }

                // Send button (shown when text is entered)
                if !messageText.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button(action: {}) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundColor(.purple)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 20))
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .sheet(isPresented: showRecordingUI) {
            VoiceRecordingButton(
                onRecordingComplete: { url in
                    onRecordingComplete(url)
                    showRecordingUI.wrappedValue = false
                },
                onCancelled: {
                    showRecordingUI.wrappedValue = false
                }
            )
        }
    }
}

// MARK: - Complete Example View

/// A complete example demonstrating voice message integration
struct VoiceMessageIntegrationExample: View {

    // MARK: - State

    @State private var messages: [ChatMessage] = []
    @State private var messageText = ""
    @State private var showRecordingUI = false

    @FocusState private var isInputFocused: Bool

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Messages list
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(messages) { message in
                        MessageRow(message: message)
                            .transition(.slide.combined(with: .opacity))
                    }
                }
                .padding()
            }

            Divider()

            // Input toolbar
            enhancedInputToolbar
        }
        .navigationTitle("Voice Chat Demo")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Enhanced Input Toolbar

    private var enhancedInputToolbar: some View {
        HStack(alignment: .bottom, spacing: 12) {
            // Quick actions
            HStack(spacing: 8) {
                Button {
                    // Show attachment options
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundColor(.gray)
                }

                Button {
                    // Show camera
                } label: {
                    Image(systemName: "camera.fill")
                        .font(.title2)
                        .foregroundColor(.gray)
                }
            }

            // Text input with voice button
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Message", text: $messageText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .focused($isInputFocused)
                    .lineLimit(1...4)

                // Voice recording button
                if messageText.isEmpty {
                    Button {
                        showRecordingUI = true
                    } label: {
                        Image(systemName: "mic.fill")
                            .font(.title2)
                            .foregroundColor(.purple)
                    }
                    .accessibilityLabel("Record voice message")
                }

                // Send button
                if !messageText.isEmpty {
                    Button {
                        sendTextMessage()
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundColor(.purple)
                    }
                    .accessibilityLabel("Send message")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color(.systemGray6))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color(.systemGray4), lineWidth: 0.5)
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .sheet(isPresented: $showRecordingUI) {
            VoiceRecordingButton(
                onRecordingComplete: { audioURL in
                    handleRecordingComplete(audioURL)
                },
                onCancelled: {
                    SecureLogger.shared.debug("Recording cancelled")
                }
            )
        }
    }

    // MARK: - Actions

    private func sendTextMessage() {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        let newMessage = ChatMessage(
            id: UUID().uuidString,
            type: .text,
            text: text,
            imageURL: nil,
            audioURL: nil,
            duration: nil,
            isIncoming: false,
            timestamp: Date(),
            senderName: "Me"
        )

        withAnimation(.spring()) {
            messages.append(newMessage)
        }

        messageText = ""
    }

    private func handleRecordingComplete(_ audioURL: URL) {
        // Get audio duration
        let duration = getAudioDuration(from: audioURL)

        // Create voice message
        let voiceMessage = ChatMessage(
            id: UUID().uuidString,
            type: .voice,
            text: nil,
            imageURL: nil,
            audioURL: audioURL,
            duration: duration,
            isIncoming: false,
            timestamp: Date(),
            senderName: "Me"
        )

        withAnimation(.spring()) {
            messages.append(voiceMessage)
        }

        // Upload to server
        Task {
            await uploadVoiceMessage(audioURL)
        }
    }

    private func getAudioDuration(from url: URL) -> TimeInterval {
        // In production, use AVAsset to get actual duration
        // For demo, return placeholder
        return 25.0
    }

    private func uploadVoiceMessage(_ url: URL) async {
        // TODO: Implement upload to server
        SecureLogger.shared.debug("Uploading voice message: \(url)")
    }
}

// MARK: - Simplified Message Model for Demo

enum DemoMessageType {
    case text
    case voice
    case image
}

struct ChatMessage: Identifiable {
    let id: String
    let type: DemoMessageType
    let text: String?
    let imageURL: URL?
    let audioURL: URL?
    let duration: TimeInterval?
    let isIncoming: Bool
    let timestamp: Date
    let senderName: String
}

// MARK: - Message Row Component

struct MessageRow: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.isIncoming {
                messageContent
                Spacer(minLength: 60)
            } else {
                Spacer(minLength: 60)
                messageContent
            }
        }
    }

    @ViewBuilder
    private var messageContent: some View {
        VStack(alignment: message.isIncoming ? .leading : .trailing, spacing: 4) {
            switch message.type {
            case .text:
                Text(message.text ?? "")
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(message.isIncoming ? Color(.systemBackground) : Color.purple)
                    .foregroundColor(message.isIncoming ? .primary : .white)
                    .clipShape(RoundedRectangle(cornerRadius: 20))

            case .voice:
                VoiceMessageBubble(
                    audioURL: message.audioURL!,
                    duration: message.duration ?? 0,
                    isIncoming: message.isIncoming
                )

            case .image:
                AsyncImage(url: message.imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    case .empty, .failure:
                        Rectangle()
                            .fill(Color.gray.opacity(0.2))
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(width: 200, height: 200)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }

            // Timestamp
            Text(message.timestamp, style: .time)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Preview

#Preview("Voice Message Integration") {
    NavigationView {
        VoiceMessageIntegrationExample()
            .onAppear {
                // Pre-populate with some messages
            }
    }
}

// MARK: - Usage Tips

/*
 ## INTEGRATION TIPS

 1. **Add Voice Recording Button to Input Toolbar**

    ```swift
    if messageText.isEmpty {
        Button {
            showRecordingUI = true
        } label: {
            Image(systemName: "mic.fill")
                .foregroundColor(.purple)
        }
    }
    ```

 2. **Present Recording UI as Sheet**

    ```swift
    .sheet(isPresented: $showRecordingUI) {
        VoiceRecordingButton(
            onRecordingComplete: { url in
                // Handle completed recording
                handleVoiceMessage(url)
                showRecordingUI = false
            },
            onCancelled: {
                showRecordingUI = false
            }
        )
    }
    ```

 3. **Display Voice Messages in Chat**

    ```swift
    VoiceMessageBubble(
        audioURL: message.audioURL,
        duration: message.duration,
        isIncoming: message.isIncoming
    )
    ```

 4. **Handle Recording Completion**

    ```swift
    func handleVoiceMessage(_ url: URL) {
        // Get duration
        let duration = getAudioDuration(from: url)

        // Create message
        let message = ChatMessage(
            type: .voice,
            audioURL: url,
            duration: duration,
            isIncoming: false
        )

        // Add to messages
        messages.append(message)

        // Upload to server
        Task {
            await uploadVoiceMessage(url)
        }
    }
    ```

 5. **Upload Voice Message to Server**

    ```swift
    func uploadVoiceMessage(_ url: URL) async {
        // Read file data
        guard let data = try? Data(contentsOf: url) else { return }

        // Upload via API
        await apiClient.uploadVoiceMessage(data: data)
    }
    ```

 6. **Clean Up Temporary Files**

    ```swift
    // Automatically handled by VoiceRecordingViewModel
    // Files older than 1 hour are deleted

    // Manual cleanup:
    VoiceRecordingViewModel.cleanupAllRecordings()
    ```

 ## CUSTOMIZATION

 - Change recording format: Modify `AVFormatIDKey` in settings
 - Adjust max duration: Change `maximumRecordingDuration`
 - Customize waveform: Implement actual audio analysis
 - Add playback speed: Add rate controls to VoiceMessageView
 - Background playback: Configure AVAudioSession appropriately

 ## PERMISSIONS

 Microphone permission already configured in Info.plist:

 ```xml
 <key>NSMicrophoneUsageDescription</key>
 <string>需要麦克风权限来录制语音消息</string>
 ```

 ## TESTING

 Test with different scenarios:
 - Grant/deny microphone permission
 - Record short/long messages
 - Cancel recording by swiping up
 - Play/pause voice messages
 - Handle upload failures
 - Test memory management

 */
