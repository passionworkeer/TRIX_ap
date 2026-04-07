//
//  NotificationPanelView.swift
//  TRIX3DCompanion
//
//  Notification panel similar to web NotificationPanel
//

import SwiftUI
import ActivityIndicatorView

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

struct NotificationPanelView: View {
    @Binding var isPresented: Bool

    @State private var notifications: [AppNotification] = []
    @State private var isLoading = false
    @State private var selectedFilter: NotificationFilter = .all
    @State private var errorMessage: String?

    // Use shared API client
    private let apiClient = APIClient.shared

    enum NotificationFilter: String, CaseIterable {
        case all = "notification.filter.all"
        case unread = "notification.filter.unread"
        case system = "notification.filter.system"
    }

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

                    // Filter tabs
                    filterSection

                    // Notifications list
                    notificationsList
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
        }
        .onAppear {
            loadNotifications()
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
            Text(L("notification.title"))
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

    // MARK: - Filter Section

    private var filterSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(NotificationFilter.allCases, id: \.self) { filter in
                    Button {
                        selectedFilter = filter
                    } label: {
                        Text(L(filter.rawValue))
                            .font(.subheadline)
                            .fontWeight(selectedFilter == filter ? .semibold : .regular)
                            .foregroundColor(selectedFilter == filter ? .white : .secondary)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(
                                Capsule()
                                    .fill(selectedFilter == filter ? Color.brandPurple : Color.clear)
                            )
                            .overlay(
                                Capsule()
                                    .stroke(selectedFilter == filter ? Color.clear : Color.secondary.opacity(0.3), lineWidth: 1)
                            )
                    }
                }
            }
            .padding(.horizontal, 20)
        }
        .padding(.bottom, 12)
    }

    // MARK: - Notifications List

    private var notificationsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if isLoading {
                    TrixLoadingIndicator.standard()
                        .padding(.top, 40)
                } else if filteredNotifications.isEmpty {
                    emptyState
                } else {
                    ForEach(filteredNotifications) { notification in
                        NotificationRow(notification: notification) {
                            markAsRead(notification)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 20)
        }
        .refreshable {
            await loadNotificationsAsync()
        }
    }

    private var filteredNotifications: [AppNotification] {
        switch selectedFilter {
        case .all:
            return notifications
        case .unread:
            return notifications.filter { !$0.isRead }
        case .system:
            return notifications.filter { $0.type == .system }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "bell.slash")
                .font(.system(size: 40))
                .foregroundColor(.secondary)

            Text(L("notification.empty"))
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.top, 60)
    }

    // MARK: - Actions

    private func loadNotifications() {
        Task {
            await loadNotificationsAsync()
        }
    }

    private func loadNotificationsAsync() async {
        isLoading = true
        errorMessage = nil

        do {
            // Fetch notifications from backend API
            let apiNotifications: [APIAppNotification] = try await apiClient.get(.notificationList)

            // Map API notifications to local model
            notifications = apiNotifications.map { apiNotification in
                AppNotification(
                    id: UUID(uuidString: apiNotification.id) ?? UUID(),
                    type: mapNotificationType(apiNotification.type),
                    title: apiNotification.title,
                    content: apiNotification.body,
                    time: formatTime(apiNotification.createdAt),
                    isRead: apiNotification.isRead
                )
            }
            isLoading = false
        } catch {
            isLoading = false
            errorMessage = L("notification.load.failed").replacingOccurrences(of: "%@", with: error.localizedDescription)
        }
    }

    private func markAsRead(_ notification: AppNotification) {
        Task {
            do {
                try await apiClient.markNotificationAsRead(notificationId: notification.id.uuidString)
                // Update local state
                if let index = notifications.firstIndex(where: { $0.id == notification.id }) {
                    notifications[index].isRead = true
                }
            } catch {
                // Silent fail
            }
        }
    }

    private func markAllAsRead() {
        Task {
            do {
                try await apiClient.markAllNotificationsAsRead()
                // Update local state
                for index in notifications.indices {
                    notifications[index].isRead = true
                }
            } catch {
                // Silent fail
            }
        }
    }

    private func mapNotificationType(_ type: String) -> AppNotification.NotificationType {
        switch type.lowercased() {
        case "system":
            return .system
        case "points", "reward":
            return .points
        case "chat", "message":
            return .chat
        case "study", "learning":
            return .study
        default:
            return .system
        }
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Notification Model

struct AppNotification: Identifiable, Hashable {
    let id: UUID
    let type: NotificationType
    let title: String
    let content: String
    let time: String
    var isRead: Bool

    enum NotificationType: String {
        case system
        case points
        case chat
        case study
    }
}

// MARK: - Notification Row

struct NotificationRow: View {
    let notification: AppNotification
    let onTap: () -> Void

    var body: some View {
        Button {
            onTap()
        } label: {
            HStack(alignment: .top, spacing: 12) {
                // Icon
                ZStack {
                    Circle()
                        .fill(iconBackgroundColor)
                        .frame(width: 40, height: 40)

                    Image(systemName: iconName)
                        .font(.system(size: 16))
                        .foregroundColor(.white)
                }

                // Content
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(notification.title)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(notification.isRead ? .secondary : .primary)

                        Spacer()

                        Text(notification.time)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }

                    Text(notification.content)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }

                // Unread indicator
                if !notification.isRead {
                    Circle()
                        .fill(Color.brandPurple)
                        .frame(width: 8, height: 8)
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(notification.isRead ? Color.clear : Color.brandPurple.opacity(0.05))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(notification.isRead ? Color.clear : Color.brandPurple.opacity(0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var iconName: String {
        switch notification.type {
        case .system: return "gearshape.fill"
        case .points: return "star.fill"
        case .chat: return "message.fill"
        case .study: return "book.fill"
        }
    }

    private var iconBackgroundColor: Color {
        switch notification.type {
        case .system: return .blue
        case .points: return .yellow
        case .chat: return .green
        case .study: return .purple
        }
    }
}

// MARK: - Preview

#Preview("Notification Panel") {
    NotificationPanelView(isPresented: .constant(true))
}
