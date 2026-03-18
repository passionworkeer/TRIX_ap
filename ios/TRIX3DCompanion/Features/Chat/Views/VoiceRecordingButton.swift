//
//  VoiceRecordingButton.swift
//  TRIX3DCompanion
//
//  Created by TRIX 3D Companion Team
//

import SwiftUI
import AVFoundation
import UIKit
import ActivityIndicatorView

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Recording State

/// The current state of voice recording
enum VoiceRecordingState {
    case idle
    case preparing
    case recording(progress: Double)
    case cancelling
    case finished(URL)

    var isRecording: Bool {
        if case .recording = self {
            return true
        }
        return false
    }
}

// MARK: - Voice Recording ViewModel

/// ViewModel managing voice recording state and operations
@MainActor
class VoiceRecordingViewModel: NSObject, ObservableObject {

    // MARK: - Published Properties

    @Published var recordingState: VoiceRecordingState = .idle
    @Published var recordingDuration: TimeInterval = 0
    @Published var hasPermission: Bool = false
    @Published var errorMessage: String?

    // MARK: - Constants

    static let maximumRecordingDuration: TimeInterval = 60.0
    private static let recordingDirectory = "temp_recordings"

    // MARK: - Private Properties

    private var audioRecorder: AVAudioRecorder?
    private var recordingTimer: Timer?
    private var startTime: Date?

    // MARK: - Computed Properties

    var isRecording: Bool {
        recordingState.isRecording
    }

    var canRecord: Bool {
        hasPermission && !isRecording
    }

    var progress: Double {
        guard recordingDuration > 0 else { return 0 }
        return min(recordingDuration / Self.maximumRecordingDuration, 1.0)
    }

    var formattedDuration: String {
        recordingDuration.formattedDuration
    }

    var tempRecordingURL: URL {
        let filename = "recording_\(UUID().uuidString).m4a"
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        let tempDirectory = paths[0].appendingPathComponent(Self.recordingDirectory)

        // Create directory if it doesn't exist
        try? FileManager.default.createDirectory(
            at: tempDirectory,
            withIntermediateDirectories: true
        )

        return tempDirectory.appendingPathComponent(filename)
    }

    // MARK: - Initialization

    override init() {
        super.init()
        Task {
            await checkPermissionStatus()
        }
    }

    // MARK: - Permission Management

    /// Checks current microphone permission status
    func checkPermissionStatus() async {
        let status = AVAudioSession.sharedInstance().recordPermission

        switch status {
        case .granted:
            hasPermission = true
        case .denied, .undetermined:
            hasPermission = false
        @unknown default:
            hasPermission = false
        }
    }

    /// Requests microphone permission from the user
    func requestMicrophonePermission() async {
        do {
            let granted = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Bool, Error>) in
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            }
            hasPermission = granted

            if !granted {
                errorMessage = L("voice.permission.denied")
            }
        } catch {
            errorMessage = L("voice.permission.failed").replacingOccurrences(of: "%@", with: error.localizedDescription)
            hasPermission = false
        }
    }

    // MARK: - Recording Operations

    /// Starts recording audio
    func startRecording() async {
        guard !isRecording else { return }

        // Check permission first
        guard hasPermission else {
            await requestMicrophonePermission()
            guard hasPermission else {
                errorMessage = L("voice.need.permission")
                return
            }
            return
        }

        recordingState = .preparing

        do {
            // Configure audio session
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(
                .record,
                mode: .default,
                options: .defaultToSpeaker
            )
            try session.setActive(true)

            // Create recorder
            let url = tempRecordingURL
            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44100.0,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue
            ]

            audioRecorder = try AVAudioRecorder(url: url, settings: settings)
            audioRecorder?.delegate = self

            guard let recorder = audioRecorder else {
                throw RecordingError.recorderCreationFailed
            }

            // Start recording
            startTime = Date()
            recordingDuration = 0
            recorder.record()

            recordingState = .recording(progress: 0)

            // Start timer
            startTimer()

        } catch {
            errorMessage = L("voice.recording.failed")
            recordingState = .idle
            SecureLogger.shared.error("Recording error: \(error)")
        }
    }

    /// Stops the current recording
    func stopRecording() async -> URL? {
        guard isRecording else { return nil }

        audioRecorder?.stop()
        stopTimer()

        // Deactivate audio session
        try? AVAudioSession.sharedInstance().setActive(false)

        if let url = audioRecorder?.url {
            recordingState = .finished(url)

            // Clean up old recordings
            cleanupOldRecordings()

            return url
        }

        recordingState = .idle
        return nil
    }

    /// Cancels the current recording and deletes the file
    func cancelRecording() async {
        guard isRecording else { return }

        recordingState = .cancelling

        audioRecorder?.stop()
        audioRecorder = nil
        stopTimer()

        // Delete temporary file
        if let url = audioRecorder?.url {
            try? FileManager.default.removeItem(at: url)
        }

        // Deactivate audio session
        try? AVAudioSession.sharedInstance().setActive(false)

        recordingState = .idle
        recordingDuration = 0
    }

    /// Formats duration at a specific time
    func formattedDuration(at time: TimeInterval) -> String {
        time.formattedDuration
    }

    // MARK: - Timer Management

    private func startTimer() {
        recordingTimer = Timer.scheduledTimer(
            withTimeInterval: 0.1,
            repeats: true
        ) { [weak self] _ in
            Task { @MainActor in
                self?.updateDuration()
            }
        }
    }

    private func stopTimer() {
        recordingTimer?.invalidate()
        recordingTimer = nil
        startTime = nil
    }

    private func updateDuration() {
        guard let start = startTime else { return }

        let elapsed = Date().timeIntervalSince(start)
        recordingDuration = elapsed

        // Update progress
        if case .recording = recordingState {
            let progress = min(elapsed / Self.maximumRecordingDuration, 1.0)
            recordingState = .recording(progress: progress)
        }

        // Auto-stop at maximum duration
        if elapsed >= Self.maximumRecordingDuration {
            Task {
                _ = await stopRecording()
            }
        }
    }

    // MARK: - File Management

    /// Cleans up old temporary recording files
    private func cleanupOldRecordings() {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        guard let tempDirectory = paths.first?.appendingPathComponent(Self.recordingDirectory) else {
            return
        }

        // Remove files older than 1 hour
        let expirationDate = Date().addingTimeInterval(-3600)

        guard let enumerator = FileManager.default.enumerator(
            at: tempDirectory,
            includingPropertiesForKeys: [.contentModificationDateKey]
        ) else {
            return
        }

        for case let url as URL in enumerator {
            do {
                let values = try url.resourceValues(forKeys: [.contentModificationDateKey])
                if let modificationDate = values.contentModificationDate,
                   modificationDate < expirationDate {
                    try FileManager.default.removeItem(at: url)
                }
            } catch {
                SecureLogger.shared.error("Error cleaning up recording: \(error)")
            }
        }
    }

    /// Cleans up all temporary recordings
    static func cleanupAllRecordings() {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        guard let tempDirectory = paths.first?.appendingPathComponent(recordingDirectory) else {
            return
        }

        try? FileManager.default.removeItem(at: tempDirectory)
    }
}

