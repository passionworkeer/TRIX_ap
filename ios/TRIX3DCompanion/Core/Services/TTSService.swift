//
//  TTSService.swift
//  TRIX3DCompanion
//
//  Text-to-speech service using AVSpeechSynthesizer
//

import Foundation
import AVFoundation
import Combine

/// Text-to-speech service
@MainActor
final class TTSService: NSObject, TTSServiceProtocol, ObservableObject {

    // MARK: - Singleton

    static let shared = TTSService()

    // MARK: - Published Properties

    @Published private(set) var isSpeaking: Bool = false
    @Published private(set) var currentVoice: AVSpeechSynthesisVoice?

    // MARK: - Properties

    private let synthesizer: AVSpeechSynthesizer
    private var currentUtterance: AVSpeechUtterance?

    // Speech settings
    private var speechRate: Float = 0.5  // Default: 0.0 - 1.0
    private var speechPitch: Float = 1.0  // Default: 0.5 - 2.0
    private var speechVolume: Float = 1.0  // Default: 0.0 - 1.0

    // Cancellables
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private override init() {
        self.synthesizer = AVSpeechSynthesizer()
        super.init()

        // Set up delegate
        synthesizer.delegate = self

        // Set default voice
        if let defaultVoice = AVSpeechSynthesisVoice(language: TTSLanguage.chinese.rawValue) {
            currentVoice = defaultVoice
        }
    }

    // MARK: - TTSServiceProtocol

    /// Speak the given text
    func speak(_ text: String, language: String? = nil) async throws {
        guard !text.isEmpty else {
            throw TTSError.textEmpty
        }

        // Stop any current speech
        await stop()

        // Create utterance
        let utterance = AVSpeechUtterance(string: text)

        // Configure voice
        let languageCode = language ?? TTSLanguage.chinese.rawValue
        if let voice = AVSpeechSynthesisVoice(language: languageCode) {
            utterance.voice = voice
            currentVoice = voice
        } else {
            // Use default voice if requested language not available
            utterance.voice = currentVoice
        }

        // Configure speech parameters
        utterance.rate = speechRate
        utterance.pitchMultiplier = speechPitch
        utterance.volume = speechVolume

        currentUtterance = utterance
        isSpeaking = true

        // Speak
        synthesizer.speak(utterance)
    }

    /// Stop speaking immediately
    func stop() async {
        guard synthesizer.isSpeaking else { return }

        synthesizer.stopSpeaking(at: .immediate)
        currentUtterance = nil
        isSpeaking = false
    }

    /// Pause speech
    func pause() async {
        guard synthesizer.isSpeaking && !synthesizer.isPaused else { return }

        synthesizer.pauseSpeaking(at: .immediate)
    }

    /// Resume paused speech
    func resume() async {
        guard synthesizer.isPaused else { return }

        synthesizer.continueSpeaking()
    }

    /// Set speech rate
    func setRate(_ rate: Float) async {
        speechRate = max(0.0, min(1.0, rate))
    }

    /// Set pitch multiplier
    func setPitch(_ pitch: Float) async {
        speechPitch = max(0.5, min(2.0, pitch))
    }

    /// Get available voices for a language
    func getAvailableVoices(for language: String) -> [AVSpeechSynthesisVoice] {
        return AVSpeechSynthesisVoice.speechVoices().filter { voice in
            voice.language.hasPrefix(language.prefix(2))
        }
    }

    // MARK: - Public Methods

    /// Get all available languages
    func getAvailableLanguages() -> [TTSLanguage] {
        return TTSLanguage.allCases.filter { language in
            !AVSpeechSynthesisVoice.speechVoices().filter({ $0.language == language.rawValue }).isEmpty
        }
    }

    /// Set voice by language
    func setVoice(language: TTSLanguage) async {
        if let voice = AVSpeechSynthesisVoice(language: language.rawValue) {
            currentVoice = voice
        }
    }

    /// Speak a preset message
    func speakPreset(_ preset: TTSPreset) async throws {
        try await speak(preset.message, language: preset.language.rawValue)
    }
}

// MARK: - AVSpeechSynthesizerDelegate

extension TTSService: AVSpeechSynthesizerDelegate {

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        isSpeaking = true
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        isSpeaking = false
        currentUtterance = nil
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        isSpeaking = false
        currentUtterance = nil
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didPause utterance: AVSpeechUtterance) {
        // Keep isSpeaking true when paused
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didContinue utterance: AVSpeechUtterance) {
        // Keep isSpeaking true when continuing
    }
}

// MARK: - TTS Settings

/// TTS settings model
struct TTSSettings: Codable {
    var isEnabled: Bool = true
    var language: TTSLanguage = .chinese
    var rate: Float = 0.5
    var pitch: Float = 1.0
    var volume: Float = 1.0

    /// Get voice for current language
    func getVoice() -> AVSpeechSynthesisVoice? {
        return AVSpeechSynthesisVoice(language: language.rawValue)
    }
}
