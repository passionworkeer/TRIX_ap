//
//  MockVoiceServices.swift
//  TRIX3DCompanionTests
//
//  Mock implementations for Voice-related services
//  Used for testing TTSViewModel and VoicePlayerViewModel
//

import Foundation
import Combine
import AVFoundation
@testable import TRIX3DCompanion

// MARK: - MockTTSService

/// Mock implementation of TTSServiceProtocol for testing
@MainActor
final class MockTTSService: TTSServiceProtocol {

    // MARK: - Published State

    @Published private(set) var isSpeaking: Bool = false
    @Published private(set) var currentVoice: AVSpeechSynthesisVoice? = nil

    // MARK: - Call Tracking

    private(set) var speakCallCount = 0
    private(set) var lastSpokenText: String?
    private(set) var lastSpokenLanguage: String?
    private(set) var stopCallCount = 0
    private(set) var pauseCallCount = 0
    private(set) var resumeCallCount = 0
    private(set) var setRateCallCount = 0
    private(set) var lastSetRate: Float?
    private(set) var setPitchCallCount = 0
    private(set) var lastSetPitch: Float?
    private(set) var setVoiceCallCount = 0
    private(set) var lastSetVoiceLanguage: TTSLanguage?
    private(set) var speakPresetCallCount = 0
    private(set) var lastSpeakPreset: TTSPreset?

    // MARK: - Configuration

    var shouldSpeakThrowError = false
    var speakError: Error = TTSError.synthesisFailed(NSError(domain: "Test", code: -1))
    var speakShouldSimulateCompletion = false
    var availableLanguagesToReturn: [TTSLanguage] = TTSLanguage.allCases
    var simulateAsyncDelay: TimeInterval = 0

    // MARK: - TTSServiceProtocol

    func speak(_ text: String, language: String?) async throws {
        speakCallCount += 1
        lastSpokenText = text
        lastSpokenLanguage = language

        if shouldSpeakThrowError {
            throw speakError
        }

        if simulateAsyncDelay > 0 {
            try? await Task.sleep(nanoseconds: UInt64(simulateAsyncDelay * 1_000_000_000))
        }

        isSpeaking = true

        if speakShouldSimulateCompletion {
            isSpeaking = false
        }
    }

    func stop() async {
        stopCallCount += 1
        isSpeaking = false
    }

    func pause() async {
        pauseCallCount += 1
    }

    func resume() async {
        resumeCallCount += 1
    }

    func setRate(_ rate: Float) async {
        setRateCallCount += 1
        lastSetRate = rate
    }

    func setPitch(_ pitch: Float) async {
        setPitchCallCount += 1
        lastSetPitch = pitch
    }

    func setVoice(language: TTSLanguage) async {
        setVoiceCallCount += 1
        lastSetVoiceLanguage = language
    }

    func getAvailableVoices(for language: String) -> [AVSpeechSynthesisVoice] {
        return AVSpeechSynthesisVoice.speechVoices().filter { voice in
            voice.language.hasPrefix(language.prefix(2))
        }
    }

    func getAvailableLanguages() -> [TTSLanguage] {
        return availableLanguagesToReturn
    }

    func speakPreset(_ preset: TTSPreset) async throws {
        speakPresetCallCount += 1
        lastSpeakPreset = preset

        if shouldSpeakThrowError {
            throw speakError
        }

        isSpeaking = true

        if speakShouldSimulateCompletion {
            isSpeaking = false
        }
    }

    // MARK: - Helper Methods

    func resetCallTracking() {
        speakCallCount = 0
        lastSpokenText = nil
        lastSpokenLanguage = nil
        stopCallCount = 0
        pauseCallCount = 0
        resumeCallCount = 0
        setRateCallCount = 0
        lastSetRate = nil
        setPitchCallCount = 0
        lastSetPitch = nil
        setVoiceCallCount = 0
        lastSetVoiceLanguage = nil
        speakPresetCallCount = 0
        lastSpeakPreset = nil
    }

    func simulateSpeakingCompleted() {
        isSpeaking = false
    }

    func simulateSpeakingStarted() {
        isSpeaking = true
    }
}

// MARK: - MockVoicePlaybackService

