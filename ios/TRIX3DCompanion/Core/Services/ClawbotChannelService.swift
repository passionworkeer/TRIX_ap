//
//  ClawbotChannelService.swift
//  TRIX3DCompanion
//
//  Clawbot Channel Service - 连接 OpenClaw 后端配对服务
//  基于 Web 端 ClawbotChannelBridge.ts 实现
//
//  注意: 当前使用 Starscream WebSocket 库，不支持 Socket.IO 协议
//        需要添加 Socket.IO 库或使用其他方式实现完整功能
//

import Foundation
import Starscream
import Combine
import AVFoundation

// MARK: - Types

/// 消息内容类型
enum ClawbotMessageContentType: String, Codable {
    case text
    case image
    case video
    case file
    case mixed
}

/// Clawbot 消息
struct ClawbotMessage: Codable, Identifiable, Equatable {
    let id: String
    let content: String
    let contentType: ClawbotMessageContentType
    let mediaUrl: String?
    let mediaMimeType: String?
    let timestamp: Date
    let sender: MessageSender

    enum MessageSender: String, Codable {
        case user
        case bot
    }
}

/// 连接状态
enum ClawbotConnectionState {
    case disconnected
    case connecting
    case connected
    case reconnecting(attempt: Int)
    case error(String)
}

/// 配对状态
struct ClawbotPairingStatus {
    let paired: Bool
    let deviceId: String?
    let deviceName: String?
    let botOnline: Bool?
    let pairedAt: String?
}

/// 学习房间状态 (WebSocket 通信用)
struct ClawbotStudyRoomState: Codable {
    let roomCode: String
    let roomName: String
    let hostId: String
    let hostName: String
    let participants: [StudyRoomParticipant]
    let status: String
    let createdAt: Date?

    struct StudyRoomParticipant: Codable {
        let userId: String
        let displayName: String
        let avatarUrl: String?
        let isHost: Bool
        let joinedAt: Date?
    }
}

// MARK: - Protocol

protocol ClawbotChannelServiceProtocol {
    var connectionState: ClawbotConnectionState { get }
    var isConnected: Bool { get }
    var isPaired: Bool { get }
    var deviceId: String? { get }

    // TTS
    var ttsEnabled: Bool { get set }
    var ttsLanguage: TTSLanguage { get set }

    // Connection
    func connect() async throws
    func disconnect()

    // Pairing
    func checkPairingStatus() async throws -> ClawbotPairingStatus
    func pairWithCode(_ code: String) async throws -> Bool
    func pairWithToken(_ token: String) async throws -> Bool
    func unpair()

    // Messages
    func sendMessage(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?) async throws

    // Study Room
    func createStudyRoom(displayName: String, avatarUrl: String?, maxMembers: Int?) async throws -> ClawbotStudyRoomState
    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String?) async throws -> ClawbotStudyRoomState
    func leaveStudyRoom(roomCode: String?) async throws

    // Publishers
    var connectionStatePublisher: Published<ClawbotConnectionState>.Publisher { get }
    var pairingStatePublisher: Published<Bool>.Publisher { get }
    var messagePublisher: Published<ClawbotMessage?>.Publisher { get }
    var botStatePublisher: Published<BotState>.Publisher { get }
}

// MARK: - Event Handlers

typealias ClawbotEventHandler<T> = (T) -> Void

// MARK: - Service Implementation

final class ClawbotChannelService: ObservableObject, ClawbotChannelServiceProtocol {

    // MARK: - Singleton

    static let shared = ClawbotChannelService()

    // MARK: - Published Properties

    @Published private(set) var connectionState: ClawbotConnectionState = .disconnected
    @Published private(set) var isPaired: Bool = false
    @Published private(set) var lastMessage: ClawbotMessage?
    @Published private(set) var botState: BotState = .idle

    // MARK: - Publishers (for Combine)

    var connectionStatePublisher: Published<ClawbotConnectionState>.Publisher { $connectionState }
    var pairingStatePublisher: Published<Bool>.Publisher { $isPaired }
    var messagePublisher: Published<ClawbotMessage?>.Publisher { $lastMessage }
    var botStatePublisher: Published<BotState>.Publisher { $botState }

    // MARK: - Private Properties

    private var socket: Starscream.WebSocket?
    private var userId: String?
    private(set) var deviceId: String?

