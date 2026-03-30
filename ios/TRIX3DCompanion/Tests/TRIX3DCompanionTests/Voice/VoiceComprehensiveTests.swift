//
//  VoiceComprehensiveTests.swift
//  TRIX3DCompanionTests
//
//  Comprehensive test suite for TTSViewModel and VoicePlayerViewModel
//  Covers all public methods, state transitions, and error handling
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - TTSViewModel Tests

@MainActor
final class TTSViewModelTests: XCTestCase {

    // MARK: - Properties

    private var sut: TTSViewModel!
    private var mockTTSService: MockTTSService!
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Lifecycle

    override func setUp() async throws {
        try await super.setUp()
        mockTTSService = MockTTSService()
        sut = TTSViewModel(ttsService: mockTTSService)
        cancellables = []
    }

    override func tearDown() async throws {
        sut = nil
        mockTTSService = nil
        cancellables = []
        try await super.tearDown()
    }

    private func waitForAsyncEffects(until condition: () -> Bool) async {
        for _ in 0..<20 {
            if condition() {
                return
            }
            await Task.yield()
        }
    }

    // MARK: - Initialization Tests

    func testInit_LoadsAvailableLanguages() {
        XCTAssertFalse(sut.availableLanguages.isEmpty, "Should load available languages")
    }

    func testInit_SetsDefaultValues() {
        XCTAssertTrue(sut.isEnabled, "Should be enabled by default")
        XCTAssertEqual(sut.speechRate, 0.5, "Default rate should be 0.5")
        XCTAssertEqual(sut.speechPitch, 1.0, "Default pitch should be 1.0")
        XCTAssertEqual(sut.selectedLanguage, .chinese, "Default language should be Chinese")
        XCTAssertFalse(sut.showLanguageSelector, "Language selector should be hidden")
        XCTAssertFalse(sut.showSettings, "Settings should be hidden")
        XCTAssertNil(sut.errorMessage, "No error by default")
        XCTAssertEqual(sut.textToSpeak, "", "Empty text by default")
        XCTAssertFalse(sut.isSpeakingText, "Not speaking by default")
    }

    func testInit_SetsAvailableRateOptions() {
        let options = sut.availableRateOptions
        XCTAssertEqual(options.count, 4, "Should have 4 rate options")
        XCTAssertTrue(options.contains(where: { $0.value == 0.3 }), "Should have 0.3x option")
        XCTAssertTrue(options.contains(where: { $0.value == 0.5 }), "Should have 0.5x option")
        XCTAssertTrue(options.contains(where: { $0.value == 0.7 }), "Should have 0.7x option")
        XCTAssertTrue(options.contains(where: { $0.value == 1.0 }), "Should have 1.0x option")
    }

    func testInit_SetsAvailablePitchOptions() {
        let options = sut.availablePitchOptions
        XCTAssertEqual(options.count, 3, "Should have 3 pitch options")
        XCTAssertTrue(options.contains(where: { $0.value == 0.8 }), "Should have low pitch option")
        XCTAssertTrue(options.contains(where: { $0.value == 1.0 }), "Should have standard pitch option")
        XCTAssertTrue(options.contains(where: { $0.value == 1.2 }), "Should have high pitch option")
    }

    // MARK: - Speak Tests

    func testSpeak_WithValidText_CallsService() async {
        // Given
        let text = "Hello world"

        // When
        await sut.speak(text)

        // Then
        XCTAssertEqual(mockTTSService.speakCallCount, 1, "Should call speak once")
        XCTAssertEqual(mockTTSService.lastSpokenText, text, "Should pass correct text")
        XCTAssertEqual(mockTTSService.lastSpokenLanguage, TTSLanguage.chinese.rawValue, "Should use selected language")
        XCTAssertTrue(sut.isSpeakingText, "Should set isSpeakingText to true")
        XCTAssertNil(sut.errorMessage, "Should have no error")
    }

