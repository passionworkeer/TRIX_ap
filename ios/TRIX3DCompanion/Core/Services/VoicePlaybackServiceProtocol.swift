//
//  VoicePlaybackServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for voice message playback service
//

import Foundation
import Combine

/// Protocol for voice message playback service
@MainActor
protocol VoicePlaybackServiceProtocol: AnyObject {

    /// Whether a voice message is currently playing
    var isPlaying: Bool { get }

    /// Current playback time in seconds
    var currentTime: TimeInterval { get }

    /// Total duration of the current audio
    var duration: TimeInterval { get }

    /// Current playback rate (0.5, 1.0, 1.5, 2.0)
    var playbackRate: Float { get }

    /// Toggle play/pause
    func togglePlayPause() async

    /// Play audio from URL
    /// - Parameter url: The audio file URL
    func play(url: URL) async throws

    /// Play audio from data
    /// - Parameters:
    ///   - data: Audio data
    ///   - filename: Filename for the audio
    func play(data: Data, filename: String) async throws

    /// Pause playback
    func pause() async

    /// Stop playback
    func stop() async

    /// Seek to a specific time
    /// - Parameter time: Time in seconds
    func seek(to time: TimeInterval) async

    /// Set playback rate
    /// - Parameter rate: Playback rate (0.5, 1.0, 1.5, 2.0)
    func setPlaybackRate(_ rate: Float) async

    /// Publisher for playback state changes
    var playbackStatePublisher: AnyPublisher<PlaybackState, Never> { get }

    /// Publisher for playback progress updates
    var progressPublisher: AnyPublisher<PlaybackProgress, Never> { get }
}

/// Playback state
enum PlaybackState: Equatable {
    case idle
    case loading
    case playing
    case paused
    case finished
    case error(String)

    static func == (lhs: PlaybackState, rhs: PlaybackState) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle),
             (.loading, .loading),
             (.playing, .playing),
             (.paused, .paused),
             (.finished, .finished):
            return true
        case (.error(let lhsMessage), .error(let rhsMessage)):
            return lhsMessage == rhsMessage
        default:
            return false
        }
    }
}

/// Playback progress
struct PlaybackProgress: Equatable {
    let currentTime: TimeInterval
    let duration: TimeInterval
    let progress: Double  // 0.0 - 1.0

    init(currentTime: TimeInterval, duration: TimeInterval) {
        self.currentTime = currentTime
        self.duration = duration
        self.progress = duration > 0 ? currentTime / duration : 0.0
    }
}

/// Playback rate options
enum PlaybackRate: Float, CaseIterable {
    case half = 0.5
    case normal = 1.0
    case oneAndHalf = 1.5
    case double = 2.0

    var displayName: String {
        switch self {
        case .half: return "0.5x"
        case .normal: return "1.0x"
        case .oneAndHalf: return "1.5x"
        case .double: return "2.0x"
        }
    }
}

/// Voice playback errors
enum VoicePlaybackError: Error, LocalizedError {
    case audioNotFound
    case invalidAudioFormat
    case playbackFailed(Error)
    case seekFailed
    case unknown

    var errorDescription: String? {
        switch self {
        case .audioNotFound:
            return "Audio file not found"
        case .invalidAudioFormat:
            return "Invalid audio format"
        case .playbackFailed(let error):
            return "Playback failed: \(error.localizedDescription)"
        case .seekFailed:
            return "Failed to seek to position"
        case .unknown:
            return "Unknown playback error"
        }
    }
}
