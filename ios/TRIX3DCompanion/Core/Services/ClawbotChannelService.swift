//
//  ClawbotChannelService.swift
//  TRIX3DCompanion
//
//  Clawbot Channel Service - 连接 OpenClaw 后端配对服务
//  基于 Web 端 ClawbotChannelBridge.ts 实现
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

/// 配对数据
struct PairingData: Codable {
    let pairingCode: String
    let qrImage: String
    let expiresIn: Int
}

/// Socket 响应
struct SocketResponse: Codable {
    let success: Bool
    let paired: Bool?
    let error: String?
    let deviceId: String?
    let deviceName: String?
    let message: String?
    let data: SocketResponseData?

    enum CodingKeys: String, CodingKey {
        case success
        case paired
        case error
        case deviceId
        case deviceName
        case message
        case data
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        success = try container.decodeIfPresent(Bool.self, forKey: .success) ?? false
        paired = try container.decodeIfPresent(Bool.self, forKey: .paired)
        error = try container.decodeIfPresent(String.self, forKey: .error)
        deviceId = try container.decodeIfPresent(String.self, forKey: .deviceId)
        deviceName = try container.decodeIfPresent(String.self, forKey: .deviceName)
        message = try container.decodeIfPresent(String.self, forKey: .message)

        // 尝试解析 data 字段
        if let dataContainer = try? container.nestedContainer(keyedBy: CodingKeys.self, forKey: .data) {
            data = try? dataContainer.decode(SocketResponseData.self, forKey: .data)
        } else {
            data = nil
        }
    }
}

struct SocketResponseData: Codable {
    let paired: Bool?
    let deviceId: String?
    let deviceName: String?
    let botOnline: Bool?
    let pairedAt: String?
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

/// 学习房间状态
struct StudyRoomState: Codable {
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
    func createStudyRoom(displayName: String, avatarUrl: String?, maxMembers: Int?) async throws -> StudyRoomState
    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String?) async throws -> StudyRoomState
    func leaveStudyRoom(roomCode: String?) async throws

    // Publishers
    var connectionStatePublisher: Published<ClawbotConnectionState>.Publisher { get }
    var pairingStatePublisher: Published<Bool>.Publisher { get }
    var messagePublisher: Published<ClawbotMessage>.Publisher { get }
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
    var messagePublisher: Published<ClawbotMessage>.Publisher { $lastMessage }
    var botStatePublisher: Published<BotState>.Publisher { $botState }

    // MARK: - Private Properties

    private var socket: WebSocket?
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
        guard let userId = await getSupabaseUserId() else {
            throw ClawbotError.userNotLoggedIn
        }

        self.userId = userId

        await MainActor.run {
            connectionState = .connecting
        }

        // Create WebSocket connection
        var request = URLRequest(url: URL(string: channelUrl)!)
        request.timeoutInterval = 10