    func testSpeak_WithEmptyText_SetsError() async {
        // Given
        let text = ""

        // When
        await sut.speak(text)

        // Then
        XCTAssertEqual(mockTTSService.speakCallCount, 0, "Should NOT call speak for empty text")
        XCTAssertNotNil(sut.errorMessage, "Should set error message")
        XCTAssertFalse(sut.isSpeakingText, "Should not set isSpeakingText")
    }

    func testSpeak_WhenDisabled_DoesNothing() async {
        // Given
        sut.isEnabled = false
        let text = "Hello"

        // When
        await sut.speak(text)

        // Then
        XCTAssertEqual(mockTTSService.speakCallCount, 0, "Should NOT call speak when disabled")
    }

    func testSpeak_WhenServiceThrows_SetsError() async {
        // Given
        mockTTSService.shouldSpeakThrowError = true
        mockTTSService.speakError = TTSError.synthesisFailed(NSError(domain: "Test", code: 1))

        // When
        await sut.speak("Test text")

        // Then
        XCTAssertNotNil(sut.errorMessage, "Should set error message")
        XCTAssertFalse(sut.isSpeakingText, "Should reset isSpeakingText on error")
    }

    func testSpeakCurrentText_SpeaksTextToSpeakProperty() async {
        // Given
        sut.textToSpeak = "Current text"

        // When
        await sut.speakCurrentText()

        // Then
        XCTAssertEqual(mockTTSService.speakCallCount, 1, "Should call speak")
        XCTAssertEqual(mockTTSService.lastSpokenText, "Current text", "Should speak textToSpeak value")
    }

    func testSpeak_WithDifferentLanguage_CallsServiceWithCorrectLanguage() async {
        // Given
        sut.selectedLanguage = .english

        // When
        await sut.speak("Hello")

        // Then
        XCTAssertEqual(mockTTSService.lastSpokenLanguage, TTSLanguage.english.rawValue)
    }

    // MARK: - Stop Tests

    func testStop_CallsServiceStop() async {
        // When
        await sut.stop()

        // Then
        XCTAssertEqual(mockTTSService.stopCallCount, 1, "Should call stop on service")
        XCTAssertFalse(sut.isSpeakingText, "Should reset isSpeakingText")
    }

    // MARK: - Pause/Resume Tests

    func testPause_CallsServicePause() async {
        // When
        await sut.pause()

        // Then
        XCTAssertEqual(mockTTSService.pauseCallCount, 1, "Should call pause on service")
    }

    func testResume_CallsServiceResume() async {
        // When
        await sut.resume()

        // Then
        XCTAssertEqual(mockTTSService.resumeCallCount, 1, "Should call resume on service")
    }

    // MARK: - Rate Setting Tests

    func testSetRate_UpdatesRateAndCallsService() async {
        // Given
        let newRate: Float = 0.7

        // When
        await sut.setRate(newRate)

        // Then
        XCTAssertEqual(sut.speechRate, newRate, "Should update speechRate")
        XCTAssertEqual(mockTTSService.lastSetRate, newRate, "Should call setRate on service")
    }

    func testSetRate_ClampsToValidRange() async {
        // Given - rate above 1.0
        let overRate: Float = 1.5

        // When
        await sut.setRate(overRate)

        // Then
        XCTAssertEqual(sut.speechRate, 1.0, "Should clamp to 1.0")
        XCTAssertEqual(mockTTSService.lastSetRate, 1.0, "Should pass clamped value")
    }

    func testSetRate_ClampsToMinimum() async {
        // Given - rate below 0.0
        let underRate: Float = -0.5

        // When
        await sut.setRate(underRate)

        // Then
        XCTAssertEqual(sut.speechRate, 0.0, "Should clamp to 0.0")
    }

    // MARK: - Pitch Setting Tests

    func testSetPitch_UpdatesPitchAndCallsService() async {
        // Given
        let newPitch: Float = 1.2

        // When
        await sut.setPitch(newPitch)

        // Then
        XCTAssertEqual(sut.speechPitch, newPitch, "Should update speechPitch")
        XCTAssertEqual(mockTTSService.lastSetPitch, newPitch, "Should call setPitch on service")
    }

