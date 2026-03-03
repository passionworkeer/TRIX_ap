//
//  ChatInputBar.swift
//  TRIX3DCompanion
//
//  Glass-morphism input bar for chat messages
//  Supports text input, attachments, and send action
//

import SwiftUI

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

    // MARK: - Properties

    let onSend: () -> Void
    let onAttach: ((AttachmentType) -> Void)?

    let isConnected: Bool
    let maxCharacterLimit: Int = 1000

    // MARK: - Environment

    @Environment(\.colorScheme) private var colorScheme

    // MARK: - Body

    var body: some View {
        HStack(alignment: .bottom, spacing: 12) {
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
        .disabled(!isConnected)
    }

    // MARK: - Text Input Container

    private var textInputContainer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Message...", text: $text, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.body)
                .focused($isFocused)
                .lineLimit(1...6)
                .disabled(!isConnected)
                .onChange(of: text) { newValue in
                    // Enforce character limit
                    if newValue.count > maxCharacterLimit {
                        text = String(newValue.prefix(maxCharacterLimit))
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
                    .frame(width: 40, height: 40)
                    .shadow(color: .purple.opacity(0.3), radius: 4, y: 2)

                Image(systemName: "arrow.up.fill")
                    .font(.body)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
            }
        }
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
            Text("Cancel")
        }
    }

    // MARK: - Sheets

    private var imagePickerSheet: some View {
        NavigationView {
            VStack(spacing: 20) {
                Image(systemName: "photo.on.rectangle.angled")
                    .font(.system(size: 60))
                    .foregroundColor(.purple)

                Text("Select Photo")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Choose a photo from your library")
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
            .navigationTitle("Photo Library")
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

                Text("Take Photo")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Capture a new photo to send")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()

                Button("Open Camera") {
                    showCamera = false
                    onAttach?(.camera)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            .navigationTitle("Camera")
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
}

// MARK: - Convenience Initializers

extension ChatInputBar {

    init(text: Binding<String>, isConnected: Bool = true, onSend: @escaping () -> Void) {
        self._text = text
        self.isConnected = isConnected
        self.onSend = onSend
        self.onAttach = nil
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
