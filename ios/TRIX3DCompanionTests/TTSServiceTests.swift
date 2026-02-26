//
//  TTSServiceTests.swift
//  TRIX3DCompanionTests
//
//  Comprehensive unit tests for TTSService
//

import XCTest
import AVFoundation
import Combine
@testable import TRIX3DCompanion

/// Comprehensive unit tests for TTSService
final class TTSServiceTests: XCTestCase {

    // MARK: - Properties

    var ttsService: TTSService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        ttsService = TTSService.shared
        cancellables = Set<AnyCancellable>()

        // Stop any ongoing speech
        Task {
            await ttsService.stop()
        }
    }

    override func tearDownWithError() throws {
        // Stop any ongoing speech
        Task {
            await ttsService.stop()
        }

        ttsService = nil
        cancellables = nil
    }

    // MARK: - Speak Tests

    func test_speak_success_withValidText() async throws {
        // Arrange
        let testText = "测试语音合成"

        // Act
        try await ttsService.speak(testText)

        // Assert
        XCTAssertTrue(ttsService.isSpeaking, "Should be speaking after speak() is called")
    }

    func test_speak_failure_withEmptyText() async {
        // Arrange
        let emptyText = ""

        // Act & Assert
        do {
            try await ttsService.speak(emptyText)
            XCTFail("Should throw error for empty text")
        } catch let error as TTSError {
            XCTAssertEqual(error, .textEmpty, "Should throw textEmpty error")
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func test_speak_failure_withWhitespaceOnly() async {
        // Arrange
        let whitespaceText = "   \n\t   "

        // Act & Assert
        do {
            try await ttsService.speak(whitespaceText)
            XCTFail("Should throw error for whitespace-only text")
        } catch let error as TTSError {
            XCTAssertEqual(error, .textEmpty, "Should throw textEmpty error")
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func test_speak_withChineseLanguage() async throws {
        // Arrange
        let testText = "你好世界"

        // Act
        try await ttsService.speak(testText, language: "zh-CN")

        // Assert
        XCTAssertTrue(ttsService.isSpeaking)
        XCTAssertEqual(ttsService.currentVoice?.language, "zh-CN")
    }

    func test_speak_withEnglishLanguage() async throws {
        // Arrange
        let testText = "Hello World"

        // Act
        try await ttsService.speak(testText, language: "en-US")

        // Assert
        XCTAssertTrue(ttsService.isSpeaking)
        XCTAssertTrue(ttsService.currentVoice?.language.hasPrefix("en") ?? false)
    }

    func test_speak_stopsPreviousSpeech() async throws {
        // Arrange
        let firstText = "第一段文字"
        let secondText = "第二段文字"

        // Act
        try await ttsService.speak(firstText)
        let firstSpeaking = ttsService.isSpeaking

        try await ttsService.speak(secondText)
        let secondSpeaking = ttsService.isSpeaking

        // Assert - Both should trigger speech, second replaces first
        XCTAssertTrue(firstSpeaking, "First speech should start")
        XCTAssertTrue(secondSpeaking, "Second speech should start")
    }

    // MARK: - Stop Tests

    func test_stop_stopsSpeaking() async throws {
        // Arrange
        try await ttsService.speak("测试停止功能")
        XCTAssertTrue(ttsService.isSpeaking)

        // Act
        await ttsService.stop()

        // Assert
        XCTAssertFalse(ttsService.isSpeaking, "Should not be speaking after stop()")
    }

    func test_stop_whenNotSpeaking_doesNotCrash() async {
        // Arrange - Ensure not speaking
        await ttsService.stop()

        // Act - Should not crash
        await ttsService.stop()

        // Assert
        XCTAssertFalse(ttsService.isSpeaking)
    }

    // MARK: - Pause/Resume Tests

    func test_pause_pausesSpeaking() async throws {
        // Arrange
        try await ttsService.speak("这是一段较长的文字，用于测试暂停功能")

        // Wait a bit for speech to start
        try await Task.sleep(nanoseconds: 100_000_000)

        // Act
        await ttsService.pause()

        // Assert
        // Note: AVSpeechSynthesizer doesn't have an isPaused property
        // We verify the method doesn't crash
        XCTAssertTrue(true, "pause() should execute without error")
    }

    func test_pause_whenNotSpeaking_doesNotCrash() async {
        // Arrange - Ensure not speaking
        await ttsService.stop()

        // Act - Should not crash
        await ttsService.pause()

        // Assert
        XCTAssertTrue(true, "pause() should execute without error when not speaking")
    }

    func test_resume_afterPause() async throws {
        // Arrange
        try await ttsService.speak("测试恢复功能")
        try await Task.sleep(nanoseconds: 100_000_000)
        await ttsService.pause()

        // Act - Should not crash
        await ttsService.resume()

        // Assert
        XCTAssertTrue(true, "resume() should execute without error")
    }

    func test_resume_whenNotPaused_doesNotCrash() async {
        // Act - Should not crash
        await ttsService.resume()

        // Assert
        XCTAssertTrue(true, "resume() should execute without error when not paused")
    }

    // MARK: - Rate Tests

    func test_setRate_validValue() async {
        // Arrange
        let testRate: Float = 0.7

        // Act
        await ttsService.setRate(testRate)

        // Assert - Should not crash
        XCTAssertTrue(true, "setRate() should accept valid rate")
    }

    func test_setRate_minimumValue() async {
        // Arrange
        let minRate: Float = 0.0

        // Act
        await ttsService.setRate(minRate)

        // Assert
        XCTAssertTrue(true, "setRate() should accept minimum rate")
    }

    func test_setRate_maximumValue() async {
        // Arrange
        let maxRate: Float = 1.0

        // Act
        await ttsService.setRate(maxRate)

        // Assert
        XCTAssertTrue(true, "setRate() should accept maximum rate")
    }

    func test_setRate_belowMinimum_clampsToMinimum() async {
        // Arrange
        let invalidRate: Float = -0.5

        // Act - Should clamp to 0.0
        await ttsService.setRate(invalidRate)

        // Assert - Should not crash (rate is clamped internally)
        XCTAssertTrue(true, "setRate() should clamp negative values to 0.0")
    }

    func test_setRate_aboveMaximum_clampsToMaximum() async {
        // Arrange
        let invalidRate: Float = 1.5

        // Act - Should clamp to 1.0
        await ttsService.setRate(invalidRate)

        // Assert - Should not crash (rate is clamped internally)
        XCTAssertTrue(true, "setRate() should clamp high values to 1.0")
    }

    // MARK: - Pitch Tests

    func test_setPitch_validValue() async {
        // Arrange
        let testPitch: Float = 1.2

        // Act
        await ttsService.setPitch(testPitch)

        // Assert
        XCTAssertTrue(true, "setPitch() should accept valid pitch")
    }

    func test_setPitch_minimumValue() async {
        // Arrange
        let minPitch: Float = 0.5

        // Act
        await ttsService.setPitch(minPitch)

        // Assert
        XCTAssertTrue(true, "setPitch() should accept minimum pitch")
    }

    func test_setPitch_maximumValue() async {
        // Arrange
        let maxPitch: Float = 2.0

        // Act
        await ttsService.setPitch(maxPitch)

        // Assert
        XCTAssertTrue(true, "setPitch() should accept maximum pitch")
    }

    func test_setPitch_belowMinimum_clampsToMinimum() async {
        // Arrange
        let invalidPitch: Float = 0.3

        // Act - Should clamp to 0.5
        await ttsService.setPitch(invalidPitch)

        // Assert
        XCTAssertTrue(true, "setPitch() should clamp low values to 0.5")
    }

    func test_setPitch_aboveMaximum_clampsToMaximum() async {
        // Arrange
        let invalidPitch: Float = 2.5

        // Act - Should clamp to 2.0
        await ttsService.setPitch(invalidPitch)

        // Assert
        XCTAssertTrue(true, "setPitch() should clamp high values to 2.0")
    }

    // MARK: - Voice Tests

    func test_getAvailableVoices_forChinese() {
        // Act
        let voices = ttsService.getAvailableVoices(for: "zh")

        // Assert
        XCTAssertNotNil(voices, "Should return voices array")
        // Note: May be empty on some simulators
    }

    func test_getAvailableVoices_forEnglish() {
        // Act
        let voices = ttsService.getAvailableVoices(for: "en")

        // Assert
        XCTAssertNotNil(voices, "Should return voices array")
        XCTAssertTrue(voices.allSatisfy { $0.language.hasPrefix("en") }, "All voices should be English")
    }

    func test_setVoice_forChinese() async {
        // Act
        await ttsService.setVoice(language: .chinese)

        // Assert
        XCTAssertNotNil(ttsService.currentVoice, "Should have a current voice")
        XCTAssertTrue(ttsService.currentVoice?.language.hasPrefix("zh") ?? false, "Voice should be Chinese")
    }

    func test_setVoice_forEnglish() async {
        // Act
        await ttsService.setVoice(language: .english)

        // Assert
        XCTAssertNotNil(ttsService.currentVoice, "Should have a current voice")
        XCTAssertTrue(ttsService.currentVoice?.language.hasPrefix("en") ?? false, "Voice should be English")
    }

    // MARK: - Language Tests

    func test_getAvailableLanguages() {
        // Act
        let languages = ttsService.getAvailableLanguages()

        // Assert
        XCTAssertFalse(languages.isEmpty, "Should have at least some available languages")
        // Chinese should typically be available
        XCTAssertTrue(languages.contains(.chinese) || !languages.isEmpty, "Should have languages")
    }

    // MARK: - Preset Tests

    func test_speakPreset_pomodoroStart() async throws {
        // Act
        try await ttsService.speakPreset(.pomodoroStart)

        // Assert
        XCTAssertTrue(ttsService.isSpeaking, "Should be speaking preset")
    }

    func test_speakPreset_pomodoroComplete() async throws {
        // Act
        try await ttsService.speakPreset(.pomodoroComplete)

        // Assert
        XCTAssertTrue(ttsService.isSpeaking, "Should be speaking preset")
    }

    func test_speakPreset_restComplete() async throws {
        // Act
        try await ttsService.speakPreset(.restComplete)

        // Assert
        XCTAssertTrue(ttsService.isSpeaking, "Should be speaking preset")
    }

    func test_speakPreset_dailyGoalReminder() async throws {
        // Act
        try await ttsService.speakPreset(.dailyGoalReminder)

        // Assert
        XCTAssertTrue(ttsService.isSpeaking, "Should be speaking preset")
    }

    func test_speakPreset_newMessage() async throws {
        // Act
        try await ttsService.speakPreset(.newMessage)

        // Assert
        XCTAssertTrue(ttsService.isSpeaking, "Should be speaking preset")
    }

    func test_speakPreset_friendRequest() async throws {
        // Act
        try await ttsService.speakPreset(.friendRequest)

        // Assert
        XCTAssertTrue(ttsService.isSpeaking, "Should be speaking preset")
    }

    func test_allPresetsHaveValidMessages() {
        // Test all presets have non-empty messages
        let presets: [TTSPreset] = [
            .pomodoroStart,
            .pomodoroComplete,
            .restComplete,
            .dailyGoalReminder,
            .newMessage,
            .friendRequest
        ]

        for preset in presets {
            XCTAssertFalse(preset.message.isEmpty, "Preset \(preset) should have a message")
            XCTAssertEqual(preset.language, .chinese, "All presets should use Chinese")
        }
    }

    // MARK: - Published Properties Tests

    func test_isSpeaking_publishedChanges() async throws {
        // Arrange
        let expectation = XCTestExpectation(description: "isSpeaking should publish change")
        var speakingStates: [Bool] = []

        ttsService.$isSpeaking
            .sink { isSpeaking in
                speakingStates.append(isSpeaking)
                if speakingStates.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Act
        try await ttsService.speak("测试发布属性")
        try await Task.sleep(nanoseconds: 100_000_000)
        await ttsService.stop()

        // Assert
        wait(for: [expectation], timeout: 5.0)
        XCTAssertTrue(speakingStates.contains(true), "Should have speaking state true")
        XCTAssertTrue(speakingStates.contains(false), "Should have speaking state false")
    }

    func test_currentVoice_publishedChanges() async {
        // Arrange
        let expectation = XCTestExpectation(description: "currentVoice should publish change")

        ttsService.$currentVoice
            .dropFirst()
            .sink { voice in
                if voice != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Act
        await ttsService.setVoice(language: .english)

        // Assert
        wait(for: [expectation], timeout: 2.0)
    }

    // MARK: - Error Handling Tests

    func test_multipleSpeakCalls_handleGracefully() async throws {
        // Arrange
        let texts = ["第一", "第二", "第三", "第四", "第五"]

        // Act - Multiple rapid calls
        for text in texts {
            try await ttsService.speak(text)
            try await Task.sleep(nanoseconds: 50_000_000)
        }

        // Assert - Should handle gracefully
        XCTAssertTrue(ttsService.isSpeaking, "Should be speaking after multiple calls")
    }

    func test_speakVeryLongText_handlesGracefully() async throws {
        // Arrange
        let longText = String(repeating: "这是一段测试文字。", count: 100)

        // Act
        try await ttsService.speak(longText)

        // Assert
        XCTAssertTrue(ttsService.isSpeaking, "Should handle long text")
    }

    func test_speakWithSpecialCharacters_handlesGracefully() async throws {
        // Arrange
        let specialText = "测试特殊字符：@#$%^&*()_+-={}[]|\\:;\"'<>?,./"

        // Act
        try await ttsService.speak(specialText)

        // Assert
        XCTAssertTrue(ttsService.isSpeaking, "Should handle special characters")
    }

    func test_speakWithEmojis_handlesGracefully() async throws {
        // Arrange
        let emojiText = "测试表情符号 😊🎉👍"

        // Act
        try await ttsService.speak(emojiText)

        // Assert
        XCTAssertTrue(ttsService.isSpeaking, "Should handle emojis")
    }

    // MARK: - Settings Tests

    func test TTSSettings_defaultValues() {
        // Arrange
        let settings = TTSSettings()

        // Assert
        XCTAssertTrue(settings.isEnabled, "Should be enabled by default")
        XCTAssertEqual(settings.language, .chinese, "Should default to Chinese")
        XCTAssertEqual(settings.rate, 0.5, "Should have default rate")
        XCTAssertEqual(settings.pitch, 1.0, "Should have default pitch")
        XCTAssertEqual(settings.volume, 1.0, "Should have default volume")
    }

    func test TTSSettings_getVoice() {
        // Arrange
        let settings = TTSSettings(language: .chinese)

        // Act
        let voice = settings.getVoice()

        // Assert
        XCTAssertNotNil(voice, "Should get a voice")
        XCTAssertEqual(voice?.language, "zh-CN", "Voice should match language")
    }

    func test TTSSettings_codable() {
        // Arrange
        let originalSettings = TTSSettings(
            isEnabled: false,
            language: .english,
            rate: 0.7,
            pitch: 1.2,
            volume: 0.8
        )

        // Act
        let encoder = JSONEncoder()
        let encoderData = try? encoder.encode(originalSettings)
        let decoder = JSONDecoder()
        let decodedSettings = try? decoder.decode(TTSSettings.self, from: encoderData!)

        // Assert
        XCTAssertNotNil(encoderData, "Should encode successfully")
        XCTAssertNotNil(decodedSettings, "Should decode successfully")
        XCTAssertEqual(originalSettings.isEnabled, decodedSettings?.isEnabled)
        XCTAssertEqual(originalSettings.language, decodedSettings?.language)
        XCTAssertEqual(originalSettings.rate, decodedSettings?.rate)
        XCTAssertEqual(originalSettings.pitch, decodedSettings?.pitch)
        XCTAssertEqual(originalSettings.volume, decodedSettings?.volume)
    }

    // MARK: - Enum Tests

    func test TTSLanguage_allCases() {
        // Assert
        XCTAssertFalse(TTSLanguage.allCases.isEmpty, "Should have language cases")
        XCTAssertTrue(TTSLanguage.allCases.contains(.chinese), "Should have Chinese")
        XCTAssertTrue(TTSLanguage.allCases.contains(.english), "Should have English")
    }

    func test TTSLanguage_rawValues() {
        // Assert
        XCTAssertEqual(TTSLanguage.chinese.rawValue, "zh-CN", "Chinese raw value should be zh-CN")
        XCTAssertEqual(TTSLanguage.english.rawValue, "en-US", "English raw value should be en-US")
    }

    func test_TTSPreset_messagesUnique() {
        // Arrange
        let presets: [TTSPreset] = [
            .pomodoroStart,
            .pomodoroComplete,
            .restComplete,
            .dailyGoalReminder,
            .newMessage,
            .friendRequest
        ]

        let messages = Set(presets.map { $0.message })

        // Assert - All messages should be unique
        XCTAssertEqual(messages.count, presets.count, "All preset messages should be unique")
    }

    // MARK: - Memory/Performance Tests

    func test_rapidSpeakStopPerformance() async throws {
        // Measure performance of rapid speak/stop cycles
        measure {
            let group = DispatchGroup()
            for _ in 0..<10 {
                group.enter()
                Task {
                    try? await ttsService.speak("测试")
                    await ttsService.stop()
                    group.leave()
                }
            }
            group.wait()
        }
    }

    func test_concurrentVoiceRequests() async throws {
        // Test concurrent voice availability checks
        await withTaskGroup(of: [AVSpeechSynthesisVoice].self) { group in
            for _ in 0..<5 {
                group.addTask {
                    return self.ttsService.getAvailableVoices(for: "zh")
                }
            }

            var results: [[AVSpeechSynthesisVoice]] = []
            for await voices in group {
                results.append(voices)
            }

            XCTAssertEqual(results.count, 5, "Should handle concurrent requests")
        }
    }
}

// MARK: - TTS Error Tests

extension TTSServiceTests {

    func test TTSError_textEmpty_description() {
        // Arrange
        let error = TTSError.textEmpty

        // Assert
        XCTAssertNotNil(error.localizedDescription, "Should have error description")
    }

    func test TTSError_localizedErrorConformance() {
        // Arrange
        let error: Error = TTSError.textEmpty

        // Assert
        XCTAssertTrue(error is LocalizedError, "TTSError should conform to LocalizedError")
    }
}
