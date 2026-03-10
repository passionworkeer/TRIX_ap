//
//  ScheduleViewModel.swift
//  TRIX3DCompanion
//
//  Schedule ViewModel for managing schedule items with CRUD operations and backend API
//

import Foundation
import UIKit
import UserNotifications

// MARK: - Haptic Feedback Protocol

/// Protocol for haptic feedback - allows dependency injection for testing
protocol HapticFeedbackProvider {
    func trigger()
}

/// Default haptic feedback implementation using UIKit
final class UIKitHapticFeedbackProvider: HapticFeedbackProvider {
    func trigger() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }
}

// MARK: - Schedule View Model

/// Schedule view model managing schedule items state and operations
@MainActor
final class ScheduleViewModel: ObservableObject {

    // MARK: - Published Properties

    /// All schedule items
    @Published private(set) var schedules: [Schedule] = []

    /// Current filter
    @Published var filter: ScheduleFilter = .upcoming

    /// Whether currently loading
    @Published private(set) var isLoading: Bool = false

    /// Error message to display
    @Published var errorMessage: String?

    /// Success message to display
    @Published var successMessage: String?

    /// Whether showing add/edit form
    @Published var showForm: Bool = false

    /// Schedule being edited (nil for new schedule)
    @Published var editingSchedule: Schedule?

    // MARK: - Dependencies

    private let scheduleService: ScheduleServiceProtocol
    private let notificationService: LocalNotificationServiceProtocol
    private let hapticProvider: HapticFeedbackProvider

    // MARK: - Computed Properties

    /// Filtered schedules
    var filteredSchedules: [Schedule] {
        let now = Date()

        switch filter {
        case .all:
            return schedules.sorted { $0.startTime < $1.startTime }
        case .upcoming:
            return schedules
                .filter { !$0.isPast }
                .sorted { $0.startTime < $1.startTime }
        case .today:
            return schedules
                .filter { $0.isToday }
                .sorted { $0.startTime < $1.startTime }
        case .past:
            return schedules
                .filter { $0.isPast }
                .sorted { $0.startTime < $1.startTime }
        }
    }

    /// Today's schedules
    var todaySchedules: [Schedule] {
        schedules
            .filter { $0.isToday && !$0.isPast }
            .sorted { $0.startTime < $1.startTime }
    }

    /// Upcoming schedules (next 7 days)
    var upcomingSchedules: [Schedule] {
        let nextWeek = Calendar.current.date(byAdding: .day, value: 7, to: Date())!
        return schedules
            .filter { !$0.isPast && $0.startTime <= nextWeek }
            .sorted { $0.startTime < $1.startTime }
    }

    /// Schedule count for today
    var todayCount: Int {
        schedules.filter { $0.isToday && !$0.isPast }.count
    }

    /// Total upcoming schedule count
    var upcomingCount: Int {
        schedules.filter { !$0.isPast }.count
    }

    // MARK: - Initialization

    /// Initialize with optional dependencies for dependency injection
    init(
        scheduleService: ScheduleServiceProtocol = ScheduleService.shared,
        notificationService: LocalNotificationServiceProtocol = LocalNotificationService.shared,
        hapticProvider: HapticFeedbackProvider = UIKitHapticFeedbackProvider()
    ) {
        self.scheduleService = scheduleService
        self.notificationService = notificationService
        self.hapticProvider = hapticProvider
        loadSchedules()
    }

    // MARK: - Public Methods - CRUD

    /// Add a new schedule
    /// - Parameter schedule: Schedule to add
    func addSchedule(_ schedule: Schedule) {
        Task {
            do {
                isLoading = true
                let request = CreateScheduleRequest(
                    title: schedule.title,
                    description: schedule.description,
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    reminderMinutesBefore: schedule.reminderMinutesBefore,
                    location: schedule.location
                )
                let created = try await scheduleService.createSchedule(request)
                schedules.append(created)
                isLoading = false

                // Schedule notification if reminder is set
                if let reminderMinutes = schedule.reminderMinutesBefore {
                    await scheduleReminder(for: created, minutesBefore: reminderMinutes)
                }

                successMessage = "Schedule added successfully"
            } catch {
                isLoading = false
                errorMessage = error.localizedDescription
            }
        }
    }

    /// Update an existing schedule
    /// - Parameter schedule: Schedule with updated values
    func updateSchedule(_ schedule: Schedule) {
        Task {
            do {
                isLoading = true
                let request = CreateScheduleRequest(
                    title: schedule.title,
                    description: schedule.description,
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    reminderMinutesBefore: schedule.reminderMinutesBefore,
                    location: schedule.location
                )
                let updated = try await scheduleService.updateSchedule(id: schedule.id.uuidString, request: request)

                // Cancel old notification and schedule new one if needed
                await cancelReminder(for: schedule.id)
                if let reminderMinutes = schedule.reminderMinutesBefore {
                    await scheduleReminder(for: updated, minutesBefore: reminderMinutes)
                }

                if let index = schedules.firstIndex(where: { $0.id == schedule.id }) {
                    schedules[index] = updated
                }
                isLoading = false
                successMessage = "Schedule updated successfully"
            } catch {
                isLoading = false
                errorMessage = error.localizedDescription
            }
        }
    }

