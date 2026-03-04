//
//  SpeechRecognitionService.swift
//  TRIX3DCompanion
//
//  Speech recognition service using SFSpeechRecognizer
//

import Foundation
import Speech
import AVFoundation
import Combine

/// Speech recognition service using iOS Speech framework
@MainActor
final class SpeechRecognitionService: NSObject, SpeechRecognitionServiceProtocol, ObservableObject {

    // MARK: - Singleton

    static let shared = SpeechRecognitionService()

    // MARK: - Published Properties

    @Published private(set) var status: SpeechRecognitionStatus = .idle
    @Published private(set) var isSupported: Bool = false
    @Published private(set) var isListening: Bool = false
    @Published private(set) var recognizedText: String = ""
    @Published private(set) var errorMessage: String?

    // MARK: - Properties

    private let speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()

    // Language setting
    private let recognitionLanguage = "zh-CN"

    // MARK: - Initialization

    private override init() {
        // Initialize speech recognizer with Chinese language
        self.speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: recognitionLanguage))
        super.init()

        // Check if speech recognition is supported
        self.isSupported = speechRecognizer?.isAvailable ?? false
    }

    // MARK: - SpeechRecognitionServiceProtocol

    /// Check and request authorization for speech recognition
    func checkAuthorization() async -> Bool {
        // Check current authorization status
        let status = SFSpeechRecognizer.authorizationStatus()

        switch status {
        case .authorized:
            return true
        case .notDetermined:
            // Request authorization
            return await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { newStatus in
                    continuation.resume(returning: newStatus == .authorized)
                }
            }
        case .denied, .restricted:
            return false
        @unknown default:
            return false
        }
    }

    /// Start speech recognition
    func startRecognition() async throws {
        // Check authorization first
        guard await checkAuthorization() else {
            errorMessage = SpeechRecognitionError.notAuthorized.errorDescription
            status = .error(errorMessage ?? "Not authorized")
            throw SpeechRecognitionError.notAuthorized
        }

        // Check if supported
        guard let speechRecognizer = speechRecognizer, speechRecognizer.isAvailable else {
            errorMessage = SpeechRecognitionError.notAvailable.errorDescription
            status = .error(errorMessage ?? "Not available")
            throw SpeechRecognitionError.notAvailable
        }

        // Cancel any existing task
        await stopRecognition()

        // Clear previous text
        recognizedText = ""
        errorMessage = nil

        // Configure audio session
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        // Create recognition request
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()

        guard let recognitionRequest = recognitionRequest else {
            let error = SpeechRecognitionError.recognitionFailed("Unable to create recognition request")
            errorMessage = error.errorDescription
            status = .error(errorMessage ?? "Failed")
            throw error
        }

        // Configure request
        recognitionRequest.shouldReportPartialResults = true
        recognitionRequest.requiresOnDeviceRecognition = false

        // Configure audio input
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        // Install tap on input node
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        // Start recognition task
        status = .listening
        isListening = true

        recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            Task { @MainActor in
                self?.handleRecognitionResult(result: result, error: error)
            }
        }

        // Start audio engine
        audioEngine.prepare()
        try audioEngine.start()
    }

    /// Stop speech recognition
    func stopRecognition() async {
        // Stop audio engine
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }

        // Cancel recognition request and task
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()

        recognitionRequest = nil
        recognitionTask = nil

        // Update status
        if isListening {
            isListening = false

            if recognizedText.isEmpty {
                status = .idle
            } else {
                status = .idle
            }
        }
    }

    // MARK: - Private Methods

    private func handleRecognitionResult(result: SFSpeechRecognitionResult?, error: Error?) {
        // Handle error
        if let error = error {
            let nsError = error as NSError

            // Check for common error types
            if nsError.domain == "kAFAssistantErrorDomain" ||
               nsError.code == 1110 { // Network error
                errorMessage = SpeechRecognitionError.networkError(error.localizedDescription).errorDescription
                status = .error(errorMessage ?? "Network error")
            } else if nsError.code == 216 { // No speech
                errorMessage = SpeechRecognitionError.noSpeechDetected.errorDescription
                status = .error(errorMessage ?? "No speech")
            } else {
                errorMessage = SpeechRecognitionError.recognitionFailed(error.localizedDescription).errorDescription
                status = .error(errorMessage ?? "Error")
            }

            isListening = false
            return
        }

        // Handle result
        guard let result = result else { return }

        // Get the transcription
        let transcription = result.bestTranscription.formattedString

        if result.isFinal {
            // Final result
            recognizedText = transcription
            isListening = false
            status = .idle
        } else {
            // Partial result
            recognizedText = transcription
            status = .listening
        }
    }
}

// MARK: - Convenience Extension

extension SpeechRecognitionService {

    /// Check if speech recognition is available
    static var isAvailable: Bool {
        SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))?.isAvailable ?? false
    }

    /// Get authorization status
    static var authorizationStatus: SFSpeechRecognizerAuthorizationStatus {
        SFSpeechRecognizer.authorizationStatus()
    }
}
