//
//  HomeViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for HomeViewModel - Home screen navigation and state management
//
//  Test Coverage:
//  - Workbench presentation state
//  - Panel visibility (mail, notifications, study room)
//  - Quick snap options and camera capture flow
//  - Photo picker handling
//  - Snapshot navigation
//  - Workbench item interactions
//  - Navigation destination management
//

import XCTest
import UIKit
@testable import TRIX3DCompanion

// MARK: - Home View Model Tests

@MainActor
final class HomeViewModelTests: XCTestCase {

    var sut: HomeViewModel!

    override func setUp() async throws {
        try await super.setUp()
        sut = HomeViewModel()
    }

    override func tearDown() async throws {
        sut = nil
        try await super.tearDown()
    }
}

// MARK: - Initial State Tests

extension HomeViewModelTests {

    func testInitialWorkbenchState() {
        // Then
        XCTAssertFalse(sut.isWorkbenchPresented, "Workbench should be hidden initially")
    }

    func testInitialRobotBackgroundState() {
        // Then
        XCTAssertTrue(sut.useRobotBackground, "Robot background should be enabled initially")
    }

    func testInitialMailPanelState() {
        // Then
        XCTAssertFalse(sut.showMailPanel, "Mail panel should be hidden initially")
    }

    func testInitialNotificationPanelState() {
        // Then
        XCTAssertFalse(sut.showNotificationPanel, "Notification panel should be hidden initially")
    }

    func testInitialStudyRoomState() {
        // Then
        XCTAssertFalse(sut.showStudyRoom, "Study room should be hidden initially")
    }

    func testInitialQuickSnapOptionsState() {
        // Then
        XCTAssertFalse(sut.showQuickSnapOptions, "Quick snap options should be hidden initially")
    }

    func testInitialCameraCaptureState() {
        // Then
        XCTAssertFalse(sut.showCameraCapture, "Camera capture should be hidden initially")
    }

    func testInitialPhotoPickerState() {
        // Then
        XCTAssertFalse(sut.showPhotoPicker, "Photo picker should be hidden initially")
    }

    func testInitialSnapshotState() {
        // Then
        XCTAssertFalse(sut.showSnapshot, "Snapshot should be hidden initially")
    }

    func testInitialNavigationDestination() {
        // Then
        XCTAssertEqual(sut.navigationDestination, .none, "Navigation destination should be none initially")
    }

    func testInitialPendingSnapshotImage() {
        // Then
        XCTAssertNil(sut.pendingSnapshotImage, "Pending snapshot image should be nil initially")
    }

    func testInitialPendingSnapshotURL() {
        // Then
        XCTAssertNil(sut.pendingSnapshotImageURL, "Pending snapshot URL should be nil initially")
    }
}

// MARK: - Workbench Tests

extension HomeViewModelTests {

    func testToggleWorkbenchFromHidden() {
        // When
        sut.toggleWorkbench()

        // Then
        XCTAssertTrue(sut.isWorkbenchPresented, "Workbench should be presented after toggle")
    }

    func testToggleWorkbenchFromPresented() {
        // Given
        sut.isWorkbenchPresented = true

        // When
        sut.toggleWorkbench()

        // Then
        XCTAssertFalse(sut.isWorkbenchPresented, "Workbench should be hidden after toggle")
    }

    func testHandleWorkbenchPresentedChange() {
        // When
        sut.handleWorkbenchPresentedChange(true)

        // Then
        XCTAssertTrue(sut.isWorkbenchPresented, "Workbench should be presented")
    }

    func testHandleWorkbenchCardClickSnapshot() {
        // When
        sut.handleWorkbenchCardClick(WorkbenchItem.snapshot.id)

        // Then
        XCTAssertFalse(sut.isWorkbenchPresented, "Workbench should be hidden after card click")
        XCTAssertTrue(sut.showQuickSnapOptions, "Quick snap options should be shown")
    }

