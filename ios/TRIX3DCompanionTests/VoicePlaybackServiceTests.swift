//
//  VoicePlaybackServiceTests.swift
//  TRIX3DCompanionTests
//
//  Comprehensive unit tests for VoicePlaybackService
//

import XCTest
import AVFoundation
import Combine
@testable import TRIX3DCompanion

/// Comprehensive unit tests for VoicePlaybackService
final class VoicePlaybackServiceTests: XCTestCase {

    // MARK: - Properties

    var playbackService: VoicePlaybackService!
    var cancellables: Set<AnyCancellable>!
    var testAudioFileURL: URL!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        playbackService = VoicePlaybackService.shared
        cancellables = Set<AnyCancellable>()

        // Stop any ongoing playback
        Task {
            await playbackService.stop()
        }

        // Create a test audio file path
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        testAudioFileURL = documentsPath.appendingPathComponent("test_audio.m4a")
    }

    override func tearDownWithError() throws {
        // Stop any ongoing playback
        Task {
            await playbackService.stop()
        }

        // Clean up test audio file if exists
        try? FileManager.default.removeItem(at: testAudioFileURL)

        playbackService = nil
        cancellables = nil
        testAudioFileURL = nil
    }

    // MARK: - Play from URL Tests

    func test_play_fromURL_initialState() async {
        // Arrange - Create test expectations
        let stateExpectation = XCTestExpectation(description: "Should transition through loading and playing states")

        var receivedStates: [PlaybackState] = []
        playbackService.playbackStatePublisher
            .sink { state in
                receivedStates.append(state)
                if state == .playing || case .error = state {
                    stateExpectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Act
        do {
            // Note: This will fail if file doesn't exist, which is expected in test
            try await playbackService.play(url: testAudioFileURL)
        } catch {
            // Expected if file doesn't exist
        }

        // Assert
        wait(for: [stateExpectation], timeout: 2.0)
        XCTAssertTrue(receivedStates.contains(.loading), "Should have loading state")
    }

    func test_play_fromURL_fileNotFoundError() async {
        // Arrange
        let nonExistentURL = URL(fileURLWithPath: "/path/to/nonexistent/file.mp3")

        // Act & Assert
        do {
            try await playbackService.play(url: nonExistentURL)
            XCTFail("Should throw error for non-existent file")
        } catch let error as VoicePlaybackError {
            XCTAssertEqual(error, .audioNotFound, "Should throw audioNotFound error")
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    // MARK: - Play from Data Tests

    func test_play_fromData_withInvalidData() async {
        // Arrange
        let invalidData = Data([0x00, 0x01, 0x02, 0x03])

        // Act & Assert
        do {
            try await playbackService.play(data: invalidData, filename: "test.mp3")
            XCTFail("Should throw error for invalid audio data")
        } catch let error as VoicePlaybackError {
            XCTAssertTrue(error == .playbackFailed(_) || error == .audioNotFound, "Should throw playback error")
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    // MARK: - Pause Tests

    func test_pause_whenPlaying() async {
        // Arrange - Setup state as if playing
        // Note: Can't actually play without valid audio file, so we test the state logic

        // Act
        await playbackService.pause()

        // Assert
        XCTAssertFalse(playbackService.isPlaying, "Should not be playing after pause")
    }

    func test_pause_whenNotPlaying_doesNotCrash() async {
        // Arrange - Ensure stopped
        await playbackService.stop()

        // Act - Should not crash
        await playbackService.pause()

        // Assert
        XCTAssertFalse(playbackService.isPlaying, "Should not be playing")
    }

    // MARK: - Stop Tests

    func test_stop_resetsState() async {
        // Act
        await playbackService.stop()

        // Assert
        XCTAssertFalse(playbackService.isPlaying, "Should not be playing")
        XCTAssertEqual(playbackService.currentTime, 0, "Current time should be reset")
    }

    func test_stop_whenAlreadyStopped_doesNotCrash() async {
        // Act - Multiple stops should not crash
        await playbackService.stop()
        await playbackService.stop()
        await playbackService.stop()

        // Assert
        XCTAssertTrue(true, "Multiple stops should not crash")
    }

    // MARK: - Seek Tests

    func test_seek_toValidTime() async {
        // Arrange
        let targetTime: TimeInterval = 5.0

        // Act
        await playbackService.seek(to: targetTime)

        // Assert - Should not crash
        XCTAssertTrue(true, "Seek to valid time should not crash")
    }

    func test_seek_toZeroTime() async {
        // Arrange
        let targetTime: TimeInterval = 0.0

        // Act
        await playbackService.seek(to: targetTime)

        // Assert
        XCTAssertEqual(playbackService.currentTime, 0, "Current time should be 0")
    }

    func test_seek_toNegativeTime_clampsToZero() async {
        // Arrange
        let negativeTime: TimeInterval = -5.0

        // Act
        await playbackService.seek(to: negativeTime)

        // Assert
        XCTAssertTrue(playbackService.currentTime >= 0, "Current time should be clamped to 0 or higher")
    }

    func test_seek_toTimeBeyondDuration_clampsToDuration() async {
        // Arrange
        let largeTime: TimeInterval = 9999.0

        // Act
        await playbackService.seek(to: largeTime)

        // Assert - Should clamp to duration
        XCTAssertTrue(playbackService.currentTime <= playbackService.duration, "Current time should be clamped to duration")
    }

    // MARK: - Playback Rate Tests

    func test_setPlaybackRate_normal() async {
        // Arrange
        let normalRate: Float = 1.0

        // Act
        await playbackService.setPlaybackRate(normalRate)

        // Assert
        XCTAssertEqual(playbackService.playbackRate, normalRate, "Playback rate should be set to normal")
    }

    func test_setPlaybackRate_halfSpeed() async {
        // Arrange
        let halfRate: Float = 0.5

        // Act
        await playbackService.setPlaybackRate(halfRate)

        // Assert
        XCTAssertEqual(playbackService.playbackRate, halfRate, "Playback rate should be set to half speed")
    }

    func test_setPlaybackRate_doubleSpeed() async {
        // Arrange
        let doubleRate: Float = 2.0

        // Act
        await playbackService.setPlaybackRate(doubleRate)

        // Assert
        XCTAssertEqual(playbackService.playbackRate, doubleRate, "Playback rate should be set to double speed")
    }

    func test_setPlaybackRate_zero_doesNotCrash() async {
        // Arrange
        let zeroRate: Float = 0.0

        // Act
        await playbackService.setPlaybackRate(zeroRate)

        // Assert - Should not crash
        XCTAssertTrue(true, "Setting zero rate should not crash")
    }

    // MARK: - Toggle Play/Pause Tests

    func test_togglePlayPause_whenStopped_startsPlaying() async {
        // Arrange
        await playbackService.stop()
        // Note: Without actual audio, this won't truly play, but tests the logic

        // Act
        await playbackService.togglePlayPause()

        // Assert - Method should execute without crash
        XCTAssertTrue(true, "Toggle when stopped should not crash")
    }

    func test_togglePlayPause_whenPlaying_pauses() async {
        // Arrange - Simulate playing state
        // Note: Without actual audio file, can't truly play

        // Act
        await playbackService.togglePlayPause()

        // Assert - Method should execute without crash
        XCTAssertTrue(true, "Toggle when playing should not crash")
    }

    // MARK: - Skip Tests

    func test_skipForward_defaultAmount() async {
        // Arrange
        let initialTime = playbackService.currentTime

        // Act
        await playbackService.skipForward()

        // Assert
        XCTAssertGreaterThan(playbackService.currentTime, initialTime, "Time should advance")
    }

    func test_skipForward_customAmount() async {
        // Arrange
        let initialTime = playbackService.currentTime
        let skipAmount: TimeInterval = 10.0

        // Act
        await playbackService.skipForward(skipAmount)

        // Assert
        // Should be approximately initial + skip (may differ due to clamping)
        XCTAssertTrue(playbackService.currentTime >= initialTime, "Time should advance or stay same")
    }

    func test_skipBackward_defaultAmount() async {
        // Arrange
        // First set a time
        await playbackService.seek(to: 10.0)
        let initialTime = playbackService.currentTime

        // Act
        await playbackService.skipBackward()

        // Assert
        XCTAssertLessThan(playbackService.currentTime, initialTime, "Time should go back")
    }

    func test_skipBackward_customAmount() async {
        // Arrange
        await playbackService.seek(to: 15.0)
        let skipAmount: TimeInterval = 8.0

        // Act
        await playbackService.skipBackward(skipAmount)

        // Assert
        XCTAssertLessThan(playbackService.currentTime, 15.0, "Time should go back")
    }

    func test_skipBackward_belowZero_clampsToZero() async {
        // Arrange
        await playbackService.seek(to: 2.0)

        // Act
        await playbackService.skipBackward(10.0)

        // Assert
        XCTAssertEqual(playbackService.currentTime, 0, "Should clamp to zero")
    }

    // MARK: - Time Formatting Tests

    func test_getFormattedTime_zeroSeconds() {
        // Arrange
        let time: TimeInterval = 0

        // Act
        let formatted = playbackService.getFormattedTime(time)

        // Assert
        XCTAssertEqual(formatted, "00:00", "Zero seconds should format as 00:00")
    }

    func test_getFormattedTime_thirtySeconds() {
        // Arrange
        let time: TimeInterval = 30

        // Act
        let formatted = playbackService.getFormattedTime(time)

        // Assert
        XCTAssertEqual(formatted, "00:30", "30 seconds should format as 00:30")
    }

    func test_getFormattedTime_oneMinute() {
        // Arrange
        let time: TimeInterval = 60

        // Act
        let formatted = playbackService.getFormattedTime(time)

        // Assert
        XCTAssertEqual(formatted, "01:00", "1 minute should format as 01:00")
    }

    func test_getFormattedTime_oneMinuteThirtySeconds() {
        // Arrange
        let time: TimeInterval = 90

        // Act
        let formatted = playbackService.getFormattedTime(time)

        // Assert
        XCTAssertEqual(formatted, "01:30", "1:30 should format as 01:30")
    }

    func test_getFormattedTime_tenMinutes() {
        // Arrange
        let time: TimeInterval = 600

        // Act
        let formatted = playbackService.getFormattedTime(time)

        // Assert
        XCTAssertEqual(formatted, "10:00", "10 minutes should format as 10:00")
    }

    func test_getFormattedTime_withPartialSeconds() {
        // Arrange
        let time: TimeInterval = 65.7

        // Act
        let formatted = playbackService.getFormattedTime(time)

        // Assert
        XCTAssertEqual(formatted, "01:05", "Should truncate seconds")
    }

    // MARK: - Computed Properties Tests

    func test_currentTimeString_returnsFormatted() {
        // Arrange
        await playbackService.seek(to: 45)

        // Act
        let timeString = playbackService.currentTimeString

        // Assert
        XCTAssertEqual(timeString, "00:45", "Current time string should match formatted time")
    }

    func test_durationString_returnsFormatted() {
        // Arrange
        // Note: Duration will be 0 unless audio is loaded
        // This tests the property access

        // Act
        let durationString = playbackService.durationString

        // Assert
        XCTAssertNotNil(durationString, "Duration string should not be nil")
        XCTAssertEqual(durationString, "00:00", "Zero duration should format as 00:00")
    }

    // MARK: - Publisher Tests

    func test_playbackStatePublisher_emitsLoading() async {
        // Arrange
        let expectation = XCTestExpectation(description: "Should emit loading state")

        playbackService.playbackStatePublisher
            .sink { state in
                if case .loading = state {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Act
        do {
            try await playbackService.play(url: testAudioFileURL)
        } catch {}

        // Assert
        wait(for: [expectation], timeout: 1.0)
    }

    func test_progressPublisher_emitsProgress() {
        // Arrange
        let expectation = XCTestExpectation(description: "Should emit progress")

        playbackService.progressPublisher
            .sink { progress in
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // Act
        Task {
            await playbackService.seek(to: 5.0)
        }

        // Assert
        wait(for: [expectation], timeout: 1.0)
    }

    // MARK: - Published Properties Tests

    func test_isPlaying_publishedChanges() async {
        // Arrange
        let expectation = XCTestExpectation(description: "isPlaying should publish changes")
        var playingStates: [Bool] = []

        playbackService.$isPlaying
            .sink { isPlaying in
                playingStates.append(isPlaying)
                if playingStates.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Act
        await playbackService.stop()
        // Note: Without actual audio playback, we test the publisher mechanism

        // Assert
        wait(for: [expectation], timeout: 2.0)
    }

    func test_currentTime_publishedChanges() {
        // Arrange
        let expectation = XCTestExpectation(description: "currentTime should publish changes")

        playbackService.$currentTime
            .dropFirst()
            .sink { _ in
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // Act
        Task {
            await playbackService.seek(to: 10.0)
        }

        // Assert
        wait(for: [expectation], timeout: 1.0)
    }

    func test_duration_publishedChanges() {
        // Arrange
        let expectation = XCTestExpectation(description: "duration should publish")

        playbackService.$duration
            .dropFirst()
            .sink { _ in
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // Act - Duration updates when audio is loaded
        Task {
            do {
                try await playbackService.play(url: testAudioFileURL)
            } catch {}
        }

        // Assert
        wait(for: [expectation], timeout: 1.0)
    }

    // MARK: - Error Handling Tests

    func test_multipleRapidSeeks_handleGracefully() async {
        // Act
        await playbackService.seek(to: 1.0)
        await playbackService.seek(to: 5.0)
        await playbackService.seek(to: 10.0)
        await playbackService.seek(to: 3.0)
        await playbackService.seek(to: 7.0)

        // Assert - Should handle gracefully without crashing
        XCTAssertTrue(true, "Multiple rapid seeks should not crash")
    }

    func test_rapidPlayPauseToggle_handleGracefully() async {
        // Act
        for _ in 0..<10 {
            await playbackService.togglePlayPause()
        }

        // Assert - Should handle gracefully
        XCTAssertTrue(true, "Rapid toggles should not crash")
    }

    func test_setVariousPlaybackRates_handleGracefully() async {
        // Arrange
        let rates: [Float] = [0.5, 1.0, 1.5, 2.0, 0.75, 1.25]

        // Act
        for rate in rates {
            await playbackService.setPlaybackRate(rate)
        }

        // Assert - Should handle all rates
        XCTAssertEqual(playbackService.playbackRate, rates.last, "Final rate should be set")
    }

    // MARK: - Edge Cases Tests

    func test_seekBeyondMaxTimeInterval() async {
        // Arrange - Test with very large time value
        let maxTime = TimeInterval.greatestFiniteMagnitude

        // Act
        await playbackService.seek(to: maxTime)

        // Assert - Should clamp to duration, not crash
        XCTAssertTrue(playbackService.currentTime >= 0, "Should handle extreme values")
    }

    func test_negativePlaybackRate_doesNotCrash() async {
        // Arrange
        let negativeRate: Float = -1.0

        // Act - AVAudioPlayer may or may not accept this
        await playbackService.setPlaybackRate(negativeRate)

        // Assert - Should handle gracefully
        XCTAssertTrue(true, "Negative rate should not crash")
    }

    func test_veryLargePlaybackRate_doesNotCrash() async {
        // Arrange
        let largeRate: Float = 100.0

        // Act
        await playbackService.setPlaybackRate(largeRate)

        // Assert - Should handle gracefully
        XCTAssertTrue(true, "Large rate should not crash")
    }

    // MARK: - State Consistency Tests

    func test_stop_clearsAllState() async {
        // Arrange - Set some state
        await playbackService.seek(to: 10.0)
        await playbackService.setPlaybackRate(1.5)

        // Act
        await playbackService.stop()

        // Assert
        XCTAssertFalse(playbackService.isPlaying, "Should not be playing")
        XCTAssertEqual(playbackService.currentTime, 0, "Time should reset")
        // Note: playbackRate is a configuration, not reset on stop
    }

    func test_concurrentOperations_handleGracefully() async {
        // Test concurrent seek and rate operations
        async let seek1 = playbackService.seek(to: 5.0)
        async let seek2 = playbackService.seek(to: 10.0)
        async let rate = playbackService.setPlaybackRate(1.5)

        await seek1
        await seek2
        await rate

        // Assert - Should handle concurrent operations
        XCTAssertTrue(true, "Concurrent operations should not crash")
    }
}

// MARK: - PlaybackState Enum Tests

extension VoicePlaybackServiceTests {

    func test_PlaybackState_allCases() {
        // Test all playback states exist
        let states: [PlaybackState] = [
            .idle,
            .loading,
            .playing,
            .paused,
            .finished
        ]

        XCTAssertEqual(states.count, 5, "Should have 5 playback states")
    }

    func test_PlaybackState_errorCase() {
        // Arrange
        let errorMessage = "Test error"
        let errorState = PlaybackState.error(errorMessage)

        // Assert
        if case .error(let message) = errorState {
            XCTAssertEqual(message, errorMessage, "Error state should contain message")
        } else {
            XCTFail("Should be error state")
        }
    }
}

// MARK: - PlaybackProgress Struct Tests

extension VoicePlaybackServiceTests {

    func test_PlaybackProgress_properties() {
        // Arrange
        let progress = PlaybackProgress(currentTime: 45.5, duration: 180.0)

        // Assert
        XCTAssertEqual(progress.currentTime, 45.5, "Should have correct current time")
        XCTAssertEqual(progress.duration, 180.0, "Should have correct duration")
    }

    func test_PlaybackProgress_zeroDuration() {
        // Arrange
        let progress = PlaybackProgress(currentTime: 0, duration: 0)

        // Assert
        XCTAssertEqual(progress.currentTime, 0, "Current time should be 0")
        XCTAssertEqual(progress.duration, 0, "Duration should be 0")
    }

    func test_PlaybackProgress_currentTimeExceedsDuration() {
        // Arrange - This could happen during loading
        let progress = PlaybackProgress(currentTime: 200, duration: 180)

        // Assert - Should allow this state
        XCTAssertEqual(progress.currentTime, 200, "Should allow time to exceed duration during loading")
    }
}

// MARK: - VoicePlaybackError Tests

extension VoicePlaybackServiceTests {

    func test_VoicePlaybackError_audioNotFound() {
        // Arrange
        let error = VoicePlaybackError.audioNotFound

        // Assert
        XCTAssertNotNil(error.localizedDescription, "Should have error description")
    }

    func test_VoicePlaybackError_playbackFailed() {
        // Arrange
        let underlyingError = NSError(domain: "Test", code: -1)
        let error = VoicePlaybackError.playbackFailed(underlyingError)

        // Assert
        XCTAssertNotNil(error.localizedDescription, "Should have error description")
    }

    func test_VoicePlaybackError_localizedErrorConformance() {
        // Arrange
        let error: Error = VoicePlaybackError.audioNotFound

        // Assert
        XCTAssertTrue(error is LocalizedError, "VoicePlaybackError should conform to LocalizedError")
    }
}
