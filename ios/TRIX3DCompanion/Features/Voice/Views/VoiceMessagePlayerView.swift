//
//  VoiceMessagePlayerView.swift
//  TRIX3DCompanion
//
//  Voice message player UI with progress bar and speed control
//

import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Voice Message Player View

/// A view displaying a voice message player with playback controls
struct VoiceMessagePlayerView: View {

    // MARK: - State Objects

    @StateObject private var viewModel: VoicePlayerViewModel
    @Environment(\.colorScheme) var colorScheme

    // MARK: - Properties

    let audioURL: URL
    let audioData: Data?
    let filename: String

    // MARK: - Initialization

    /// Initialize with audio URL
    /// - Parameters:
    ///   - audioURL: URL of the audio file
    ///   - viewModel: Optional view model dependency
    init(
        audioURL: URL,
        viewModel: VoicePlayerViewModel? = nil
    ) {
        self.audioURL = audioURL
        self.audioData = nil
        self.filename = audioURL.lastPathComponent
        self._viewModel = StateObject(wrappedValue: viewModel ?? VoicePlayerViewModel())
    }

    /// Initialize with audio data
    /// - Parameters:
    ///   - audioData: Audio data
    ///   - filename: Filename for the audio
    ///   - viewModel: Optional view model dependency
    init(
        audioData: Data,
        filename: String,
        viewModel: VoicePlayerViewModel? = nil
    ) {
        self.audioURL = URL(fileURLWithPath: "/dev/null")
        self.audioData = audioData
        self.filename = filename
        self._viewModel = StateObject(wrappedValue: viewModel ?? VoicePlayerViewModel())
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 16) {
            // Main controls
            mainControls

            // Progress bar
            progressBar

            // Time labels and speed control
            HStack {
                // Current time
                Text(viewModel.formattedCurrentTime)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.secondary)

                Spacer()

                // Speed button
                speedButton

                // Total time
                Text(viewModel.formattedTotalDuration)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.secondary)
            }

            // Error message
            if let error = viewModel.errorMessage {
                errorMessageView(error)
            }
        }
        .padding(16)
        .glassPanel(cornerRadius: 20)
        .onAppear {
            // Auto-play on appear
            Task {
                if let data = audioData {
                    await viewModel.play(data: data, filename: filename)
                } else {
                    await viewModel.play(url: audioURL)
                }
            }
        }
        .onDisappear {
            // Stop playback on disappear
            Task {
                await viewModel.stop()
            }
        }
    }

    // MARK: - Main Controls

    private var mainControls: some View {
        HStack(spacing: 24) {
            // Skip backward button
            skipBackwardButton

            // Play/Pause button
            playPauseButton

            // Skip forward button
            skipForwardButton

            // Stop button
            stopButton
        }
    }

    // MARK: - Play/Pause Button

    private var playPauseButton: some View {
        Button(action: {
            Task {
                await viewModel.togglePlayPause()
            }
        }) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: viewModel.isPlaying
                                ? [Color.purple.opacity(0.8), Color.pink.opacity(0.6)]
                                : [Color.purple, Color.pink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 64, height: 64)
                    .shadow(color: .purple.opacity(0.3), radius: 8, x: 0, y: 4)

                Image(systemName: viewModel.isPlaying ? "pause.fill" : "play.fill")
                    .font(.title2)
                    .foregroundColor(.white)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(viewModel.isPlaying ? L("voice.pause") : L("voice.play"))
    }

    // MARK: - Skip Buttons

    private var skipBackwardButton: some View {
        Button(action: {
            Task {
                await viewModel.skipBackward()
            }
        }) {
            Image(systemName: "gobackward.15")
                .font(.title3)
                .foregroundColor(.purple)
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L("voice.skip.backward"))
    }

    private var skipForwardButton: some View {
        Button(action: {
            Task {
                await viewModel.skipForward()
            }
        }) {
            Image(systemName: "goforward.15")
                .font(.title3)
                .foregroundColor(.purple)
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L("voice.skip.forward"))
    }

    // MARK: - Stop Button

    private var stopButton: some View {
        Button(action: {
            Task {
                await viewModel.stop()
            }
        }) {
            Image(systemName: "stop.fill")
                .font(.title3)
                .foregroundColor(.red.opacity(0.8))
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial, in: Circle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Progress Bar

    private var progressBar: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background track
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.purple.opacity(0.2))
                    .frame(height: 8)

                // Progress fill
                RoundedRectangle(cornerRadius: 4)
                    .fill(
                        LinearGradient(
                            colors: [Color.purple, Color.pink],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: geometry.size.width * CGFloat(viewModel.progress), height: 8)

                // Drag gesture
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.clear)
                    .frame(height: 8)
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                let newProgress = value.location.x / geometry.size.width
                                Task {
                                    await viewModel.seek(to: max(0, min(1, newProgress)))
                                }
                            }
                    )
            }
        }
        .frame(height: 8)
    }

    // MARK: - Speed Button

    private var speedButton: some View {
        Button(action: {
            viewModel.toggleSpeedSelector()
        }) {
            Text("\(String(format: "%.1f", viewModel.playbackRate))x")
                .font(.system(.caption, design: .rounded).bold())
                .foregroundColor(.purple)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(.purple.opacity(0.1), in: Capsule())
        }
        .buttonStyle(.plain)
        .confirmationDialog(
            L("voice.playback.speed"),
            isPresented: $viewModel.showSpeedSelector,
            titleVisibility: .hidden
        ) {
            ForEach(viewModel.availableRates, id: \.self) { rate in
                Button(rate.displayName) {
                    Task {
                        await viewModel.setPlaybackRate(rate)
                    }
                }
                .fontWeight(viewModel.playbackRate == rate.rawValue ? .bold : .regular)
            }
        }
    }

    // MARK: - Error Message

    private func errorMessageView(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.orange)

            Text(message)
                .font(.caption)
                .foregroundColor(.secondary)

            Button(L("voice.clear")) {
                viewModel.clearError()
            }
            .font(.caption)
            .foregroundColor(.purple)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Compact Voice Player

