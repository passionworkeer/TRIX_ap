//
//  VoicePlayerViewModel.swift
//  TRIX3DCompanion
//
//  Voice message player ViewModel - manages audio playback state and controls
//

import Foundation
import AVFoundation
import Combine

// MARK: - Voice Player ViewModel

/// ViewModel managing voice message playback with progress tracking
@MainActor
final class VoicePlayerViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Current playback state
    @Published var playbackState: PlaybackState = .idle

    /// Whether audio is currently playing
    @Published var isPlaying: Bool = false

    /// Current playback time in seconds
    @Published var currentTime: TimeInterval = 0

    /// Total duration of the audio
    @Published var totalDuration: TimeInterval = 0

    /// Current playback rate
    @Published var playbackRate: Float = 1.0

    /// Playback progress (0.0 - 1.0)
    @Published var progress: Double = 0

    /// Error message to display
    @Published var errorMessage: String?

    /// Whether to show speed selector
    @Published var showSpeedSelector: Bool = false

    // MARK: - Dependencies

    private let playbackService: VoicePlaybackServiceProtocol
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Computed Properties

    /// Formatted current time string (mm:ss)
    var formattedCurrentTime: String {
        currentTime.formattedDuration
    }

    /// Formatted total duration string (mm:ss)
    var formattedTotalDuration: String {
        totalDuration.formattedDuration
    }

    /// Available playback rates
    var availableRates: [PlaybackRate] {
        PlaybackRate.allCases
    }

    // MARK: - Initialization

    /// Initialize VoicePlayerViewModel
    /// - Parameter playbackService: Voice playback service dependency
    init(
        playbackService: VoicePlaybackServiceProtocol? = nil
    ) {
        self.playbackService = playbackService ?? VoicePlaybackService.shared

        // Setup bindings
        setupBindings()
    }

    // MARK: - Setup

    /// Setup Combine bindings
    private func setupBindings() {
        // Bind to playback state
        playbackService.playbackStatePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.playbackState = state
                self?.updatePlayingState(from: state)
            }
            .store(in: &cancellables)

        // Bind to progress updates
        playbackService.progressPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] progressInfo in
                self?.currentTime = progressInfo.currentTime
                self?.totalDuration = progressInfo.duration
                self?.progress = progressInfo.progress
            }
            .store(in: &cancellables)
    }

    /// Update playing state based on playback state
    private func updatePlayingState(from state: PlaybackState) {
        switch state {
        case .playing:
            isPlaying = true
            errorMessage = nil
        case .paused, .idle, .finished:
            isPlaying = false
        case .error(let message):
            isPlaying = false
            errorMessage = message
        default:
            break
        }
    }

    // MARK: - Playback Controls

    /// Toggle play/pause
    func togglePlayPause() async {
        await playbackService.togglePlayPause()
    }

    /// Play audio from URL
    /// - Parameter url: Audio file URL
    func play(url: URL) async {
        do {
            errorMessage = nil
            try await playbackService.play(url: url)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Play audio from data
    /// - Parameters:
    ///   - data: Audio data
    ///   - filename: Filename for the audio
    func play(data: Data, filename: String) async {
        do {
            errorMessage = nil
            try await playbackService.play(data: data, filename: filename)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Pause playback
    func pause() async {
        await playbackService.pause()
    }

    /// Stop playback
    func stop() async {
        await playbackService.stop()
        // Reset local state
        currentTime = 0
        progress = 0
        errorMessage = nil
    }

    /// Seek to specific time
    /// - Parameter time: Time in seconds
    func seek(to time: TimeInterval) async {
        await playbackService.seek(to: time)
    }

    /// Seek to specific progress position
    /// - Parameter progress: Progress value (0.0 - 1.0)
    func seekToProgress(_ progress: Double) async {
        guard totalDuration > 0 else { return }

        let clampedProgress = max(0, min(1, progress))
        let time = totalDuration * clampedProgress
        await seek(to: time)
    }

    // MARK: - Speed Control

    /// Set playback rate
    /// - Parameter rate: Playback rate value
    func setPlaybackRate(_ rate: Float) async {
        await playbackService.setPlaybackRate(rate)
        playbackRate = rate
        showSpeedSelector = false
    }

    /// Set playback rate from enum
    /// - Parameter rateOption: PlaybackRate enum value
    func setPlaybackRate(_ rateOption: PlaybackRate) async {
        await setPlaybackRate(rateOption.rawValue)
    }

    // MARK: - Navigation Controls

    /// Skip forward by specified seconds
    /// - Parameter seconds: Seconds to skip (default: 5)
    func skipForward(_ seconds: TimeInterval = 5.0) async {
        let newTime = min(currentTime + seconds, totalDuration)
        await seek(to: newTime)
    }

    /// Skip backward by specified seconds
    /// - Parameter seconds: Seconds to skip back (default: 5)
    func skipBackward(_ seconds: TimeInterval = 5.0) async {
        let newTime = max(currentTime - seconds, 0)
        await seek(to: newTime)
    }

    // MARK: - Utility Methods

    /// Clear error message
    func clearError() {
        errorMessage = nil
    }

    /// Toggle speed selector visibility
    func toggleSpeedSelector() {
        showSpeedSelector.toggle()
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension VoicePlayerViewModel {
    /// Create preview view model with sample state
    static var preview: VoicePlayerViewModel {
        let vm = VoicePlayerViewModel()
        vm.totalDuration = 120.0
        vm.currentTime = 45.0
        vm.progress = 0.375
        vm.playbackRate = 1.0
        vm.isPlaying = false
        return vm
    }

    /// Create preview view model with playing state
    static var previewPlaying: VoicePlayerViewModel {
        let vm = VoicePlayerViewModel()
        vm.totalDuration = 180.0
        vm.currentTime = 60.0
        vm.progress = 0.333
        vm.playbackRate = 1.5
        vm.isPlaying = true
        return vm
    }
}
#endif
