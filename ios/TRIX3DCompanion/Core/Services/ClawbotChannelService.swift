//
//  ClawbotChannelService.swift
//  TRIX3DCompanion
//
//  Clawbot Channel Service - 连接 OpenClaw 后端配对服务
//  基于 Web 端 ClawbotChannelBridge.ts 实现
//  使用 Socket.IO 协议
//

import Foundation
import SocketIO
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
enum ClawbotConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case reconnecting(attempt: Int)
    case error(String)
}

/// 配对状态
struct ClawbotPairingStatus: Equatable {
    let paired: Bool
    let deviceId: String?
    let deviceName: String?
    let botOnline: Bool?
    let pairedAt: String?
}

/// Bot 状态
enum BotState: String {
    case idle
    case thinking
    case speaking
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
    func pairWithQR(_ qrData: String) async throws -> Bool
    func unpair()

    // Messages
    func sendMessage(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?) async throws

    // Study Room
    func createStudyRoom(displayName: String, avatarUrl: String?, maxMembers: Int?) async throws -> ClawbotStudyRoomState
    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String?) async throws -> ClawbotStudyRoomState
    func leaveStudyRoom(roomCode: String?) async throws
    func hostActionStudyRoom(roomCode: String, action: StudyRoomHostAction) async throws -> ClawbotStudyRoomState
}

// MARK: - Study Room State

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

// MARK: - Service Implementation

final class ClawbotChannelService: ObservableObject, ClawbotChannelServiceProtocol {

    // MARK: - Singleton

    static let shared = ClawbotChannelService()

    // MARK: - Published Properties

    @Published private(set) var connectionState: ClawbotConnectionState = .disconnected
    @Published private(set) var isPaired: Bool = false
    @Published private(set) var lastMessage: ClawbotMessage?
    @Published private(set) var botState: BotState = .idle
    @Published private(set) var currentStudyRoomState: StudyRoomState?

    // MARK: - Private Properties

    private var manager: SocketManager?
    private var socket: SocketIOClient?
    private var userId: String?
    private(set) var deviceId: String?

    // Reconnect
    private var reconnectAttempts: Int = 0
    private let maxReconnectAttempts: Int = 10

    // Heartbeat
    private var heartbeatTimer: Timer?
    private var lastPongTime: Date = Date()
    private let heartbeatInterval: TimeInterval = 30

    // Event handlers storage
    private var eventHandlers: [String: [(Any) -> Void]] = [:]
    private let handlerLock = NSLock()

    // TTS
    private let ttsService = TTSService.shared
    @Published var ttsEnabled: Bool = true
    @Published var ttsLanguage: TTSLanguage = .chinese

    // MARK: - Configuration

    private var channelUrl: String {
        #if DEBUG
        return "http://localhost:8765"
        #else
        return "https://api.trix3d.com"
        #endif
    }

    // MARK: - Initialization

    private init() {
        deviceId = getOrCreateDeviceId()
        loadPersistedState()
    }

    // MARK: - Computed Properties

    var isConnected: Bool {
        if case .connected = connectionState {
            return true
        }
        return false
    }

    // MARK: - Public Methods

    func connect() async throws {
        guard let supabaseUserId = await getSupabaseUserId() else {
            throw ClawbotError.userNotLoggedIn
        }

        self.userId = supabaseUserId

        await MainActor.run {
            connectionState = .connecting
        }

        // Create Socket.IO manager
        let config: SocketIOClientConfiguration = [
            .log(false),
            .compress,
            .forceWebsockets(true),
            .reconnects(false), // Handle reconnection manually
        ]

        manager = SocketManager(socketURL: URL(string: channelUrl)!, config: config)
        socket = manager?.defaultSocket

        setupEventHandlers()

        socket?.connect()
    }

    func disconnect() {
        stopHeartbeat()
        socket?.disconnect()
        socket = nil
        manager = nil

        DispatchQueue.main.async {
            self.connectionState = .disconnected
            self.botState = .idle
        }
    }

    // MARK: - Pairing