// MARK: - AVAudioRecorderDelegate

extension VoiceRecordingViewModel: AVAudioRecorderDelegate {
    nonisolated func audioRecorderDidFinishRecording(
        _ recorder: AVAudioRecorder,
        successfully flag: Bool
    ) {
        Task { @MainActor in
            if !flag {
                errorMessage = L("voice.recording.failed")
                recordingState = .idle
            }
        }
    }

    nonisolated func audioRecorderEncodeErrorDidOccur(
        _ recorder: AVAudioRecorder,
        error: Error?
    ) {
        Task { @MainActor in
            if let error = error {
                errorMessage = L("voice.encode.error").replacingOccurrences(of: "%@", with: error.localizedDescription)
            }
            recordingState = .idle
        }
    }
}

// MARK: - Recording Error

enum RecordingError: LocalizedError {
    case recorderCreationFailed
    case permissionDenied
    case invalidOutputURL
    case recordingFailed(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .recorderCreationFailed:
            return L("voice.error.recorder.create")
        case .permissionDenied:
            return L("voice.error.permission.denied")
        case .invalidOutputURL:
            return L("voice.error.invalid.url")
        case .recordingFailed(let error):
            return L("voice.error.recording.failed").replacingOccurrences(of: "%@", with: error.localizedDescription)
        }
    }
}

// MARK: - Voice Recording Button View

/// A button for recording voice messages with long press and cancel gestures
struct VoiceRecordingButton: View {

    // MARK: - Properties

    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = VoiceRecordingViewModel()
    @State private var dragOffset: CGFloat = 0
    @State private var isDragging = false
    @State private var hasAutoStarted = false

    let onRecordingComplete: (URL) -> Void
    let onCancelled: (() -> Void)?

    // MARK: - Initialization

    init(
        onRecordingComplete: @escaping (URL) -> Void,
        onCancelled: (() -> Void)? = nil
    ) {
        self.onRecordingComplete = onRecordingComplete
        self.onCancelled = onCancelled
    }

    // MARK: - Body

    var body: some View {
        recordingOverlay
            .task {
                await autoStartRecordingIfNeeded()
            }
    }

    private func autoStartRecordingIfNeeded() async {
        guard !hasAutoStarted else { return }
        hasAutoStarted = true
        await viewModel.startRecording()
    }

    private func closeRecorder() async {
        if viewModel.isRecording {
            await viewModel.cancelRecording()
        }
        onCancelled?()
        dismiss()
    }