/// Mock implementation of VoicePlaybackServiceProtocol for testing
@MainActor
final class MockVoicePlaybackService: VoicePlaybackServiceProtocol {

    // MARK: - Published State
    // Made settable (non-private(set)) so tests can drive state directly.
    // didSet observers trigger automatic emission through the publishers.

    /// Mirrors the current PlaybackState for test-control.
    /// Setting this emits the value through _playbackStateSubject so ViewModel bindings react.
    var playbackState: PlaybackState = .idle {
        didSet { _playbackStateSubject.send(playbackState) }
    }

    @Published var isPlaying: Bool = false
    @Published var currentTime: TimeInterval = 0 {
        didSet { emitProgress() }
    }
    @Published var duration: TimeInterval = 0 {
        didSet { emitProgress() }
    }
    @Published private(set) var playbackRate: Float = 1.0

    /// Settable progress backing — tests use this to control progress independently
    /// of the computed currentTime/duration ratio.
    var progress: Double = 0

    // MARK: - Call Tracking

    private(set) var playURLCallCount = 0
    private(set) var lastPlayURL: URL?
    private(set) var playDataCallCount = 0
    private(set) var lastPlayData: Data?
    private(set) var lastPlayFilename: String?
    private(set) var pauseCallCount = 0
    private(set) var stopCallCount = 0
    private(set) var seekCallCount = 0
    private(set) var lastSeekTime: TimeInterval?
    private(set) var setPlaybackRateCallCount = 0
    private(set) var lastSetPlaybackRate: Float?
    private(set) var togglePlayPauseCallCount = 0

    // MARK: - Publishers

    // Exposed as internal so test code can subscribe directly.
    // Use emitState(_:) and emitProgress() helpers to send values.
    let _playbackStateSubject = PassthroughSubject<PlaybackState, Never>()
    let _progressSubject = PassthroughSubject<PlaybackProgress, Never>()

    var playbackStatePublisher: AnyPublisher<PlaybackState, Never> {
        _playbackStateSubject.eraseToAnyPublisher()
    }

    var progressPublisher: AnyPublisher<PlaybackProgress, Never> {
        _progressSubject.eraseToAnyPublisher()
    }

    // MARK: - Configuration

    var shouldPlayThrowError = false
    var playError: Error = VoicePlaybackError.playbackFailed(NSError(domain: "Test", code: -1))
    var simulateAutoFinish = false
    var shouldSimulateError: Bool = false
    var errorMessage: String = "Mock playback error"

    // MARK: - VoicePlaybackServiceProtocol

    func play(url: URL) async throws {
        playURLCallCount += 1
        lastPlayURL = url

        if shouldPlayThrowError {
            throw playError
        }

        isPlaying = true
        currentTime = 0
        duration = 60.0
        _playbackStateSubject.send(.playing)
        emitProgress()

        if simulateAutoFinish {
            await simulateFinish()
        }
    }

    func play(data: Data, filename: String) async throws {
        playDataCallCount += 1
        lastPlayData = data
        lastPlayFilename = filename

        if shouldPlayThrowError {
            throw playError
        }

        isPlaying = true
        currentTime = 0
        duration = 30.0
        _playbackStateSubject.send(.playing)
        emitProgress()
    }

    func pause() async {
        pauseCallCount += 1
        isPlaying = false
        _playbackStateSubject.send(.paused)
    }

    func stop() async {
        stopCallCount += 1
        isPlaying = false
        currentTime = 0
        duration = 0
        _playbackStateSubject.send(.idle)
        emitProgress()
    }

    func seek(to time: TimeInterval) async {
        seekCallCount += 1
        lastSeekTime = time
        currentTime = time
        emitProgress()
    }

    func setPlaybackRate(_ rate: Float) async {
        setPlaybackRateCallCount += 1
        lastSetPlaybackRate = rate
        playbackRate = rate
    }

    func togglePlayPause() async {
        togglePlayPauseCallCount += 1
        if isPlaying {
            isPlaying = false
            _playbackStateSubject.send(.paused)
        } else {
            isPlaying = true
            _playbackStateSubject.send(.playing)
        }
    }

    // MARK: - Helper Methods

