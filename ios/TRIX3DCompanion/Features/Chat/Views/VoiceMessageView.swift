//
//  VoiceMessageView.swift
//  TRIX3DCompanion
//
//  Created by TRIX 3D Companion Team
//

import SwiftUI
import AVFoundation
import Combine

// MARK: - Voice Message ViewModel

/// ViewModel managing voice message playback
@MainActor
class VoiceMessageViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var isPlaying: Bool = false
    @Published var isPaused: Bool = false
    @Published var playbackProgress: Double = 0
    @Published var currentTime: TimeInterval = 0
    @Published var totalDuration: TimeInterval
    @Published var waveformSamples: [Float] = []
    @Published var errorMessage: String?

    // MARK: - Properties

    let audioURL: URL
    private var audioPlayer: AVAudioPlayer?
    private var progressTimer: Timer?
    private var progressUpdateInterval: TimeInterval = 0.1

    // MARK: - Computed Properties

    var formattedCurrentTime: String {
        currentTime.formattedDuration
    }

    var formattedTotalDuration: String {
        totalDuration.formattedDuration
    }

    var progress: Double {
        guard totalDuration > 0 else { return 0 }
        return currentTime / totalDuration
    }

    // MARK: - Initialization

    init(audioURL: URL, duration: TimeInterval = 0) {
        self.audioURL = audioURL
        self.totalDuration = duration

        // Generate default waveform samples
        self.waveformSamples = Self.generateDefaultWaveform()
    }

    // MARK: - Playback Operations

    /// Toggles between play and pause states
    func togglePlayback() async {
        if isPlaying {
            pausePlayback()
        } else {
            await startPlayback()
        }
    }

    /// Starts audio playback
    func startPlayback() async {
        // Create player if needed
        if audioPlayer == nil {
            do {
                audioPlayer = try AVAudioPlayer.player(from: audioURL)
                audioPlayer?.delegate = self

                // Update duration if not set
                if totalDuration == 0, let duration = audioPlayer?.duration {
                    totalDuration = duration
                }

                // Generate waveform from actual audio
                await generateWaveform()

            } catch {
                errorMessage = "无法播放音频: \(error.localizedDescription)"
                return
            }
        }

        // Resume from pause or start fresh
        if isPaused {
            audioPlayer?.play()
            isPaused = false
        } else {
            audioPlayer?.play()
        }

        isPlaying = true
        startProgressTimer()
    }

    /// Pauses audio playback
    func pausePlayback() {
        audioPlayer?.pause()
        isPlaying = false
        isPaused = true
        stopProgressTimer()
    }

    /// Stops audio playback and resets to beginning
    func stopPlayback() async {
        audioPlayer?.stop()
        audioPlayer = nil
        isPlaying = false
        isPaused = false
        currentTime = 0
        playbackProgress = 0
        stopProgressTimer()
    }

    /// Seeks to a specific time in the audio
    func seek(to time: TimeInterval) {
        audioPlayer?.currentTime = time
        updateCurrentTime(time)
    }

    /// Seeks to a specific progress position
    func seek(to progress: Double) {
        let time = totalDuration * progress
        seek(to: time)
    }

    // MARK: - Timer Management

    private func startProgressTimer() {
        stopProgressTimer() // Ensure no duplicate timers

        progressTimer = Timer.scheduledTimer(
            withTimeInterval: progressUpdateInterval,
            repeats: true
        ) { [weak self] _ in
            Task { @MainActor in
                self?.updateProgress()
            }
        }
    }

    private func stopProgressTimer() {
        progressTimer?.invalidate()
        progressTimer = nil
    }

    private func updateProgress() {
        guard let player = audioPlayer, isPlaying else { return }

        let current = player.currentTime
        updateCurrentTime(current)
    }

    func updateCurrentTime(_ time: TimeInterval) {
        currentTime = time
        playbackProgress = progress
    }

    // MARK: - Waveform Generation

    /// Generates waveform samples from audio file
    private func generateWaveform() async {
        // For simplicity, generate default waveform
        // In a production app, you would analyze the audio data
        waveformSamples = Self.generateDefaultWaveform()
    }

    /// Generates default random waveform samples
    static func generateDefaultWaveform(count: Int = 50) -> [Float] {
        (0..<count).map { _ in
            Float.random(in: 0.2...1.0)
        }
    }

    // MARK: - Cleanup

    deinit {
        stopProgressTimer()
        audioPlayer?.stop()
    }
}

// MARK: - AVAudioPlayerDelegate

extension VoiceMessageViewModel: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(
        _ player: AVAudioPlayer,
        successfully flag: Bool
    ) {
        Task { @MainActor in
            if flag {
                // Playback completed successfully
                isPlaying = false
                isPaused = false
                currentTime = 0
                playbackProgress = 0
                stopProgressTimer()
            }
        }
    }

    nonisolated func audioPlayerDecodeErrorDidOccur(
        _ player: AVAudioPlayer,
        error: Error?
    ) {
        Task { @MainActor in
            isPlaying = false
            isPaused = false
            stopProgressTimer()
            if let error = error {
                errorMessage = "播放错误: \(error.localizedDescription)"
            }
        }
    }
}

// MARK: - Voice Message View

/// A view displaying a voice message with playback controls
struct VoiceMessageView: View {

    // MARK: - Properties

    @StateObject private var viewModel: VoiceMessageViewModel
    @Environment(\.colorScheme) var colorScheme

    let isIncoming: Bool

    // MARK: - Computed Properties

    private var bubbleColor: Color {
        isIncoming
            ? Color(.systemBackground)
            : Color.purple
    }

    private var textColor: Color {
        isIncoming
            ? Color.primary
            : Color.white
    }