    func testHandleWorkbenchCardClickLocation() {
        // When
        sut.handleWorkbenchCardClick(WorkbenchItem.location.id)

        // Then
        XCTAssertFalse(sut.isWorkbenchPresented, "Workbench should be hidden after card click")
        XCTAssertTrue(sut.showLocation, "Location should be shown")
    }

    func testHandleWorkbenchCardClickSchedule() {
        // When
        sut.handleWorkbenchCardClick(WorkbenchItem.schedule.id)

        // Then
        XCTAssertFalse(sut.isWorkbenchPresented, "Workbench should be hidden after card click")
        XCTAssertTrue(sut.showSchedule, "Schedule should be shown")
    }

    func testHandleWorkbenchCardClickTodo() {
        // When
        sut.handleWorkbenchCardClick(WorkbenchItem.todo.id)

        // Then
        XCTAssertFalse(sut.isWorkbenchPresented, "Workbench should be hidden after card click")
        XCTAssertTrue(sut.showTodo, "Todo should be shown")
    }

    func testHandleWorkbenchCardClickUnknownItem() {
        // Given
        sut.isWorkbenchPresented = true

        // When
        sut.handleWorkbenchCardClick("unknown_item")

        // Then
        XCTAssertFalse(sut.isWorkbenchPresented, "Workbench should be hidden after card click")
        XCTAssertFalse(sut.showQuickSnapOptions, "Quick snap options should not be shown")
        XCTAssertFalse(sut.showLocation, "Location should not be shown")
    }
}

// MARK: - Quick Snap Options Tests

extension HomeViewModelTests {

    func testPresentCameraFromQuickSnap() {
        // Given
        sut.showQuickSnapOptions = true

        // When
        sut.presentCamera()

        // Then
        XCTAssertFalse(sut.showQuickSnapOptions, "Quick snap options should be hidden")
        XCTAssertTrue(sut.showCameraCapture, "Camera capture should be shown")
    }

    func testPresentPhotoPickerFromQuickSnap() {
        // Given
        sut.showQuickSnapOptions = true

        // When
        sut.presentPhotoPicker()

        // Then
        XCTAssertFalse(sut.showQuickSnapOptions, "Quick snap options should be hidden")
        XCTAssertTrue(sut.showPhotoPicker, "Photo picker should be shown")
    }

    func testPresentAlbumFromQuickSnap() {
        // Given
        sut.showQuickSnapOptions = true

        // When
        sut.presentAlbum()

        // Then
        XCTAssertFalse(sut.showQuickSnapOptions, "Quick snap options should be hidden")
        XCTAssertTrue(sut.showSnapshot, "Snapshot should be shown")
    }

    func testDismissingQuickSnapOptionsDoesNotAffectOtherStates() {
        // Given
        sut.showLocation = true
        sut.showSchedule = true

        // When
        sut.presentCamera()

        // Then
        XCTAssertTrue(sut.showLocation, "Location state should be preserved")
        XCTAssertTrue(sut.showSchedule, "Schedule state should be preserved")
    }
}

// MARK: - Camera Capture Tests

extension HomeViewModelTests {

    func testHandleCameraCaptureWithImage() {
        // Given
        let testImage = UIImage(systemName: "photo")!

        // When
        sut.handleCameraCapture(image: testImage, uploadedImageURL: nil)

        // Then
        XCTAssertFalse(sut.showCameraCapture, "Camera capture should be hidden")
        XCTAssertEqual(sut.pendingSnapshotImage, testImage, "Pending image should be set")
        XCTAssertNil(sut.pendingSnapshotImageURL, "URL should be nil")
    }

    func testHandleCameraCaptureWithImageAndURL() {
        // Given
        let testImage = UIImage(systemName: "photo")!
        let uploadedURL = "https://example.com/photo.jpg"

        // When
        sut.handleCameraCapture(image: testImage, uploadedImageURL: uploadedURL)

        // Then
        XCTAssertEqual(sut.pendingSnapshotImage, testImage, "Pending image should be set")
        XCTAssertEqual(sut.pendingSnapshotImageURL, uploadedURL, "URL should be set")
    }

