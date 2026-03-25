//
//  MockWorkbenchServices.swift
//  TRIX3DCompanionTests
//
//  Mock implementations for Workbench feature services
//

import Foundation
import Combine
import UserNotifications
@testable import TRIX3DCompanion

// MARK: - Mock Schedule Service

/// Mock implementation of ScheduleServiceProtocol for testing
@MainActor
final class MockScheduleService: ScheduleServiceProtocol, ObservableObject {

    // MARK: - Published Properties

    @Published private(set) var schedules: [Schedule] = []
    @Published private(set) var isLoading: Bool = false

    // MARK: - Test Control Properties

    var shouldFailFetch = false
    var shouldFailCreate = false
    var shouldFailUpdate = false
    var shouldFailDelete = false
    var mockError: Error = ScheduleServiceError.unknown(underlying: nil)

    // MARK: - Call Tracking

    var fetchSchedulesCalled = false
    var fetchSchedulesByDateRangeCalled = false
    var fetchUpcomingSchedulesCalled = false
    var createScheduleCalled = false
    var updateScheduleCalled = false
    var deleteScheduleCalled = false

    var lastCreateRequest: CreateScheduleRequest?
    var lastUpdateId: String?
    var lastUpdateRequest: CreateScheduleRequest?
    var lastDeleteId: String?

    // MARK: - Initialization

    init(schedules: [Schedule] = []) {
        self.schedules = schedules
    }

    // MARK: - Protocol Methods

    func fetchSchedules() async throws -> [Schedule] {
        fetchSchedulesCalled = true

        if shouldFailFetch {
            throw mockError
        }

        isLoading = true
        try await Task.sleep(nanoseconds: 100_000_000) // Simulate network delay
        isLoading = false
        return schedules
    }

    func fetchSchedulesByDateRange(start: Date, end: Date) async throws -> [Schedule] {
        fetchSchedulesByDateRangeCalled = true

        if shouldFailFetch {
            throw mockError
        }

        return schedules.filter { $0.startTime >= start && $0.startTime <= end }
    }

    func fetchUpcomingSchedules(minutes: Int) async throws -> [Schedule] {
        fetchUpcomingSchedulesCalled = true

        if shouldFailFetch {
            throw mockError
        }

        let cutoff = Date().addingTimeInterval(Double(minutes * 60))
        return schedules.filter { $0.startTime <= cutoff && $0.startTime >= Date() }
    }

    func createSchedule(_ request: CreateScheduleRequest) async throws -> Schedule {
        createScheduleCalled = true
        lastCreateRequest = request

        if shouldFailCreate {
            throw mockError
        }

        let newSchedule = Schedule(
            id: UUID(),
            title: request.title,
            description: request.description,
            startTime: request.startTime,
            endTime: request.endTime,
            reminderMinutesBefore: request.reminderMinutesBefore,
            location: request.location,
            createdAt: Date(),
            updatedAt: Date(),
            syncStatus: .synced
        )

        schedules.append(newSchedule)
        return newSchedule
    }

    func updateSchedule(id: String, request: CreateScheduleRequest) async throws -> Schedule {
        updateScheduleCalled = true
        lastUpdateId = id
        lastUpdateRequest = request

        if shouldFailUpdate {
            throw mockError
        }

        guard let uuid = UUID(uuidString: id),
              let index = schedules.firstIndex(where: { $0.id == uuid }) else {
            throw ScheduleServiceError.updateFailed(underlying: NSError(domain: "Test", code: 404))
        }

        let updated = Schedule(
            id: uuid,
            title: request.title,
            description: request.description,
            startTime: request.startTime,
            endTime: request.endTime,
            reminderMinutesBefore: request.reminderMinutesBefore,
            location: request.location,
            createdAt: schedules[index].createdAt,
            updatedAt: Date(),
            syncStatus: .synced
        )

        schedules[index] = updated
        return updated
    }

    func deleteSchedule(id: String) async throws {
        deleteScheduleCalled = true
        lastDeleteId = id

        if shouldFailDelete {
            throw mockError
        }

        guard let uuid = UUID(uuidString: id) else {
            throw ScheduleServiceError.deleteFailed(underlying: NSError(domain: "Test", code: 400))
        }

        schedules.removeAll { $0.id == uuid }
    }

    // MARK: - Helper Methods

    func setSchedules(_ newSchedules: [Schedule]) {
        schedules = newSchedules
    }

    func resetCallTracking() {
        fetchSchedulesCalled = false
        fetchSchedulesByDateRangeCalled = false
        fetchUpcomingSchedulesCalled = false
        createScheduleCalled = false
        updateScheduleCalled = false
        deleteScheduleCalled = false
        lastCreateRequest = nil
        lastUpdateId = nil
        lastUpdateRequest = nil
        lastDeleteId = nil
    }
}

// MARK: - Mock Todo Service

