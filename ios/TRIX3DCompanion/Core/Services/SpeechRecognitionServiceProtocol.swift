//
//  SpeechRecognitionServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for speech recognition service
//

import Foundation

/// Speech recognition status
enum SpeechRecognitionStatus: Equatable {
    case idle
    case listening
    case processing
    case error(String)
}

/// Speech recognition error
enum SpeechRecognitionError: Error, LocalizedError {
    case notAvailable
    case notAuthorized
    case recognitionFailed(String)
    case networkError(String)
    case noSpeechDetected

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "Speech recognition is not available on this device"
        case .notAuthorized:
            return "Speech recognition permission was denied"
        case .recognitionFailed(let message):
            return "Recognition failed: \(message)"
        case .networkError(let message):
            return "Network error: \(message)"
        case .noSpeechDetected:
            return "No speech detected"
        }
    }
}

/// Protocol for speech recognition service
@MainActor
protocol SpeechRecognitionServiceProtocol: ObservableObject {

    /// Current recognition status
    var status: SpeechRecognitionStatus { get }

    /// Whether speech recognition is supported
    var isSupported: Bool { get }

    /// Whether currently listening
    var isListening: Bool { get }

    /// Last recognized text
    var recognizedText: String { get }

    /// Error message if any
    var errorMessage: String? { get }

    /// Start speech recognition
    func startRecognition() async throws

    /// Stop speech recognition
    func stopRecognition() async

    /// Check and request authorization
    func checkAuthorization() async -> Bool
}
