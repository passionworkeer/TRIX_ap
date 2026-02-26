//
//  VoicePlayerViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for VoicePlayerViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for VoicePlayerViewModel
final class VoicePlayerViewModelTests: XCTestCase {

    // MARK: - Properties

    var voicePlayerViewModel: VoicePlayerViewModel!
    var mockPlaybackService: MockVoicePlaybackService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockPlaybackService = MockVoicePlaybackService()

        voicePlayerViewModel = VoicePlayerViewModel(
            playbackService: mockPlaybackService
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        voicePlayerViewModel = nil
        mockPlaybackService = nil
        cancellables = nil
    }

    // MARK: - Initial State Tests

    func test_initialPlaybackState_idle() {
        // Assert
        XCTAssertNotNil(voicePlayerViewModel.playbackState)
    }

    func test_initialIsPlaying_false() {
        // Assert
        XCTAssertFalse(voicePlayerViewModel.isPlaying)
    }

    func test_initialCurrentTime_zero() {
        // Assert
        XCTAssertEqual(voicePlayerViewModel.currentTime, 0)
    }

    func test_initialTotalDuration_zero() {
        // Assert
        XCTAssertEqual(voicePlayerViewModel.totalDuration, 0)
    }

    func test_initialPlaybackRate_default() {
        // Assert
        XCTAssertEqual(voicePlayerViewModel.playbackRate, 1.0)
    }

    // MARK: - Playback Controls Tests

    func test_togglePlayPause_callsService() async throws {
        // Act
        await voicePlayerViewModel.togglePlayPause()

        // Assert
        XCTAssertEqual(mockPlaybackService.togglePlayPauseCallCount, 1)
    }

    func test_play_url_callsService() async throws {
        // Arrange
        let url = URL(string: "https://example.com/audio.mp3")!

        // Act
        await voicePlayerViewModel.play(url: url)

        // Assert
        XCTAssertEqual(mockPlaybackService.playCallCount, 1)
    }

    func test_play_data_callsService() async throws {
        // Arrange
        let data = Data()
        let filename = "test.mp3"

        // Act
        await voicePlayerViewModel.play(data: data, filename: filename)

        // Assert
        XCTAssertEqual(mockPlaybackService.playCallCount, 1)
    }

    func test_pause_callsService() async throws {
        // Act
        await voicePlayerViewModel.pause()

        // Assert
        XCTAssertEqual(mockPlaybackService.pauseCallCount, 1)
    }

    func test_stop_callsServiceAndResetsState() async throws {
        // Arrange
        voicePlayerViewModel.currentTime = 30
        voicePlayerViewModel.progress = 0.5

        // Act
        await voicePlayerViewModel.stop()

        // Assert
        XCTAssertEqual(mockPlaybackService.stopCallCount, 1)
        XCTAssertEqual(voicePlayerViewModel.currentTime, 0)
        XCTAssertEqual(voicePlayerViewModel.progress, 0)
    }

    func test_seek_callsService() async throws {
        // Arrange
        let time: TimeInterval = 30

        // Act
        await voicePlayerViewModel.seek(to: time)

        // Assert
        XCTAssertEqual(mockPlaybackService.seekCallCount, 1)
    }

    func test_seek_toProgress_calculatesCorrectly() async throws {
        // Arrange
        voicePlayerViewModel.totalDuration = 100

        // Act
        await voicePlayerViewModel.seek(to: 0.5)

        // Assert
        XCTAssertEqual(mockPlaybackService.lastSeekTime, 50, accuracy: 1)
    }

    // MARK: - Speed Control Tests

    func test_setPlaybackRate_callsService() async throws {
        // Act
        await voicePlayerViewModel.setPlaybackRate(1.5)

        // Assert
        XCTAssertEqual(mockPlaybackService.setPlaybackRateCallCount, 1)
        XCTAssertEqual(voicePlayerViewModel.playbackRate, 1.5)
    }

    func test_setPlaybackRate_fromEnum() async throws {
        // Act
        await voicePlayerViewModel.setPlaybackRate(.double)

        // Assert
        XCTAssertEqual(voicePlayerViewModel.playbackRate, 2.0)
    }

    // MARK: - Navigation Controls Tests

    func test_skipForward_callsSeek() async throws {
        // Arrange
        voicePlayerViewModel.currentTime = 10
        voicePlayerViewModel.totalDuration = 60

        // Act
        await voicePlayerViewModel.skipForward(5)

        // Assert
        XCTAssertEqual(voicePlayerViewModel.currentTime, 15)
    }