    private var waveformColor: Color {
        isIncoming
            ? Color.purple
            : Color.white
    }

    // MARK: - Initialization

    init(audioURL: URL, duration: TimeInterval = 0, isIncoming: Bool = true) {
        self._viewModel = StateObject(
            wrappedValue: VoiceMessageViewModel(audioURL: audioURL, duration: duration)
        )
        self.isIncoming = isIncoming
    }

    // MARK: - Body

    var body: some View {
        HStack(spacing: 12) {
            // Play/Pause button
            playPauseButton

            // Waveform and info
            VStack(alignment: .leading, spacing: 6) {
                // Waveform visualization
                waveformView

                // Progress and time
                HStack {
                    progressView

                    Spacer()

                    Text(viewModel.formattedTotalDuration)
                        .font(.caption2)
                        .foregroundColor(textColor.opacity(0.8))
                        .monospacedDigit()
                }
            }

            // Error message
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(bubbleColor)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    // MARK: - Play/Pause Button

    private var playPauseButton: some View {
        Button(action: {
            Task {
                await viewModel.togglePlayback()
            }
        }) {
            ZStack {
                Circle()
                    .fill(isIncoming ? Color.purple : Color.white.opacity(0.2))
                    .frame(width: 44, height: 44)

                Image(systemName: viewModel.isPlaying ? "pause.fill" : "play.fill")
                    .font(.title3)
                    .foregroundColor(isIncoming ? .white : .white)
            }
        }
    }

    // MARK: - Waveform View

    private var waveformView: some View {
        GeometryReader { geometry in
            HStack(spacing: 2) {
                ForEach(Array(viewModel.waveformSamples.enumerated()), id: \.offset) { index, amplitude in
                    WaveformBar(
                        amplitude: amplitude,
                        progress: viewModel.playbackProgress,
                        index: index,
                        totalBars: viewModel.waveformSamples.count
                    )
                }
            }
            .frame(height: 30)
        }
        .frame(height: 30)
    }

    // MARK: - Progress View

    private var progressView: some View {
        Text(viewModel.formattedCurrentTime)
            .font(.caption2)
            .foregroundColor(textColor.opacity(0.8))
            .monospacedDigit()
    }
}

// MARK: - Waveform Bar

/// A single bar in the waveform visualization
struct WaveformBar: View {
    let amplitude: Float
    let progress: Double
    let index: Int
    let totalBars: Int

    private var barProgress: Double {
        Double(index) / Double(totalBars)
    }

    private var isPlayed: Bool {
        barProgress <= progress
    }

    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(
                isPlayed
                    ? Color.white
                    : Color.white.opacity(0.3)
            )
            .frame(
                width: 3,
                height: CGFloat(amplitude) * 30
            )
            .animation(.linear(duration: 0.1), value: isPlayed)
    }
}

// MARK: - Voice Message Bubble

/// A complete voice message bubble with proper alignment
struct VoiceMessageBubble: View {
    let audioURL: URL
    let duration: TimeInterval
    let isIncoming: Bool

    var body: some View {
        HStack {
            if isIncoming {
                VoiceMessageView(
                    audioURL: audioURL,
                    duration: duration,
                    isIncoming: true
                )
            } else {
                Spacer()
                VoiceMessageView(
                    audioURL: audioURL,
                    duration: duration,
                    isIncoming: false
                )
            }
        }
    }
}

// MARK: - Preview

#Preview("Incoming Voice Message") {
    VStack(alignment: .leading, spacing: 12) {
        VoiceMessageBubble(
            audioURL: URL(fileURLWithPath: "/tmp/audio.m4a"),
            duration: 15,
            isIncoming: true
        )

        VoiceMessageBubble(
            audioURL: URL(fileURLWithPath: "/tmp/audio2.m4a"),
            duration: 45,
            isIncoming: true
        )

        VoiceMessageBubble(
            audioURL: URL(fileURLWithPath: "/tmp/audio3.m4a"),
            duration: 5,
            isIncoming: true
        )
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}

#Preview("Outgoing Voice Message") {
    VStack(alignment: .trailing, spacing: 12) {
        VoiceMessageBubble(
            audioURL: URL(fileURLWithPath: "/tmp/audio.m4a"),
            duration: 20,
            isIncoming: false
        )

        VoiceMessageBubble(
            audioURL: URL(fileURLWithPath: "/tmp/audio2.m4a"),
            duration: 60,
            isIncoming: false
        )

        VoiceMessageBubble(
            audioURL: URL(fileURLWithPath: "/tmp/audio3.m4a"),
            duration: 10,
            isIncoming: false
        )
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}

#Preview("Mixed Messages") {
    VStack(alignment: .leading, spacing: 12) {
        VoiceMessageBubble(
            audioURL: URL(fileURLWithPath: "/tmp/in1.m4a"),
            duration: 15,
            isIncoming: true
        )

        VoiceMessageBubble(
            audioURL: URL(fileURLWithPath: "/tmp/out1.m4a"),
            duration: 25,
            isIncoming: false
        )

        VoiceMessageBubble(
            audioURL: URL(fileURLWithPath: "/tmp/in2.m4a"),
            duration: 8,
            isIncoming: true
        )

        VoiceMessageBubble(
            audioURL: URL(fileURLWithPath: "/tmp/out2.m4a"),
            duration: 42,
            isIncoming: false
        )
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}

#Preview("Waveform Bars") {
    HStack(spacing: 2) {
        ForEach(0..<30) { index in
            WaveformBar(
                amplitude: Float.random(in: 0.3...1.0),
                progress: 0.5,
                index: index,
                totalBars: 30
            )
        }
    }
    .padding()
    .background(Color.purple)
}