    func checkPairingStatus() async throws -> ClawbotPairingStatus {
        guard isConnected, let socket = socket, let userId = userId else {
            throw ClawbotError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            socket.emitWithAck(with: "check_pairing_status", ["userId": userId]) { response in
                guard let dict = response as? [String: Any],
                      let success = dict["success"] as? Bool, success else {
                    continuation.resume(returning: ClawbotPairingStatus(
                        paired: false,
                        deviceId: nil,
                        deviceName: nil,
                        botOnline: nil,
                        pairedAt: nil
                    ))
                    return
                }

                let data = dict["data"] as? [String: Any] ?? [:]
                let paired = data["paired"] as? Bool ?? false
                let deviceId = data["deviceId"] as? String
                let deviceName = data["deviceName"] as? String
                let botOnline = data["botOnline"] as? Bool
                let pairedAt = data["pairedAt"] as? String

                continuation.resume(returning: ClawbotPairingStatus(
                    paired: paired,
                    deviceId: deviceId,
                    deviceName: deviceName,
                    botOnline: botOnline,
                    pairedAt: pairedAt
                ))
            }
        }
    }

    func pairWithCode(_ code: String) async throws -> Bool {
        guard isConnected, let socket = socket, let userId = userId else {
            throw ClawbotError.notConnected
        }

        let normalizedCode = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard normalizedCode.count == 6 else {
            throw ClawbotError.invalidResponse
        }

        return try await withCheckedThrowingContinuation { continuation in
            socket.emitWithAck(with: "pair_with_code", ["code": normalizedCode, "userId": userId]) { response in
                guard let dict = response as? [String: Any] else {
                    continuation.resume(throwing: ClawbotError.invalidResponse)
                    return
                }

                if let success = dict["success"] as? Bool, success {
                    continuation.resume(returning: true)
                } else {
                    let error = dict["error"] as? String ?? "配对失败"
                    continuation.resume(throwing: ClawbotError.messageFailed(error))
                }
            }
        }
    }

    func pairWithToken(_ token: String) async throws -> Bool {
        guard isConnected, let socket = socket, let userId = userId else {
            throw ClawbotError.notConnected
        }

        // Parse token from QR code data
        let normalizedData = token.trimmingCharacters(in: .whitespacesAndNewlines)
        var qrToken: String?

        // Try to parse as JSON
        if let data = normalizedData.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            qrToken = json["token"] as? String ?? json["pairingToken"] as? String
        }

        // Check prefix
        if qrToken == nil {
            if normalizedData.hasPrefix("trix:pair:") {
                qrToken = String(normalizedData.dropFirst(10))
            } else if normalizedData.count >= 10 {
                qrToken = normalizedData
            }
        }

        guard let finalToken = qrToken, finalToken.count >= 10 else {
            throw ClawbotError.invalidResponse
        }