    /// Delete a schedule
    /// - Parameter id: Schedule ID to delete
    func deleteSchedule(_ id: UUID) {
        Task {
            do {
                isLoading = true
                try await scheduleService.deleteSchedule(id: id.uuidString)
                await cancelReminder(for: id)
                schedules.removeAll { $0.id == id }
                isLoading = false
                successMessage = "Schedule deleted"
            } catch {
                isLoading = false
                errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Public Methods - Form

    /// Show form for adding new schedule
    func showAddForm() {
        editingSchedule = nil
        showForm = true
    }

    /// Show form for editing existing schedule
    /// - Parameter schedule: Schedule to edit
    func showEditForm(for schedule: Schedule) {
        editingSchedule = schedule
        showForm = true
    }

    /// Dismiss form
    func dismissForm() {
        showForm = false
        editingSchedule = nil
    }

    // MARK: - Public Methods - Filter

    /// Set filter
    /// - Parameter newFilter: New filter value
    func setFilter(_ newFilter: ScheduleFilter) {
        filter = newFilter
    }

    // MARK: - Public Methods - Messages

    /// Clear messages
    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }

    // MARK: - Public Methods - Haptic

    /// Trigger haptic feedback - call this from View layer
    func triggerHaptic() {
        hapticProvider.trigger()
    }

    // MARK: - Private Methods - Notifications

    /// Schedule a reminder notification for a schedule
    /// - Parameters:
    ///   - schedule: Schedule to remind about
    ///   - minutesBefore: Minutes before the schedule to remind
    private func scheduleReminder(for schedule: Schedule, minutesBefore: Int) async {
        let reminderDate = schedule.startTime.addingTimeInterval(-Double(minutesBefore * 60))

        // Don't schedule if the reminder time has already passed
        guard reminderDate > Date() else { return }

        let request = LocalNotificationRequest(
            id: "SCHEDULE_\(schedule.id.uuidString)",
            type: .system,
            title: schedule.title,
            body: schedule.description ?? "Starting at \(schedule.timeRangeString)",
            scheduledDate: reminderDate,
            repeats: false,
            sound: .default,
            userInfo: ["scheduleId": schedule.id.uuidString],
            categoryIdentifier: nil
        )

        do {
            _ = try await notificationService.schedule(request)
        } catch {
            SecureLogger.shared.error("Failed to schedule reminder: \(error)")
        }
    }

    /// Cancel reminder notification for a schedule
    /// - Parameter id: Schedule ID
    private func cancelReminder(for id: UUID) async {
        do {
            try await notificationService.cancelNotification(identifier: "SCHEDULE_\(id.uuidString)")
        } catch {
            // Notification may not exist, ignore error
        }
    }

    // MARK: - Private Methods - Persistence

    /// Load schedules from backend API
    func loadSchedules() {
        Task {
            isLoading = true
            do {
                let fetchedSchedules = try await scheduleService.fetchSchedules()
                schedules = fetchedSchedules
                isLoading = false
            } catch {
                isLoading = false
                errorMessage = "Failed to load schedules: \(error.localizedDescription)"
            }
        }
    }

    /// Refresh schedules from backend
    func refresh() {
        loadSchedules()
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension ScheduleViewModel {
    /// Create view model with sample data using a test-friendly initializer
    static var preview: ScheduleViewModel {
        let vm = ScheduleViewModel(
            notificationService: PreviewNotificationService(),
            hapticProvider: PreviewHapticProvider()
        )
        vm.loadSampleSchedules()
        return vm
    }

    /// Internal method to load sample schedules for preview
    func loadSampleSchedules() {
        schedules = Schedule.sampleSchedules
    }
}

/// Test notification service that does nothing
private final class PreviewNotificationService: LocalNotificationServiceProtocol {
    var authorizationStatus: UNAuthorizationStatus { .authorized }
    var isAuthorized: Bool { true }

    func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool { true }
    func checkAuthorizationStatus() async -> UNAuthorizationStatus { .authorized }
    func schedule(_ request: LocalNotificationRequest) async throws -> String { "preview-\(UUID().uuidString)" }
    func scheduleStudyReminder(config: StudyReminderConfig, customMessage: String?) async throws -> String { "preview-\(UUID().uuidString)" }
    func scheduleDailyGoalReminder(config: DailyGoalConfig, goalProgress: String?) async throws -> String { "preview-\(UUID().uuidString)" }
    func getScheduledNotifications() async -> [UNNotificationRequest] { [] }
    func getPendingNotifications(ofType type: LocalNotificationType) async -> [UNNotificationRequest] { [] }
    func cancelNotification(identifier: String) async throws { }
    func cancelNotifications(ofType type: LocalNotificationType) async { }
    func cancelAllNotifications() async { }
    func removeDeliveredNotifications() async { }
    func getPendingNotificationIdentifiers() async -> [String] { [] }
    func getNotificationSettings() async -> UNNotificationSettings {
        // Preview/test implementation - not used in actual app
        // In production, this would come from UNUserNotificationCenter.current().notificationSettings()
        fatalError("getNotificationSettings() should not be called in preview mode")
    }
    func registerCategories() { }
    func setBadgeCount(_ count: Int) { }
    func clearBadge() { }
}

/// Test haptic provider that does nothing
private final class PreviewHapticProvider: HapticFeedbackProvider {
    func trigger() {
        // No-op for preview
    }
}
#endif