    func testSetPitch_ClampsToValidRange() async {
        // Given - pitch above 2.0
        let overPitch: Float = 3.0

        // When
        await sut.setPitch(overPitch)

        // Then
        XCTAssertEqual(sut.speechPitch, 2.0, "Should clamp to 2.0")
    }

    // MARK: - Language Selection Tests

    func testSetLanguage_UpdatesLanguageAndCallsService() async {
        // Given
        let newLanguage: TTSLanguage = .english

        // When
        await sut.setLanguage(newLanguage)

        // Then
        XCTAssertEqual(sut.selectedLanguage, newLanguage, "Should update selectedLanguage")
        XCTAssertEqual(mockTTSService.lastSetVoiceLanguage, newLanguage, "Should call setVoice on service")
        XCTAssertFalse(sut.showLanguageSelector, "Should hide language selector")
    }

    func testToggleLanguageSelector_TogglesVisibility() {
        // Given
        XCTAssertFalse(sut.showLanguageSelector)

        // When
        sut.toggleLanguageSelector()

        // Then
        XCTAssertTrue(sut.showLanguageSelector)

        // When toggled again
        sut.toggleLanguageSelector()

        // Then
        XCTAssertFalse(sut.showLanguageSelector)
    }

    // MARK: - Settings Panel Tests

    func testToggleSettings_TogglesVisibility() {
        // Given
        XCTAssertFalse(sut.showSettings)

        // When
        sut.toggleSettings()

        // Then
        XCTAssertTrue(sut.showSettings)

        // When toggled again
        sut.toggleSettings()

        // Then
        XCTAssertFalse(sut.showSettings)
    }

    // MARK: - Preset Message Tests

    func testSpeakPreset_PomodoroStart_CallsService() async {
        // When
        await sut.speakPomodoroStart()

        // Then
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
        XCTAssertEqual(mockTTSService.lastSpeakPreset, .pomodoroStart)
    }

    func testSpeakPreset_PomodoroComplete_CallsService() async {
        // When
        await sut.speakPomodoroComplete()

        // Then
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
        XCTAssertEqual(mockTTSService.lastSpeakPreset, .pomodoroComplete)
    }

    func testSpeakPreset_RestComplete_CallsService() async {
        // When
        await sut.speakRestComplete()

        // Then
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
        XCTAssertEqual(mockTTSService.lastSpeakPreset, .restComplete)
    }

    func testSpeakPreset_DailyGoalReminder_CallsService() async {
        // When
        await sut.speakDailyGoalReminder()

        // Then
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
        XCTAssertEqual(mockTTSService.lastSpeakPreset, .dailyGoalReminder)
    }

    func testSpeakPreset_NewMessage_CallsService() async {
        // When
        await sut.speakNewMessage()

        // Then
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
        XCTAssertEqual(mockTTSService.lastSpeakPreset, .newMessage)
    }

    func testSpeakPreset_FriendRequest_CallsService() async {
        // When
        await sut.speakFriendRequest()

        // Then
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
        XCTAssertEqual(mockTTSService.lastSpeakPreset, .friendRequest)
    }

