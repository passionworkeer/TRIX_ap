//
//  TrixBotChatView.swift
//  TRIX3DCompanion
//
//  TRIX Bot chat view - connects to Clawbot Channel for AI conversation
//

import SwiftUI

// MARK: - TrixBot Chat View

/// Chat view for TRIX Bot AI conversations
struct TrixBotChatView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var clawbotChannel: ClawbotChannelViewModel

    // MARK: - State

    @State private var messageText: String = ""
    @State private var scrollToBottom = false
    @FocusState private var isInputFocused: Bool

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Connection status bar
            connectionStatusBar

            // Messages list
            messagesList

            // Input area
            inputArea
        }
        .background(backgroundGradient)
        .gesture(TapGesture().onEnded { _ in dismissKeyboard() })
        .navigationTitle("TRIX Bot")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                // Pairing status indicator
                HStack(spacing: 4) {
                    Circle()
                        .fill(clawbotChannel.isPaired ? Color.green : Color.orange)
                        .frame(width: 8, height: 8)
                    Text(clawbotChannel.isPaired ? "已配对" : "未配对")
                        .font(.caption)
                        .foregroundColor(clawbotChannel.isPaired ? .green : .orange)
                }
            }
        }
        .onAppear {
            Task {
                await connectToBot()
            }
        }
        .onChange(of: clawbotChannel.messages) { _ in
            scrollToBottom = true
        }
    }

    // MARK: - Connection Status Bar

    private var connectionStatusBar: some View {
        Group {
            if !clawbotChannel.isConnected {
                HStack(spacing: 8) {
                    Image(systemName: "wifi.slash").font(.caption)
                    Text("正在连接...").font(.caption)
                    Spacer()
                }
                .padding(.horizontal).padding(.vertical, 8)
                .background(.orange.opacity(0.2))
            } else if !clawbotChannel.isPaired {
                HStack(spacing: 8) {
                    Image(systemName: "link.badge.plus").font(.caption)
                    Text("未配对设备，请先配对").font(.caption)
                    Spacer()
                }
                .padding(.horizontal).padding(.vertical, 8)
                .background(.yellow.opacity(0.2))
            }
        }
    }

    // MARK: - Messages List

    private var messagesList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(clawbotChannel.messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }

                    // Typing indicator
                    if clawbotChannel.botState == .thinking || clawbotChannel.botState == .speaking {
                        HStack {
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                Text("TRIX Bot")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                HStack(spacing: 4) {
                                    ForEach(0..<3) { index in
                                        Circle()
                                            .fill(Color.gray.opacity(0.6))
                                            .frame(width: 8, height: 8)
                                            .scaleEffect(clawbotChannel.botState == .speaking ? 1.2 : 1.0)
                                    }
                                }
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.gray.opacity(0.2))
                            .cornerRadius(16)
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .onChange(of: scrollToBottom) { shouldScroll in
                if shouldScroll, let lastMessage = clawbotChannel.messages.last {
                    withAnimation {
                        proxy.scrollTo(lastMessage.id, anchor: .bottom)
                    }
                    scrollToBottom = false
                }
            }
        }
    }

    // MARK: - Input Area

    private var inputArea: some View {
        HStack(alignment: .bottom, spacing: 12) {
            // Text input
            HStack(alignment: .bottom, spacing: 8) {
                TextField("发送消息...", text: $messageText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...6)
                    .disabled(!clawbotChannel.isPaired)

                if !messageText.isEmpty {
                    Button(action: { messageText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.gray)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color(.systemGray6))
            )

            // Send button
            if !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Button(action: sendMessage) {
                    ZStack {
                        Circle()
                            .fill(clawbotChannel.isPaired ? Color.purple : Color.gray)
                            .frame(width: 40, height: 40)

                        if clawbotChannel.isSending {
                            ProgressView()
                                .scaleEffect(0.8)
                        } else {
                            Image(systemName: "arrow.up.fill")
                                .font(.body)
                                .fontWeight(.semibold)
                                .foregroundColor(.white)
                        }
                    }
                }
                .disabled(!clawbotChannel.isPaired || clawbotChannel.isSending)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }

    // MARK: - Background Gradient

    private var backgroundGradient: some View {
        LinearGradient(
            colors: [Color.purple.opacity(0.15), Color.pink.opacity(0.1), Color.black.opacity(0.1)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        ).ignoresSafeArea()
    }

    // MARK: - Actions

    private func connectToBot() async {
        if !clawbotChannel.isConnected {
            await clawbotChannel.connect()
        }
    }

    private func sendMessage() {
        let trimmedText = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty, clawbotChannel.isPaired else { return }

        Task {
            let success = await clawbotChannel.sendMessage(trimmedText)
            if success {
                await MainActor.run {
                    messageText = ""
                    scrollToBottom = true
                }
            }
        }
    }

    private func dismissKeyboard() {
        isInputFocused = false
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: ClawbotMessage

    var body: some View {
        HStack {
            if message.sender == .user {
                Spacer()
            }

            VStack(alignment: message.sender == .user ? .trailing : .leading, spacing: 4) {
                Text(message.sender == .user ? "你" : "TRIX Bot")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(message.content)
                    .font(.body)
                    .foregroundColor(message.sender == .user ? .white : .primary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(
                        message.sender == .user ?
                        AnyView(LinearGradient(colors: [.purple, .pink], startPoint: .topLeading, endPoint: .bottomTrailing)) :
                        AnyView(Color(.systemGray5))
                    )
                    .cornerRadius(16)

                Text(formatTime(message.timestamp))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            if message.sender == .bot {
                Spacer()
            }
        }
        .padding(.horizontal)
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Preview

#Preview("TRIX Bot Chat") {
    NavigationStack {
        TrixBotChatView()
            .environmentObject(ClawbotChannelViewModel.shared)
    }
}