    func test_skipForward_doesNotExceedDuration() async throws {
        // Arrange
        voicePlayerViewModel.currentTime = 58
        voicePlayerViewModel.totalDuration = 60

        // Act
        await voicePlayerViewModel.skipForward(5)

        // Assert
        XCTAssertEqual(voicePlayerViewModel.currentTime, 60)
    }

    func test_skipBackward_callsSeek() async throws {
        // Arrange
        voicePlayerViewModel.currentTime = 30
        voicePlayerViewModel.totalDuration = 60

        // Act
        await voicePlayerViewModel.skipBackward(5)

        // Assert
        XCTAssertEqual(voicePlayerViewModel.currentTime, 25)
    }

    func test_skipBackward_doesNotGoBelowZero() async throws {
        // Arrange
        voicePlayerViewModel.currentTime = 3
        voicePlayerViewModel.totalDuration = 60

        // Act
        await voicePlayerViewModel.skipBackward(5)

        // Assert
        XCTAssertEqual(voicePlayerViewModel.currentTime, 0)
    }

    // MARK: - Utility Tests

    func test_clearError_clearsErrorMessage() {
        // Arrange
        voicePlayerViewModel.errorMessage = "Test error"

        // Act
        voicePlayerViewModel.clearError()

        // Assert
        XCTAssertNil(voicePlayerViewModel.errorMessage)
    }

    func test_toggleSpeedSelector_togglesVisibility() {
        // Act
        voicePlayerViewModel.toggleSpeedSelector()

        // Assert
        XCTAssertTrue(voicePlayerViewModel.showSpeedSelector)

        // Act
        voicePlayerViewModel.toggleSpeedSelector()

        // Assert
        XCTAssertFalse(voicePlayerViewModel.showSpeedSelector)
    }

    // MARK: - Computed Properties Tests

    func test_formattedCurrentTime_formatsCorrectly() {
        // Arrange
        voicePlayerViewModel.currentTime = 65 // 1:05

        // Assert
        XCTAssertEqual(voicePlayerViewModel.formattedCurrentTime, "1:05")
    }

    func test_formattedTotalDuration_formatsCorrectly() {
        // Arrange
        voicePlayerViewModel.totalDuration = 120 // 2:00

        // Assert
        XCTAssertEqual(voicePlayerViewModel.formattedTotalDuration, "2:00")
    }

    func test_availableRates_returnsAllRates() {
        // Assert
        XCTAssertEqual(voicePlayerViewModel.availableRates.count, 4)
    }
}

// MARK: - Mock Voice Playback Service

class MockVoicePlaybackService: VoicePlaybackServiceProtocol {

    var isPlaying: Bool = false
    var currentTime: TimeInterval = 0
    var duration: TimeInterval = 0
    var playbackRate: Float = 1.0

    var mockPlayResult: Result<Void, Error>?
    var mockPlaybackState: PlaybackState = .idle

    // Call tracking
    var playCallCount: Int = 0
    var pauseCallCount: Int = 0
    var stopCallCount: Int = 0
    var seekCallCount: Int = 0
    var setPlaybackRateCallCount: Int = 0
    var togglePlayPauseCallCount: Int = 0

    var lastSeekTime: TimeInterval?

    var playbackStatePublisher: AnyPublisher<PlaybackState, Never> {
        Just(mockPlaybackState)
            .eraseToAnyPublisher()
    }

    var progressPublisher: AnyPublisher<PlaybackProgress, Never> {
        Just(PlaybackProgress(currentTime: currentTime, duration: duration))
            .eraseToAnyPublisher()
    }

    func play(url: URL) async throws {
        playCallCount += 1

        if let result = mockPlayResult {
            switch result {
            case .success:
                break
            case .failure(let error):
                throw error
            }
        }
    }

    func play(data: Data, filename: String) async throws {
        playCallCount += 1
    }

    func pause() async {
        pauseCallCount += 1
    }

    func stop() async {
        stopCallCount += 1
    }

    func seek(to time: TimeInterval) async {
        seekCallCount += 1
        lastSeekTime = time
        currentTime = time
    }

    func setPlaybackRate(_ rate: Float) async {
        setPlaybackRateCallCount += 1
        playbackRate = rate
    }

    func togglePlayPause() async {
        togglePlayPauseCallCount += 1
    }
}
