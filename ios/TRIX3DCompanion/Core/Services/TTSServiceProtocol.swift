//
//  TTSServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for text-to-speech service
//

import Foundation
import AVFoundation

/// Protocol for text-to-speech service
@MainActor
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

    /// Set voice language
    /// - Parameter language: TTS language
    func setVoice(language: TTSLanguage) async

    /// Get available voices for a language
    /// - Parameter language: Language code (e.g., "zh-CN")
    /// - Returns: Array of available voices
    func getAvailableVoices(for language: String) -> [AVSpeechSynthesisVoice]

    /// Get available languages
    /// - Returns: Array of available TTS languages
    func getAvailableLanguages() -> [TTSLanguage]

    /// Speak a preset text
    /// - Parameter preset: The TTS preset to speak
    func speakPreset(_ preset: TTSPreset) async throws
}

/// Common languages
enum TTSLanguage: String, CaseIterable, Codable {
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

/// TTS Presets for common messages
enum TTSPreset {
    case pomodoroStart
    case pomodoroComplete
    case restComplete
    case dailyGoalReminder
    case newMessage
    case friendRequest

    var message: String {
        switch self {
        case .pomodoroStart:
            return "开始专注，祝你学习愉快！"
        case .pomodoroComplete:
            return "恭喜完成一个番茄钟！休息一下吧。"
        case .restComplete:
            return "休息时间结束了，准备开始新的专注！"
        case .dailyGoalReminder:
            return "你今天还没有完成学习目标哦，加油！"
        case .newMessage:
            return "你有新的消息。"
        case .friendRequest:
            return "你有新的好友请求。"
        }
    }

    var language: TTSLanguage {
        return .chinese
    }
}
