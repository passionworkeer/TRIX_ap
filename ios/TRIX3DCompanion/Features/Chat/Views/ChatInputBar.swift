//
//  ChatInputBar.swift
//  TRIX3DCompanion
//
//  Glass-morphism input bar for chat messages
//  Supports text input, attachments, and send action
//

import SwiftUI
import Speech
import Combine

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Chat Input Bar

/// Glass-morphism input bar for composing messages
struct ChatInputBar: View {

    // MARK: - Bindings

    @Binding var text: String
    @FocusState var isFocused: Bool

    // MARK: - State

    @State private var showAttachmentMenu = false
    @State private var showImagePicker = false
    @State private var showCamera = false
    @State private var showDocumentPicker = false
    @State private var showVoiceRecording = false

    // AI Action selector state
    @State private var selectedAIAction: AIActionType = .chat

    // Speech recognition state
    @State private var isListening = false
    @State private var showSpeechError = false
    @State private var speechErrorMessage = ""

    // MARK: - Properties

    let onSend: () -> Void
    let onAttach: ((AttachmentType) -> Void)?
    let onVoiceRecordingComplete: ((URL) -> Void)?

    let isConnected: Bool
    let maxCharacterLimit: Int = 1000

    // Speech recognition service
    @StateObject private var speechService = SpeechRecognitionService.shared

    // MARK: - Environment

    @Environment(\.colorScheme) private var colorScheme

    // MARK: - Body

    var body: some View {
        HStack(alignment: .bottom, spacing: 12) {
            // AI Action selector button
            aiActionSelectorButton

            // Voice recording button
            voiceRecordingButton

            // Speech-to-text button
            speechToTextButton

            // Attachment button
            attachmentButton

            // Text input container
            textInputContainer

            // Send button (shown when text is entered)
            if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                sendButton
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .overlay(topBorder)
        .sheet(isPresented: $showImagePicker) {
            // Image picker sheet
            imagePickerSheet
        }
        .sheet(isPresented: $showCamera) {
            // Camera sheet
            cameraSheet
        }
        .confirmationDialog("Send Attachment", isPresented: $showAttachmentMenu, titleVisibility: .hidden) {
            attachmentMenuButtons
        }
        .fullScreenCover(isPresented: $showVoiceRecording) {
            VoiceRecordingButton(
                onRecordingComplete: { url in
                    showVoiceRecording = false
                    onVoiceRecordingComplete?(url)
                },
                onCancelled: {
                    showVoiceRecording = false
                }
            )
        }
        .alert(L("chat.input.speech.error"), isPresented: $showSpeechError) {
            Button(L("action.confirm"), role: .cancel) {}
        } message: {
            Text(speechErrorMessage)
        }
    }

    // MARK: - Attachment Button

    private var attachmentButton: some View {
        Button(action: { showAttachmentMenu = true }) {
            ZStack {
                Circle()
                    .fill(.ultraThinMaterial)
                    .frame(width: 44, height: 44)
                    .overlay(
                        Circle()
                            .stroke(.gray.opacity(0.2), lineWidth: 1)
                    )

                Image(systemName: "plus.circle.fill")
                    .font(.title2)
                    .foregroundColor(.purple)
            }
        }
        .accessibilityLabel("Attach file")
        .disabled(!isConnected)
    }

    // MARK: - AI Action Selector Button

    private var aiActionSelectorButton: some View {
        AIActionSelectorView(
            selectedAction: $selectedAIAction,
            onSelect: { action in
                // Apply AI action prefix to current text
                text = applyAIActionPrefix(text, action: action)
            }
        )
    }

    // MARK: - Voice Recording Button

    private var voiceRecordingButton: some View {
        Button(action: { showVoiceRecording = true }) {
            ZStack {
                Circle()
                    .fill(.ultraThinMaterial)
                    .frame(width: 44, height: 44)
                    .overlay(
                        Circle()
                            .stroke(.gray.opacity(0.2), lineWidth: 1)
                    )

                Image(systemName: "mic.fill")
                    .font(.title2)
                    .foregroundColor(.red)
            }
        }
        .accessibilityLabel("Record voice message")
        .disabled(!isConnected)
    }

    // MARK: - Speech-to-Text Button

    private var speechToTextButton: some View {
        Button(action: toggleSpeechRecognition) {
            ZStack {
                Circle()
                    .fill(isListening ? AnyShapeStyle(Color.red.opacity(0.2)) : AnyShapeStyle(.ultraThinMaterial))
                    .frame(width: 44, height: 44)
                    .overlay(
                        Circle()
                            .stroke(isListening ? Color.red.opacity(0.5) : Color.gray.opacity(0.2), lineWidth: 1)
                    )

                Image(systemName: isListening ? "waveform" : "text.bubble")
                    .font(.title2)
                    .foregroundColor(isListening ? .red : .blue)
            }
        }
        .accessibilityLabel("Speech to text")
        .disabled(!isConnected || !speechService.isSupported)
        .opacity(speechService.isSupported ? 1.0 : 0.5)
        .scaleEffect(isListening ? 1.1 : 1.0)
        .animation(.easeInOut(duration: 0.3), value: isListening)
    }

    // MARK: - Speech Recognition Toggle

    // MARK: - Text Input Container

    private var textInputContainer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField(L("chat.input.message"), text: $text, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.body)
                .focused($isFocused)
                .lineLimit(1...6)
                .disabled(!isConnected)
                .accessibilityLabel("Message input")
                .onChange(of: text) { newValue in
                    // Enforce character limit
                    if newValue.count > maxCharacterLimit {
                        text = String(newValue.prefix(maxCharacterLimit))
                    }
                }
                .onChange(of: speechService.recognizedText) { newValue in
                    // Update text when speech recognition completes
                    if !newValue.isEmpty && isListening == false {
                        if text.isEmpty {
                            text = newValue
                        } else {
                            text = text + " " + newValue
                        }
                        // Reset recognized text
                        speechService.resetRecognizedText()
                    }
                }

            // Character count indicator (when approaching limit)
            if text.count > maxCharacterLimit * 8 / 10 {
                characterCountIndicator
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(.regularMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(.gray.opacity(0.3), lineWidth: 0.5)
                )
        )
    }