        socket = WebSocket(request: request)
        socket?.delegate = self
        socket?.connect()
    }

    func disconnect() {
        stopHeartbeat()
        socket?.disconnect()
        socket = nil

        DispatchQueue.main.async {
            self.connectionState = .disconnected
            self.botState = .idle  // Reset bot state on disconnect (matching Web)
        }
    }

    // MARK: - Pairing

    func checkPairingStatus() async throws -> ClawbotPairingStatus {
        guard isConnected, let userId = userId else {
            throw ClawbotError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            let timeout = DispatchWorkItem {
                continuation.resume(throwing: ClawbotError.timeout)
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 8, execute: timeout)

            socket?.emit(withAck("check_pairing_status", ["userId": userId]) { [weak self] response in
                timeout.cancel()

                guard let self = self else {
                    continuation.resume(throwing: ClawbotError.unknown)
                    return
                }

                do {
                    let status = try self.parsePairingStatusResponse(response)
                    continuation.resume(returning: status)
                } catch {
                    continuation.resume(throwing: error)
                }
            })
        }
    }

    func pairWithCode(_ code: String) async throws -> Bool {
        guard isConnected, let userId = userId else {
            throw ClawbotError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            let timeout = DispatchWorkItem {
                continuation.resume(throwing: ClawbotError.timeout)
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 10, execute: timeout)

            socket?.emit(withAck("pair_with_code", ["code": code.uppercased(), "userId": userId]) { [weak self] response in
                timeout.cancel()

                guard let self = self else {
                    continuation.resume(throwing: ClawbotError.unknown)
                    return
                }

                do {
                    let success = try self.parsePairingResponse(response)
                    if success {
                        self.isPaired = true
                        self.persistPairingState()
                    }
                    continuation.resume(returning: success)
                } catch {
                    continuation.resume(throwing: error)
                }
            })
        }
    }

    func pairWithToken(_ token: String) async throws -> Bool {
        guard isConnected, let userId = userId else {
            throw ClawbotError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            let timeout = DispatchWorkItem {
                continuation.resume(throwing: ClawbotError.timeout)
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 10, execute: timeout)

            socket?.emit(withAck("pair_with_token", ["token": token, "userId": userId]) { [weak self] response in
                timeout.cancel()

                guard let self = self else {
                    continuation.resume(throwing: ClawbotError.unknown)
                    return
                }

                do {
                    let success = try self.parsePairingResponse(response)
                    if success {
                        self.isPaired = true
                        self.persistPairingState()
                    }
                    continuation.resume(returning: success)
                } catch {
                    continuation.resume(throwing: error)
                }
            })
        }
    }

    func unpair() {
        if isConnected {
            socket?.emit("unpair", [])
        }

        isPaired = false
        deviceId = nil
        botState = .idle  // Reset bot state on unpair (matching Web)
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

        let messageId = generateMessageId()

        return try await withCheckedThrowingContinuation { continuation in
            let timeout = DispatchWorkItem {
                continuation.resume(throwing: ClawbotError.timeout)
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 10, execute: timeout)

            var payload: [String: Any] = [
                "content": content,
                "contentType": contentType.rawValue,
                "messageId": messageId
            ]

            if let mediaUrl = mediaUrl {
                payload["mediaUrl"] = mediaUrl
            }

            if let mediaMimeType = mediaMimeType {
                payload["mediaMimeType"] = mediaMimeType
            }

            socket?.emit(withAck("app_message", payload) { [weak self] response in
                timeout.cancel()

                guard let _ = self else {
                    continuation.resume(throwing: ClawbotError.unknown)
                    return
                }

                if let dict = response as? [String: Any],
                   let success = dict["success"] as? Bool, success {
                    // Set bot state to thinking after sending message
                    DispatchQueue.main.async {
                        self.botState = .thinking
                    }
                    continuation.resume()
                } else {
                    let errorMessage = (response as? [String: Any])?["error"] as? String ?? "Failed to send message"
                    continuation.resume(throwing: ClawbotError.messageFailed(errorMessage))
                }
            })
        }
    }

    // MARK: - Study Room

    func createStudyRoom(displayName: String, avatarUrl: String? = nil, maxMembers: Int? = nil) async throws -> StudyRoomState {
        guard isConnected, let userId = userId else {
            throw ClawbotError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            var payload: [String: Any] = [
                "userId": userId,
                "displayName": displayName
            ]

            if let avatarUrl = avatarUrl {
                payload["avatarUrl"] = avatarUrl
            }

            if let maxMembers = maxMembers {
                payload["maxMembers"] = maxMembers
            }

            socket?.emit(withAck("study_room_create", payload) { response in
                if let dict = response as? [String: Any],
                   let success = dict["success"] as? Bool, success,
                   let roomData = dict["room"] as? [String: Any] {
                    // Parse room data
                    let room = StudyRoomState(
                        roomCode: roomData["roomCode"] as? String ?? "",
                        roomName: roomData["roomName"] as? String ?? "",
                        hostId: roomData["hostId"] as? String ?? "",
                        hostName: roomData["hostName"] as? String ?? "",
                        participants: [],
                        status: roomData["status"] as? String ?? "",
                        createdAt: nil
                    )
                    continuation.resume(returning: room)
                } else {
                    let errorMessage = (response as? [String: Any])?["error"] as? String ?? "Create room failed"
                    continuation.resume(throwing: ClawbotError.messageFailed(errorMessage))
                }
            })
        }
    }

    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String? = nil) async throws -> StudyRoomState {
        guard isConnected, let userId = userId else {
            throw ClawbotError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            var payload: [String: Any] = [
                "userId": userId,
                "roomCode": roomCode,
                "displayName": displayName
            ]

            if let avatarUrl = avatarUrl {
                payload["avatarUrl"] = avatarUrl
            }

            socket?.emit(withAck("study_room_join", payload) { response in
                if let dict = response as? [String: Any],
                   let success = dict["success"] as? Bool, success,
                   let roomData = dict["room"] as? [String: Any] {
                    let room = StudyRoomState(
                        roomCode: roomData["roomCode"] as? String ?? "",
                        roomName: roomData["roomName"] as? String ?? "",
                        hostId: roomData["hostId"] as? String ?? "",
                        hostName: roomData["hostName"] as? String ?? "",
                        participants: [],
                        status: roomData["status"] as? String ?? "",
                        createdAt: nil
                    )
                    continuation.resume(returning: room)
                } else {
                    let errorMessage = (response as? [String: Any])?["error"] as? String ?? "Join room failed"
                    continuation.resume(throwing: ClawbotError.messageFailed(errorMessage))
                }
            })
        }
    }

    func leaveStudyRoom(roomCode: String?) async throws {
        guard isConnected, let userId = userId else {
            throw ClawbotError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            var payload: [String: Any] = ["userId": userId]

            if let roomCode = roomCode {
                payload["roomCode"] = roomCode
            }

            socket?.emit(withAck("study_room_leave", payload) { response in
                if let dict = response as? [String: Any],
                   let success = dict["success"] as? Bool, success {
                    continuation.resume()
                } else {
                    let errorMessage = (response as? [String: Any])?["error"] as? String ?? "Leave room failed"
                    continuation.resume(throwing: ClawbotError.messageFailed(errorMessage))
                }
            })
        }
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

        // Use UUID for cryptographically secure random
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
        // 从 AuthService 获取当前用户 ID
        return AuthService.shared.currentUser?.id
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

            // Check timeout
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

    // MARK: - Response Parsing

    private func parsePairingStatusResponse(_ response: Any) throws -> ClawbotPairingStatus {
        guard let dict = response as? [String: Any] else {
            throw ClawbotError.invalidResponse
        }

        guard let success = dict["success"] as? Bool, success else {
            return ClawbotPairingStatus(paired: false, deviceId: nil, deviceName: nil, botOnline: nil, pairedAt: nil)
        }

        var paired = false
        var deviceId: String?
        var deviceName: String?
        var botOnline: Bool?
        var pairedAt: String?

        if let data = dict["data"] as? [String: Any] {
            paired = data["paired"] as? Bool ?? false
            deviceId = data["deviceId"] as? String
            deviceName = data["deviceName"] as? String
            botOnline = data["botOnline"] as? Bool
            pairedAt = data["pairedAt"] as? String
        } else {
            paired = dict["paired"] as? Bool ?? false
            deviceId = dict["deviceId"] as? String
            deviceName = dict["deviceName"] as? String
        }

        return ClawbotPairingStatus(
            paired: paired,
            deviceId: deviceId,
            deviceName: deviceName,
            botOnline: botOnline,
            pairedAt: pairedAt
        )
    }

    private func parsePairingResponse(_ response: Any) throws -> Bool {
        guard let dict = response as? [String: Any],
              let success = dict["success"] as? Bool else {
            throw ClawbotError.invalidResponse
        }

        if success {
            // Check for deviceId in different formats (matching Web)
            // Web returns: { success: true, pairingId, status }
            if let deviceId = dict["deviceId"] as? String {
                self.deviceId = deviceId
            } else if let pairingId = dict["pairingId"] as? String {
                self.deviceId = pairingId
            } else if let data = dict["data"] as? [String: Any],
                      let deviceId = data["deviceId"] as? String {
                self.deviceId = deviceId
            }
        }

        return success
    }

    // MARK: - Event Emission

    private func emitEvent<T>(_ event: String, data: T) {
        // Event handling implementation
    }
}