/// A compact version of the voice player for inline use
struct CompactVoicePlayerView: View {

    // MARK: - State Objects

    @StateObject private var viewModel: VoicePlayerViewModel

    // MARK: - Properties

    let audioURL: URL

    // MARK: - Initialization

    init(audioURL: URL, viewModel: VoicePlayerViewModel? = nil) {
        self.audioURL = audioURL
        self._viewModel = StateObject(wrappedValue: viewModel ?? VoicePlayerViewModel())
    }

    // MARK: - Body

    var body: some View {
        HStack(spacing: 12) {
            // Play/Pause button
            Button(action: {
                Task {
                    if viewModel.isPlaying {
                        await viewModel.pause()
                    } else if viewModel.currentTime > 0 {
                        await viewModel.togglePlayPause()
                    } else {
                        await viewModel.play(url: audioURL)
                    }
                }
            }) {
                ZStack {
                    Circle()
                        .fill(Color.purple)
                        .frame(width: 44, height: 44)

                    Image(systemName: viewModel.isPlaying ? "pause.fill" : "play.fill")
                        .font(.body)
                        .foregroundColor(.white)
                }
            }
            .buttonStyle(.plain)

            // Progress and time
            VStack(alignment: .leading, spacing: 4) {
                // Progress bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.purple.opacity(0.2))
                            .frame(height: 4)

                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.purple)
                            .frame(width: geometry.size.width * CGFloat(viewModel.progress), height: 4)
                    }
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                let newProgress = value.location.x / geometry.size.width
                                Task {
                                    await viewModel.seek(to: max(0, min(1, newProgress)))
                                }
                            }
                    )
                }
                .frame(height: 4)

                // Time labels
                HStack {
                    Text(viewModel.formattedCurrentTime)
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundColor(.secondary)

                    Text("/")
                        .font(.system(.caption2))
                        .foregroundColor(.secondary)

                    Text(viewModel.formattedTotalDuration)
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            }

            // Speed control
            Menu {
                ForEach(viewModel.availableRates, id: \.self) { rate in
                    Button(rate.displayName) {
                        Task {
                            await viewModel.setPlaybackRate(rate)
                        }
                    }
                }
            } label: {
                Text("\(String(format: "%.1f", viewModel.playbackRate))x")
                    .font(.system(.caption2, design: .rounded).bold())
                    .foregroundColor(.purple)
            }
        }
        .padding(12)
        .glassPanel(cornerRadius: 12, padding: 8)
    }
}

// MARK: - Preview

#Preview("Voice Message Player") {
    VStack(spacing: 24) {
        VoiceMessagePlayerView(
            audioURL: URL(fileURLWithPath: "/tmp/audio.m4a")
        )

        VoiceMessagePlayerView(
            audioURL: URL(fileURLWithPath: "/tmp/audio2.m4a")
        )
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
        LinearGradient(
            colors: [.purple.opacity(0.2), .pink.opacity(0.2)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}

#Preview("Compact Voice Player") {
    VStack(spacing: 16) {
        CompactVoicePlayerView(audioURL: URL(fileURLWithPath: "/tmp/audio.m4a"))

        CompactVoicePlayerView(audioURL: URL(fileURLWithPath: "/tmp/audio2.m4a"))

        CompactVoicePlayerView(audioURL: URL(fileURLWithPath: "/tmp/audio3.m4a"))
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(.systemGroupedBackground))
}

#Preview("Dark Mode") {
    VStack(spacing: 24) {
        VoiceMessagePlayerView(
            audioURL: URL(fileURLWithPath: "/tmp/audio.m4a")
        )

        CompactVoicePlayerView(
            audioURL: URL(fileURLWithPath: "/tmp/audio2.m4a")
        )
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black)
    .preferredColorScheme(.dark)
}