    private var heartbeatTimer: Timer?
    private var lastPongTime: Date = Date()
    private let heartbeatInterval: TimeInterval = 30

    private var reconnectAttempts: Int = 0
    private let maxReconnectAttempts: Int = 10

    private var pendingMessageHandlers: [String: (Result<Void, Error>) -> Void] = [:]
    private let messageHandlerLock = NSLock()

    // Event handlers
    private var eventHandlers: [String: Any] = [:]

    // TTS for bot messages
    private let ttsService = TTSService.shared
    @Published var ttsEnabled: Bool = true
    @Published var ttsLanguage: TTSLanguage = .chinese

    // MARK: - Configuration

    private var channelUrl: String {
        #if DEBUG
        return "ws://localhost:8765"
        #else
        return "wss://api.trix3d.com"
        #endif
    }

    // MARK: - Initialization

    private init() {
        deviceId = getOrCreateDeviceId()
        loadPersistedState()
    }

    // MARK: - Public Methods

    var isConnected: Bool {
        if case .connected = connectionState {
            return true
        }
        return false
    }

    func connect() async throws {
        guard let supabaseUserId = await getSupabaseUserId() else {
            throw ClawbotError.userNotLoggedIn
        }

        self.userId = supabaseUserId

        await MainActor.run {
            connectionState = .connecting
        }

        // Create WebSocket connection
        var request = URLRequest(url: URL(string: channelUrl)!)
        request.timeoutInterval = 10

        socket = Starscream.WebSocket(request: request)
        socket?.delegate = self
        socket?.connect()
    }

    func disconnect() {
        stopHeartbeat()
        socket?.disconnect()
        socket = nil

        DispatchQueue.main.async {
            self.connectionState = .disconnected
            self.botState = .idle
        }
    }

    // MARK: - Pairing (Simplified - needs Socket.IO support)

    func checkPairingStatus() async throws -> ClawbotPairingStatus {
        // Simplified implementation - requires Socket.IO for full functionality
        guard isConnected else {
            throw ClawbotError.notConnected
        }
        return ClawbotPairingStatus(paired: isPaired, deviceId: deviceId, deviceName: nil, botOnline: nil, pairedAt: nil)
    }

    func pairWithCode(_ code: String) async throws -> Bool {
        // Simplified implementation - requires Socket.IO for full functionality
        guard isConnected else {
            throw ClawbotError.notConnected
        }
        // TODO: Implement with Socket.IO
        throw ClawbotError.messageFailed("Pairing requires Socket.IO support")
    }

    func pairWithToken(_ token: String) async throws -> Bool {
        // Simplified implementation - requires Socket.IO for full functionality
        guard isConnected else {
            throw ClawbotError.notConnected
        }
        // TODO: Implement with Socket.IO
        throw ClawbotError.messageFailed("Pairing requires Socket.IO support")
    }

    func unpair() {
        if isConnected {
            // Use basic WebSocket send
            let message = "{\"event\":\"unpair\",\"data\":{}}"
            socket?.write(string: message)
        }

        isPaired = false
        deviceId = nil
        botState = .idle
        clearPersistedState()
    }

    // MARK: - Messages

