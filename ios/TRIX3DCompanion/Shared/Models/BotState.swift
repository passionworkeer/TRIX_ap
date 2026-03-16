//
//  BotState.swift
//  TRIX3DCompanion
//
//  Robot state enumeration for video and animation states
//

import Foundation

// MARK: - Bot State

/// Robot state enumeration defining different visual and behavioral states
enum BotState: String, Equatable, CaseIterable {
    /// Robot is idle and waiting for input
    case idle = "IDLE"

    /// Robot is processing/thinking
    case thinking = "THINKING"

    /// Robot is speaking/responding
    case speaking = "SPEAKING"

    /// Robot is bored/inactive
    case boring = "BORING"

    /// Display name for the state
    var displayName: String {
        switch self {
        case .idle:
            return NSLocalizedString("bot.state.idle", comment: "Bot idle state")
        case .thinking:
            return NSLocalizedString("bot.state.thinking", comment: "Bot thinking state")
        case .speaking:
            return NSLocalizedString("bot.state.speaking", comment: "Bot speaking state")
        case .boring:
            return NSLocalizedString("bot.state.boring", comment: "Bot boring state")
        }
    }

    /// Video file name for this state (without extension)
    var videoFileName: String {
        switch self {
        case .idle:
            return "idle"
        case .thinking:
            return "thinking"
        case .speaking:
            return "speaking"
        case .boring:
            return "boring"
        }
    }

    /// Whether this state should use the boring video in low power mode
    func shouldUseBoringVideo(inLowPowerMode lowPower: Bool) -> Bool {
        return lowPower && self == .idle
    }
}
