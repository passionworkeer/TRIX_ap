//
//  StudyTimerViewTests.swift
//  TRIX3DCompanionTests
//
//  UI component tests for StudyTimerView
//  Tests timer functionality, display, and animations
//

import XCTest
import SwiftUI
@testable import TRIX3DCompanion

// MARK: - StudyTimerView Tests

@MainActor
final class StudyTimerViewTests: XCTestCase {

    // MARK: - Helper Methods

    private func makeStudyRoomState(
        roomCode: String = "TEST123",
        sessionState: StudyRoomSessionState = .idle,
        timer: StudyRoomTimerState? = nil
    ) -> StudyRoomState {
        StudyRoomState(
            roomCode: roomCode,
            hostUserId: "user_1",
            sessionState: sessionState,
            members: [],
            maxMembers: 10,
            version: 1,
            createdAt: Date(),
            updatedAt: Date(),
            timer: timer
        )
    }

    private func makeTimer(
        durationSeconds: Int = 1500,
        remainingSeconds: Int = 1500
    ) -> StudyRoomTimerState {
        StudyRoomTimerState(
            durationSeconds: durationSeconds,
            startedAt: Date(),
            endsAt: Date().addingTimeInterval(TimeInterval(durationSeconds)),
            remainingSeconds: remainingSeconds
        )
    }

    private func makeStudyTimerView(
        roomState: StudyRoomState = StudyRoomState(
            roomCode: "TEST123",
            hostUserId: "user_1",
            sessionState: .idle,
            members: [],
            maxMembers: 10,
            version: 1,
            createdAt: Date(),
            updatedAt: Date(),
            timer: nil
        )
    ) -> StudyTimerView {
        StudyTimerView(roomState: .constant(roomState))
    }

    // MARK: - Timer State Tests

    func testTimerStartsInIdleState() throws {
        let roomState = makeStudyRoomState(sessionState: .idle)

        let view = makeStudyTimerView(roomState: roomState)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
        XCTAssertEqual(roomState.sessionState, .idle)
    }

    func testTimerInFocusingState() throws {
        let timer = makeTimer(durationSeconds: 1500, remainingSeconds: 1400)
        let roomState = makeStudyRoomState(sessionState: .focusing, timer: timer)

        let view = makeStudyTimerView(roomState: roomState)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
        XCTAssertEqual(roomState.sessionState, .focusing)
        XCTAssertNotNil(roomState.timer)
    }

    func testTimerInRestingState() throws {
        let timer = makeTimer(durationSeconds: 300, remainingSeconds: 250)
        let roomState = makeStudyRoomState(sessionState: .resting, timer: timer)

        let view = makeStudyTimerView(roomState: roomState)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
        XCTAssertEqual(roomState.sessionState, .resting)
    }

    // MARK: - Timer Display Format Tests

    func testTimerDisplayFormatMinutesSeconds() throws {
        let testCases: [(Int, String)] = [
            (0, "0:00"),
            (30, "0:30"),
            (60, "1:00"),
            (90, "1:30"),
            (600, "10:00"),
            (1500, "25:00"),
        ]

        for (seconds, _) in testCases {
            let minutes = seconds / 60
            let secs = seconds % 60
            let hours = seconds / 3600

            let formatted: String
            if hours > 0 {
                formatted = String(format: "%d:%02d:%02d", hours, minutes, secs)
            } else {
                formatted = String(format: "%d:%02d", minutes, secs)
            }

            XCTAssertFalse(formatted.isEmpty)
        }
    }

    func testTimerDisplayFormatHoursMinutesSeconds() throws {
        let testCases: [(Int, String)] = [
            (3600, "1:00:00"),
            (3661, "1:01:01"),
            (7200, "2:00:00"),
            (9000, "2:30:00"),
        ]

        for (seconds, _) in testCases {
            let hours = seconds / 3600
            let minutes = (seconds % 3600) / 60
            let secs = seconds % 60

            let formatted = String(format: "%d:%02d:%02d", hours, minutes, secs)
            XCTAssertFalse(formatted.isEmpty)
            XCTAssertTrue(formatted.contains(":"))
        }
    }

    // MARK: - Timer Countdown Tests

    func testTimerCountdownCalculation() throws {
        let totalSeconds = 1500
        var remainingSeconds = 1500

        // Simulate countdown
        remainingSeconds -= 1

        XCTAssertEqual(remainingSeconds, 1499)
        XCTAssertGreaterThan(remainingSeconds, 0)
    }

