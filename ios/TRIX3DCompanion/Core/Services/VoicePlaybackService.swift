//
//  VoicePlaybackService.swift
//  TRIX3DCompanion
//
//  Voice message playback service using AVAudioPlayer
//

import Foundation
@preconcurrency import AVFoundation
import Combine

/// Voice message playback service
@MainActor
final class VoicePlaybackService: NSObject, VoicePlaybackServiceProtocol {

    // MARK: - Singleton

    static let shared = VoicePlaybackService()

    // MARK: - Published Properties

    @Published private(set) var isPlaying: Bool = false
    @Published private(set) var currentTime: TimeInterval = 0
    @Published private(set) var duration: TimeInterval = 0
    @Published private(set) var playbackRate: Float = 1.0

    // MARK: - Publishers

    var playbackStatePublisher: AnyPublisher<PlaybackState, Never> {
        playbackStateSubject.eraseToAnyPublisher()
    }

    var progressPublisher: AnyPublisher<PlaybackProgress, Never> {
        progressSubject.eraseToAnyPublisher()
    }

    // MARK: - Properties

    private var audioPlayer: AVAudioPlayer?
    private var progressTimer: Timer?
    private var currentURL: URL?

    // State
    private let playbackStateSubject = PassthroughSubject<PlaybackState, Never>()
    private let progressSubject = PassthroughSubject<PlaybackProgress, Never>()

    // Cancellables
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private override init() {
        super.init()
        setupAudioSession()
        setupObservers()
    }

    // MARK: - VoicePlaybackServiceProtocol

    /// Play audio from URL
    func play(url: URL) async throws {
        try await AudioSessionManager.shared.configureForPlayback()

        updateState(.loading)

        guard FileManager.default.fileExists(atPath: url.path) else {
            updateState(.error(VoicePlaybackError.audioNotFound.localizedDescription))
            throw VoicePlaybackError.audioNotFound
        }

        do {
            audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer?.delegate = self
            audioPlayer?.rate = playbackRate
            audioPlayer?.prepareToPlay()

            currentURL = url
            duration = audioPlayer?.duration ?? 0
            currentTime = 0

            audioPlayer?.play()
            isPlaying = true
            updateState(.playing)
            startProgressTimer()

        } catch {
            updateState(.error(error.localizedDescription))
            throw VoicePlaybackError.playbackFailed(error)
        }
    }

    /// Play audio from data
    func play(data: Data, filename: String) async throws {
        try await AudioSessionManager.shared.configureForPlayback()

        updateState(.loading)

        do {
            audioPlayer = try AVAudioPlayer(data: data)
            audioPlayer?.delegate = self
            audioPlayer?.rate = playbackRate
            audioPlayer?.prepareToPlay()

            currentURL = nil
            duration = audioPlayer?.duration ?? 0
            currentTime = 0

            audioPlayer?.play()
            isPlaying = true
            updateState(.playing)
            startProgressTimer()

        } catch {
            updateState(.error(error.localizedDescription))
            throw VoicePlaybackError.playbackFailed(error)
        }
    }

    /// Pause playback
    func pause() async {
        guard isPlaying, let player = audioPlayer else { return }

        player.pause()
        isPlaying = false
        stopProgressTimer()
        updateState(.paused)
    }

    /// Stop playback
    func stop() async {
        guard audioPlayer != nil else { return }

        audioPlayer?.stop()
        audioPlayer = nil
        isPlaying = false
        currentTime = 0
        stopProgressTimer()
        updateState(.idle)
    }

    /// Seek to a specific time
    func seek(to time: TimeInterval) async {
        guard let player = audioPlayer else { return }

        let clampedTime = max(0, min(time, duration))
        player.currentTime = clampedTime
        currentTime = clampedTime

        emitProgress()
    }

    /// Set playback rate
    func setPlaybackRate(_ rate: Float) async {
        playbackRate = rate
        audioPlayer?.rate = rate
    }

    // MARK: - Private Methods

    private func setupAudioSession() {
        // Audio session setup is handled by AudioSessionManager
    }

    private func setupObservers() {
        // Setup any observers if needed
    }

    private func startProgressTimer() {
        stopProgressTimer()

        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.updateProgress()
            }
        }
    }

    private func stopProgressTimer() {
        progressTimer?.invalidate()
        progressTimer = nil
    }

    private func updateProgress() {
        guard let player = audioPlayer else { return }

        currentTime = player.currentTime
        emitProgress()
    }

    private func emitProgress() {
        let progress = PlaybackProgress(currentTime: currentTime, duration: duration)
        progressSubject.send(progress)
    }

    private func updateState(_ state: PlaybackState) {
        playbackStateSubject.send(state)
    }

    // MARK: - Public Convenience Methods

    /// Toggle play/pause
    func togglePlayPause() async {
        if isPlaying {
            await pause()
        } else {
            // Resume if we have a player
            if audioPlayer != nil && currentTime > 0 {
                audioPlayer?.play()
                isPlaying = true
                updateState(.playing)
                startProgressTimer()
            }
        }
    }

    /// Skip forward by specified seconds
    func skipForward(_ seconds: TimeInterval = 5.0) async {
        let newTime = currentTime + seconds
        await seek(to: newTime)
    }

    /// Skip backward by specified seconds
    func skipBackward(_ seconds: TimeInterval = 5.0) async {
        let newTime = currentTime - seconds
        await seek(to: newTime)
    }

    /// Get formatted time string (mm:ss)
    func getFormattedTime(_ time: TimeInterval) -> String {
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    /// Get current progress formatted string
    var currentTimeString: String {
        return getFormattedTime(currentTime)
    }

    /// Get duration formatted string
    var durationString: String {
        return getFormattedTime(duration)
    }
}

// MARK: - AVAudioPlayerDelegate

@MainActor
extension VoicePlaybackService: @preconcurrency AVAudioPlayerDelegate {

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        isPlaying = false
        stopProgressTimer()
        currentTime = duration
        emitProgress()

        if flag {
            updateState(.finished)
        } else {
            updateState(.error("Playback finished with error"))
        }
    }

    nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        Task { @MainActor in
            isPlaying = false
            stopProgressTimer()
            updateState(.error(error?.localizedDescription ?? "Decode error"))
        }
    }
}
