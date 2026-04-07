//
//  MailPanelView.swift
//  TRIX3DCompanion
//
//  Mail/Messages panel similar to web MailPanel
//

import SwiftUI
import ActivityIndicatorView

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

struct MailPanelView: View {
    @Binding var isPresented: Bool

    @State private var messages: [MailMessage] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    // Use shared API client for notifications
    private let apiClient = APIClient.shared

    var body: some View {
        GeometryReader { geometry in
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

                    // Error message if any
                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .padding(.horizontal)
                    }

                    // Messages list
                    messagesList
                }
                .frame(maxHeight: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: 24)
                        .fill(Color(.systemBackground))
                )
                .shadow(color: .black.opacity(0.15), radius: 20, x: 0, y: -5)
            }
            .padding(.top, geometry.safeAreaInsets.top) // Respect safe area
            .ignoresSafeArea(edges: .bottom)
            .onAppear {
                loadMessages()
            }
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
                markAllAsRead()
            } label: {
                Text(L("notification.mark.all.read"))
                    .font(.caption)
                    .foregroundColor(.blue)
            }

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
                    TrixLoadingIndicator.standard()
                        .padding(.top, 40)
                } else if messages.isEmpty {
                    emptyState
                } else {
                    ForEach(messages) { message in
                        MailMessageRow(message: message) {
                            markAsRead(message.id)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 20)
        }
        .refreshable {
            await loadMessagesAsync()
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
        Task {
            await loadMessagesAsync()
        }
    }

    private func loadMessagesAsync() async {
        isLoading = true
        errorMessage = nil

        do {
            // Fetch notifications from backend API
            let notifications: [APIAppNotification] = try await apiClient.get(.notificationList)

            // Map API notifications to mail messages
            messages = notifications.map { notification in
                MailMessage(
                    id: UUID(uuidString: notification.id) ?? UUID(),
                    sender: notification.title,
                    title: notification.title,
                    content: notification.body,
                    time: formatTime(notification.createdAt),
                    isRead: notification.isRead
                )
            }
            isLoading = false
        } catch {
            isLoading = false
            errorMessage = L("mail.load.failed").replacingOccurrences(of: "%@", with: error.localizedDescription)
        }
    }

    private func markAsRead(_ id: UUID) {
        Task {
            do {
                try await apiClient.markNotificationAsRead(notificationId: id.uuidString)
                // Update local state
                if let index = messages.firstIndex(where: { $0.id == id }) {
                    let updatedMessage = messages[index]
                    messages[index] = MailMessage(
                        id: updatedMessage.id,
                        sender: updatedMessage.sender,
                        title: updatedMessage.title,
                        content: updatedMessage.content,
                        time: updatedMessage.time,
                        isRead: true
                    )
                }
            } catch {
                // Silent fail for mark as read
            }
        }
    }

    private func markAllAsRead() {
        Task {
            do {
                try await apiClient.markAllNotificationsAsRead()
                // Update local state
                messages = messages.map { message in
                    MailMessage(
                        id: message.id,
                        sender: message.sender,
                        title: message.title,
                        content: message.content,
                        time: message.time,
                        isRead: true
                    )
                }
            } catch {
                // Silent fail
            }
        }
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
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
    var onTap: (() -> Void)?

    var body: some View {
        Button(action: {
            onTap?()
        }) {
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
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("Mail Panel") {
    MailPanelView(isPresented: .constant(true))
}