    func sendMessage(_ content: String, contentType: ClawbotMessageContentType = .text, mediaUrl: String? = nil, mediaMimeType: String? = nil) async throws {
        guard isConnected else {
            throw ClawbotError.notConnected
        }

        guard isPaired else {
            throw ClawbotError.notPaired
        }

        // Use basic WebSocket send
        let messageData: [String: Any] = [
            "event": "app_message",
            "data": [
                "content": content,
                "contentType": contentType.rawValue
            ]
        ]

        if let jsonData = try? JSONSerialization.data(withJSONObject: messageData),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            socket?.write(string: jsonString)

            // Set bot state to thinking
            DispatchQueue.main.async {
                self.botState = .thinking
            }
        }
    }

    // MARK: - Study Room (Simplified)

    func createStudyRoom(displayName: String, avatarUrl: String? = nil, maxMembers: Int? = nil) async throws -> ClawbotStudyRoomState {
        guard isConnected else {
            throw ClawbotError.notConnected
        }
        // Simplified implementation
        return ClawbotStudyRoomState(
            roomCode: "",
            roomName: displayName,
            hostId: userId ?? "",
            hostName: displayName,
            participants: [],
            status: "waiting",
            createdAt: Date()
        )
    }

    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String? = nil) async throws -> ClawbotStudyRoomState {
        guard isConnected else {
            throw ClawbotError.notConnected
        }
        // Simplified implementation
        return ClawbotStudyRoomState(
            roomCode: roomCode,
            roomName: "Study Room",
            hostId: "",
            hostName: displayName,
            participants: [],
            status: "studying",
            createdAt: Date()
        )
    }

    func leaveStudyRoom(roomCode: String?) async throws {
        guard isConnected else {
            throw ClawbotError.notConnected
        }
        // Simplified implementation
    }

    // MARK: - Private Methods

    private func getOrCreateDeviceId() -> String {
        if let existingId = UserDefaults.standard.string(forKey: "clawbot_channel_device_id") {
            return existingId
        }

        let newId = "app_\(generateSecureRandomString(9))_\(Int(Date().timeIntervalSince1970))"
        UserDefaults.standard.set(newId, forKey: "clawbot_channel_device_id")
        return newId
    }

    private func generateSecureRandomString(_ length: Int) -> String {
        let characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        var randomString = ""

        let uuid = UUID().uuidString.replacingOccurrences(of: "-", with: "")
        let uuidChars = Array(uuid)

        for i in 0..<length {
            let index = i % uuidChars.count
            randomString.append(uuidChars[index])
        }

        return String(randomString.prefix(length))
    }

    private func generateMessageId() -> String {
        return "\(Int(Date().timeIntervalSince1970 * 1000))-\(generateSecureRandomString(9))"
    }

    private func getSupabaseUserId() async -> String? {
        return await MainActor.run {
            AuthService.shared.currentUser?.id
        }
    }

    // MARK: - Persistence

    private func persistPairingState() {
        if let deviceId = deviceId {
            UserDefaults.standard.set(deviceId, forKey: "clawbot_device_id")
        }
        UserDefaults.standard.set(isPaired, forKey: "clawbot_paired")
    }

    private func loadPersistedState() {
        isPaired = UserDefaults.standard.bool(forKey: "clawbot_paired")
        deviceId = UserDefaults.standard.string(forKey: "clawbot_device_id")
    }

    private func clearPersistedState() {
        UserDefaults.standard.removeObject(forKey: "clawbot_paired")
        UserDefaults.standard.removeObject(forKey: "clawbot_device_id")
    }

    // MARK: - Heartbeat

    private func startHeartbeat() {
        stopHeartbeat()
        lastPongTime = Date()

        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: heartbeatInterval, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            if Date().timeIntervalSince(self.lastPongTime) > 60 {
                self.socket?.disconnect()
                self.socket?.connect()
                return
            }

            self.socket?.write(ping: Data())
        }
    }

    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }

    // MARK: - Event Emission

    private func emitEvent<T>(_ event: String, data: T) {
        // Event handling implementation
    }
}

// MARK: - WebSocketDelegate

extension ClawbotChannelService: Starscream.WebSocketDelegate {
    func didReceive(event: Starscream.WebSocketEvent, client: any Starscream.WebSocketClient) {
        switch event {
        case .connected(_):
            handleConnected()

        case .disconnected(let reason, _):
            DispatchQueue.main.async {
                self.connectionState = .disconnected
                self.stopHeartbeat()
            }
            SecureLogger.shared.info("[ClawbotChannel] Disconnected: \(reason)")

        case .text(let string):
            handleTextMessage(string)

        case .binary(let data):
            handleBinaryMessage(data)

        case .ping(_):
            break

        case .pong(_):
            DispatchQueue.main.async {
                self.lastPongTime = Date()
            }

        case .viabilityChanged(let viable):
            SecureLogger.shared.info("[ClawbotChannel] Viability changed: \(viable)")

        case .reconnectSuggested(let suggested):
            if suggested {
                handleReconnect()
            }

        case .cancelled:
            DispatchQueue.main.async {
                self.connectionState = .disconnected
            }

        case .error(let error):
            DispatchQueue.main.async {
                self.connectionState = .error(error?.localizedDescription ?? "Unknown error")
            }
            SecureLogger.shared.error("[ClawbotChannel] Error: \(error?.localizedDescription ?? "Unknown")")

        case .peerClosed:
            DispatchQueue.main.async {
                self.connectionState = .disconnected
            }
        }
    }

