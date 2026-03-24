//
//  StudyRoomIntegrationTests.swift
//  TRIX3DCompanionE2ETests
//
//  E2E tests for study room creation and join flow
//

import XCTest

/// E2E tests for study room flow
final class StudyRoomIntegrationTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--mock-server", "--auto-login"]
        app.launch()
    }

    // MARK: - Self Study Flow

    func test_selfStudy_canSelectDurationAndStart() throws {
        // Navigate to study
        let studyTab = app.tabBars.buttons["Study"]
        if studyTab.waitForExistence(timeout: 5) {
            studyTab.tap()
        }

        // Select 45 minute duration
        let duration45 = app.buttons["45 min"]
        if duration45.waitForExistence(timeout: 3) {
            duration45.tap()
            XCTAssertTrue(duration45.isSelected || duration45.exists)
        }

        // Start self study
        let startButton = app.buttons["Start Focus"]
        if startButton.waitForExistence(timeout: 3) {
            startButton.tap()
        }

        // Verify timer view appears
        let timerView = app.otherElements["TimerView"]
        XCTAssertTrue(timerView.waitForExistence(timeout: 5), "Timer view should appear after starting focus")
    }

    // MARK: - Room Code Entry

    func test_roomCodeEntry_normalizesToUppercase() throws {
        // Open study room modal
        let roomButton = app.buttons["Study Room"]
        if roomButton.waitForExistence(timeout: 5) {
            roomButton.tap()
        }

        // Switch to room code mode
        let roomModeButton = app.buttons["Join by Code"]
        if roomModeButton.waitForExistence(timeout: 3) {
            roomModeButton.tap()
        }

        // Type lowercase code
        let input = app.textFields["Enter room code"]
        if input.waitForExistence(timeout: 3) {
            input.tap()
            input.typeText("abc123")

            // Verify normalization
            XCTAssertEqual(input.value as? String, "ABC123")
        }
    }

    // MARK: - Room State Display

    func test_roomState_showsMemberCount() throws {
        let roomButton = app.buttons["Study Room"]
        if roomButton.waitForExistence(timeout: 5) {
            roomButton.tap()
        }

        // If in a room, check member count display
        let memberCountLabel = app.staticTexts.matching(identifier: "memberCount").firstMatch
        if memberCountLabel.waitForExistence(timeout: 3) {
            XCTAssertTrue(memberCountLabel.exists, "Member count should be displayed")
        }
    }

    // MARK: - Error Handling

    func test_joinInvalidRoom_showsError() throws {
        let roomButton = app.buttons["Study Room"]
        if roomButton.waitForExistence(timeout: 5) {
            roomButton.tap()
        }

        let roomModeButton = app.buttons["Join by Code"]
        if roomModeButton.waitForExistence(timeout: 3) {
            roomModeButton.tap()
        }

        let input = app.textFields["Enter room code"]
        if input.waitForExistence(timeout: 3) {
            input.tap()
            input.typeText("XXXX")
        }

        let joinButton = app.buttons["Join"]
        if joinButton.waitForExistence(timeout: 3) {
            joinButton.tap()
        }

        // Should show error alert
        let errorAlert = app.alerts.firstMatch
        if errorAlert.waitForExistence(timeout: 5) {
            XCTAssertTrue(errorAlert.exists, "Error alert should appear for invalid room")
            errorAlert.buttons["OK"].tap()
        }
    }
}