    func testSpeakPreset_WhenDisabled_DoesNothing() async {
        // Given
        sut.isEnabled = false

        // When
        await sut.speakPreset(.pomodoroStart)

        // Then
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 0, "Should NOT call service when disabled")
    }

    // MARK: - Error Handling Tests

    func testClearError_ClearsErrorMessage() {
        // Given
        sut.errorMessage = "Some error"

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.errorMessage, "Should clear error message")
    }

    func testSpeak_WhenServiceFails_SetsError() async {
        // Given
        mockTTSService.shouldSpeakThrowError = true

        // When
        await sut.speak("Test")

        // Then
        XCTAssertNotNil(sut.errorMessage, "Should set error message")
    }

    // MARK: - Reset to Defaults Tests

    func testResetToDefaults_ResetsAllSettings() async {
        // Given - change all settings
        sut.speechRate = 0.9
        sut.speechPitch = 1.5
        sut.selectedLanguage = .japanese

        // When
        await sut.resetToDefaults()

        // Then
        XCTAssertEqual(sut.speechRate, 0.5, "Should reset rate to 0.5")
        XCTAssertEqual(sut.speechPitch, 1.0, "Should reset pitch to 1.0")
        XCTAssertEqual(sut.selectedLanguage, .chinese, "Should reset language to Chinese")
    }

    // MARK: - Settings Export/Import Tests

    func testExportSettings_ExportsCurrentSettings() {
        // Given
        sut.isEnabled = true
        sut.speechRate = 0.7
        sut.speechPitch = 1.2
        sut.selectedLanguage = .english

        // When
        let settings = sut.exportSettings()

        // Then
        XCTAssertTrue(settings.isEnabled)
        XCTAssertEqual(settings.rate, 0.7)
        XCTAssertEqual(settings.pitch, 1.2)
        XCTAssertEqual(settings.language, .english)
    }

    func testLoadSettings_ImportsSettings() {
        // Given
        let settings = TTSSettings(
            isEnabled: false,
            language: .japanese,
            rate: 0.3,
            pitch: 0.8,
            volume: 0.5
        )

        // When
        sut.loadSettings(settings: settings)

        // Then
        XCTAssertFalse(sut.isEnabled)
        XCTAssertEqual(sut.selectedLanguage, .japanese)
        XCTAssertEqual(sut.speechRate, 0.3)
        XCTAssertEqual(sut.speechPitch, 0.8)
    }

    // MARK: - IsEnabled State Tests

    func testIsEnabled_DidSet_StopsSpeakingWhenDisabled() async {
        // Given - currently speaking
        sut.isEnabled = true
        await sut.speak("Hello")
        XCTAssertTrue(sut.isSpeakingText)

        // When - disable
        sut.isEnabled = false
        await waitForAsyncEffects {
            self.mockTTSService.stopCallCount == 1 && self.sut.isSpeakingText == false
        }

        // Then - should stop
        XCTAssertEqual(mockTTSService.stopCallCount, 1)
        XCTAssertFalse(sut.isSpeakingText)
    }

    // MARK: - Preview Helpers Tests

    func testPreview_ReturnsConfiguredInstance() {
        // When
        let preview = TTSViewModel.preview

        // Then
        XCTAssertTrue(preview.isEnabled)
        XCTAssertEqual(preview.speechRate, 0.5)
        XCTAssertEqual(preview.speechPitch, 1.0)
        XCTAssertEqual(preview.selectedLanguage, .chinese)
        XCTAssertFalse(preview.isSpeaking)
    }

    func testPreviewSpeaking_ReturnsConfiguredInstance() {
        // When
        let preview = TTSViewModel.previewSpeaking

        // Then
        XCTAssertTrue(preview.isEnabled)
        XCTAssertTrue(preview.isSpeaking)
        XCTAssertTrue(preview.isSpeakingText)
        XCTAssertFalse(preview.textToSpeak.isEmpty)
    }
}

// MARK: - VoicePlayerViewModel Tests

@MainActor
final class VoicePlayerViewModelTests: XCTestCase {

    // MARK: - Properties

    private var sut: VoicePlayerViewModel!
    private var mockPlaybackService: MockVoicePlaybackService!
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Lifecycle

    override func setUp() async throws {
        try await super.setUp()
        mockPlaybackService = MockVoicePlaybackService()
        sut = VoicePlayerViewModel(playbackService: mockPlaybackService)
        cancellables = []
    }

    override func tearDown() async throws {
        sut = nil
        mockPlaybackService = nil
        cancellables = []
        try await super.tearDown()
    }

    private func waitForBindingPropagation() async {
        await Task.yield()
        await Task.yield()
    }

    private func publishPlaybackState(_ state: PlaybackState) async {
        mockPlaybackService.emitState(state)
        await waitForBindingPropagation()
    }

    // MARK: - Initialization Tests

