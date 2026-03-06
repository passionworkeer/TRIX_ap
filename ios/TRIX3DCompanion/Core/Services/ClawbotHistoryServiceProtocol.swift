//
//  ClawbotHistoryServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for Clawbot History Service
//

import Foundation
import Combine

/// Protocol defining Clawbot history service interface
protocol ClawbotHistoryServiceProtocol {
    /// Current chat history for the selected room
    var history: [ChatMessage] { get }

    /// Whether currently loading history
    var isLoading: Bool { get }

    /// Last error if any
    var lastError: ClawbotHistoryServiceError? { get }

    /// Fetch chat history for a specific room
    /// - Parameters:
    ///   - roomId: The room ID to fetch history for
    ///   - limit: Maximum number of messages to fetch
    ///   - offset: Offset for pagination
    /// - Returns: Array of chat messages
    func getHistory(roomId: String, limit: Int, offset: Int) async throws -> [ChatMessage]

    /// Clear history for a specific room
    /// - Parameter roomId: The room ID to clear history for
    func clearHistory(roomId: String) async throws

    /// Get cached history for offline access
    /// - Parameter roomId: The room ID to get cached history for
    /// - Returns: Array of cached chat messages
    func getCachedHistory(roomId: String) async throws -> [ChatMessage]
}
