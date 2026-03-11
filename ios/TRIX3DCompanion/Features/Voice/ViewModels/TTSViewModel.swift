//
//  TTSViewModel.swift
//  TRIX3DCompanion
//
//  Text-to-speech ViewModel - manages TTS state and controls
//

import Foundation
import AVFoundation
import Combine

// MARK: - TTS ViewModel

/// ViewModel managing text-to-speech functionality
@MainActor
final class TTSViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Whether TTS is currently speaking
    @Published private(set) var isSpeaking: Bool = false

    /// Whether TTS is enabled
    @Published var isEnabled: Bool = true {
        didSet {
            // Disable TTS if turned off
            if !isEnabled {
                Task {
                    await stop()
                }
            }
        }
    }

    /// Current speech rate (0.0 - 1.0)
    @Published var speechRate: Float = 0.5 {
        didSet {
            // Update service rate
            Task {
                await ttsService.setRate(speechRate)
            }
        }
    }

    /// Current speech pitch (0.5 - 2.0)
    @Published var speechPitch: Float = 1.0 {
        didSet {
            // Update service pitch
            Task {
                await ttsService.setPitch(speechPitch)
            }
        }
    }

    /// Selected language
    @Published var selectedLanguage: TTSLanguage = .chinese {
        didSet {
            // Update service voice
            Task {
                await ttsService.setVoice(language: selectedLanguage)
            }
        }
    }

    /// Available languages
    @Published var availableLanguages: [TTSLanguage] = []

    /// Whether to show language selector
    @Published var showLanguageSelector: Bool = false

    /// Whether to show settings panel
    @Published var showSettings: Bool = false

    /// Error message to display
    @Published var errorMessage: String?

    /// Text to speak
    @Published var textToSpeak: String = ""

    /// Whether currently speaking the text
    @Published private(set) var isSpeakingText: Bool = false

    // MARK: - Dependencies

    private let ttsService: TTSServiceProtocol
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Computed Properties

    /// Available speech rate options
    var availableRateOptions: [SpeechRateOption] {
        [
            SpeechRateOption(value: 0.3, displayName: "0.3x"),
            SpeechRateOption(value: 0.5, displayName: "0.5x"),
            SpeechRateOption(value: 0.7, displayName: "0.7x"),
            SpeechRateOption(value: 1.0, displayName: "1.0x")
        ]
    }

    /// Available pitch options
    var availablePitchOptions: [SpeechPitchOption] {
        [
            SpeechPitchOption(value: 0.8, displayName: "低音"),
            SpeechPitchOption(value: 1.0, displayName: "标准"),
            SpeechPitchOption(value: 1.2, displayName: "高音")
        ]
    }

    // MARK: - Initialization

    /// Initialize TTSViewModel
    /// - Parameter ttsService: TTS service dependency
    init(
        ttsService: TTSServiceProtocol? = nil
    ) {
        self.ttsService = ttsService ?? TTSService.shared

        // Setup bindings and load languages
        setupBindings()
        loadAvailableLanguages()
    }

    // MARK: - Setup

    /// Setup Combine bindings
    private func setupBindings() {
        // TTSService publishes its own state; view model reads values on demand.
    }

    /// Load available languages
    private func loadAvailableLanguages() {
        availableLanguages = ttsService.getAvailableLanguages()
    }

    // MARK: - TTS Controls

    /// Speak the given text
    /// - Parameter text: Text to speak
    func speak(_ text: String) async {
        guard isEnabled else { return }
        guard !text.isEmpty else {
            errorMessage = "请输入要朗读的文本"
            return
        }

        do {
            errorMessage = nil
            isSpeakingText = true
            try await ttsService.speak(text, language: selectedLanguage.rawValue)
        } catch {
            errorMessage = error.localizedDescription
            isSpeakingText = false
        }
    }

    /// Speak current text
    func speakCurrentText() async {
        await speak(textToSpeak)
    }

    /// Stop speaking
    func stop() async {
        await ttsService.stop()
        isSpeakingText = false
    }

    /// Pause speaking
    func pause() async {
        await ttsService.pause()
    }

    /// Resume speaking
    func resume() async {
        await ttsService.resume()
    }

    // MARK: - Settings Management

    /// Set speech rate
    /// - Parameter rate: Speech rate value (0.0 - 1.0)
    func setRate(_ rate: Float) async {
        let clampedRate = max(0.0, min(1.0, rate))
        speechRate = clampedRate
        await ttsService.setRate(clampedRate)
    }

    /// Set speech pitch
    /// - Parameter pitch: Speech pitch value (0.5 - 2.0)
    func setPitch(_ pitch: Float) async {
        let clampedPitch = max(0.5, min(2.0, pitch))
        speechPitch = clampedPitch
        await ttsService.setPitch(clampedPitch)
    }

    /// Set language
    /// - Parameter language: TTS language
    func setLanguage(_ language: TTSLanguage) async {
        selectedLanguage = language
        await ttsService.setVoice(language: language)
        showLanguageSelector = false
    }

    // MARK: - Preset Messages

    /// Speak a preset message
    /// - Parameter preset: TTSPreset enum value
    func speakPreset(_ preset: TTSPreset) async {
        guard isEnabled else { return }

        do {
            errorMessage = nil
            isSpeakingText = true
            try await ttsService.speakPreset(preset)
        } catch {
            errorMessage = error.localizedDescription
            isSpeakingText = false
        }
    }

    /// Speak Pomodoro start message
    func speakPomodoroStart() async {
        await speakPreset(.pomodoroStart)
    }

    /// Speak Pomodoro complete message
    func speakPomodoroComplete() async {
        await speakPreset(.pomodoroComplete)
    }

    /// Speak rest complete message
    func speakRestComplete() async {
        await speakPreset(.restComplete)
    }

    /// Speak daily goal reminder
    func speakDailyGoalReminder() async {
        await speakPreset(.dailyGoalReminder)
    }

    /// Speak new message notification
    func speakNewMessage() async {
        await speakPreset(.newMessage)
    }

    /// Speak friend request notification
    func speakFriendRequest() async {
        await speakPreset(.friendRequest)
    }

    // MARK: - Utility Methods

    /// Clear error message
    func clearError() {
        errorMessage = nil
    }

    /// Toggle language selector visibility
    func toggleLanguageSelector() {
        showLanguageSelector.toggle()
    }

    /// Toggle settings panel visibility
    func toggleSettings() {
        showSettings.toggle()
    }

    /// Reset settings to defaults
    func resetToDefaults() async {
        speechRate = 0.5
        speechPitch = 1.0
        selectedLanguage = .chinese

        await ttsService.setRate(0.5)
        await ttsService.setPitch(1.0)
        await ttsService.setVoice(language: .chinese)
    }

    /// Load settings from storage
    func loadSettings(settings: TTSSettings) {
        isEnabled = settings.isEnabled
        speechRate = settings.rate
        speechPitch = settings.pitch
        selectedLanguage = settings.language
    }

    /// Export current settings
    func exportSettings() -> TTSSettings {
        return TTSSettings(
            isEnabled: isEnabled,
            language: selectedLanguage,
            rate: speechRate,
            pitch: speechPitch,
            volume: 1.0
        )
    }
}

// MARK: - Speech Rate Option

/// Speech rate option model
struct SpeechRateOption: Identifiable, Equatable {
    let id = UUID()
    let value: Float
    let displayName: String
}

// MARK: - Speech Pitch Option

/// Speech pitch option model
struct SpeechPitchOption: Identifiable, Equatable {
    let id = UUID()
    let value: Float
    let displayName: String
}

// MARK: - Preview Helpers

#if DEBUG
extension TTSViewModel {
    /// Create preview view model with sample state
    static var preview: TTSViewModel {
        let vm = TTSViewModel()
        vm.isEnabled = true
        vm.speechRate = 0.5
        vm.speechPitch = 1.0
        vm.selectedLanguage = .chinese
        vm.isSpeaking = false
        return vm
    }

    /// Create preview view model with speaking state
    static var previewSpeaking: TTSViewModel {
        let vm = TTSViewModel()
        vm.isEnabled = true
        vm.speechRate = 0.7
        vm.speechPitch = 1.2
        vm.selectedLanguage = .chinese
        vm.isSpeaking = true
        vm.isSpeakingText = true
        vm.textToSpeak = "这是一段测试文本，用于演示语音朗读功能。"
        return vm
    }
}
#endif
