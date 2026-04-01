//
//  TTSViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for TTSViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for TTSViewModel
final class TTSViewModelTests: XCTestCase {

    // MARK: - Properties

    var ttsViewModel: TTSViewModel!
    var mockTTSService: MockTTSService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockTTSService = MockTTSService()

        ttsViewModel = TTSViewModel(
            ttsService: mockTTSService
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        ttsViewModel = nil
        mockTTSService = nil
        cancellables = nil
    }

    // MARK: - Initial State Tests

    func test_initialIsEnabled_true() {
        // Assert
        XCTAssertTrue(ttsViewModel.isEnabled)
    }

    func test_initialSpeechRate_default() {
        // Assert
        XCTAssertEqual(ttsViewModel.speechRate, 0.5)
    }

    func test_initialSpeechPitch_default() {
        // Assert
        XCTAssertEqual(ttsViewModel.speechPitch, 1.0)
    }

    func test_initialSelectedLanguage_chinese() {
        // Assert
        XCTAssertEqual(ttsViewModel.selectedLanguage, .chinese)
    }

    func test_initialIsSpeaking_false() {
        // Assert
        XCTAssertFalse(ttsViewModel.isSpeaking)
    }

    // MARK: - TTS Controls Tests

    func test_speak_callsService() async throws {
        // Arrange
        let text = "测试文本"

        // Act
        await ttsViewModel.speak(text)

        // Assert
        XCTAssertEqual(mockTTSService.speakCallCount, 1)
    }

    func test_speak_whenDisabled_doesNotCallService() async throws {
        // Arrange
        ttsViewModel.isEnabled = false

        // Act
        await ttsViewModel.speak("测试文本")

        // Assert
        XCTAssertEqual(mockTTSService.speakCallCount, 0)
    }

    func test_speak_emptyText_setsErrorMessage() async throws {
        // Act
        await ttsViewModel.speak("")

        // Assert
        XCTAssertNotNil(ttsViewModel.errorMessage)
    }

    func test_speakCurrentText_usesTextToSpeak() async throws {
        // Arrange
        ttsViewModel.textToSpeak = "要朗读的文本"

        // Act
        await ttsViewModel.speakCurrentText()

        // Assert
        XCTAssertEqual(mockTTSService.speakCallCount, 1)
    }

    func test_stop_callsService() async throws {
        // Act
        await ttsViewModel.stop()

        // Assert
        XCTAssertEqual(mockTTSService.stopCallCount, 1)
    }

    func test_pause_callsService() async throws {
        // Act
        await ttsViewModel.pause()

        // Assert
        XCTAssertEqual(mockTTSService.pauseCallCount, 1)
    }

    func test_resume_callsService() async throws {
        // Act
        await ttsViewModel.resume()

        // Assert
        XCTAssertEqual(mockTTSService.resumeCallCount, 1)
    }

    // MARK: - Settings Tests

    func test_setRate_callsService() async throws {
        // Act
        await ttsViewModel.setRate(0.7)

        // Assert
        XCTAssertEqual(ttsViewModel.speechRate, 0.7)
        XCTAssertEqual(mockTTSService.setRateCallCount, 1)
    }

    func test_setRate_clampsValue() async throws {
        // Act
        await ttsViewModel.setRate(2.0)

        // Assert
        XCTAssertEqual(ttsViewModel.speechRate, 1.0)
    }

    func test_setPitch_callsService() async throws {
        // Act
        await ttsViewModel.setPitch(1.5)

        // Assert
        XCTAssertEqual(ttsViewModel.speechPitch, 1.5)
        XCTAssertEqual(mockTTSService.setPitchCallCount, 1)
    }

    func test_setPitch_clampsValue() async throws {
        // Act
        await ttsViewModel.setPitch(3.0)

        // Assert
        XCTAssertEqual(ttsViewModel.speechPitch, 2.0)
    }

    func test_setLanguage_callsService() async throws {
        // Act
        await ttsViewModel.setLanguage(.english)

        // Assert
        XCTAssertEqual(ttsViewModel.selectedLanguage, .english)
        XCTAssertEqual(mockTTSService.setVoiceCallCount, 1)
    }

    // MARK: - Preset Messages Tests

    func test_speakPreset_callsService() async throws {
        // Act
        await ttsViewModel.speakPreset(.pomodoroStart)

        // Assert
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
    }

    func test_speakPomodoroStart_callsPreset() async throws {
        // Act
        await ttsViewModel.speakPomodoroStart()

        // Assert
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
    }

    func test_speakPomodoroComplete_callsPreset() async throws {
        // Act
        await ttsViewModel.speakPomodoroComplete()

        // Assert
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
    }

    func test_speakRestComplete_callsPreset() async throws {
        // Act
        await ttsViewModel.speakRestComplete()

        // Assert
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
    }

