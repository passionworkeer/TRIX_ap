//
//  ScheduleViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for ScheduleViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - ScheduleViewModel Tests

@MainActor
final class ScheduleViewModelTests: XCTestCase {

    // MARK: - Properties

    var sut: ScheduleViewModel!
    var mockScheduleService: MockScheduleService!
    var mockNotificationService: MockNotificationService!
    var mockHapticProvider: MockHapticFeedbackProvider!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUp() {
        super.setUp()

        mockScheduleService = MockScheduleService()
        mockNotificationService = MockNotificationService()
        mockHapticProvider = MockHapticFeedbackProvider()

        sut = ScheduleViewModel(
            scheduleService: mockScheduleService,
            notificationService: mockNotificationService,
            hapticProvider: mockHapticProvider
        )

        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        sut = nil
        mockScheduleService = nil
        mockNotificationService = nil
        mockHapticProvider = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Helpers

    private func waitForAsyncStateChange() async {
        try? await Task.sleep(nanoseconds: 250_000_000)
    }

    private func waitForInitialLoadToSettle() async {
        try? await Task.sleep(nanoseconds: 150_000_000)
        mockScheduleService.resetCallTracking()
    }

    private func loadSchedules(_ schedules: [Schedule]) async {
        await waitForInitialLoadToSettle()
        mockScheduleService.setSchedules(schedules)
        sut.loadSchedules()
        await waitForAsyncStateChange()
    }

    // MARK: - Initial State Tests

    func testInitialState_EmptySchedules() {
        XCTAssertTrue(sut.schedules.isEmpty)
    }

    func testInitialState_DefaultFilter() {
        XCTAssertEqual(sut.filter, .upcoming)
    }

    func testInitialState_NotLoading() {
        XCTAssertFalse(sut.isLoading)
    }

    func testInitialState_NoError() {
        XCTAssertNil(sut.errorMessage)
    }

    func testInitialState_NoSuccessMessage() {
        XCTAssertNil(sut.successMessage)
    }

    func testInitialState_FormNotShown() {
        XCTAssertFalse(sut.showForm)
    }

    func testInitialState_NoEditingSchedule() {
        XCTAssertNil(sut.editingSchedule)
    }

    // MARK: - Computed Properties Tests

    func testFilteredSchedules_AllFilter() async {
        // Given
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let schedules = [
            Schedule(title: "Future", startTime: tomorrow),
            Schedule(title: "Past", startTime: yesterday)
        ]
        await loadSchedules(schedules)

        // When
        sut.setFilter(.all)

        // Then
        XCTAssertEqual(sut.filteredSchedules.count, 2)
    }

    func testFilteredSchedules_UpcomingFilter() async {
        // Given
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let schedules = [
            Schedule(title: "Future", startTime: tomorrow),
            Schedule(title: "Past", startTime: yesterday)
        ]
        await loadSchedules(schedules)

        // When
        sut.setFilter(.upcoming)

        // Then
        let filtered = sut.filteredSchedules
        XCTAssertTrue(filtered.allSatisfy { !$0.isPast })
    }

    func testFilteredSchedules_TodayFilter() async {
        // Given
        let now = Date()
        let schedules = [
            Schedule(title: "Today", startTime: now),
            Schedule(title: "Tomorrow", startTime: Calendar.current.date(byAdding: .day, value: 1, to: now)!)
        ]
        await loadSchedules(schedules)

        // When
        sut.setFilter(.today)

        // Then
        let filtered = sut.filteredSchedules
        XCTAssertTrue(filtered.allSatisfy { $0.isToday })
    }

    func testFilteredSchedules_PastFilter() async {
        // Given
        let now = Date()
        let schedules = [
            Schedule(title: "Past", startTime: Calendar.current.date(byAdding: .day, value: -1, to: now)!),
            Schedule(title: "Future", startTime: Calendar.current.date(byAdding: .day, value: 1, to: now)!)
        ]
        await loadSchedules(schedules)

        // When
        sut.setFilter(.past)

        // Then
        let filtered = sut.filteredSchedules
        XCTAssertTrue(filtered.allSatisfy { $0.isPast })
    }

    func testTodaySchedules_OnlyTodayAndNotPast() async {
        // Given
        let now = Date()
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now)!
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: now)!