/// Mock implementation of TodoServiceProtocol for testing
@MainActor
final class MockTodoService: TodoServiceProtocol, ObservableObject {

    // MARK: - Published Properties

    @Published private(set) var todos: [Todo] = []
    @Published private(set) var isLoading: Bool = false

    // MARK: - Test Control Properties

    var shouldFailFetch = false
    var shouldFailCreate = false
    var shouldFailUpdate = false
    var shouldFailDelete = false
    var shouldFailToggle = false
    var mockError: Error = TodoServiceError.unknown(underlying: nil)

    // MARK: - Call Tracking

    var fetchTodosCalled = false
    var createTodoCalled = false
    var updateTodoCalled = false
    var deleteTodoCalled = false
    var toggleTodoCalled = false

    var lastCreateRequest: CreateTodoRequest?
    var lastUpdateId: String?
    var lastUpdateRequest: UpdateTodoRequest?
    var lastDeleteId: String?
    var lastToggleId: String?

    // MARK: - Initialization

    init(todos: [Todo] = []) {
        self.todos = todos
    }

    // MARK: - Protocol Methods

    func fetchTodos() async throws -> [Todo] {
        fetchTodosCalled = true

        if shouldFailFetch {
            throw mockError
        }

        isLoading = true
        try await Task.sleep(nanoseconds: 100_000_000) // Simulate network delay
        isLoading = false
        return todos
    }

    func createTodo(_ request: CreateTodoRequest) async throws -> Todo {
        createTodoCalled = true
        lastCreateRequest = request

        if shouldFailCreate {
            throw mockError
        }

        let newTodo = Todo(
            id: UUID(),
            title: request.title,
            description: request.description,
            completed: false,
            priority: request.priority,
            dueDate: request.dueDate,
            createdAt: Date(),
            updatedAt: Date(),
            syncStatus: .synced
        )

        todos.append(newTodo)
        return newTodo
    }

    func updateTodo(id: String, request: UpdateTodoRequest) async throws -> Todo {
        updateTodoCalled = true
        lastUpdateId = id
        lastUpdateRequest = request

        if shouldFailUpdate {
            throw mockError
        }

        guard let uuid = UUID(uuidString: id),
              let index = todos.firstIndex(where: { $0.id == uuid }) else {
            throw TodoServiceError.updateFailed(underlying: NSError(domain: "Test", code: 404))
        }

        let existing = todos[index]
        let updated = Todo(
            id: uuid,
            title: request.title ?? existing.title,
            description: request.description ?? existing.description,
            completed: request.completed ?? existing.completed,
            priority: request.priority ?? existing.priority,
            dueDate: request.dueDate ?? existing.dueDate,
            createdAt: existing.createdAt,
            updatedAt: Date(),
            syncStatus: .synced
        )

        todos[index] = updated
        return updated
    }

    func deleteTodo(id: String) async throws {
        deleteTodoCalled = true
        lastDeleteId = id

        if shouldFailDelete {
            throw mockError
        }

        guard let uuid = UUID(uuidString: id) else {
            throw TodoServiceError.deleteFailed(underlying: NSError(domain: "Test", code: 400))
        }

        todos.removeAll { $0.id == uuid }
    }

    func toggleTodo(id: String) async throws -> Todo {
        toggleTodoCalled = true
        lastToggleId = id

        if shouldFailToggle {
            throw mockError
        }

        guard let uuid = UUID(uuidString: id),
              let index = todos.firstIndex(where: { $0.id == uuid }) else {
            throw TodoServiceError.toggleFailed(underlying: NSError(domain: "Test", code: 404))
        }

        let existing = todos[index]
        let updated = Todo(
            id: uuid,
            title: existing.title,
            description: existing.description,
            completed: !existing.completed,
            priority: existing.priority,
            dueDate: existing.dueDate,
            createdAt: existing.createdAt,
            updatedAt: Date(),
            syncStatus: .synced
        )

        todos[index] = updated
        return updated
    }

    // MARK: - Helper Methods

    func setTodos(_ newTodos: [Todo]) {
        todos = newTodos
    }

    func resetCallTracking() {
        fetchTodosCalled = false
        createTodoCalled = false
        updateTodoCalled = false
        deleteTodoCalled = false
        toggleTodoCalled = false
        lastCreateRequest = nil
        lastUpdateId = nil
        lastUpdateRequest = nil
        lastDeleteId = nil
        lastToggleId = nil
    }
}

// MARK: - Mock Notification Service

/// Mock implementation of LocalNotificationServiceProtocol for testing
@MainActor
final class MockNotificationService: LocalNotificationServiceProtocol, ObservableObject {

    // MARK: - Published Properties

    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .authorized
    @Published private(set) var isAuthorized: Bool = true

    // MARK: - Test Control Properties