    func test_speakDailyGoalReminder_callsPreset() async throws {
        // Act
        await ttsViewModel.speakDailyGoalReminder()

        // Assert
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
    }

    func test_speakNewMessage_callsPreset() async throws {
        // Act
        await ttsViewModel.speakNewMessage()

        // Assert
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
    }

    func test_speakFriendRequest_callsPreset() async throws {
        // Act
        await ttsViewModel.speakFriendRequest()

        // Assert
        XCTAssertEqual(mockTTSService.speakPresetCallCount, 1)
    }

    // MARK: - Utility Tests

    func test_clearError_clearsErrorMessage() {
        // Arrange
        ttsViewModel.errorMessage = "Test error"

        // Act
        ttsViewModel.clearError()

        // Assert
        XCTAssertNil(ttsViewModel.errorMessage)
    }

    func test_toggleLanguageSelector_togglesVisibility() {
        // Act
        ttsViewModel.toggleLanguageSelector()

        // Assert
        XCTAssertTrue(ttsViewModel.showLanguageSelector)

        // Act
        ttsViewModel.toggleLanguageSelector()

        // Assert
        XCTAssertFalse(ttsViewModel.showLanguageSelector)
    }

    func test_toggleSettings_togglesVisibility() {
        // Act
        ttsViewModel.toggleSettings()

        // Assert
        XCTAssertTrue(ttsViewModel.showSettings)

        // Act
        ttsViewModel.toggleSettings()

        // Assert
        XCTAssertFalse(ttsViewModel.showSettings)
    }

    func test_resetToDefaults_resetsAllSettings() async throws {
        // Arrange
        ttsViewModel.speechRate = 0.7
        ttsViewModel.speechPitch = 1.5
        ttsViewModel.selectedLanguage = .english

        // Act
        await ttsViewModel.resetToDefaults()

        // Assert
        XCTAssertEqual(ttsViewModel.speechRate, 0.5)
        XCTAssertEqual(ttsViewModel.speechPitch, 1.0)
        XCTAssertEqual(ttsViewModel.selectedLanguage, .chinese)
    }

    func test_exportSettings_returnsCorrectSettings() {
        // Arrange
        ttsViewModel.speechRate = 0.7
        ttsViewModel.speechPitch = 1.2
        ttsViewModel.selectedLanguage = .english

        // Act
        let settings = ttsViewModel.exportSettings()

        // Assert
        XCTAssertEqual(settings.rate, 0.7)
        XCTAssertEqual(settings.pitch, 1.2)
        XCTAssertEqual(settings.language, .english)
    }

    // MARK: - Computed Properties Tests

    func test_availableRateOptions_returnsOptions() {
        // Assert
        XCTAssertEqual(ttsViewModel.availableRateOptions.count, 4)
    }

    func test_availablePitchOptions_returnsOptions() {
        // Assert
        XCTAssertEqual(ttsViewModel.availablePitchOptions.count, 3)
    }
}

// MARK: - Mock TTS Service

class MockTTSService: TTSServiceProtocol {

    var isSpeaking: Bool = false
    var currentVoice: AVSpeechSynthesisVoice?

    // Call tracking
    var speakCallCount: Int = 0
    var stopCallCount: Int = 0
    var pauseCallCount: Int = 0
    var resumeCallCount: Int = 0
    var setRateCallCount: Int = 0
    var setPitchCallCount: Int = 0
    var setVoiceCallCount: Int = 0
    var speakPresetCallCount: Int = 0

    func speak(_ text: String, language: String?) async throws {
        speakCallCount += 1
    }

    func stop() async {
        stopCallCount += 1
    }

    func pause() async {
        pauseCallCount += 1
    }

    func resume() async {
        resumeCallCount += 1
    }

    func setRate(_ rate: Float) async {
        setRateCallCount += 1
    }

    func setPitch(_ pitch: Float) async {
        setPitchCallCount += 1
    }

    func setVoice(language: TTSLanguage) async {
        setVoiceCallCount += 1
    }

    func getAvailableVoices(for language: String) -> [AVSpeechSynthesisVoice] {
        return []
    }

    func getAvailableLanguages() -> [TTSLanguage] {
        return [.chinese, .english, .japanese]
    }

    func speakPreset(_ preset: TTSPreset) async throws {
        speakPresetCallCount += 1
    }
}

// MARK: - Import AVFoundation

import AVFoundation

// MARK: - TTSSettings Model

struct TTSSettings: Codable {
    let isEnabled: Bool
    let language: TTSLanguage
    let rate: Float
    let pitch: Float
    let volume: Float
}

// MARK: - TTSPreset

enum TTSPreset: String, CaseIterable {
    case pomodoroStart
    case pomodoroComplete
    case restComplete
    case dailyGoalReminder
    case newMessage
    case friendRequest
}