    func testInit_SetsDefaultValues() {
        XCTAssertEqual(sut.playbackState, .idle)
        XCTAssertFalse(sut.isPlaying)
        XCTAssertEqual(sut.currentTime, 0)
        XCTAssertEqual(sut.totalDuration, 0)
        XCTAssertEqual(sut.playbackRate, 1.0)
        XCTAssertEqual(sut.progress, 0)
        XCTAssertNil(sut.errorMessage)
        XCTAssertFalse(sut.showSpeedSelector)
    }

    func testInit_AvailableRates_ReturnsAllRates() {
        let rates = sut.availableRates
        XCTAssertEqual(rates.count, 4)
        XCTAssertTrue(rates.contains(.half))
        XCTAssertTrue(rates.contains(.normal))
        XCTAssertTrue(rates.contains(.oneAndHalf))
        XCTAssertTrue(rates.contains(.double))
    }

    func testInit_FormattedTimeStrings_FormatsCorrectly() {
        // Given - inject test values
        sut.totalDuration = 125.0
        sut.currentTime = 45.0

        // Then
        XCTAssertEqual(sut.formattedTotalDuration, "2:05")
        XCTAssertEqual(sut.formattedCurrentTime, "0:45")
    }

    // MARK: - Playback Controls Tests

    func testPlay_WithURL_CallsServicePlayURL() async {
        // Given
        let url = URL(string: "file:///test/audio.m4a")!

        // When
        await sut.play(url: url)

        // Then
        XCTAssertEqual(mockPlaybackService.playURLCallCount, 1)
        XCTAssertEqual(mockPlaybackService.lastPlayURL, url)
        XCTAssertNil(sut.errorMessage)
    }

