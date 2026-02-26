//
//  TTSServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for text-to-speech service
//

import Foundation
import AVFoundation

/// Protocol for text-to-speech service
protocol TTSServiceProtocol: AnyObject {
    /// Whether speech is currently in progress
    var isSpeaking: Bool { get }

    /// Current voice being used
    var currentVoice: AVSpeechSynthesisVoice? { get }

    /// Speak the given text
    /// - Parameters:
    ///   - text: The text to speak
    ///   - language: Optional language code (e.g., "zh-CN", "en-US")
    func speak(_ text: String, language: String?) async throws

    /// Stop speaking immediately
    func stop() async

    /// Pause speech
    func pause() async

    /// Resume paused speech
    func resume() async

    /// Set speech rate (0.0 - 1.0)
    /// - Parameter rate: The speech rate
    func setRate(_ rate: Float) async

    /// Set pitch multiplier (0.5 - 2.0)
    /// - Parameter pitch: The pitch multiplier
    func setPitch(_ pitch: Float) async

    /// Get available voices for a language
    /// - Parameter language: Language code (e.g., "zh-CN")
    /// - Returns: Array of available voices
    func getAvailableVoices(for language: String) -> [AVSpeechSynthesisVoice]
}

/// Common languages
enum TTSLanguage: String, CaseIterable {
    case chinese = "zh-CN"
    case english = "en-US"
    case japanese = "ja-JP"
    case korean = "ko-KR"
    case spanish = "es-ES"
    case french = "fr-FR"
    case german = "de-DE"

    var displayName: String {
        switch self {
        case .chinese: return "简体中文"
        case .english: return "English"
        case .japanese: return "日本語"
        case .korean: return "한국어"
        case .spanish: return "Español"
        case .french: return "Français"
        case .german: return "Deutsch"
        }
    }
}

/// TTS errors
enum TTSError: Error, LocalizedError {
    case synthesizerUnavailable
    case textEmpty
    case voiceNotAvailable
    case synthesisFailed(Error)
    case unknown

    var errorDescription: String? {
        switch self {
        case .synthesizerUnavailable:
            return "Speech synthesizer is not available"
        case .textEmpty:
            return "Cannot speak empty text"
        case .voiceNotAvailable:
            return "Requested voice is not available"
        case .synthesisFailed(let error):
            return "Speech synthesis failed: \(error.localizedDescription)"
        case .unknown:
            return "Unknown TTS error"
        }
    }
}