    func testHandleCameraCaptureWithoutImage() {
        // Given
        sut.showCameraCapture = true

        // When
        sut.handleCameraCapture(image: nil, uploadedImageURL: nil)

        // Then
        XCTAssertFalse(sut.showCameraCapture, "Camera capture should be hidden")
        XCTAssertNil(sut.pendingSnapshotImage, "Pending image should be nil")
    }

    func testHandleCameraCaptureShowsTrixBot() {
        // Given
        let testImage = UIImage(systemName: "photo")!

        // When
        sut.handleCameraCapture(image: testImage, uploadedImageURL: nil)

        // Then
        XCTAssertTrue(sut.showTrixBotFromSnapshot, "TRIX bot should be shown with image")
    }

    func testPresentPendingSnapshotChatIfNeeded() {
        // Given
        let testImage = UIImage(systemName: "photo")!
        sut.pendingSnapshotImage = testImage

        // When
        sut.presentPendingSnapshotChatIfNeeded()

        // Then
        XCTAssertTrue(sut.showTrixBotFromSnapshot, "TRIX bot should be shown")
    }

    func testPresentPendingSnapshotChatIfNeededWithoutImage() {
        // Given
        sut.pendingSnapshotImage = nil

        // When
        sut.presentPendingSnapshotChatIfNeeded()

        // Then
        XCTAssertFalse(sut.showTrixBotFromSnapshot, "TRIX bot should not be shown without image")
    }

    func testClearPendingSnapshotSelection() {
        // Given
        sut.pendingSnapshotImage = UIImage(systemName: "photo")
        sut.pendingSnapshotImageURL = "https://example.com/photo.jpg"
        sut.showTrixBotFromSnapshot = true

        // When
        sut.clearPendingSnapshotSelection()

        // Then
        XCTAssertNil(sut.pendingSnapshotImage, "Pending image should be cleared")
        XCTAssertNil(sut.pendingSnapshotImageURL, "Pending URL should be cleared")
    }
}

// MARK: - Panel Visibility Tests

extension HomeViewModelTests {

    func testOpenMailPanel() {
        // When
        sut.showMailPanel = true

        // Then
        XCTAssertTrue(sut.showMailPanel, "Mail panel should be visible")
    }

    func testCloseMailPanel() {
        // Given
        sut.showMailPanel = true

        // When
        sut.showMailPanel = false

        // Then
        XCTAssertFalse(sut.showMailPanel, "Mail panel should be hidden")
    }

    func testOpenNotificationPanel() {
        // When
        sut.showNotificationPanel = true

        // Then
        XCTAssertTrue(sut.showNotificationPanel, "Notification panel should be visible")
    }

    func testCloseNotificationPanel() {
        // Given
        sut.showNotificationPanel = true

        // When
        sut.showNotificationPanel = false

        // Then
        XCTAssertFalse(sut.showNotificationPanel, "Notification panel should be hidden")
    }

    func testOpenStudyRoom() {
        // When
        sut.showStudyRoom = true

        // Then
        XCTAssertTrue(sut.showStudyRoom, "Study room should be visible")
    }

    func testCloseStudyRoom() {
        // Given
        sut.showStudyRoom = true

        // When
        sut.showStudyRoom = false

        // Then
        XCTAssertFalse(sut.showStudyRoom, "Study room should be hidden")
    }
}

// MARK: - Navigation Destination Tests

extension HomeViewModelTests {

    func testSetNavigationDestinationToSnapshot() {
        // When
        sut.navigationDestination = .snapshot

        // Then
        XCTAssertEqual(sut.navigationDestination, .snapshot, "Navigation should be set to snapshot")
    }

    func testSetNavigationDestinationToLocation() {
        // When
        sut.navigationDestination = .location

        // Then
        XCTAssertEqual(sut.navigationDestination, .location, "Navigation should be set to location")
    }