    func testPlay_WithURL_WhenServiceThrows_SetsError() async {
        // Given
        mockPlaybackService.shouldPlayThrowError = true
        mockPlaybackService.playError = VoicePlaybackError.audioNotFound
        let url = URL(string: "file:///nonexistent/audio.m4a")!

        // When
        await sut.play(url: url)

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    func testPlay_WithData_CallsServicePlayData() async {
        // Given
        let data = Data([0x00, 0x01, 0x02])
        let filename = "voice.m4a"

        // When
        await sut.play(data: data, filename: filename)

        // Then
        XCTAssertEqual(mockPlaybackService.playDataCallCount, 1)
        XCTAssertEqual(mockPlaybackService.lastPlayData, data)
        XCTAssertEqual(mockPlaybackService.lastPlayFilename, filename)
    }

    func testPlay_WithData_WhenServiceThrows_SetsError() async {
        // Given
        mockPlaybackService.shouldPlayThrowError = true
        let data = Data([0x00])

        // When
        await sut.play(data: data, filename: "test.m4a")

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    func testPlay_ClearsPreviousError() async {
        // Given
        sut.errorMessage = "Previous error"
        let url = URL(string: "file:///test/audio.m4a")!

        // When
        await sut.play(url: url)

        // Then
        XCTAssertNil(sut.errorMessage)
    }

    // MARK: - Pause Tests

    func testPause_CallsServicePause() async {
        // When
        await sut.pause()

        // Then
        XCTAssertEqual(mockPlaybackService.pauseCallCount, 1)
    }

    // MARK: - Stop Tests

    func testStop_CallsServiceStop() async {
        // Given - set some state
        sut.currentTime = 30.0
        sut.progress = 0.5

        // When
        await sut.stop()

        // Then
        XCTAssertEqual(mockPlaybackService.stopCallCount, 1)
        XCTAssertEqual(sut.currentTime, 0)
        XCTAssertEqual(sut.progress, 0)
        XCTAssertNil(sut.errorMessage)
    }

    // MARK: - Seek Tests

    func testSeek_CallsServiceSeek() async {
        // Given
        let time: TimeInterval = 45.0

        // When
        await sut.seek(to: time)

        // Then
        XCTAssertEqual(mockPlaybackService.seekCallCount, 1)
        XCTAssertEqual(mockPlaybackService.lastSeekTime, time)
    }

    func testSeekToProgress_ConvertsProgressToTime() async {
        // Given
        sut.totalDuration = 100.0
        let progress: Double = 0.5

        // When
        await sut.seekToProgress(progress)

        // Then
        XCTAssertEqual(mockPlaybackService.lastSeekTime, 50.0)
    }

    func testSeekToProgress_WithZeroDuration_DoesNotSeek() async {
        // Given
        sut.totalDuration = 0

        // When
        await sut.seekToProgress(0.5)

        // Then
        XCTAssertEqual(mockPlaybackService.seekCallCount, 0)
    }

    // MARK: - Playback Rate Tests

    func testSetPlaybackRate_WithFloat_UpdatesRate() async {
        // Given
        let rate: Float = 1.5

        // When
        await sut.setPlaybackRate(rate)

        // Then
        XCTAssertEqual(sut.playbackRate, rate)
        XCTAssertEqual(mockPlaybackService.lastSetPlaybackRate, rate)
        XCTAssertFalse(sut.showSpeedSelector)
    }

    func testSetPlaybackRate_WithEnum_UpdatesRate() async {
        // Given
        let rate = PlaybackRate.oneAndHalf

        // When
        await sut.setPlaybackRate(rate)

        // Then
        XCTAssertEqual(sut.playbackRate, rate.rawValue)
        XCTAssertEqual(mockPlaybackService.lastSetPlaybackRate, rate.rawValue)
    }

    func testSetPlaybackRate_HidesSpeedSelector() async {
        // Given
        sut.showSpeedSelector = true

        // When
        await sut.setPlaybackRate(1.0)

        // Then
        XCTAssertFalse(sut.showSpeedSelector)
    }

    // MARK: - Skip Forward/Backward Tests

    func testSkipForward_SeeksForward() async {
        // Given
        sut.totalDuration = 100.0
        sut.currentTime = 50.0

        // When
        await sut.skipForward(5.0)

        // Then
        XCTAssertEqual(mockPlaybackService.lastSeekTime, 55.0)
    }

    func testSkipForward_ClampsToDuration() async {
        // Given
        sut.totalDuration = 10.0
        sut.currentTime = 8.0

        // When
        await sut.skipForward(5.0)

        // Then
        XCTAssertEqual(mockPlaybackService.lastSeekTime, 10.0)
    }

    func testSkipBackward_SeeksBackward() async {
        // Given
        sut.totalDuration = 100.0
        sut.currentTime = 50.0

        // When
        await sut.skipBackward(5.0)

        // Then
        XCTAssertEqual(mockPlaybackService.lastSeekTime, 45.0)
    }

    func testSkipBackward_ClampsToZero() async {
        // Given
        sut.totalDuration = 100.0
        sut.currentTime = 3.0

        // When
        await sut.skipBackward(5.0)

        // Then
        XCTAssertEqual(mockPlaybackService.lastSeekTime, 0.0)
    }

    // MARK: - Toggle Play/Pause Tests

    func testTogglePlayPause_CallsServiceToggle() async {
        // When
        await sut.togglePlayPause()

        // Then
        XCTAssertEqual(mockPlaybackService.togglePlayPauseCallCount, 1)
    }

    // MARK: - Error Handling Tests

    func testClearError_ClearsErrorMessage() {
        // Given
        sut.errorMessage = "Test error"

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.errorMessage)
    }

    // MARK: - Speed Selector Tests

    func testToggleSpeedSelector_TogglesVisibility() {
        // Given
        XCTAssertFalse(sut.showSpeedSelector)

        // When
        sut.toggleSpeedSelector()

        // Then
        XCTAssertTrue(sut.showSpeedSelector)

        // When toggled again
        sut.toggleSpeedSelector()

        // Then
        XCTAssertFalse(sut.showSpeedSelector)
    }

    // MARK: - Publisher Binding Tests

    func testBindings_ReceivePlaybackStateUpdates() async {
        // Given - capture state changes
        var receivedStates: [PlaybackState] = []
        mockPlaybackService._playbackStateSubject
            .sink { state in
                receivedStates.append(state)
            }
            .store(in: &cancellables)

        // When - emit state changes
        mockPlaybackService.emitState(.loading)
        mockPlaybackService.emitState(.playing)
        mockPlaybackService.emitState(.paused)

        // Then
        XCTAssertTrue(receivedStates.contains(.loading))
        XCTAssertTrue(receivedStates.contains(.playing))
        XCTAssertTrue(receivedStates.contains(.paused))
    }

    func testBindings_ReceiveProgressUpdates() async {
        // Given
        mockPlaybackService.duration = 60.0

        // When - emit progress
        mockPlaybackService.simulateProgressUpdate(currentTime: 10.0)
        mockPlaybackService.simulateProgressUpdate(currentTime: 20.0)
        await waitForBindingPropagation()

        // Then
        XCTAssertEqual(sut.currentTime, 20.0)
        XCTAssertEqual(sut.totalDuration, 60.0)
        XCTAssertEqual(sut.progress, 20.0 / 60.0, accuracy: 0.0001)
    }

    // MARK: - Playback State Binding Transitions

    func testUpdatePlayingState_FromPlaying_SetsIsPlayingTrue() async {
        // When
        await publishPlaybackState(.playing)

        // Then
        XCTAssertEqual(sut.playbackState, .playing)
        XCTAssertTrue(sut.isPlaying)
        XCTAssertNil(sut.errorMessage)
    }

    func testUpdatePlayingState_FromPaused_SetsIsPlayingFalse() async {
        // Given
        await publishPlaybackState(.playing)
        XCTAssertTrue(sut.isPlaying)

        // When
        await publishPlaybackState(.paused)

        // Then
        XCTAssertEqual(sut.playbackState, .paused)
        XCTAssertFalse(sut.isPlaying)
    }

    func testUpdatePlayingState_FromIdle_SetsIsPlayingFalse() async {
        // Given
        await publishPlaybackState(.playing)
        XCTAssertTrue(sut.isPlaying)

        // When
        await publishPlaybackState(.idle)

        // Then
        XCTAssertEqual(sut.playbackState, .idle)
        XCTAssertFalse(sut.isPlaying)
    }

    func testUpdatePlayingState_FromFinished_SetsIsPlayingFalse() async {
        // Given
        await publishPlaybackState(.playing)
        XCTAssertTrue(sut.isPlaying)

        // When
        await publishPlaybackState(.finished)

        // Then
        XCTAssertEqual(sut.playbackState, .finished)
        XCTAssertFalse(sut.isPlaying)
    }

    func testUpdatePlayingState_FromError_SetsIsPlayingFalseAndError() async {
        // Given
        await publishPlaybackState(.playing)
        XCTAssertTrue(sut.isPlaying)
        let errorMsg = "Playback failed"

        // When
        await publishPlaybackState(.error(errorMsg))

        // Then
        XCTAssertEqual(sut.playbackState, .error(errorMsg))
        XCTAssertFalse(sut.isPlaying)
        XCTAssertEqual(sut.errorMessage, errorMsg)
    }

    // MARK: - Preview Helpers Tests

    func testPreview_ReturnsConfiguredInstance() {
        // When
        let preview = VoicePlayerViewModel.preview

        // Then
        XCTAssertFalse(preview.isPlaying)
        XCTAssertEqual(preview.totalDuration, 120.0)
        XCTAssertEqual(preview.currentTime, 45.0)
        XCTAssertEqual(preview.progress, 0.375)
        XCTAssertEqual(preview.playbackRate, 1.0)
    }

    func testPreviewPlaying_ReturnsConfiguredInstance() {
        // When
        let preview = VoicePlayerViewModel.previewPlaying

        // Then
        XCTAssertTrue(preview.isPlaying)
        XCTAssertEqual(preview.totalDuration, 180.0)
        XCTAssertEqual(preview.currentTime, 60.0)
        XCTAssertEqual(preview.playbackRate, 1.5)
    }
}