        return try await withCheckedThrowingContinuation { continuation in
            socket.emitWithAck(with: "pair_with_token", ["token": finalToken, "userId": userId]) { response in
                guard let dict = response as? [String: Any] else {
                    continuation.resume(throwing: ClawbotError.invalidResponse)
                    return
                }

                if let success = dict["success"] as? Bool, success {
                    continuation.resume(returning: true)
                } else {
                    let error = dict["error"] as? String ?? "配对失败"
                    continuation.resume(throwing: ClawbotError.messageFailed(error))
                }
            }
        }
    }

    func pairWithQR(_ qrData: String) async throws -> Bool {
        return try await pairWithToken(qrData)
    }

    func unpair() {
        socket?.emit("unpair")

        DispatchQueue.main.async {
            self.isPaired = false
            self.deviceId = nil
            self.botState = .idle
            self.clearPersistedState()
        }
    }

    // MARK: - Messages

    func sendMessage(_ content: String, contentType: ClawbotMessageContentType = .text, mediaUrl: String? = nil, mediaMimeType: String? = nil) async throws {
        guard isConnected, let socket = socket else {
            throw ClawbotError.notConnected
        }

        guard isPaired else {
            throw ClawbotError.notPaired
        }

        let messageId = generateMessageId()

        // Set bot state to thinking
        DispatchQueue.main.async {
            self.botState = .thinking
        }

        // Emit message with ACK
        socket.emitWithAck(with: "app_message", [
            "content": content,
            "contentType": contentType.rawValue,
            "mediaUrl": mediaUrl as Any,
            "mediaMimeType": mediaMimeType as Any,
            "messageId": messageId
        ])
    }

    // MARK: - Study Room

    func createStudyRoom(displayName: String, avatarUrl: String? = nil, maxMembers: Int? = nil) async throws -> ClawbotStudyRoomState {
        guard isConnected, let socket = socket, let userId = userId else {
            throw ClawbotError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            socket.emitWithAck(with: "study_room_create", [
                "userId": userId,
                "displayName": displayName,
                "avatarUrl": avatarUrl as Any,
                "maxMembers": maxMembers as Any
            ]) { response in
                guard let dict = response as? [String: Any],
                      let success = dict["success"] as? Bool, success,
                      let roomData = dict["room"] as? [String: Any] else {
                    continuation.resume(throwing: ClawbotError.invalidResponse)
                    return
                }

                if let room = self.parseStudyRoomState(roomData) {
                    continuation.resume(returning: room)
                } else {
                    continuation.resume(throwing: ClawbotError.invalidResponse)
                }
            }
        }
    }

    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String? = nil) async throws -> ClawbotStudyRoomState {
        guard isConnected, let socket = socket, let userId = userId else {
            throw ClawbotError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            socket.emitWithAck(with: "study_room_join", [
                "userId": userId,
                "roomCode": roomCode,
                "displayName": displayName,
                "avatarUrl": avatarUrl as Any
            ]) { response in
                guard let dict = response as? [String: Any],
                      let success = dict["success"] as? Bool, success,
                      let roomData = dict["room"] as? [String: Any] else {
                    continuation.resume(throwing: ClawbotError.invalidResponse)
                    return
                }

                if let room = self.parseStudyRoomState(roomData) {
                    continuation.resume(returning: room)
                } else {
                    continuation.resume(throwing: ClawbotError.invalidResponse)
                }
            }
        }
    }

    func leaveStudyRoom(roomCode: String?) async throws {
        guard isConnected, let socket = socket, let userId = userId else {
            throw ClawbotError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            socket.emitWithAck(with: "study_room_leave", [
                "userId": userId,
                "roomCode": roomCode as Any
            ]) { response in
                guard let dict = response as? [String: Any],
                      let success = dict["success"] as? Bool, success else {
                    continuation.resume(throwing: ClawbotError.invalidResponse)
                    return
                }
                continuation.resume()
            }
        }
    }

    // MARK: - Host Actions

    /// Perform host action (start_focus, pause, end)
    func hostActionStudyRoom(roomCode: String, action: StudyRoomHostAction) async throws -> ClawbotStudyRoomState {
        guard isConnected, let socket = socket, let userId = userId else {
            throw ClawbotError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            socket.emitWithAck(with: "study_room_host_action", [
                "userId": userId,
                "roomCode": roomCode,
                "action": action.rawValue
            ]) { response in
                guard let dict = response as? [String: Any],
                      let success = dict["success"] as? Bool, success,
                      let roomData = dict["room"] as? [String: Any] else {
                    continuation.resume(throwing: ClawbotError.invalidResponse)
                    return
                }

                if let room = self.parseStudyRoomState(roomData) {
                    continuation.resume(returning: room)
                } else {
                    continuation.resume(throwing: ClawbotError.invalidResponse)
                }
            }
        }
    }

    // MARK: - Private Methods

    private func getOrCreateDeviceId() -> String {
        let key = "clawbot_channel_device_id"

        // 尝试从 Keychain 读取
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecSuccess, let data = item as? Data,
           let deviceId = String(data: data, encoding: .utf8) {
            return deviceId
        }

        // 创建新的设备 ID
        let newId = "app_\(generateSecureRandomString(9))_\(Int(Date().timeIntervalSince1970))"

        // 存储到 Keychain
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: newId.data(using: .utf8)!
        ]

        // 如果已存在，先删除
        SecItemDelete(query as CFDictionary)

        // 添加新值
        SecItemAdd(addQuery as CFDictionary, nil)

        return newId
    }

    private func generateSecureRandomString(_ length: Int) -> String {
        // 使用密码学安全的随机数生成器
        var randomBytes = [UInt8](repeating: 0, count: length)
        let status = SecRandomCopyBytes(kSecRandomDefault, length, &randomBytes)

        guard status == errSecSuccess else {
            // Fallback to UUID (less secure but better than failing)
            let uuid = UUID().uuidString.replacingOccurrences(of: "-", with: "")
            return String(uuid.prefix(length))
        }

        return randomBytes.map { String(format: "%02x", $0) }.joined()
    }

    private func generateMessageId() -> String {
        return "\(Int(Date().timeIntervalSince1970 * 1000))-\(generateSecureRandomString(9))"
    }

    private func getSupabaseUserId() async -> String? {
        return await MainActor.run {
            AuthService.shared.currentUser?.id
        }
    }

    // MARK: - Event Handlers Setup

    private func setupEventHandlers() {
        guard let socket = socket else { return }

        // Connect
        socket.on(clientEvent: .connect) { [weak self] _, _ in
            self?.handleConnected()
        }

        // Disconnect
        socket.on(clientEvent: .disconnect) { [weak self] _, _ in
            DispatchQueue.main.async {
                self?.connectionState = .disconnected
                self?.stopHeartbeat()
            }
        }

        // Reconnecting
        socket.on(clientEvent: .reconnect) { [weak self] data, _ in
            guard let attempt = (data.first as? Int) else { return }
            DispatchQueue.main.async {
                self?.connectionState = .reconnecting(attempt: attempt)
            }
        }

        // Custom events
        socket.on("pairing_success") { [weak self] data, _ in
            guard let dict = data.first as? [String: Any],
                  let deviceId = dict["deviceId"] as? String else { return }

            DispatchQueue.main.async {
                self?.isPaired = true
                self?.deviceId = deviceId
                self?.persistPairingState()
            }
        }

        socket.on("unpaired") { [weak self] _, _ in
            DispatchQueue.main.async {
                self?.isPaired = false
                self?.deviceId = nil
                self?.clearPersistedState()
            }
        }

        socket.on("bot_message") { [weak self] data, _ in
            guard let dict = data.first as? [String: Any] else { return }
            self?.handleBotMessage(dict)
        }

        socket.on("bot_online") { [weak self] data, _ in
            SecureLogger.shared.info("[ClawbotChannel] Bot online: \(data)")
        }

        socket.on("bot_offline") { [weak self] data, _ in
            SecureLogger.shared.info("[ClawbotChannel] Bot offline: \(data)")
        }

        socket.on("pong") { [weak self] _, _ in
            self?.lastPongTime = Date()
        }

        // Study Room State
        socket.on("study_room_state") { [weak self] data, _ in
            guard let data = data.first else { return }

            // Handle different data formats (Socket.IO can send different types)
            if let jsonData = data as? [String: Any] {
                // Already parsed JSON
                self?.handleStudyRoomStateEvent(jsonData)
            } else if let jsonString = data as? String,
                      let jsonData = jsonString.data(using: .utf8),
                      let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                self?.handleStudyRoomStateEvent(parsed)
            }
        }

        socket.on("error") { [weak self] data, _ in
            if let error = data.first as? String {
                SecureLogger.shared.error("[ClawbotChannel] Error: \(error)")
                DispatchQueue.main.async {
                    self?.connectionState = .error(error)
                }
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

            // State machine for TTS
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

    private func handleStudyRoomStateEvent(_ json: [String: Any]) {
        // Try to decode as StudyRoomState directly
        if let jsonData = try? JSONSerialization.data(withJSONObject: json),
           let state = try? JSONDecoder().decode(StudyRoomState.self, from: jsonData) {
            DispatchQueue.main.async {
                self.currentStudyRoomState = state
            }
            return
        }

        // Try to decode as StudyRoomStateEvent (wrapper with room property)
        if let jsonData = try? JSONSerialization.data(withJSONObject: json),
           let event = try? JSONDecoder().decode(StudyRoomStateEvent.self, from: jsonData),
           let room = event.room {
            DispatchQueue.main.async {
                self.currentStudyRoomState = room
            }
            return
        }

        SecureLogger.shared.warning("[ClawbotChannel] Failed to parse study_room_state event: \(json)")
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

    private func parseStudyRoomState(_ data: [String: Any]) -> ClawbotStudyRoomState? {
        guard let roomCode = data["roomCode"] as? String,
              let roomName = data["roomName"] as? String,
              let hostId = data["hostId"] as? String,
              let hostName = data["hostName"] as? String,
              let status = data["status"] as? String else {
            return nil
        }

        let participants = (data["participants"] as? [[String: Any]] ?? []).compactMap { p -> ClawbotStudyRoomState.StudyRoomParticipant? in
            guard let userId = p["userId"] as? String,
                  let displayName = p["displayName"] as? String else { return nil }
            return ClawbotStudyRoomState.StudyRoomParticipant(
                userId: userId,
                displayName: displayName,
                avatarUrl: p["avatarUrl"] as? String,
                isHost: p["isHost"] as? Bool ?? false,
                joinedAt: nil
            )
        }

        return ClawbotStudyRoomState(
            roomCode: roomCode,
            roomName: roomName,
            hostId: hostId,
            hostName: hostName,
            participants: participants,
            status: status,
            createdAt: nil
        )
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

            self.socket?.emit("ping")
        }
    }

    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
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