// MARK: - WebSocketDelegate

extension ClawbotChannelService: WebSocketDelegate {
    func didReceive(event: WebSocketEvent, client: any WebSocketClient) {
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
            socket?.emit("app_register", ["userId": userId])
        }

        // Check pairing status after connection
        Task {
            do {
                let status = try await checkPairingStatus()
                await MainActor.run {
                    self.isPaired = status.paired
                    if status.paired, let id = status.deviceId {
                        self.deviceId = id
                    }
                }
            } catch {
                SecureLogger.shared.warning("[ClawbotChannel] Failed to check pairing status: \(error)")
            }
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
            // Handle bot status changes
            break

        case "study_room_state":
            // Handle study room state updates
            break

        case "message_sent":
            // Handle message sent confirmation
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

            // State machine: IDLE -> THINKING -> SPEAKING -> IDLE (matching Web)
            if self.ttsEnabled && contentType == .text && !content.isEmpty {
                // With voice enabled: IDLE -> THINKING -> SPEAKING -> IDLE
                self.botState = .thinking

                // Then transition to speaking after a short delay (mimicking processing time)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    if self.botState == .thinking {
                        self.botState = .speaking
                    }
                }

                // Calculate dynamic timeout based on content length (matching Web)
                // Web: SPEAKING_BASE_MS (800) + contentLength * SPEAKING_PER_CHAR_MS (45)
                // Min: 1200ms, Max: 12000ms
                let contentLength = content.count
                let baseMs: Double = 800
                let perCharMs: Double = 45
                let minMs: Double = 1200
                let maxMs: Double = 12000
                let speakingDuration = min(max(baseMs + Double(contentLength) * perCharMs, minMs), maxMs)

                // Add thinking timeout (25 seconds like Web)
                let thinkingTimeout: Double = 25.0

                // Set back to idle after calculated duration
                DispatchQueue.main.asyncAfter(deadline: .now() + (speakingDuration / 1000)) {
                    if self.botState == .speaking {
                        self.botState = .idle
                    }
                }

                // Also set thinking timeout
                DispatchQueue.main.asyncAfter(deadline: .now() + thinkingTimeout) {
                    if self.botState == .thinking {
                        self.botState = .idle
                    }
                }

                // Trigger TTS for bot message
                Task {
                    await self.speakBotMessage(content)
                }
            } else {
                // Without voice: just idle
                self.botState = .idle
            }
        }
    }

    /// Speak bot message via TTS
    @MainActor
    private func speakBotMessage(_ text: String) async {
        // Stop any current speech first
        await ttsService.stop()

        // Set the language
        await ttsService.setVoice(language: ttsLanguage)

        // Speak the message
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

        // Exponential backoff
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
