//
//  VoiceRecordingButtonTests.swift
//  TRIX3DCompanionTests
//
//  Created by TRIX 3D Companion Team
//

import XCTest
import AVFoundation
import Combine
@testable import TRIX3DCompanion

/// Unit tests for VoiceRecordingButton ViewModel
final class VoiceRecordingButtonTests: XCTestCase {

    // MARK: - Properties

    var viewModel: VoiceRecordingViewModel!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        viewModel = VoiceRecordingViewModel()
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        viewModel = nil
        cancellables = nil
    }

    // MARK: - Initial State Tests

    func testInitialState() {
        XCTAssertEqual(viewModel.recordingState, .idle, "Should start in idle state")
        XCTAssertEqual(viewModel.recordingDuration, 0, "Duration should be 0")
        XCTAssertFalse(viewModel.isRecording, "Should not be recording")
        XCTAssertFalse(viewModel.hasPermission, "Permission status unknown initially")
    }

    // MARK: - Permission Tests

    func testRequestPermission_Success() throws {
        let expectation = XCTestExpectation(description: "Permission granted")

        // Note: This test requires actual microphone permission
        // In CI/testing environment, we may need to mock AVAudioSession

        viewModel.$hasPermission
            .dropFirst() // Skip initial value
            .sink { granted in
                if granted {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        Task {
            await viewModel.requestMicrophonePermission()
        }

        // In testing environment, this might timeout
        // We'll handle this gracefully
        wait(for: [expectation], timeout: 2.0)
    }

    // MARK: - Recording State Tests

    func testRecordingStateTransitions() async throws {
        // Grant permission first (simulated)
        // In real tests, we'd mock AVAudioSession

        // Test: idle -> recording
        await viewModel.startRecording()
        // Assertions would depend on permission status
    }

    func testMaximumDuration() {
        XCTAssertEqual(
            VoiceRecordingViewModel.maximumRecordingDuration,
            60.0,
            "Maximum duration should be 60 seconds"
        )
    }

    func testRecordingDurationFormat() {
        let viewModel = VoiceRecordingViewModel()

        // Test duration formatting
        XCTAssertEqual(viewModel.formattedDuration(at: 0), "0:00")
        XCTAssertEqual(viewModel.formattedDuration(at: 5), "0:05")
        XCTAssertEqual(viewModel.formattedDuration(at: 30), "0:30")
        XCTAssertEqual(viewModel.formattedDuration(at: 59), "0:59")
        XCTAssertEqual(viewModel.formattedDuration(at: 60), "1:00")
    }

    // MARK: - Cancellation Tests

    func testCancelRecording() async {
        // Start recording (would fail without permission)
        // Then cancel and verify state reset
        // In mock environment, we'd test state transitions
    }

    // MARK: - File Management Tests

    func testTemporaryFileCleanup() {
        // Test that temporary files are cleaned up after cancel
        // This would require mocking file system operations
    }

    func testRecordingURLCreation() {
        // Test that recording URL is created correctly
        let url = viewModel.tempRecordingURL

        XCTAssertTrue(url.lastPathComponent.hasSuffix(".m4a"), "File should be .m4a format")
        XCTAssertTrue(
            url.path.contains("recording"),
            "File name should contain 'recording'"
        )
    }
}
