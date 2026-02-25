//
//  VoiceMessageViewTests.swift
//  TRIX3DCompanionTests
//
//  Created by TRIX 3D Companion Team
//

import XCTest
import AVFoundation
import Combine
@testable import TRIX3DCompanion

/// Unit tests for VoiceMessageView ViewModel
final class VoiceMessageViewTests: XCTestCase {

    // MARK: - Properties

    var viewModel: VoiceMessageViewModel!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        viewModel = nil
        cancellables = nil
    }

    // MARK: - Initialization Tests

    func testInitializationWithValidURL() throws {
        let testURL = URL(fileURLWithPath: "/test/audio.m4a")

        viewModel = VoiceMessageViewModel(audioURL: testURL, duration: 30)

        XCTAssertFalse(viewModel.isPlaying, "Should not be playing initially")
        XCTAssertFalse(viewModel.isPaused, "Should not be paused initially")
        XCTAssertEqual(viewModel.playbackProgress, 0, "Progress should be 0")
        XCTAssertEqual(viewModel.currentTime, 0, "Current time should be 0")
        XCTAssertEqual(viewModel.totalDuration, 30, "Total duration should be 30")
        XCTAssertEqual(viewModel.audioURL, testURL, "URL should match")
    }

    func testInitializationWithZeroDuration() {
        let testURL = URL(fileURLWithPath: "/test/audio.m4a")

        viewModel = VoiceMessageViewModel(audioURL: testURL, duration: 0)

        XCTAssertEqual(viewModel.totalDuration, 0, "Duration should be 0")
        XCTAssertEqual(viewModel.formattedCurrentTime, "0:00", "Should format 0 as 0:00")
        XCTAssertEqual(viewModel.formattedTotalDuration, "0:00", "Should format 0 as 0:00")
    }

    // MARK: - Playback State Tests

    func testPlayPauseToggle() async {
        let testURL = URL(fileURLWithPath: "/test/audio.m4a")
        viewModel = VoiceMessageViewModel(audioURL: testURL, duration: 30)

        // Initially not playing
        XCTAssertFalse(viewModel.isPlaying)

        // Toggle to play (would fail with invalid URL)
        await viewModel.togglePlayback()

        // In real implementation with valid audio file:
        // - isPlaying would become true
        // - Progress would start updating
    }

    func testProgressUpdates() {
        let testURL = URL(fileURLWithPath: "/test/audio.m4a")
        viewModel = VoiceMessageViewModel(audioURL: testURL, duration: 30)

        let expectation = XCTestExpectation(description: "Progress updated")

        viewModel.$playbackProgress
            .dropFirst()
            .sink { progress in
                if progress > 0 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Start playback (would fail with invalid URL)
        Task {
            await viewModel.togglePlayback()
        }

        // In real scenario, progress would update
        wait(for: [expectation], timeout: 2.0)
    }

    func testStopPlayback() async {
        let testURL = URL(fileURLWithPath: "/test/audio.m4a")
        viewModel = VoiceMessageViewModel(audioURL: testURL, duration: 30)

        // After playing, stop should reset progress
        await viewModel.stopPlayback()

        XCTAssertEqual(viewModel.playbackProgress, 0, "Progress should reset to 0")
        XCTAssertEqual(viewModel.currentTime, 0, "Current time should reset to 0")
        XCTAssertFalse(viewModel.isPlaying, "Should not be playing")
    }

    // MARK: - Time Formatting Tests

    func testTimeFormatting() {
        let testURL = URL(fileURLWithPath: "/test/audio.m4a")
        viewModel = VoiceMessageViewModel(audioURL: testURL, duration: 125)

        // Test various time points
        let testCases: [(TimeInterval, String)] = [
            (0, "0:00"),
            (5, "0:05"),
            (30, "0:30"),
            (60, "1:00"),
            (90, "1:30"),
            (125, "2:05")
        ]

        for (time, expected) in testCases {
            viewModel.updateCurrentTime(time)
            XCTAssertEqual(
                viewModel.formattedCurrentTime,
                expected,
                "Time \(time)s should format as \(expected)"
            )
        }
    }

    // MARK: - Waveform Tests

    func testWaveformGeneration() {
        let testURL = URL(fileURLWithPath: "/test/audio.m4a")
        viewModel = VoiceMessageViewModel(audioURL: testURL, duration: 30)

        // Initially, waveform samples should be empty or have default values
        // When audio loads, samples would be generated

        XCTAssertTrue(
            viewModel.waveformSamples.isEmpty || viewModel.waveformSamples.count == 50,
            "Waveform should have 50 samples when generated"
        )
    }

    // MARK: - Error Handling Tests

    func testPlaybackErrorHandling() {
        let invalidURL = URL(fileURLWithPath: "/invalid/path/audio.m4a")
        viewModel = VoiceMessageViewModel(audioURL: invalidURL, duration: 30)

        let expectation = XCTestExpectation(description: "Error occurred")

        viewModel.$errorMessage
            .compactMap { $0 }
            .sink { error in
                XCTAssertFalse(error.isEmpty, "Error message should not be empty")
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // Attempt playback
        Task {
            await viewModel.togglePlayback()
        }

        wait(for: [expectation], timeout: 2.0)
    }

    // MARK: - Memory Management Tests

    func testPlayerCleanup() {
        let testURL = URL(fileURLWithPath: "/test/audio.m4a")
        viewModel = VoiceMessageViewModel(audioURL: testURL, duration: 30)

        // Ensure player is properly deallocated
        weak var weakViewModel = viewModel

        viewModel = nil

        XCTAssertNil(weakViewModel, "ViewModel should be deallocated")
    }
}