    private func handleConnected() {
        DispatchQueue.main.async {
            self.connectionState = .connected
            self.reconnectAttempts = 0
            self.startHeartbeat()
        }

        // Register with user ID
        if let userId = userId {
            let message = "{\"event\":\"app_register\",\"data\":{\"userId\":\"\(userId)\"}}"
            socket?.write(string: message)
        }
    }

    private func handleTextMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let eventType = json["event"] as? String else {
            return
        }

        switch eventType {
        case "pairing_success":
            if let deviceId = json["deviceId"] as? String,
               let deviceName = json["deviceName"] as? String {
                DispatchQueue.main.async {
                    self.isPaired = true
                    self.deviceId = deviceId
                    self.persistPairingState()
                }
            }

        case "unpaired":
            DispatchQueue.main.async {
                self.isPaired = false
                self.deviceId = nil
                self.clearPersistedState()
            }

        case "bot_message":
            handleBotMessage(json)

        case "bot_online", "bot_offline":
            break

        case "study_room_state":
            break

        case "message_sent":
            break

        default:
            break
        }
    }

    private func handleBotMessage(_ json: [String: Any]) {
        let content = json["content"] as? String ?? ""
        let contentTypeRaw = json["contentType"] as? String ?? "text"
        let contentType = ClawbotMessageContentType(rawValue: contentTypeRaw) ?? .text
        let mediaUrl = json["mediaUrl"] as? String
        let mediaMimeType = json["mediaMimeType"] as? String ?? json["media_mime_type"] as? String
        let timestamp = Date(timeIntervalSince1970: (json["timestamp"] as? Double ?? Double(Date().timeIntervalSince1970)) / 1000)
        let messageId = json["messageId"] as? String ?? generateMessageId()

        let message = ClawbotMessage(
            id: messageId,
            content: content,
            contentType: contentType,
            mediaUrl: mediaUrl,
            mediaMimeType: mediaMimeType,
            timestamp: timestamp,
            sender: .bot
        )

        DispatchQueue.main.async {
            self.lastMessage = message

            // State machine
            if self.ttsEnabled && contentType == .text && !content.isEmpty {
                self.botState = .thinking

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    if self.botState == .thinking {
                        self.botState = .speaking
                    }
                }

                let contentLength = content.count
                let baseMs: Double = 800
                let perCharMs: Double = 45
                let minMs: Double = 1200
                let maxMs: Double = 12000
                let speakingDuration = min(max(baseMs + Double(contentLength) * perCharMs, minMs), maxMs)

                DispatchQueue.main.asyncAfter(deadline: .now() + (speakingDuration / 1000)) {
                    if self.botState == .speaking {
                        self.botState = .idle
                    }
                }

                Task {
                    await self.speakBotMessage(content)
                }
            } else {
                self.botState = .idle
            }
        }
    }

    @MainActor
    private func speakBotMessage(_ text: String) async {
        await ttsService.stop()
        await ttsService.setVoice(language: ttsLanguage)

        do {
            try await ttsService.speak(text, language: ttsLanguage.rawValue)
        } catch {
            SecureLogger.shared.error("TTS Error: \(error.localizedDescription)")
        }
    }

    private func handleBinaryMessage(_ data: Data) {
        // Handle binary messages if needed
    }

    private func handleReconnect() {
        guard reconnectAttempts < maxReconnectAttempts else {
            DispatchQueue.main.async {
                self.connectionState = .error("Max reconnection attempts reached")
            }
            return
        }

        DispatchQueue.main.async {
            self.reconnectAttempts += 1
            self.connectionState = .reconnecting(attempt: self.reconnectAttempts)
        }

        let delay = min(pow(2.0, Double(reconnectAttempts)), 30.0)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            self?.socket?.connect()
        }
    }
}

// MARK: - Errors

enum ClawbotError: LocalizedError {
    case userNotLoggedIn
    case notConnected
    case notPaired
    case timeout
    case invalidResponse
    case messageFailed(String)
    case unknown

    var errorDescription: String? {
        switch self {
        case .userNotLoggedIn:
            return "User not logged in"
        case .notConnected:
            return "Not connected to channel server"
        case .notPaired:
            return "Not paired with any device"
        case .timeout:
            return "Request timed out"
        case .invalidResponse:
            return "Invalid response from server"
        case .messageFailed(let message):
            return message
        case .unknown:
            return "Unknown error"
        }
    }
}
