//
//  MailPanelView.swift
//  TRIX3DCompanion
//
//  Mail/Messages panel similar to web MailPanel
//

import SwiftUI

struct MailPanelView: View {
    @Binding var isPresented: Bool

    @State private var messages: [MailMessage] = []
    @State private var isLoading = false

    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture {
                    isPresented = false
                }

            // Main panel
            VStack(spacing: 0) {
                // Handle bar
                handleBar

                // Header
                headerSection

                // Messages list
                messagesList
            }
            .frame(maxHeight: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(.ultraThinMaterial)
            )
            .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: -5)
        }
        .onAppear {
            loadMessages()
        }
    }

    // MARK: - Handle Bar

    private var handleBar: some View {
        RoundedRectangle(cornerRadius: 2.5)
            .fill(Color.secondary.opacity(0.4))
            .frame(width: 40, height: 5)
            .padding(.top, 12)
            .padding(.bottom, 8)
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack {
            Text(NSLocalizedString("mail.title", comment: "邮件"))
                .font(.title3)
                .fontWeight(.bold)

            Spacer()

            Button {
                isPresented = false
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 12)
    }

    // MARK: - Messages List

    private var messagesList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if isLoading {
                    ProgressView()
                        .padding(.top, 40)
                } else if messages.isEmpty {
                    emptyState
                } else {
                    ForEach(messages) { message in
                        MailMessageRow(message: message)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 20)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "envelope.open")
                .font(.system(size: 40))
                .foregroundColor(.secondary)

            Text(NSLocalizedString("mail.empty", comment: "暂无邮件"))
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.top, 60)
    }

    // MARK: - Actions

    private func loadMessages() {
        // Load messages from local storage or API
        isLoading = true

        // Simulated data
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            messages = [
                MailMessage(id: UUID(), sender: "TRIX", title: "欢迎使用", content: "欢迎来到 TRIX 3D Companion!", time: "2小时前", isRead: false),
                MailMessage(id: UUID(), sender: "系统", title: "积分变动", content: "您获得了 +50 积分", time: "昨天", isRead: true)
            ]
            isLoading = false
        }
    }
}

// MARK: - Mail Message Model

struct MailMessage: Identifiable, Hashable {
    let id: UUID
    let sender: String
    let title: String
    let content: String
    let time: String
    let isRead: Bool
}

// MARK: - Mail Message Row

struct MailMessageRow: View {
    let message: MailMessage

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(message.sender)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(message.isRead ? .secondary : .primary)

                Spacer()

                Text(message.time)
                    .font(.caption)
                    .foregroundColor(.secondary)

                if !message.isRead {
                    Circle()
                        .fill(Color.brandPurple)
                        .frame(width: 8, height: 8)
                }
            }

            Text(message.title)
                .font(.subheadline)
                .foregroundColor(.primary)
                .lineLimit(1)

            Text(message.content)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(2)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(message.isRead ? Color.clear : Color.brandPurple.opacity(0.05))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(message.isRead ? Color.clear : Color.brandPurple.opacity(0.2), lineWidth: 1)
        )
    }
}

// MARK: - Preview

#Preview("Mail Panel") {
    MailPanelView(isPresented: .constant(true))
}