    func testSetNavigationDestinationToSchedule() {
        // When
        sut.navigationDestination = .schedule

        // Then
        XCTAssertEqual(sut.navigationDestination, .schedule, "Navigation should be set to schedule")
    }

    func testSetNavigationDestinationToTodo() {
        // When
        sut.navigationDestination = .todo

        // Then
        XCTAssertEqual(sut.navigationDestination, .todo, "Navigation should be set to todo")
    }

    func testSetNavigationDestinationToMail() {
        // When
        sut.navigationDestination = .mail

        // Then
        XCTAssertEqual(sut.navigationDestination, .mail, "Navigation should be set to mail")
    }

    func testSetNavigationDestinationToNotifications() {
        // When
        sut.navigationDestination = .notifications

        // Then
        XCTAssertEqual(sut.navigationDestination, .notifications, "Navigation should be set to notifications")
    }

    func testSetNavigationDestinationToStudyRoom() {
        // When
        sut.navigationDestination = .studyRoom

        // Then
        XCTAssertEqual(sut.navigationDestination, .studyRoom, "Navigation should be set to study room")
    }

    func testSetNavigationDestinationToCamera() {
        // When
        sut.navigationDestination = .camera

        // Then
        XCTAssertEqual(sut.navigationDestination, .camera, "Navigation should be set to camera")
    }

    func testResetNavigationDestination() {
        // Given
        sut.navigationDestination = .snapshot

        // When
        sut.navigationDestination = .none

        // Then
        XCTAssertEqual(sut.navigationDestination, .none, "Navigation should be reset to none")
    }
}

// MARK: - Workbench Item Tests

extension HomeViewModelTests {

    func testAllWorkbenchItemsExist() {
        // Then
        XCTAssertFalse(WorkbenchItem.allItems.isEmpty, "Workbench items should exist")
        XCTAssertEqual(WorkbenchItem.allItems.count, 4, "Should have 4 workbench items")
    }

    func testSnapshotWorkbenchItem() {
        // Then
        XCTAssertEqual(WorkbenchItem.snapshot.id, "snapshot", "ID should be 'snapshot'")
        XCTAssertFalse(WorkbenchItem.snapshot.title.isEmpty, "Title should not be empty")
        XCTAssertEqual(WorkbenchItem.snapshot.icon, "camera.fill", "Icon should be camera.fill")
    }

    func testLocationWorkbenchItem() {
        // Then
        XCTAssertEqual(WorkbenchItem.location.id, "location", "ID should be 'location'")
        XCTAssertFalse(WorkbenchItem.location.title.isEmpty, "Title should not be empty")
        XCTAssertEqual(WorkbenchItem.location.icon, "location.fill", "Icon should be location.fill")
    }

    func testScheduleWorkbenchItem() {
        // Then
        XCTAssertEqual(WorkbenchItem.schedule.id, "schedule", "ID should be 'schedule'")
        XCTAssertFalse(WorkbenchItem.schedule.title.isEmpty, "Title should not be empty")
        XCTAssertEqual(WorkbenchItem.schedule.icon, "calendar", "Icon should be calendar")
    }

    func testTodoWorkbenchItem() {
        // Then
        XCTAssertEqual(WorkbenchItem.todo.id, "todo", "ID should be 'todo'")
        XCTAssertFalse(WorkbenchItem.todo.title.isEmpty, "Title should not be empty")
        XCTAssertEqual(WorkbenchItem.todo.icon, "checklist", "Icon should be checklist")
    }

    func testWorkbenchItemsAreEquatable() {
        // Given
        let item1 = WorkbenchItem.snapshot
        let item2 = WorkbenchItem.snapshot

        // Then
        XCTAssertEqual(item1, item2, "Same workbench items should be equal")
    }

    func testWorkbenchItemsAreIdentifiable() {
        // Given
        let item = WorkbenchItem.snapshot

        // Then
        XCTAssertFalse(item.id.isEmpty, "ID should not be empty")
    }
}