        let schedules = [
            Schedule(title: "Today", startTime: now),
            Schedule(title: "Tomorrow", startTime: tomorrow),
            Schedule(title: "Yesterday", startTime: yesterday)
        ]
        await loadSchedules(schedules)

        // Then
        let todaySchedules = sut.todaySchedules
        XCTAssertTrue(todaySchedules.allSatisfy { $0.isToday && !$0.isPast })
    }

    func testUpcomingSchedules_Next7Days() async {
        // Given
        let now = Date()
        let nextWeek = Calendar.current.date(byAdding: .day, value: 7, to: now)!
        let nextMonth = Calendar.current.date(byAdding: .day, value: 14, to: now)!

        let schedules = [
            Schedule(title: "Soon", startTime: Calendar.current.date(byAdding: .hour, value: 2, to: now)!),
            Schedule(title: "NextWeek", startTime: nextWeek),
            Schedule(title: "NextMonth", startTime: nextMonth)
        ]
        await loadSchedules(schedules)

        // Then
        let upcoming = sut.upcomingSchedules
        XCTAssertTrue(upcoming.count <= 2) // Soon and next week
        XCTAssertTrue(upcoming.allSatisfy { !$0.isPast && $0.startTime <= nextWeek })
    }

    func testTodayCount_ReturnsCorrectCount() async {
        // Given
        let now = Date()
        let laterToday = Calendar.current.date(byAdding: .minute, value: 10, to: now)!
        let schedules = [
            Schedule(title: "Today 1", startTime: laterToday),
            Schedule(title: "Today 2", startTime: Calendar.current.date(byAdding: .minute, value: 20, to: now)!),
            Schedule(title: "Tomorrow", startTime: Calendar.current.date(byAdding: .day, value: 1, to: now)!)
        ]
        await loadSchedules(schedules)

        // Then
        XCTAssertEqual(sut.todayCount, 2)
    }

    func testUpcomingCount_ReturnsCorrectCount() async {
        // Given
        let now = Date()
        let schedules = [
            Schedule(title: "Soon", startTime: Calendar.current.date(byAdding: .minute, value: 10, to: now)!),
            Schedule(title: "Later", startTime: Calendar.current.date(byAdding: .day, value: 3, to: now)!),
            Schedule(title: "Past", startTime: Calendar.current.date(byAdding: .day, value: -1, to: now)!)
        ]
        await loadSchedules(schedules)

        // Then
        XCTAssertEqual(sut.upcomingCount, 2)
    }

    // MARK: - CRUD Operations Tests

    func testAddSchedule_Success() async {
        await waitForInitialLoadToSettle()

        // Given
        let schedule = Schedule(
            title: "New Meeting",
            description: "Team sync",
            startTime: Date().addingTimeInterval(3600),
            endTime: Date().addingTimeInterval(7200),
            reminderMinutesBefore: 15,
            location: "Conference Room"
        )

        // When
        sut.addSchedule(schedule)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockScheduleService.createScheduleCalled)
        XCTAssertEqual(sut.schedules.count, 1)
        XCTAssertEqual(sut.schedules.first?.title, "New Meeting")
        XCTAssertEqual(sut.successMessage, NSLocalizedString("schedule.add.success", comment: ""))
    }

    func testAddSchedule_WithReminder_SchedulesNotification() async {
        await waitForInitialLoadToSettle()

        // Given
        let futureDate = Date().addingTimeInterval(3600 * 2) // 2 hours from now
        let schedule = Schedule(
            title: "Meeting with Reminder",
            startTime: futureDate,
            reminderMinutesBefore: 15
        )

        // When
        sut.addSchedule(schedule)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockScheduleService.createScheduleCalled)
        XCTAssertTrue(mockNotificationService.scheduleCalled)
    }

    func testAddSchedule_ServiceFailure() async {
        await waitForInitialLoadToSettle()

        // Given
        mockScheduleService.shouldFailCreate = true
        mockScheduleService.mockError = ScheduleServiceError.createFailed(underlying: NSError(domain: "Test", code: 500))

        let schedule = Schedule(title: "Test", startTime: Date())

        // When
        sut.addSchedule(schedule)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertTrue(sut.schedules.isEmpty)
    }

    func testUpdateSchedule_Success() async {
        // Given
        let schedule = Schedule(
            id: UUID(),
            title: "Original Title",
            startTime: Date(),
            syncStatus: .synced
        )
        await loadSchedules([schedule])

        // When
        let updated = Schedule(
            id: schedule.id,
            title: "Updated Title",
            description: schedule.description,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            reminderMinutesBefore: schedule.reminderMinutesBefore,
            location: schedule.location,
            createdAt: schedule.createdAt,
            updatedAt: Date(),
            syncStatus: .synced
        )
        sut.updateSchedule(updated)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockScheduleService.updateScheduleCalled)
        XCTAssertEqual(sut.successMessage, NSLocalizedString("schedule.edit.success", comment: ""))
    }

    func testUpdateSchedule_ServiceFailure() async {
        // Given
        mockScheduleService.shouldFailUpdate = true
        mockScheduleService.mockError = ScheduleServiceError.updateFailed(underlying: NSError(domain: "Test", code: 500))

        let schedule = Schedule(id: UUID(), title: "Test", startTime: Date())
        await loadSchedules([schedule])

        // When
        sut.updateSchedule(schedule)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    func testDeleteSchedule_Success() async {
        // Given
        let scheduleId = UUID()
        let schedule = Schedule(id: scheduleId, title: "To Delete", startTime: Date())
        await loadSchedules([schedule])

        // When
        sut.deleteSchedule(scheduleId)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockScheduleService.deleteScheduleCalled)
        XCTAssertEqual(sut.schedules.count, 0)
        XCTAssertEqual(sut.successMessage, NSLocalizedString("schedule.delete.success", comment: ""))
    }

    func testDeleteSchedule_CancelsNotification() async {
        // Given
        let scheduleId = UUID()
        let schedule = Schedule(id: scheduleId, title: "To Delete", startTime: Date())
        await loadSchedules([schedule])

        // When
        sut.deleteSchedule(scheduleId)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockNotificationService.cancelNotificationCalled)
    }

    func testDeleteSchedule_ServiceFailure() async {
        // Given
        mockScheduleService.shouldFailDelete = true
        mockScheduleService.mockError = ScheduleServiceError.deleteFailed(underlying: NSError(domain: "Test", code: 500))

        let scheduleId = UUID()
        let schedule = Schedule(id: scheduleId, title: "Test", startTime: Date())
        await loadSchedules([schedule])

        // When
        sut.deleteSchedule(scheduleId)

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertEqual(sut.schedules.count, 1) // Should not be deleted
    }

    // MARK: - Form Methods Tests

    func testShowAddForm_SetsCorrectState() {
        // When
        sut.showAddForm()

        // Then
        XCTAssertTrue(sut.showForm)
        XCTAssertNil(sut.editingSchedule)
    }

    func testShowEditForm_SetsCorrectState() {
        // Given
        let schedule = Schedule(title: "Test", startTime: Date())

        // When
        sut.showEditForm(for: schedule)

        // Then
        XCTAssertTrue(sut.showForm)
        XCTAssertEqual(sut.editingSchedule, schedule)
    }

    func testDismissForm_ResetsState() {
        // Given
        let schedule = Schedule(title: "Test", startTime: Date())
        sut.showEditForm(for: schedule)
        XCTAssertTrue(sut.showForm)
        XCTAssertNotNil(sut.editingSchedule)

        // When
        sut.dismissForm()

        // Then
        XCTAssertFalse(sut.showForm)
        XCTAssertNil(sut.editingSchedule)
    }

    // MARK: - Filter Tests

    func testSetFilter_UpdatesFilter() {
        // When
        sut.setFilter(.all)

        // Then
        XCTAssertEqual(sut.filter, .all)
    }

    func testSetFilter_EachCase() {
        let cases: [ScheduleFilter] = [.all, .upcoming, .today, .past]

        for filterCase in cases {
            sut.setFilter(filterCase)
            XCTAssertEqual(sut.filter, filterCase)
        }
    }

    // MARK: - Message Handling Tests

    func testClearMessages_ClearsBoth() {
        // Given
        sut.errorMessage = "Error"
        sut.successMessage = "Success"

        // When
        sut.clearMessages()

        // Then
        XCTAssertNil(sut.errorMessage)
        XCTAssertNil(sut.successMessage)
    }

    // MARK: - Haptic Feedback Tests

    func testTriggerHaptic_CallsProvider() {
        // When
        sut.triggerHaptic()

        // Then
        XCTAssertTrue(mockHapticProvider.triggerCalled)
        XCTAssertEqual(mockHapticProvider.triggerCount, 1)
    }

    func testTriggerHaptic_MultipleCalls() {
        // When
        sut.triggerHaptic()
        sut.triggerHaptic()
        sut.triggerHaptic()

        // Then
        XCTAssertEqual(mockHapticProvider.triggerCount, 3)
    }

    // MARK: - Load and Refresh Tests

    func testLoadSchedules_Success() async {
        await waitForInitialLoadToSettle()

        // Given
        let schedules = [
            Schedule(title: "Schedule 1", startTime: Date()),
            Schedule(title: "Schedule 2", startTime: Date())
        ]
        mockScheduleService.setSchedules(schedules)

        // When
        sut.loadSchedules()

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockScheduleService.fetchSchedulesCalled)
        XCTAssertEqual(sut.schedules.count, 2)
    }

    func testLoadSchedules_Failure() async {
        await waitForInitialLoadToSettle()

        // Given
        mockScheduleService.shouldFailFetch = true
        mockScheduleService.mockError = ScheduleServiceError.fetchFailed(underlying: NSError(domain: "Test", code: 500))

        // When
        sut.loadSchedules()

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    func testLoadSampleSchedules_LoadsData() {
        // When
        sut.loadSampleSchedules()

        // Then
        XCTAssertFalse(sut.schedules.isEmpty)
        XCTAssertNil(sut.errorMessage)
    }

    func testRefresh_CallsLoadSchedules() async {
        await waitForInitialLoadToSettle()

        // Given
        mockScheduleService.setSchedules([Schedule(title: "Test", startTime: Date())])

        // When
        sut.refresh()

        // Wait for async operation
        await waitForAsyncStateChange()

        // Then
        XCTAssertTrue(mockScheduleService.fetchSchedulesCalled)
    }

    // MARK: - Loading State Tests

    func testLoadingState_ChangesDuringOperation() async {
        await waitForInitialLoadToSettle()

        // Given
        let expectation = expectation(description: "Loading state changes")
        var loadingStates: [Bool] = []

        sut.$isLoading
            .dropFirst()
            .sink { isLoading in
                loadingStates.append(isLoading)
                if loadingStates.suffix(2) == [true, false] {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        sut.loadSchedules()

        // Then
        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertEqual(Array(loadingStates.suffix(2)), [true, false])
    }

    // MARK: - Notification Scheduling Tests

    // NOTE: scheduleReminder and cancelReminder are private in ScheduleViewModel.
    // These methods are tested indirectly through createSchedule/deleteSchedule integration tests.

}