    func resetCallTracking() {
        playURLCallCount = 0
        lastPlayURL = nil
        playDataCallCount = 0
        lastPlayData = nil
        lastPlayFilename = nil
        pauseCallCount = 0
        stopCallCount = 0
        seekCallCount = 0
        lastSeekTime = nil
        setPlaybackRateCallCount = 0
        lastSetPlaybackRate = nil
        togglePlayPauseCallCount = 0
    }

    func emitProgress() {
        let computedRatio = duration > 0 ? currentTime / duration : 0.0
        let effectiveProgress = progress != 0 ? progress : computedRatio
        let progressInfo = PlaybackProgress(
            currentTime: currentTime,
            duration: duration,
            progress: effectiveProgress
        )
        _progressSubject.send(progressInfo)
    }

    func emitState(_ state: PlaybackState) {
        _playbackStateSubject.send(state)
    }

    func simulateFinish() async {
        isPlaying = false
        currentTime = duration
        _playbackStateSubject.send(.finished)
        emitProgress()
    }

    func simulateError() {
        isPlaying = false
        _playbackStateSubject.send(.error(errorMessage))
    }

    func simulateProgressUpdate(currentTime: TimeInterval) {
        self.currentTime = currentTime
        emitProgress()
    }

    // MARK: - Test Helper Methods
    // Convenience helpers that update both the state property and emit through
    // the publisher in one call. Tests use these to drive ViewModel bindings.

    /// Set playbackState and simultaneously emit it through the publisher.
    /// Updates isPlaying to match the state.
    func setPlaybackState(_ state: PlaybackState) {
        playbackState = state
        switch state {
        case .playing: isPlaying = true
        case .paused, .idle, .finished, .loading: isPlaying = false
        case .error: isPlaying = false
        }
    }

    /// Async version: sets state and yields to allow MainActor bindings to propagate.
    /// Use this when the test has synchronous assertions that must see the updated state.
    func setPlaybackStateAndYield(_ state: PlaybackState) async {
        setPlaybackState(state)
        await Task.yield()
    }

    /// Directly set isPlaying (does NOT emit through playbackStatePublisher;
    /// use setPlaybackState() if you need the ViewModel binding to react).
    func setIsPlaying(_ playing: Bool) {
        isPlaying = playing
    }

    /// Async version: sets isPlaying and yields to allow MainActor bindings to propagate.
    func setIsPlayingAndYield(_ playing: Bool) async {
        isPlaying = playing
        await Task.yield()
    }
}

// MARK: - MockAudioSessionManager

/// Mock implementation for AudioSessionManager testing
@MainActor
final class MockAudioSessionManager {

    var configureForPlaybackCalled = false
    var configureForRecordingCalled = false
    var shouldConfigureThrowError = false
    var configureError: Error = NSError(domain: "AudioSession", code: -1)

    func configureForPlayback() async throws {
        configureForPlaybackCalled = true
        if shouldConfigureThrowError {
            throw configureError
        }
    }

    func configureForRecording() async throws {
        configureForRecordingCalled = true
        if shouldConfigureThrowError {
            throw configureError
        }
    }

    func reset() {
        configureForPlaybackCalled = false
        configureForRecordingCalled = false
        shouldConfigureThrowError = false
    }
}

// MARK: - Spy Objects for Publishers

/// Spy object to capture published values from Combine publishers
@MainActor
final class PlaybackStateSpy {
    private(set) var states: [PlaybackState] = []
    private var cancellable: AnyCancellable?

    func attach(to publisher: AnyPublisher<PlaybackState, Never>) {
        cancellable = publisher.sink { [weak self] state in
            self?.states.append(state)
        }
    }

    func reset() {
        states = []
        cancellable = nil
    }
}

/// Spy object to capture published progress values
@MainActor
final class PlaybackProgressSpy {
    private(set) var progresses: [PlaybackProgress] = []
    private var cancellable: AnyCancellable?

    func attach(to publisher: AnyPublisher<PlaybackProgress, Never>) {
        cancellable = publisher.sink { [weak self] progress in
            self?.progresses.append(progress)
        }
    }

    func reset() {
        progresses = []
        cancellable = nil
    }
}
