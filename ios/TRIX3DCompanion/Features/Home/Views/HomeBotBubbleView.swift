//
//  HomeBotBubbleView.swift
//  TRIX3DCompanion
//
//  Floating robot avatar bubble for home screen — inline expandable
//  Matches Web HomeBotBubble.tsx behavior:
//  - Collapsed: small bubble with latest message or greeting
//  - Expanded: inline card with history, input field, and send button
//

import SwiftUI

struct HomeBotBubbleView: View {

    @EnvironmentObject private var clawbotChannel: ClawbotChannelViewModel

    @State private var isExpanded = false
    @State private var inputText = ""
    @State private var isSending = false
    @State private var typingIndicatorVisible = false

    private let maxHistoryMessages = 3

    private var bubbleText: String {
        if let latest = clawbotChannel.messages.last, latest.sender != .user {
            return latest.content
        }
        return NSLocalizedString("home.bot.greeting", comment: "")
    }

    private var recentMessages: [ClawbotMessage] {
        Array(clawbotChannel.messages.suffix(maxHistoryMessages))
    }

    // MARK: - Bubble Text / Typing

    private var displayBubbleContent: some View {
        Group {
            if clawbotChannel.botState == .thinking || clawbotChannel.botState == .speaking {
                typingIndicator
            } else {
                Text(bubbleText)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
        }
    }

    private var typingIndicator: some View {
        HStack(spacing: 3) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.white.opacity(0.9))
                    .frame(width: 6, height: 6)
                    .scaleEffect(typingIndicatorVisible ? 1.2 : 0.8)
                    .animation(
                        .easeInOut(duration: 0.5)
                            .repeatForever(autoreverses: true)
                            .delay(Double(index) * 0.15),
                        value: typingIndicatorVisible
                    )
            }
        }
        .onAppear { typingIndicatorVisible = true }
        .onDisappear { typingIndicatorVisible = false }
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .trailing, spacing: 0) {
            if isExpanded {
                expandedCard
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .scale(scale: 0.9, anchor: .bottomTrailing)),
                        removal: .opacity.combined(with: .scale(scale: 0.9, anchor: .bottomTrailing))
                    ))
            } else {
                collapsedBubble
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .scale(scale: 0.9, anchor: .bottomTrailing)),
                        removal: .opacity.combined(with: .scale(scale: 0.9, anchor: .bottomTrailing))
                    ))
            }
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.78), value: isExpanded)
    }

    // MARK: - Collapsed Bubble

    private var collapsedBubble: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Button {
                withAnimation { isExpanded = true }
            } label: {
                HStack(spacing: 8) {
                    // Bot icon
                    ZStack {
                        Circle()
                            .fill(Color.brandPurple.opacity(0.3))
                            .frame(width: 28, height: 28)

                        Image(systemName: "sparkles")
                            .font(.system(size: 13))
                            .foregroundColor(.yellow)
                    }

                    // Bubble tail
                    VStack(alignment: .leading, spacing: 3) {
                        displayBubbleContent
                    }
                    .frame(maxWidth: 160, alignment: .leading)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(.ultraThinMaterial)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.white.opacity(0.25), lineWidth: 0.8)
                )
                .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier(HomeAccessibilityIdentifiers.botBubble)
            .accessibilityLabel("Open TRIX Bot chat")
            .accessibilityHint("Opens the TRIX assistant chat bubble")

            // Small arrow
            Image(systemName: "chevron.right")
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(.white.opacity(0.6))
                .padding(.trailing, 8)
        }
    }

    // MARK: - Expanded Card

    private var expandedCard: some View {
        VStack(spacing: 0) {
            // Header
            headerBar
                .padding(.horizontal, 14)
                .padding(.vertical, 10)

            // Divider
            Rectangle()
                .fill(Color.white.opacity(0.1))
                .frame(height: 1)

            // Message history
            messageHistory
                .padding(.horizontal, 12)
                .padding(.vertical, 8)

            // Divider
            Rectangle()
                .fill(Color.white.opacity(0.1))
                .frame(height: 1)

            // Input area
            inputArea
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
        }
        .frame(width: 280)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(.ultraThinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.white.opacity(0.2), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.2), radius: 16, x: 0, y: 8)
        .uiTestIdentifier(HomeAccessibilityIdentifiers.botExpandedCard)
    }

    private var headerBar: some View {
        HStack(spacing: 6) {
            Image(systemName: "sparkles")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(.yellow)

            Text("TRIX")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(.white)

            if clawbotChannel.botState == .speaking {
                Image(systemName: "speaker.wave.2.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.orange)
            }

            Spacer()

            // Close button
            Button {
                withAnimation { isExpanded = false }
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white.opacity(0.6))
                    .frame(width: 28, height: 28)
                    .background(Color.white.opacity(0.1))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close chat")
        }
    }

    private var messageHistory: some View {
        Group {
            if recentMessages.isEmpty {
                Text("Say hello to TRIX!")
                    .font(.system(size: 11))
                    .foregroundColor(.white.opacity(0.4))
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 12)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(recentMessages) { message in
                        HStack(alignment: .top, spacing: 4) {
                            if message.sender != .user {
                                Text("TRIX: ")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.white.opacity(0.5))
                            } else {
                                Text("You: ")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.white.opacity(0.4))
                            }

                            Text(message.content)
                                .font(.system(size: 11))
                                .foregroundColor(.white)
                                .lineLimit(1)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
            }
        }
        .frame(maxHeight: 100)
    }

    private var inputArea: some View {
        HStack(spacing: 8) {
            // Text input
            ZStack {
                TextField("Message TRIX...", text: $inputText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13))
                    .foregroundColor(.white)
                    .lineLimit(1...3)
                    .accessibilityIdentifier(HomeAccessibilityIdentifiers.botInputField)
                    .submitLabel(.send)
                    .onSubmit { handleSend() }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.white.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )

            // Send button
            Button(action: handleSend) {
                Circle()
                    .fill(
                        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
                            ? AnyShapeStyle(Color.brandPurple)
                            : AnyShapeStyle(Color.white.opacity(0.2))
                    )
                    .frame(width: 36, height: 36)
                    .overlay(
                        Group {
                            if isSending {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.7)
                            } else {
                                Image(systemName: "arrow.up")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        }
                    )
            }
            .frame(width: 36, height: 36)
            .buttonStyle(.plain)
            .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
            .accessibilityIdentifier(HomeAccessibilityIdentifiers.botSendButton)
        }
    }

    // MARK: - Actions

    private func handleSend() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }

        isSending = true
        let trimmedText = text
        inputText = ""

        Task {
            let success = await clawbotChannel.sendMessage(
                trimmedText,
                contentType: .text
            )
            await MainActor.run {
                isSending = false
                if !success {
                    inputText = trimmedText
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("Collapsed") {
    ZStack {
        Color.black.ignoresSafeArea()
        VStack {
            Spacer()
            HStack {
                Spacer()
                HomeBotBubbleView()
                    .padding(.trailing, 20)
                    .padding(.bottom, 100)
            }
        }
    }
    .environmentObject(ClawbotChannelViewModel.shared)
}

#Preview("Expanded") {
    ZStack {
        Color.black.ignoresSafeArea()
        VStack {
            Spacer()
            HStack {
                Spacer()
                HomeBotBubbleView()
                    .padding(.trailing, 20)
                    .padding(.bottom, 100)
            }
        }
    }
    .environmentObject(ClawbotChannelViewModel.shared)
}
