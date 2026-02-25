//
//  AVAudioPlayer+Extensions.swift
//  TRIX3DCompanion
//
//  Created by TRIX 3D Companion Team
//

import AVFoundation

// MARK: - Audio Player Error

/// Errors that can occur during audio playback
enum AudioPlayerError: LocalizedError {
    case fileNotFound(path: String)
    case invalidData
    case playerCreationFailed(underlying: Error?)
    case playbackFailed(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .fileNotFound(let path):
            return "Audio file not found: \(path)"
        case .invalidData:
            return "Invalid audio data"
        case .playerCreationFailed(let error):
            return "Failed to create audio player: \(error?.localizedDescription ?? "Unknown error")"
        case .playbackFailed(let error):
            return "Playback failed: \(error.localizedDescription)"
        }
    }
}

// MARK: - AVAudioPlayer Extensions

extension AVAudioPlayer {

    /// Creates an audio player from a file URL
    /// - Parameter url: The URL of the audio file
    /// - Returns: Initialized AVAudioPlayer instance
    /// - Throws: AudioPlayerError if initialization fails
    static func player(from url: URL) throws -> AVAudioPlayer {
        // Check if file exists
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw AudioPlayerError.fileNotFound(path: url.path)
        }

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.prepareToPlay()
            return player
        } catch {
            throw AudioPlayerError.playerCreationFailed(underlying: error)
        }
    }

    /// Creates an audio player from data
    /// - Parameter data: The audio data
    /// - Returns: Initialized AVAudioPlayer instance
    /// - Throws: AudioPlayerError if initialization fails
    static func player(from data: Data) throws -> AVAudioPlayer {
        guard !data.isEmpty else {
            throw AudioPlayerError.invalidData
        }

        do {
            let player = try AVAudioPlayer(data: data)
            player.prepareToPlay()
            return player
        } catch {
            throw AudioPlayerError.playerCreationFailed(underlying: error)
        }
    }

    /// Creates an audio player from a file URL asynchronously
    /// - Parameters:
    ///   - url: The URL of the audio file
    ///   - completion: Result containing either the player or an error
    static func player(
        from url: URL,
        completion: @escaping (Result<AVAudioPlayer, AudioPlayerError>) -> Void
    ) {
        // Check if file exists
        guard FileManager.default.fileExists(atPath: url.path) else {
            completion(.failure(.fileNotFound(path: url.path)))
            return
        }

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.prepareToPlay()
            completion(.success(player))
        } catch {
            completion(.failure(.playerCreationFailed(underlying: error)))
        }
    }

    /// Plays the audio with completion callback
    /// - Parameter completion: Closure called when playback finishes or fails
    func play(completion: @escaping (Bool) -> Void) {
        // Use delegate to detect playback completion
        let delegate = AudioPlayerDelegateWrapper(completion: completion)
        self.delegate = delegate

        let success = self.play()
        if !success {
            completion(false)
        }
    }

    /// Sets the playback rate and returns the player for chaining
    /// - Parameter rate: Playback rate (0.5 to 2.0, where 1.0 is normal)
    /// - Returns: Self for method chaining
    @discardableResult
    func withRate(_ rate: Float) -> AVAudioPlayer {
        self.rate = rate
        return self
    }

    /// Sets the volume and returns the player for chaining
    /// - Parameter volume: Volume (0.0 to 1.0)
    /// - Returns: Self for method chaining
    @discardableResult
    func withVolume(_ volume: Float) -> AVAudioPlayer {
        self.volume = volume
        return self
    }

    /// Sets the number of loops and returns the player for chaining
    /// - Parameter loops: Number of loops (-1 for infinite)
    /// - Returns: Self for method chaining
    @discardableResult
    func withLoops(_ loops: Int) -> AVAudioPlayer {
        self.numberOfLoops = loops
        return self
    }
}

// MARK: - TimeInterval Extension

extension TimeInterval {

    /// Formats a time interval as MM:SS string
    var formattedDuration: String {
        let minutes = Int(self) / 60
        let seconds = Int(self) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    /// Formats a time interval with hours if needed (HH:MM:SS or MM:SS)
    var formattedDurationWithHours: String {
        let hours = Int(self) / 3600
        let minutes = (Int(self) % 3600) / 60
        let seconds = Int(self) % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%d:%02d", minutes, seconds)
        }
    }
}

// MARK: - Audio Player Delegate Wrapper

/// Helper class to handle delegate callbacks with closures
private class AudioPlayerDelegateWrapper: NSObject, AVAudioPlayerDelegate {
    private let completion: (Bool) -> Void

    init(completion: @escaping (Bool) -> Void) {
        self.completion = completion
    }

    func audioPlayerDidFinishPlaying(
        _ player: AVAudioPlayer,
        successfully flag: Bool
    ) {
        completion(flag)
    }

    func audioPlayerDecodeErrorDidOccur(
        _ player: AVAudioPlayer,
        error: Error?
    ) {
        completion(false)
    }
}