    private func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            return
        }
        UIApplication.shared.open(url)
    }

    // MARK: - Recording Overlay

    private var recordingOverlay: some View {
        ZStack {
            // Background
            Color.black.opacity(0.7)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                HStack {
                    Spacer()
                    Button {
                        Task { await closeRecorder() }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(.white.opacity(0.9))
                    }
                }
                .padding(.top, 18)
                .padding(.horizontal, 18)

                Spacer()

                // Recording indicator
                recordingIndicator
                    .offset(y: -dragOffset * 0.5)

                // Instructions
                recordingInstructions

                // Cancel area indicator
                if isDragging && dragOffset < -50 {
                    cancelIndicator
                }

                Spacer()

                // Recording button
                recordingButton
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                handleDragChanged(value)
                            }
                            .onEnded { value in
                                Task {
                                    await handleDragEnded(value)
                                }
                            }
                    )
                    .padding(.bottom, 40)
            }
        }
        .transition(.opacity)
    }

    // MARK: - Recording Indicator

    private var recordingIndicator: some View {
        VStack(spacing: 16) {
            // Pulsing circle
            ZStack {
                if viewModel.isRecording {
                    Circle()
                        .fill(Color.error.opacity(0.3))
                        .frame(width: 100, height: 100)
                        .scaleEffect(1.5)
                        .animation(
                            .easeInOut(duration: 1.0)
                            .repeatForever(autoreverses: true),
                            value: viewModel.isRecording
                        )

                    Circle()
                        .fill(Color.red)
                        .frame(width: 60, height: 60)

                    Image(systemName: "mic.fill")
                        .font(.title)
                        .foregroundColor(.white)
                } else {
                    Circle()
                        .fill(Color.warning.opacity(0.25))
                        .frame(width: 80, height: 80)

                    ActivityIndicatorView(
                        isVisible: .constant(true),
                        type: .growingCircle
                    )
                    .tint(.white)
                }
            }

            // Duration
            Text(viewModel.isRecording ? viewModel.formattedDuration : L("voice.duration.default"))
                .font(.system(.title, design: .rounded))
                .fontWeight(.semibold)
                .foregroundColor(.white)
                .monospacedDigit()
        }
    }

    // MARK: - Recording Instructions

    private var recordingInstructions: some View {
        VStack(spacing: 8) {
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.subheadline)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            } else if viewModel.isRecording {
                Text(L("voice.instruction.release.send"))
                    .font(.subheadline)
                    .foregroundColor(.white)
            } else {
                Text(L("voice.preparing"))
                    .font(.subheadline)
                    .foregroundColor(.white)
            }

            if !viewModel.isRecording {
                Text(L("voice.can.retry"))
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.8))
            }

            if viewModel.isRecording && dragOffset < -30 {
                Text(L("voice.release.cancel"))
                    .font(.subheadline)
                    .foregroundColor(.red)
                    .transition(.opacity)
            }

            if !viewModel.hasPermission {
                Button(L("voice.settings")) {
                    openAppSettings()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .animation(.easeInOut, value: dragOffset)
        .animation(.easeInOut, value: viewModel.isRecording)
    }

    // MARK: - Cancel Indicator

    private var cancelIndicator: some View {
        Text(L("voice.cancel"))
            .font(.headline)
            .foregroundColor(.white)
            .padding(.horizontal, 24)
            .padding(.vertical, 12)
            .background(
                Capsule()
                    .fill(Color.red)
            )
            .transition(.scale.combined(with: .opacity))
    }

    // MARK: - Recording Button

    private var recordingButton: some View {
        Button {
            Task {
                if viewModel.isRecording {
                    if let url = await viewModel.stopRecording() {
                        onRecordingComplete(url)
                    }
                } else {
                    await viewModel.startRecording()
                }
            }
        } label: {
            ZStack {
                Circle()
                    .fill(Color.white)
                    .frame(width: 80, height: 80)
                    .shadow(color: .black.opacity(0.2), radius: 10, x: 0, y: 4)

                Image(systemName: "mic.fill")
                    .font(.title2)
                    .foregroundColor(viewModel.isRecording ? .red : .orange)
                    .offset(y: -dragOffset * 0.3)
            }
        }
    }

    // MARK: - Drag Handling

    private func handleDragChanged(_ value: DragGesture.Value) {
        guard viewModel.isRecording else { return }
        isDragging = true

        // Calculate vertical offset
        let translation = value.translation.height

        // Offset limited to -150 (cancel threshold)
        dragOffset = min(translation, 0)
    }

    private func handleDragEnded(_ value: DragGesture.Value) async {
        guard viewModel.isRecording else {
            dragOffset = 0
            return
        }

        isDragging = false

        // Check if cancel threshold reached
        if dragOffset < -50 {
            // Cancel recording
            await viewModel.cancelRecording()
            onCancelled?()
        } else {
            // Complete recording
            if let url = await viewModel.stopRecording() {
                onRecordingComplete(url)
            }
        }

        // Reset offset
        dragOffset = 0
    }
}

// MARK: - Preview

#Preview("Recording Button") {
    VoiceRecordingButton(
        onRecordingComplete: { url in
            SecureLogger.shared.debug("Recording complete: \(url)")
        },
        onCancelled: {
            SecureLogger.shared.debug("Recording cancelled")
        }
    )
}

#Preview("Recording Overlay") {
    VoiceRecordingButton(
        onRecordingComplete: { _ in },
        onCancelled: nil
    )
    .onAppear {
        // Simulate recording state for preview
        Task {
            let viewModel = VoiceRecordingViewModel()
            viewModel.hasPermission = true
            await viewModel.startRecording()
        }
    }
}