// MARK: - Panel Interaction Tests

extension HomeViewModelTests {

    func testClosingMailPanelDoesNotAffectNotificationPanel() {
        // Given
        sut.showMailPanel = true
        sut.showNotificationPanel = true

        // When
        sut.showMailPanel = false

        // Then
        XCTAssertFalse(sut.showMailPanel, "Mail panel should be closed")
        XCTAssertTrue(sut.showNotificationPanel, "Notification panel should remain open")
    }

    func testClosingNotificationPanelDoesNotAffectMailPanel() {
        // Given
        sut.showMailPanel = true
        sut.showNotificationPanel = true

        // When
        sut.showNotificationPanel = false

        // Then
        XCTAssertTrue(sut.showMailPanel, "Mail panel should remain open")
        XCTAssertFalse(sut.showNotificationPanel, "Notification panel should be closed")
    }

    func testMultiplePanelsCanBeOpen() {
        // Given
        sut.showMailPanel = true
        sut.showNotificationPanel = true
        sut.showStudyRoom = true

        // Then
        XCTAssertTrue(sut.showMailPanel, "Mail panel should be open")
        XCTAssertTrue(sut.showNotificationPanel, "Notification panel should be open")
        XCTAssertTrue(sut.showStudyRoom, "Study room should be open")
    }
}

// MARK: - Navigation Destination Equatable Tests

extension HomeViewModelTests {

    func testNavigationDestinationsAreEquatable() {
        // Given
        let dest1: HomeNavigationDestination = .snapshot
        let dest2: HomeNavigationDestination = .snapshot
        let dest3: HomeNavigationDestination = .location

        // Then
        XCTAssertEqual(dest1, dest2, "Same destinations should be equal")
        XCTAssertNotEqual(dest1, dest3, "Different destinations should not be equal")
    }

    func testAllNavigationDestinationsAreDistinct() {
        // Then
        let destinations: [HomeNavigationDestination] = [
            .none, .snapshot, .location, .schedule, .todo, .mail,
            .notifications, .studyRoom, .camera, .photoPicker, .album
        ]

        let uniqueCount = Set(destinations).count
        XCTAssertEqual(uniqueCount, destinations.count, "All destinations should be unique")
    }
}

// MARK: - State Preservation Tests

extension HomeViewModelTests {

    func testPreserveWorkbenchStateAcrossMultipleToggles() {
        // When - multiple toggles
        sut.toggleWorkbench()
        sut.toggleWorkbench()
        sut.toggleWorkbench()

        // Then - should be presented (odd number of toggles from false)
        XCTAssertTrue(sut.isWorkbenchPresented, "Workbench should be presented after 3 toggles")
    }

    func testPreserveQuickSnapOptionsState() {
        // Given
        sut.showQuickSnapOptions = true

        // When - present album
        sut.presentAlbum()

        // Then
        XCTAssertFalse(sut.showQuickSnapOptions, "Quick snap should be closed")
        XCTAssertTrue(sut.showSnapshot, "Snapshot should be shown")
    }

    func testClearAllSelectionStates() {
        // Given
        sut.pendingSnapshotImage = UIImage(systemName: "photo")
        sut.pendingSnapshotImageURL = "https://example.com/photo.jpg"
        sut.showTrixBotFromSnapshot = true
        sut.showCameraCapture = true

        // When
        sut.clearPendingSnapshotSelection()

        // Then
        XCTAssertNil(sut.pendingSnapshotImage, "Pending image should be cleared")
        XCTAssertNil(sut.pendingSnapshotImageURL, "Pending URL should be cleared")
        XCTAssertFalse(sut.showTrixBotFromSnapshot, "TRIX bot should be hidden")
        // Note: showCameraCapture is not affected by clearPendingSnapshotSelection
        XCTAssertTrue(sut.showCameraCapture, "Camera capture state should be preserved")
    }
}
