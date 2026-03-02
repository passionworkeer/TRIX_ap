//
//  WebSocketManagerProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for WebSocket Manager to enable testing with mocks
//

import Foundation

/// Protocol for WebSocket Manager operations
protocol WebSocketManagerProtocol {

    /// Check if connected to WebSocket server
    /// - Returns: Connection status
    func isConnected() -> Bool

    /// Connect to WebSocket server
    /// - Parameter userId: User ID for authentication
    func connect(userId: String) async throws

    /// Disconnect from WebSocket server
    func disconnect()

    /// Send message to bot
    /// - Parameters:
    ///   - content: Message content
    ///   - contentType: Type of message content
    ///   - mediaUrl: Optional media URL
    ///   - mediaMimeType: Optional media MIME type
    func sendMessage(content: String, contentType: BotMessage.MessageContentType, mediaUrl: String?, mediaMimeType: String?)

    /// Add event listener
    /// - Parameters:
    ///   - event: Event type
    ///   - handler: Event handler callback
    func on(_ event: WebSocketEvent, handler: @escaping (Any) -> Void)

    /// Create study room
    /// - Parameters:
    ///   - displayName: Display name for the user
    ///   - avatarUrl: Optional avatar URL
    ///   - maxMembers: Maximum number of members
    ///   - completion: Completion handler with result
    func createStudyRoom(displayName: String, avatarUrl: String?, maxMembers: Int, completion: @escaping (Result<StudyRoomAckPayload, WebSocketError>) -> Void)

    /// Join study room
    /// - Parameters:
    ///   - roomCode: Room code to join
    ///   - displayName: Display name for the user
    ///   - avatarUrl: Optional avatar URL
    ///   - completion: Completion handler with result
    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String?, completion: @escaping (Result<StudyRoomAckPayload, WebSocketError>) -> Void)

    /// Leave study room
    /// - Parameters:
    ///   - roomCode: Optional room code
    ///   - completion: Completion handler with result
    func leaveStudyRoom(roomCode: String?, completion: @escaping (Result<StudyRoomAckPayload, WebSocketError>) -> Void)

    /// Get study room state
    /// - Parameters:
    ///   - roomCode: Room code
    ///   - completion: Completion handler with result
    func getStudyRoomState(roomCode: String, completion: @escaping (Result<StudyRoomAckPayload, WebSocketError>) -> Void)

    /// Host action in study room
    /// - Parameters:
    ///   - roomCode: Room code
    ///   - action: Action to perform
    ///   - completion: Completion handler with result
    func hostActionStudyRoom(roomCode: String, action: String, completion: @escaping (Result<StudyRoomAckPayload, WebSocketError>) -> Void)
}

// Extension to make WebSocketManager conform to the protocol
extension WebSocketManager: WebSocketManagerProtocol {
    // The methods already exist with compatible signatures
    // We just need to add the isConnected() method
}