    var shouldFailSchedule = false
    var shouldFailCancel = false
    var mockError: Error = LocalNotificationError.schedulingFailed(NSError(domain: "Test", code: 500))

    // MARK: - Call Tracking

    var requestAuthorizationCalled = false
    var checkAuthorizationStatusCalled = false
    var scheduleCalled = false
    var scheduleStudyReminderCalled = false
    var scheduleDailyGoalReminderCalled = false
    var getScheduledNotificationsCalled = false
    var getPendingNotificationsCalled = false
    var cancelNotificationCalled = false
    var cancelNotificationsCalled = false
    var cancelAllNotificationsCalled = false
    var removeDeliveredNotificationsCalled = false
    var getPendingNotificationIdentifiersCalled = false
    var getNotificationSettingsCalled = false
    var registerCategoriesCalled = false
    var setBadgeCountCalled = false
    var clearBadgeCalled = false

    var scheduledNotifications: [String: LocalNotificationRequest] = [:]
    var lastScheduledRequest: LocalNotificationRequest?

    // MARK: - Initialization

    init() {}

    // MARK: - Protocol Methods

    func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool {
        requestAuthorizationCalled = true
        return isAuthorized
    }

    func checkAuthorizationStatus() async -> UNAuthorizationStatus {
        checkAuthorizationStatusCalled = true
        return authorizationStatus
    }

    func schedule(_ request: LocalNotificationRequest) async throws -> String {
        scheduleCalled = true
        lastScheduledRequest = request

        if shouldFailSchedule {
            throw mockError
        }

        scheduledNotifications[request.id] = request
        return request.id
    }

    func scheduleStudyReminder(config: StudyReminderConfig, customMessage: String?) async throws -> String {
        scheduleStudyReminderCalled = true
        return "study-reminder-\(UUID().uuidString)"
    }

    func scheduleDailyGoalReminder(config: DailyGoalConfig, goalProgress: String?) async throws -> String {
        scheduleDailyGoalReminderCalled = true
        return "daily-goal-\(UUID().uuidString)"
    }

    func getScheduledNotifications() async -> [UNNotificationRequest] {
        getScheduledNotificationsCalled = true
        return []
    }

    func getPendingNotifications(ofType type: LocalNotificationType) async -> [UNNotificationRequest] {
        getPendingNotificationsCalled = true
        return []
    }

    func cancelNotification(identifier: String) async throws {
        cancelNotificationCalled = true

        if shouldFailCancel {
            throw mockError
        }

        scheduledNotifications.removeValue(forKey: identifier)
    }

    func cancelNotifications(ofType type: LocalNotificationType) async {
        cancelNotificationsCalled = true
    }

    func cancelAllNotifications() async {
        cancelAllNotificationsCalled = true
        scheduledNotifications.removeAll()
    }

    func removeDeliveredNotifications() async {
        removeDeliveredNotificationsCalled = true
    }

    func getPendingNotificationIdentifiers() async -> [String] {
        getPendingNotificationIdentifiersCalled = true
        return Array(scheduledNotifications.keys)
    }

    func getNotificationSettings() async -> UNNotificationSettings {
        getNotificationSettingsCalled = true
        // UNNotificationSettings has no public init; return via user notification center
        return await withCheckedContinuation { continuation in
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                continuation.resume(returning: settings)
            }
        }
    }

    func registerCategories() {
        registerCategoriesCalled = true
    }

    func setBadgeCount(_ count: Int) {
        setBadgeCountCalled = true
    }

    func clearBadge() {
        clearBadgeCalled = true
    }

    // MARK: - Helper Methods

    func resetCallTracking() {
        requestAuthorizationCalled = false
        checkAuthorizationStatusCalled = false
        scheduleCalled = false
        scheduleStudyReminderCalled = false
        scheduleDailyGoalReminderCalled = false
        getScheduledNotificationsCalled = false
        getPendingNotificationsCalled = false
        cancelNotificationCalled = false
        cancelNotificationsCalled = false
        cancelAllNotificationsCalled = false
        removeDeliveredNotificationsCalled = false
        getPendingNotificationIdentifiersCalled = false
        getNotificationSettingsCalled = false
        registerCategoriesCalled = false
        setBadgeCountCalled = false
        clearBadgeCalled = false
        lastScheduledRequest = nil
    }

    func setAuthorizationStatus(_ status: UNAuthorizationStatus) {
        authorizationStatus = status
        isAuthorized = status == .authorized
    }
}

// MARK: - Mock Haptic Feedback Provider

/// Mock implementation of HapticFeedbackProvider for testing
final class MockHapticFeedbackProvider: HapticFeedbackProvider {

    var triggerCalled = false
    var triggerCount = 0

    func trigger() {
        triggerCalled = true
        triggerCount += 1
    }

    func reset() {
        triggerCalled = false
        triggerCount = 0
    }
}