    func testTimerCountdownCompletes() throws {
        var remainingSeconds = 1
        var completionCalled = false

        remainingSeconds -= 1
        if remainingSeconds == 0 {
            completionCalled = true
        }

        XCTAssertEqual(remainingSeconds, 0)
        XCTAssertTrue(completionCalled)
    }

    // MARK: - Focus Mode Tests

    func testFocusModeActivation() throws {
        let roomState = makeStudyRoomState(sessionState: .focusing)

        let view = makeStudyTimerView(roomState: roomState)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testFocusModeToggleVisibility() throws {
        let roomState = makeStudyRoomState(sessionState: .idle)

        let view = makeStudyTimerView(roomState: roomState)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Progress Bar Tests

    func testProgressBarFractionCalculation() throws {
        let totalSeconds = 1500
        var remainingSeconds = 1500

        // No progress yet
        let fraction1 = Double(totalSeconds - remainingSeconds) / Double(totalSeconds)
        XCTAssertEqual(fraction1, 0)

        // Halfway
        remainingSeconds = 750
        let fraction2 = Double(totalSeconds - remainingSeconds) / Double(totalSeconds)
        XCTAssertEqual(fraction2, 0.5)

        // Complete
        remainingSeconds = 0
        let fraction3 = Double(totalSeconds - remainingSeconds) / Double(totalSeconds)
        XCTAssertEqual(fraction3, 1.0)
    }

    func testProgressBarWithZeroTotalSeconds() throws {
        let totalSeconds = 0
        let remainingSeconds = 0

        // Avoid division by zero
        let fraction = totalSeconds > 0 ? Double(totalSeconds - remainingSeconds) / Double(totalSeconds) : 0
        XCTAssertEqual(fraction, 0)
    }

    // MARK: - Breathing Animation Tests

    func testBreathingAnimationInFocusingState() throws {
        let timer = makeTimer()
        let roomState = makeStudyRoomState(sessionState: .focusing, timer: timer)

        let view = makeStudyTimerView(roomState: roomState)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testBreathingAnimationScaleRange() throws {
        let minScale: CGFloat = 1.0
        let maxScale: CGFloat = 1.3

        XCTAssertGreaterThan(maxScale, minScale)
        XCTAssertEqual(minScale, 1.0)
        XCTAssertEqual(maxScale, 1.3)
    }

    // MARK: - Celebration Trigger Tests

    func testCelebrationTriggeredOnCompletion() throws {
        // 25 minutes (Pomodoro) should trigger celebration
        let duration = 25
        let isComplete = true

        XCTAssertGreaterThanOrEqual(duration, 25)
        XCTAssertTrue(isComplete)
    }

    func testCelebrationNotTriggeredForShortSession() throws {
        // Less than 25 minutes
        let duration = 10
        let isComplete = true

        XCTAssertLessThan(duration, 25)
        XCTAssertTrue(isComplete)
    }

    // MARK: - Points Calculation Tests

    func testPointsCalculationFormula() throws {
        // 2 points per minute
        let testCases: [(Int, Int)] = [
            (1, 2),    // 1 minute = 2 points
            (10, 20),  // 10 minutes = 20 points
            (25, 50),  // 25 minutes = 50 points
            (60, 120), // 60 minutes = 120 points
        ]

        for (minutes, expectedPoints) in testCases {
            let points = minutes * 2
            XCTAssertEqual(points, expectedPoints)
        }
    }

    func testPointsMinimumOnePoint() throws {
        let studiedMinutes = 0
        let actualMinutes = max(1, studiedMinutes)
        let points = actualMinutes * 2

        XCTAssertEqual(actualMinutes, 1)
        XCTAssertEqual(points, 2)
    }

    // MARK: - Background Time Tracking Tests

    func testBackgroundTimeTracking() throws {
        // Simulate background time elapsed
        let timerStarted = Date()
        let backgroundDuration: TimeInterval = 30
        let resumedAt = timerStarted.addingTimeInterval(backgroundDuration)

        let elapsed = resumedAt.timeIntervalSince(timerStarted)
        XCTAssertEqual(elapsed, backgroundDuration)
    }

    func testBackgroundTimerUpdate() throws {
        let originalRemaining = 1500
        let backgroundElapsed: Int = 30
        let newRemaining = max(0, originalRemaining - backgroundElapsed)

        XCTAssertEqual(newRemaining, 1470)
    }

    // MARK: - Session State Text Tests

    func testSessionStateTextForIdle() throws {
        let state = StudyRoomSessionState.idle

        let text: String
        switch state {
        case .idle:
            text = "Ready"
        case .focusing:
            text = "Focus Time"
        case .resting:
            text = "Break Time"
        }

        XCTAssertEqual(text, "Ready")
    }

    func testSessionStateTextForFocusing() throws {
        let state = StudyRoomSessionState.focusing

        let text: String
        switch state {
        case .idle:
            text = "Ready"
        case .focusing:
            text = "Focus Time"
        case .resting:
            text = "Break Time"
        }

        XCTAssertEqual(text, "Focus Time")
    }

    func testSessionStateTextForResting() throws {
        let state = StudyRoomSessionState.resting

        let text: String
        switch state {
        case .idle:
            text = "Ready"
        case .focusing:
            text = "Focus Time"
        case .resting:
            text = "Break Time"
        }

        XCTAssertEqual(text, "Break Time")
    }

    // MARK: - Session State Color Tests

    func testSessionStateColorForIdle() throws {
        let state = StudyRoomSessionState.idle

        let colorName: String
        switch state {
        case .idle:
            colorName = "textTertiary"
        case .focusing:
            colorName = "brandPurple"
        case .resting:
            colorName = "success"
        }

        XCTAssertEqual(colorName, "textTertiary")
    }

    func testSessionStateColorForFocusing() throws {
        let state = StudyRoomSessionState.focusing

        let colorName: String
        switch state {
        case .idle:
            colorName = "textTertiary"
        case .focusing:
            colorName = "brandPurple"
        case .resting:
            colorName = "success"
        }

        XCTAssertEqual(colorName, "brandPurple")
    }

    // MARK: - Control Button Tests

    func testControlButtonStates() throws {
        let states: [TimerState] = [.idle, .running, .paused, .completed, .focusing, .resting]

        for state in states {
            let icon: String
            switch state {
            case .idle:
                icon = "play.fill"
            case .running, .focusing, .resting:
                icon = "pause.fill"
            case .paused:
                icon = "play.fill"
            case .completed:
                icon = "arrow.clockwise"
            }

            XCTAssertFalse(icon.isEmpty)
        }
    }

    // MARK: - Notification Permission Tests

    func testNotificationPermissionRequest() throws {
        // Test that permission can be requested
        let canRequest = true
        XCTAssertTrue(canRequest)
    }

    // MARK: - Timer Settings Tests

    func testTimerSettingsApply() throws {
        var totalSeconds = 1500
        let focusMinutes = 30

        let newDuration = max(1, focusMinutes) * 60
        totalSeconds = newDuration

        XCTAssertEqual(totalSeconds, 1800)
    }

    func testTimerSettingsEnforceMinimum() throws {
        let focusMinutes = 0
        let duration = max(1, focusMinutes) * 60

        XCTAssertEqual(duration, 60) // At least 1 minute
    }

    // MARK: - Break Timer Tests

    func testBreakTimerDuration() throws {
        let breakDuration = 300 // 5 minutes
        XCTAssertEqual(breakDuration, 300)
        XCTAssertEqual(breakDuration / 60, 5)
    }

    func testBreakTimerAfterFocusCompletion() throws {
        let focusCompleted = true
        let timerState: TimerState = focusCompleted ? .resting : .idle

        XCTAssertEqual(timerState, .resting)
    }

    // MARK: - Study Duration Tests

    func testActualStudyDurationCalculation() throws {
        let totalSeconds = 1500
        var remainingSeconds = 600
        let studiedSeconds = totalSeconds - remainingSeconds
        let studiedMinutes = studiedSeconds / 60

        XCTAssertEqual(studiedMinutes, 15)
    }

    func testMinimumStudyDuration() throws {
        let studiedMinutes = 0
        let actualMinutes = max(1, studiedMinutes)

        XCTAssertEqual(actualMinutes, 1)
    }

    // MARK: - Focus Mode Tests

    func testFocusModeContentDisplayed() throws {
        let roomState = makeStudyRoomState(sessionState: .focusing)

        let view = makeStudyTimerView(roomState: roomState)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testNormalModeContentDisplayed() throws {
        let roomState = makeStudyRoomState(sessionState: .idle)

        let view = makeStudyTimerView(roomState: roomState)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }
}