    // MARK: - Character Count Indicator

    private var characterCountIndicator: some View {
        Text("\(text.count)/\(maxCharacterLimit)")
            .font(.caption2)
            .foregroundColor(text.count >= maxCharacterLimit ? .red : .secondary)
    }

    // MARK: - Send Button

    private var sendButton: some View {
        Button(action: handleSend) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.purple, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 44, height: 44)
                    .shadow(color: .purple.opacity(0.3), radius: 4, y: 2)

                Image(systemName: "arrow.up.fill")
                    .font(.body)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
            }
        }
        .accessibilityLabel("Send message")
        .disabled(!isConnected || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        .scaleEffect(text.isEmpty ? 0.8 : 1.0)
        .animation(.spring(response: 0.3), value: text.isEmpty)
    }

    // MARK: - Top Border

    private var topBorder: some View {
        VStack {
            Rectangle()
                .fill(.gray.opacity(0.3))
                .frame(height: 0.5)
            Spacer()
        }
    }

    // MARK: - Attachment Menu

    @ViewBuilder
    private var attachmentMenuButtons: some View {
        Button(action: {
            showAttachmentMenu = false
            showImagePicker = true
            onAttach?(.photo)
        }) {
            Label(AttachmentType.photo.label, systemImage: AttachmentType.photo.icon)
        }

        Button(action: {
            showAttachmentMenu = false
            showCamera = true
            onAttach?(.camera)
        }) {
            Label(AttachmentType.camera.label, systemImage: AttachmentType.camera.icon)
        }

        Button(action: {
            showAttachmentMenu = false
            showDocumentPicker = true
            onAttach?(.file)
        }) {
            Label(AttachmentType.file.label, systemImage: AttachmentType.file.icon)
        }

        Button(role: .cancel) {
            showAttachmentMenu = false
        } label: {
            Text(L("workbench.cancel"))
        }
    }

    // MARK: - Sheets

    private var imagePickerSheet: some View {
        NavigationView {
            VStack(spacing: 20) {
                Image(systemName: "photo.on.rectangle.angled")
                    .font(.system(size: 60))
                    .foregroundColor(.purple)

                Text(L("chat.input.select.photo"))
                    .font(.title2)
                    .fontWeight(.semibold)

                Text(L("chat.input.choose.photo"))
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()

                Button("Select") {
                    showImagePicker = false
                    onAttach?(.photo)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            .navigationTitle(L("chat.input.photo.library"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        showImagePicker = false
                    }
                }
            }
        }
    }

    private var cameraSheet: some View {
        NavigationView {
            VStack(spacing: 20) {
                Image(systemName: "camera.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.purple)

                Text(L("chat.input.take.photo"))
                    .font(.title2)
                    .fontWeight(.semibold)

                Text(L("chat.input.capture.photo"))
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()

                Button(L("chat.input.open.camera")) {
                    showCamera = false
                    onAttach?(.camera)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            .navigationTitle(L("chat.input.camera"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        showCamera = false
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func handleSend() {
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else { return }

        // Trigger send callback
        withAnimation(.spring(response: 0.3)) {
            onSend()
        }

        // Clear text
        text = ""
    }

    private func toggleSpeechRecognition() {
        if isListening {
            // Stop listening
            Task {
                await speechService.stopRecognition()
                isListening = false
            }
        } else {
            // Start listening
            Task {
                do {
                    try await speechService.startRecognition()
                    isListening = true
                } catch {
                    speechErrorMessage = error.localizedDescription
                    showSpeechError = true
                    isListening = false
                }
            }
        }
    }

    // Update text when speech recognition completes
    private func updateTextFromSpeech() {
        if !speechService.recognizedText.isEmpty {
            // Append recognized text to existing text
            if text.isEmpty {
                text = speechService.recognizedText
            } else {
                text = text + " " + speechService.recognizedText
            }
            // Clear recognized text after appending
            speechService.resetRecognizedText()
        }
    }
}

// MARK: - Convenience Initializers

extension ChatInputBar {

    init(text: Binding<String>, isConnected: Bool = true, onSend: @escaping () -> Void) {
        self._text = text
        self.isConnected = isConnected
        self.onSend = onSend
        self.onAttach = nil
        self.onVoiceRecordingComplete = nil
    }

    init(
        text: Binding<String>,
        isConnected: Bool = true,
        onSend: @escaping () -> Void,
        onAttach: @escaping (AttachmentType) -> Void
    ) {
        self._text = text
        self.isConnected = isConnected
        self.onSend = onSend
        self.onAttach = onAttach
        self.onVoiceRecordingComplete = nil
    }

    init(
        text: Binding<String>,
        isConnected: Bool = true,
        onSend: @escaping () -> Void,
        onAttach: ((AttachmentType) -> Void)? = nil,
        onVoiceRecordingComplete: ((URL) -> Void)? = nil
    ) {
        self._text = text
        self.isConnected = isConnected
        self.onSend = onSend
        self.onAttach = onAttach
        self.onVoiceRecordingComplete = onVoiceRecordingComplete
    }
}

// MARK: - Preview

#Preview("Chat Input Bar") {
    VStack {
        Spacer()

        ChatInputBar(
            text: .constant(""),
            isConnected: true,
            onSend: {
                print("Send tapped")
            }
        )

        Divider()

        ChatInputBar(
            text: .constant("Hello, this is a message"),
            isConnected: true,
            onSend: {
                print("Send tapped")
            },
            onAttach: { type in
                print("Attach: \(type)")
            }
        )

        Divider()

        ChatInputBar(
            text: .constant(""),
            isConnected: false,
            onSend: {
                print("Send tapped")
            }
        )
    }
    .background(Color.gray.opacity(0.1))
}

#Preview("Chat Input Bar in Context") {
    VStack {
        // Fake messages
        VStack(alignment: .leading, spacing: 8) {
            Text("Hey there!")
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .frame(maxWidth: 200, alignment: .leading)

            Text("How are you doing today?")
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.purple)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding()

        Spacer()

        ChatInputBar(
            text: .constant(""),
            isConnected: true,
            onSend: {
                print("Send")
            },
            onAttach: { type in
                print("Attach: \(type)")
            }
        )
    }
    .background(Color.gray.opacity(0.1))
}
