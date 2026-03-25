//
//  ClawbotChannelService.swift
//  TRIX3DCompanion
//
//  Clawbot Channel Service - 连接 OpenClaw 后端配对服务
//  基于 OpenClaw Gateway Protocol 原生 WebSocket 协议
//  协议规范: https://github.com/trix3d/trix-openclaw-native/blob/main/docs/protocol.md
//

import Foundation
import Combine
import AVFoundation
import UIKit

// MARK: - Native WebSocket Client Adapter

/// 原生 WebSocket 客户端适配器 - 替代 Socket.IO
private final class NativeWebSocketClient: @unchecked Sendable {

    // MARK: - Types

    enum Event: Sendable {
        case connected(Data)
        case disconnected(Error?)
        case message(Data)
    }

    // MARK: - Properties

    private var webSocketTask: URLSessionWebSocketTask?
    private let session: URLSession
    private let queue: DispatchQueue
    private var isReceiving = false
    private var messageHandler: ((Event) -> Void)?

    // MARK: - Initialization

    init() {
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
        self.queue = DispatchQueue(label: "com.trix3d.websocket", qos: .userInitiated)
    }

    // MARK: - Connection

    /// 连接 WebSocket - URL 格式: ws://host:port/ws?role=user&conversationId=xxx&clientId=xxx&clientToken=xxx
    func connect(to url: URL) {
        disconnect()

        var request = URLRequest(url: url)
        request.timeoutInterval = 15

        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()

        startReceiving()
    }

    /// 断开连接
    func disconnect() {
        isReceiving = false
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
    }

    /// 发送消息
    func send(_ data: Data, completion: @escaping (Error?) -> Void) {
        guard let task = webSocketTask else {
            completion(ClawbotError.notConnected)
            return
        }

        let message = URLSessionWebSocketTask.Message.data(data)
        task.send(message) { error in
            completion(error)
        }
    }

    /// 接收文本消息
    func send(_ text: String, completion: @escaping (Error?) -> Void) {
        guard let task = webSocketTask else {
            completion(ClawbotError.notConnected)
            return
        }

        let message = URLSessionWebSocketTask.Message.string(text)
        task.send(message) { error in
            completion(error)
        }
    }

    /// 设置消息处理器
    func setMessageHandler(_ handler: @escaping (Event) -> Void) {
        self.messageHandler = handler
    }

    // MARK: - Private

    private func startReceiving() {
        guard !isReceiving else { return }
        isReceiving = true

        receiveNext()
    }

    private func receiveNext() {
        guard isReceiving, let task = webSocketTask else { return }

        task.receive { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let message):
                switch message {
                case .data(let data):
                    self.queue.async {
                        self.messageHandler?(.message(data))
                    }
                case .string(let text):
                    if let data = text.data(using: .utf8) {
                        self.queue.async {
                            self.messageHandler?(.message(data))
                        }
                    }
                @unknown default:
                    break
                }
                // 继续接收下一条消息
                self.receiveNext()

            case .failure(let error):
                self.isReceiving = false
                self.queue.async {
                    self.messageHandler?(.disconnected(error))
                }
            }
        }
    }
}

// MARK: - WebSocket Protocol Interface

/// 统一协议接口 - 同时支持 Socket.IO 风格事件和原生 WebSocket
private protocol WebSocketClientProtocol: AnyObject {
    func connect(to url: URL)
    func disconnect()
    func send(_ data: Data, completion: @escaping (Error?) -> Void)
    func send(_ text: String, completion: @escaping (Error?) -> Void)
    func setMessageHandler(_ handler: @escaping (NativeWebSocketClient.Event) -> Void)
}

// MARK: - HTTP Client for REST API

/// HTTP 客户端 - 用于配对和消息发送
private final class ChannelHTTPClient: @unchecked Sendable {

    private let session: URLSession
    private let queue = DispatchQueue(label: "com.trix3d.http", qos: .userInitiated)
    var overrideBaseURL: String?

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
    }

    // MARK: - Pairing

    /// 配对请求 - POST /api/pairings/:code/claim
    /// 服务器期望的请求体: { clientId, deviceName, secret? }
    func claimPairing(
        code: String,
        clientId: String,
        deviceName: String,
        accountId: String? = nil,
        secret: String? = nil,
        completion: @escaping (Result<PairingClaimResponse, Error>) -> Void
    ) {
        var body: [String: Any] = [
            "clientId": clientId,
            "deviceName": deviceName
        ]
        if let accountId = accountId, !accountId.isEmpty {
            body["accountId"] = accountId
        }
        if let secret = secret, !secret.isEmpty {
            body["secret"] = secret
        }

        // RESTful 风格的配对端点
        post("/api/pairings/\(code.uppercased())/claim", body: body, headers: authHeaders()) { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(PairingClaimResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(error))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    /// 取消配对 - DELETE /api/pairings/:clientId
    func unpair(
        clientId: String,
        clientToken: String,
        completion: @escaping (Result<Void, Error>) -> Void
    ) {
        delete("/api/pairings/\(clientId)", headers: ["Authorization": "Bearer \(clientToken)"]) { result in
            switch result {
            case .success:
                completion(.success(()))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    // MARK: - Messages

    /// 发送消息 - POST /api/messages
    func sendMessage(
        conversationId: String,
        clientToken: String,
        text: String,
        uploadedAttachmentIds: [String] = [],
        localId: String = UUID().uuidString,
        completion: @escaping (Result<MessageResponse, Error>) -> Void
    ) {
        let body: [String: Any] = [
            "conversationId": conversationId,
            "clientToken": clientToken,
            "text": text,
            "uploadedAttachmentIds": uploadedAttachmentIds,
            "localId": localId
        ]

        post("/api/messages", body: body) { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(MessageResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(error))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    /// 上传媒体文件 - POST /api/uploads
    func uploadMedia(data: Data, mimeType: String, filename: String, conversationId: String, clientToken: String, completion: @escaping (Result<MediaUploadResponse, Error>) -> Void) {
        var request = URLRequest(url: URL(string: baseURL + "/api/uploads")!)
        request.httpMethod = "POST"
        request.setValue(filename.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? filename, forHTTPHeaderField: "X-File-Name")
        request.setValue(mimeType, forHTTPHeaderField: "X-Mime-Type")
        request.setValue(conversationId, forHTTPHeaderField: "X-Trix-Conversation-Id")
        request.setValue(clientToken, forHTTPHeaderField: "X-Trix-Client-Token")
        request.httpBody = data

        queue.async { [weak self] in
            self?.session.dataTask(with: request) { data, response, error in
                if let error = error {
                    completion(.failure(error))
                    return
                }
                guard let data = data else {
                    completion(.failure(ClawbotError.invalidResponse))
                    return
                }
                do {
                    let resp = try JSONDecoder().decode(MediaUploadResponse.self, from: data)
                    completion(.success(resp))
                } catch {
                    completion(.failure(error))
                }
            }.resume()
        }
    }

    func restorePairingSession(
        accountId: String?,
        clientId: String,
        deviceName: String,
        completion: @escaping (Result<PairingClaimResponse, Error>) -> Void
    ) {
        let body: [String: Any] = [
            "accountId": accountId ?? "default",
            "clientId": clientId,
            "deviceName": deviceName
        ]

        post("/api/client/session/restore", body: body, headers: authHeaders()) { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(PairingClaimResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(error))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    // MARK: - Private

    private var baseURL: String {
        if let overrideBaseURL, !overrideBaseURL.isEmpty {
            return normalizeBaseURL(overrideBaseURL)
        }
        #if DEBUG
        let raw = UserDefaults.standard.string(forKey: "clawbot.channel.url") ?? ""
        return raw.isEmpty ? "https://trix.love" : normalizeBaseURL(raw)
        #else
        return "https://trix.love"
        #endif
    }

    private func normalizeBaseURL(_ value: String) -> String {
        var result = value
        if result.hasPrefix("ws://") {
            result = result.replacingOccurrences(of: "ws://", with: "http://")
        } else if result.hasPrefix("wss://") {
            result = result.replacingOccurrences(of: "wss://", with: "https://")
        }
        return result
    }

    private func post(_ path: String, body: [String: Any], headers: [String: String] = [:], completion: @escaping (Result<Data, Error>) -> Void) {
        guard let url = URL(string: baseURL + path) else {
            completion(.failure(ClawbotError.invalidResponse))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(.failure(error))
            return
        }

        queue.async { [weak self] in
            self?.session.dataTask(with: request) { data, response, error in
                if let error = error {
                    completion(.failure(error))
                    return
                }
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode >= 400 {
                    completion(.failure(ClawbotError.messageFailed("HTTP \(httpResponse.statusCode)")))
                } else if let data = data {
                    completion(.success(data))
                } else {
                    completion(.failure(ClawbotError.invalidResponse))
                }
            }.resume()
        }
    }

    private func authHeaders() -> [String: String] {
        guard let accessToken = KeychainManager.shared.getAccessToken(), !accessToken.isEmpty else {
            return [:]
        }
        return ["Authorization": "Bearer \(accessToken)"]
    }

    private func get(_ path: String, completion: @escaping (Result<Data, Error>) -> Void) {
        guard let url = URL(string: baseURL + path) else {
            completion(.failure(ClawbotError.invalidResponse))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        queue.async { [weak self] in
            self?.session.dataTask(with: request) { data, _, error in
                if let error = error {
                    completion(.failure(error))
                } else if let data = data {
                    completion(.success(data))
                } else {
                    completion(.failure(ClawbotError.invalidResponse))
                }
            }.resume()
        }
    }

    private func delete(_ path: String, headers: [String: String] = [:], completion: @escaping (Result<Void, Error>) -> Void) {
        guard let url = URL(string: baseURL + path) else {
            completion(.failure(ClawbotError.invalidResponse))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        queue.async { [weak self] in
            self?.session.dataTask(with: request) { _, _, error in
                if let error = error {
                    completion(.failure(error))
                } else {
                    completion(.success(()))
                }
            }.resume()
        }
    }

    // MARK: - Study Room

    /// 创建学习房间 - POST /api/study-rooms
    func createStudyRoom(userId: String, displayName: String, avatarUrl: String?, maxMembers: Int?, completion: @escaping (Result<StudyRoomResponse, Error>) -> Void) {
        var body: [String: Any] = [
            "userId": userId,
            "displayName": displayName
        ]
        if let avatarUrl = avatarUrl { body["avatarUrl"] = avatarUrl }
        if let maxMembers = maxMembers { body["maxMembers"] = maxMembers }

        post("/api/study-rooms", body: body) { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(StudyRoomResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(error))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    /// 加入学习房间 - POST /api/study-rooms/:roomCode/join
    func joinStudyRoom(roomCode: String, userId: String, displayName: String, avatarUrl: String?, completion: @escaping (Result<StudyRoomResponse, Error>) -> Void) {
        var body: [String: Any] = [
            "userId": userId,
            "displayName": displayName
        ]
        if let avatarUrl = avatarUrl { body["avatarUrl"] = avatarUrl }

        post("/api/study-rooms/\(roomCode)/join", body: body) { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(StudyRoomResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(error))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    /// 离开学习房间 - POST /api/study-rooms/:roomCode/leave
    func leaveStudyRoom(roomCode: String, userId: String, completion: @escaping (Result<StudyRoomResponse, Error>) -> Void) {
        let body: [String: Any] = ["userId": userId]

        post("/api/study-rooms/\(roomCode)/leave", body: body) { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(StudyRoomResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(error))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    /// 学习房间主机操作 - POST /api/study-rooms/:roomCode/action
    func hostActionStudyRoom(roomCode: String, userId: String, action: String, completion: @escaping (Result<StudyRoomResponse, Error>) -> Void) {
        let body: [String: Any] = [
            "userId": userId,
            "action": action
        ]

        post("/api/study-rooms/\(roomCode)/action", body: body) { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(StudyRoomResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(error))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    /// 获取学习房间状态 - GET /api/study-rooms/:roomCode
    func getStudyRoom(roomCode: String, completion: @escaping (Result<StudyRoomResponse, Error>) -> Void) {
        get("/api/study-rooms/\(roomCode)") { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(StudyRoomResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(error))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    /// 获取所有学习房间 - GET /api/study-rooms
    func listStudyRooms(completion: @escaping (Result<StudyRoomListResponse, Error>) -> Void) {
        get("/api/study-rooms") { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(StudyRoomListResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(error))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }
}

// MARK: - API Response Models

/// 配对响应
struct PairingClaimResponse: Codable {
    let accountId: String?
    let conversationId: String
    let clientToken: String
    let peerId: String?
    let websocketUrl: String?
    let wsUrl: String?
    let uploadUrl: String?
    let messagesUrl: String?
    let serverUrl: String?
    let pairing: PairingRecord?
    let agentOnline: Bool?

    var resolvedWebSocketURL: String {
        websocketUrl ?? wsUrl ?? ""
    }
}

/// 配对记录
struct PairingRecord: Codable {
    let pairedAt: Int?
    let pairedClientId: String?
    let pairedDeviceName: String?
}

/// 消息响应
struct MessageResponse: Codable {
    struct MessageEnvelope: Codable {
        let id: String
    }

    let message: MessageEnvelope?

    var messageId: String? {
        message?.id
    }
}

// MARK: - Study Room API Response Models

/// 学习房间响应
struct StudyRoomResponse: Codable {
    let success: Bool
    let room: StudyRoomState?
    let error: String?
}

/// 学习房间列表响应
struct StudyRoomListResponse: Codable {
    let success: Bool
    let rooms: [StudyRoomState]?
}

/// 媒体上传响应
struct MediaUploadResponse: Codable {
    struct Attachment: Codable {
        let id: String
        let publicUrl: String?
        let mimeType: String
        let sizeBytes: Int?
    }

    let attachment: Attachment

    var id: String { attachment.id }
    var url: String { attachment.publicUrl ?? "" }
    var mimeType: String { attachment.mimeType }
    var size: Int? { attachment.sizeBytes }
}

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

/// Bot 连接状态
enum BotConnectionState: String {
    case online
    case offline
    case connecting
    case unknown
}

/// Bot 行为状态
enum BotBehaviorState: String {
    case idle
    case thinking
    case speaking
}

/// 消息发送状态
enum MessageSendStatus: String {
    case pending
    case sent
    case failed
}

// MARK: - Protocol

protocol ClawbotChannelServiceProtocol: ObservableObject {
    var connectionState: ClawbotConnectionState { get }
    var isConnected: Bool { get }
    var isPaired: Bool { get }
    var isBotOnline: Bool { get }
    var botConnectionState: BotConnectionState { get }
    var botBehaviorState: BotBehaviorState { get }
    var botState: BotBehaviorState { get }
    var lastMessage: ClawbotMessage? { get }
    var deviceId: String? { get }

    // Publishers for Combine bindings
    var connectionStatePublisher: AnyPublisher<ClawbotConnectionState, Never> { get }
    var lastMessagePublisher: AnyPublisher<ClawbotMessage?, Never> { get }
    var botStatePublisher: AnyPublisher<BotBehaviorState, Never> { get }

    // TTS
    var ttsEnabled: Bool { get set }
    var ttsLanguage: TTSLanguage { get set }

    // Connection
    func connect() async throws
    func disconnect()

    // Pairing
    func checkPairingStatus() async throws -> ClawbotPairingStatus
    func pairWithCode(_ code: String) async throws -> Bool
    func pairWithQR(_ qrData: String) async throws -> Bool
    func unpair()

    // Messages
    func sendMessage(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?) async throws
    func sendMessageWithCallback(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?, completion: @escaping (Result<String, Error>) -> Void) async throws

    // Study Room
    func createStudyRoom(displayName: String, avatarUrl: String?, maxMembers: Int?) async throws -> StudyRoomState
    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String?) async throws -> StudyRoomState
    func leaveStudyRoom(roomCode: String?) async throws
    func hostActionStudyRoom(roomCode: String, action: StudyRoomHostAction) async throws -> StudyRoomState
}


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

final class ClawbotChannelService: ObservableObject, ClawbotChannelServiceProtocol, @unchecked Sendable {

    // MARK: - Singleton

    static let shared = ClawbotChannelService()

    // MARK: - Published Properties

    @Published private(set) var connectionState: ClawbotConnectionState = .disconnected
    @Published private(set) var isPaired: Bool = false
    @Published private(set) var lastMessage: ClawbotMessage?
    @Published private(set) var botBehaviorState: BotBehaviorState = .idle
    @Published private(set) var botConnectionState: BotConnectionState = .unknown
    @Published private(set) var isBotOnline: Bool = false
    @Published private(set) var currentStudyRoomState: StudyRoomState?
    @Published private(set) var pendingMessages: [String: MessageSendStatus] = [:]

    /// Backward compatible botState
    @Published private(set) var botState: BotBehaviorState = .idle

    // MARK: - Private Properties

    // 原生 WebSocket 客户端
    private let wsClient = NativeWebSocketClient()
    private let httpClient = ChannelHTTPClient()

    // 会话信息 (从配对响应获取)
    private var conversationId: String?
    private var clientToken: String?
    private var websocketUrl: String?
    private var serverUrl: String?
    private var accountId: String?
    private var userId: String?
    private var pairedAppUserId: String?
    private(set) var deviceId: String?

    // Reconnect
    private var reconnectAttempts: Int = 0
    private let maxReconnectAttempts: Int = 10

    // Heartbeat
    private var heartbeatTimer: Timer?
    private let heartbeatInterval: TimeInterval = 30
    private var isConnectionActive: Bool = false

    // Pending message callbacks
    private var pendingMessageCompletions: [String: (Result<String, Error>) -> Void] = [:]
    private let messageCompletionLock = NSLock()
    private var pendingReplyKeys = Set<String>()
    private var replyAliasMap: [String: String] = [:]
    private var isTtsSpeaking = false
    private let connectStateLock = NSLock()
    private var isConnectInFlight = false

    // Event handlers storage
    private var eventHandlers: [String: [(Any) -> Void]] = [:]
    private let handlerLock = NSLock()
    private var cancellables = Set<AnyCancellable>()

    // TTS
    @Published var ttsEnabled: Bool = true
    @Published var ttsLanguage: TTSLanguage = .chinese

    // MARK: - Protocol Publishers

    var connectionStatePublisher: AnyPublisher<ClawbotConnectionState, Never> {
        $connectionState.eraseToAnyPublisher()
    }

    var lastMessagePublisher: AnyPublisher<ClawbotMessage?, Never> {
        $lastMessage.eraseToAnyPublisher()
    }

    var botStatePublisher: AnyPublisher<BotBehaviorState, Never> {
        $botState.eraseToAnyPublisher()
    }

    // MARK: - Configuration

    private let channelURLDefaultsKey = "clawbot.channel.url"
    private let debugChannelUserIdDefaultsKey = "clawbot.channel.debugUserId"

    private var baseURL: String {
        #if DEBUG
        let defaults = UserDefaults.standard
        let raw = defaults.string(forKey: channelURLDefaultsKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return raw.isEmpty ? "https://trix.love" : normalizeBaseURL(raw)
        #else
        return "https://trix.love"
        #endif
    }

    private var wsURL: String {
        #if DEBUG
        let raw = baseURL
        if raw.hasPrefix("https://") {
            return raw.replacingOccurrences(of: "https://", with: "wss://") + "/ws"
        } else {
            return raw.replacingOccurrences(of: "http://", with: "ws://") + "/ws"
        }
        #else
        return "wss://trix.love/ws"
        #endif
    }

    private func normalizeBaseURL(_ value: String) -> String {
        var result = value
        if result.hasPrefix("ws://") {
            result = result.replacingOccurrences(of: "ws://", with: "http://")
        } else if result.hasPrefix("wss://") {
            result = result.replacingOccurrences(of: "wss://", with: "https://")
        }
        return result
    }

    // MARK: - Initialization

    private init() {
        deviceId = getOrCreateDeviceId()
        loadPersistedState()
        setupWebSocketHandler()
        Task { @MainActor [weak self] in
            self?.observeTtsState()
        }
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
        guard beginConnectIfNeeded() else {
            NSLog("[TRIX-UI] service connect skipped state=%{public}@ active=%{public}@",
                  describeConnectionState(connectionState),
                  String(isConnectionActive))
            return
        }
        defer { endConnectAttempt() }

        guard let resolvedUserId = await resolveChannelUserId() else {
            throw ClawbotError.userNotLoggedIn
        }

        self.userId = resolvedUserId

        if let pairedAppUserId, !pairedAppUserId.isEmpty, pairedAppUserId != resolvedUserId {
            conversationId = nil
            clientToken = nil
            websocketUrl = nil
            serverUrl = nil
            accountId = "default"
            await MainActor.run {
                self.isPaired = false
            }
            clearPersistedPairingState()
        }

        await MainActor.run {
            connectionState = .connecting
        }

        // 如果已经有配对信息，直接连接 WebSocket
        if let convId = conversationId, let token = clientToken, let wsUrl = websocketUrl {
            await connectWebSocket(wsUrl: wsUrl, conversationId: convId, token: token)
        } else {
            let restored = await restorePairingSessionIfNeeded(for: resolvedUserId)
            if !restored {
                await MainActor.run {
                    connectionState = .disconnected
                }
            }
        }
    }

    func disconnect() {
        stopHeartbeat()
        wsClient.disconnect()

        DispatchQueue.main.async {
            self.connectionState = .disconnected
            self.setBotBehaviorState(.idle)
            self.botConnectionState = .unknown
            self.isBotOnline = false
            self.isConnectionActive = false
            self.pendingMessages.removeAll()
            self.pendingReplyKeys.removeAll()
            self.replyAliasMap.removeAll()
            self.messageCompletionLock.lock()
            self.pendingMessageCompletions.removeAll()
            self.messageCompletionLock.unlock()
        }
    }

    // MARK: - Pairing

    /// 检查配对状态 - 从本地存储判断
    /// 服务器没有状态查询端点，配对状态通过 WebSocket 连接状态和本地存储判断
    func checkPairingStatus() async throws -> ClawbotPairingStatus {
        // 从本地 Keychain 获取配对信息
        if let storedDeviceId = try? KeychainManager.shared.getPairedDeviceId(),
           let storedDeviceName = try? KeychainManager.shared.getPairedDeviceName() {
            return ClawbotPairingStatus(
                paired: isPaired,
                deviceId: storedDeviceId,
                deviceName: storedDeviceName,
                botOnline: isBotOnline,
                pairedAt: nil  // 配对时间未存储，可扩展
            )
        }

        return ClawbotPairingStatus(
            paired: isPaired,
            deviceId: deviceId,
            deviceName: nil,
            botOnline: isBotOnline,
            pairedAt: nil
        )
    }

    /// 获取设备名称
    private var deviceName: String {
        #if os(iOS)
        return UIDevice.current.name
        #else
        return "TRIX Device"
        #endif
    }

    func pairWithCode(_ code: String) async throws -> Bool {
        let resolvedUserId: String
        if let existing = userId {
            resolvedUserId = existing
        } else if let resolved = await resolveChannelUserId() {
            resolvedUserId = resolved
        } else {
            throw ClawbotError.userNotLoggedIn
        }

        let normalizedCode = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard normalizedCode.count == 6 else {
            throw ClawbotError.invalidResponse
        }

        let clientIdValue = deviceId ?? "ios_\(resolvedUserId.prefix(8))_\(Date().timeIntervalSince1970)"

        return try await withCheckedThrowingContinuation { continuation in
            httpClient.claimPairing(
                code: normalizedCode,
                clientId: clientIdValue,
                deviceName: deviceName,
                accountId: nil,
                secret: nil
            ) { [weak self] result in
                switch result {
                case .success(let response):
                    self?.handlePairingSuccess(response)
                    continuation.resume(returning: true)
                case .failure(let error):
                    continuation.resume(throwing: ClawbotError.messageFailed(error.localizedDescription))
                }
            }
        }
    }

    /// 解析二维码/链接数据
    /// 支持格式:
    /// 1. URL: https://trix.love/pair?code=ABC123&secret=xxx
    /// 2. JSON: { "claimUrl": "..."} / { "url": "..."} / { "code": "ABC123", "secret": "xxx", "serverUrl": "https://..." }
    /// 3. 纯配对码: ABC123
    /// 4. code:secret 格式: ABC123:xxx
    private func parseQRData(_ raw: String) -> (code: String, secret: String?, serverUrl: String?, accountId: String?)? {
        let normalized = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return nil }

        // 1. 尝试解析为 URL
        if normalized.hasPrefix("http://") || normalized.hasPrefix("https://") {
            guard let url = URL(string: normalized),
                  let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
                return nil
            }

            let code = (components.queryItems?.first(where: { $0.name == "code" })?.value ?? "").uppercased()
            let secret = components.queryItems?.first(where: { $0.name == "secret" })?.value
            let accountId = components.queryItems?.first(where: { $0.name == "accountId" })?.value
            let serverUrl = "\(url.scheme ?? "http")://\(url.host ?? "")\(url.port.map { ":\($0)" } ?? "")"

            if !code.isEmpty {
                return (code, secret, serverUrl, accountId)
            }
        }

        // 2. 尝试解析为 JSON
        if let data = normalized.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let claimUrl = json["claimUrl"] as? String {
                return parseQRData(claimUrl)
            }
            if let url = json["url"] as? String {
                return parseQRData(url)
            }

            let code = (json["code"] as? String ?? "").uppercased()
            let secret = json["secret"] as? String
            let serverUrl = json["serverUrl"] as? String
            let accountId = json["accountId"] as? String

            if !code.isEmpty {
                return (code, secret, serverUrl, accountId)
            }
        }

        // 3. 尝试 code:secret 格式
        if normalized.contains(":") {
            let parts = normalized.split(separator: ":", maxSplits: 1)
            if parts.count == 2 {
                let code = String(parts[0]).uppercased()
                let secret = String(parts[1])
                if !code.isEmpty && code.count >= 6 {
                    return (code, secret, nil, nil)
                }
            }
        }

        // 4. 纯配对码 (6-8位字母数字)
        let pureCode = normalized.uppercased()
        if pureCode.count == 6 && pureCode.allSatisfy({ $0.isLetter || $0.isNumber }) {
            return (pureCode, nil, nil, nil)
        }

        return nil
    }

    func pairWithQR(_ qrData: String) async throws -> Bool {
        // 解析二维码内容
        guard let parsed = parseQRData(qrData) else {
            throw ClawbotError.invalidResponse
        }

        let resolvedUserId: String
        if let existing = userId {
            resolvedUserId = existing
        } else if let resolved = await resolveChannelUserId() {
            resolvedUserId = resolved
        } else {
            throw ClawbotError.userNotLoggedIn
        }

        let clientIdValue = deviceId ?? "ios_\(resolvedUserId.prefix(8))_\(Int(Date().timeIntervalSince1970))"

        // 如果二维码包含服务器地址，更新 baseURL
        let previousOverrideBaseURL = httpClient.overrideBaseURL
        if let serverUrl = parsed.serverUrl {
            let normalizedServerURL = normalizeBaseURL(serverUrl)
            httpClient.overrideBaseURL = normalizedServerURL
            await MainActor.run {
                self.serverUrl = normalizedServerURL
            }
        }

        return try await withCheckedThrowingContinuation { continuation in
            httpClient.claimPairing(
                code: parsed.code,
                clientId: clientIdValue,
                deviceName: deviceName,
                accountId: parsed.accountId,
                secret: parsed.secret
            ) { [weak self] result in
                switch result {
                case .success(let response):
                    self?.handlePairingSuccess(response)
                    continuation.resume(returning: true)
                case .failure(let error):
                    self?.httpClient.overrideBaseURL = previousOverrideBaseURL
                    continuation.resume(throwing: ClawbotError.messageFailed(error.localizedDescription))
                }
            }
        }
    }

    func unpair() {
        guard let deviceId = deviceId, let token = clientToken else { return }

        httpClient.unpair(clientId: deviceId, clientToken: token) { _ in }

        DispatchQueue.main.async {
            self.isPaired = false
            self.clearPersistedPairingState()
            self.conversationId = nil
            self.clientToken = nil
            self.websocketUrl = nil
            self.serverUrl = nil
            self.accountId = nil
            self.pairedAppUserId = nil
            self.httpClient.overrideBaseURL = nil
            self.deviceId = nil
            self.setBotBehaviorState(.idle)
        }
    }

    // MARK: - Messages

    func sendMessage(
        _ content: String,
        contentType: ClawbotMessageContentType = .text,
        mediaUrl: String? = nil,
        mediaMimeType: String? = nil,
        mediaData: Data? = nil,
        mediaFileName: String? = nil
    ) async throws {
        guard let conversationId = conversationId, let clientToken = clientToken else {
            NSLog("[TRIX-UI] service send blocked not paired text=%{public}@", content)
            throw ClawbotError.notPaired
        }

        let localMessageId = generateMessageId()
        NSLog("[TRIX-UI] service send begin conv=%{public}@ localId=%{public}@ text=%{public}@",
              conversationId,
              localMessageId,
              content)
        let uploadedAttachmentIds = try await uploadAttachmentIdsIfNeeded(
            mediaData: mediaData,
            mediaMimeType: mediaMimeType,
            mediaFileName: mediaFileName,
            conversationId: conversationId,
            clientToken: clientToken
        )

        await MainActor.run {
            self.pendingMessages[localMessageId] = .pending
            self.registerPendingReplyKey(localMessageId)
            self.syncBotBehaviorState()
        }

        return try await withCheckedThrowingContinuation { continuation in
            httpClient.sendMessage(
                conversationId: conversationId,
                clientToken: clientToken,
                text: content,
                uploadedAttachmentIds: uploadedAttachmentIds,
                localId: localMessageId
            ) { [weak self] result in
                switch result {
                case .success(let response):
                    NSLog("[TRIX-UI] service send http ok localId=%{public}@ serverId=%{public}@",
                          localMessageId,
                          response.messageId ?? "")
                    DispatchQueue.main.async {
                        self?.pendingMessages[localMessageId] = .sent
                        if let serverMessageId = response.messageId {
                            self?.attachPendingReplyAlias(alias: serverMessageId, canonicalKey: localMessageId)
                        }
                    }
                    continuation.resume()
                case .failure(let error):
                    NSLog("[TRIX-UI] service send http failed localId=%{public}@ error=%{public}@",
                          localMessageId,
                          error.localizedDescription)
                    DispatchQueue.main.async {
                        self?.pendingMessages[localMessageId] = .failed
                        self?.clearPendingReplyKey(localMessageId)
                        self?.syncBotBehaviorState()
                    }
                    continuation.resume(throwing: ClawbotError.messageFailed(error.localizedDescription))
                }
            }
        }
    }

    func sendMessageWithCallback(
        _ content: String,
        contentType: ClawbotMessageContentType = .text,
        mediaUrl: String? = nil,
        mediaMimeType: String? = nil,
        mediaData: Data? = nil,
        mediaFileName: String? = nil,
        completion: @escaping (Result<String, Error>) -> Void
    ) async throws {
        guard let conversationId = conversationId, let clientToken = clientToken else {
            completion(.failure(ClawbotError.notPaired))
            throw ClawbotError.notPaired
        }

        let localMessageId = generateMessageId()
        let uploadedAttachmentIds = try await uploadAttachmentIdsIfNeeded(
            mediaData: mediaData,
            mediaMimeType: mediaMimeType,
            mediaFileName: mediaFileName,
            conversationId: conversationId,
            clientToken: clientToken
        )

        await MainActor.run {
            self.pendingMessages[localMessageId] = .pending
            self.registerPendingReplyKey(localMessageId)
            self.syncBotBehaviorState()
        }

        pendingMessageCompletions[localMessageId] = completion

        httpClient.sendMessage(
            conversationId: conversationId,
            clientToken: clientToken,
            text: content,
            uploadedAttachmentIds: uploadedAttachmentIds,
            localId: localMessageId
        ) { [weak self] result in
            switch result {
                case .success(let response):
                DispatchQueue.main.async {
                    self?.pendingMessages[localMessageId] = .sent
                    if let msgId = response.messageId {
                        self?.attachPendingReplyAlias(alias: msgId, canonicalKey: localMessageId)
                        self?.pendingMessageCompletions.removeValue(forKey: localMessageId)?(.success(msgId))
                    } else {
                        self?.pendingMessageCompletions.removeValue(forKey: localMessageId)?(.success(localMessageId))
                    }
                }
            case .failure(let error):
                DispatchQueue.main.async {
                    self?.pendingMessages[localMessageId] = .failed
                    self?.clearPendingReplyKey(localMessageId)
                    self?.syncBotBehaviorState()
                    self?.pendingMessageCompletions.removeValue(forKey: localMessageId)?(.failure(ClawbotError.messageFailed(error.localizedDescription)))
                }
            }
        }
    }

    // MARK: - Study Room (HTTP API)

    func createStudyRoom(displayName: String, avatarUrl: String? = nil, maxMembers: Int? = nil) async throws -> StudyRoomState {
        let resolvedUserId: String
        if let existing = userId {
            resolvedUserId = existing
        } else if let resolved = await resolveChannelUserId() {
            resolvedUserId = resolved
        } else {
            throw ClawbotError.userNotLoggedIn
        }

        return try await withCheckedThrowingContinuation { continuation in
            httpClient.createStudyRoom(userId: resolvedUserId, displayName: displayName, avatarUrl: avatarUrl, maxMembers: maxMembers) { [weak self] result in
                switch result {
                case .success(let response):
                    if let room = response.room {
                        self?.currentStudyRoomState = room
                        continuation.resume(returning: room)
                    } else {
                        continuation.resume(throwing: ClawbotError.messageFailed(response.error ?? "Failed to create room"))
                    }
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String? = nil) async throws -> StudyRoomState {
        let resolvedUserId: String
        if let existing = userId {
            resolvedUserId = existing
        } else if let resolved = await resolveChannelUserId() {
            resolvedUserId = resolved
        } else {
            throw ClawbotError.userNotLoggedIn
        }

        return try await withCheckedThrowingContinuation { continuation in
            httpClient.joinStudyRoom(roomCode: roomCode, userId: resolvedUserId, displayName: displayName, avatarUrl: avatarUrl) { [weak self] result in
                switch result {
                case .success(let response):
                    if let room = response.room {
                        self?.currentStudyRoomState = room
                        continuation.resume(returning: room)
                    } else {
                        continuation.resume(throwing: ClawbotError.messageFailed(response.error ?? "Failed to join room"))
                    }
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func leaveStudyRoom(roomCode: String?) async throws {
        let resolvedUserId: String
        if let existing = userId {
            resolvedUserId = existing
        } else if let resolved = await resolveChannelUserId() {
            resolvedUserId = resolved
        } else {
            throw ClawbotError.userNotLoggedIn
        }

        let targetRoomCode = roomCode ?? currentStudyRoomState?.roomCode ?? ""

        return try await withCheckedThrowingContinuation { continuation in
            httpClient.leaveStudyRoom(roomCode: targetRoomCode, userId: resolvedUserId) { [weak self] result in
                switch result {
                case .success:
                    self?.currentStudyRoomState = nil
                    continuation.resume()
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func hostActionStudyRoom(roomCode: String, action: StudyRoomHostAction) async throws -> StudyRoomState {
        let resolvedUserId: String
        if let existing = userId {
            resolvedUserId = existing
        } else if let resolved = await resolveChannelUserId() {
            resolvedUserId = resolved
        } else {
            throw ClawbotError.userNotLoggedIn
        }

        return try await withCheckedThrowingContinuation { continuation in
            httpClient.hostActionStudyRoom(roomCode: roomCode, userId: resolvedUserId, action: action.rawValue) { [weak self] result in
                switch result {
                case .success(let response):
                    if let room = response.room {
                        self?.currentStudyRoomState = room
                        continuation.resume(returning: room)
                    } else {
                        continuation.resume(throwing: ClawbotError.messageFailed(response.error ?? "Failed to perform action"))
                    }
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    // MARK: - Private Methods

    /// 处理配对成功
    private func handlePairingSuccess(_ response: PairingClaimResponse) {
        self.accountId = response.accountId ?? "default"
        self.conversationId = response.conversationId
        self.clientToken = response.clientToken
        self.websocketUrl = response.resolvedWebSocketURL
        self.serverUrl = response.serverUrl
        self.pairedAppUserId = userId
        self.httpClient.overrideBaseURL = response.serverUrl

        DispatchQueue.main.async {
            self.isPaired = true
            self.deviceId = response.pairing?.pairedClientId ?? self.deviceId
            self.isBotOnline = response.agentOnline ?? false
            self.botConnectionState = response.agentOnline == true ? .online : .offline
            self.persistPairingState()
        }

        // 连接 WebSocket
        Task {
            let wsUrl = response.resolvedWebSocketURL.isEmpty ? self.wsURL : response.resolvedWebSocketURL
            await self.connectWebSocket(wsUrl: wsUrl, conversationId: response.conversationId, token: response.clientToken)
        }
    }

    /// 连接 WebSocket
    private func connectWebSocket(wsUrl: String, conversationId: String, token: String) async {
        await MainActor.run {
            connectionState = .connecting
        }

        // 构建 WebSocket URL with auth params
        let wsFullUrl = buildWebSocketURL(base: wsUrl, conversationId: conversationId, token: token)

        guard let url = URL(string: wsFullUrl) else {
            await MainActor.run {
                connectionState = .error("Invalid WebSocket URL")
            }
            return
        }

        wsClient.connect(to: url)
    }

    /// 构建带认证参数的 WebSocket URL
    private func buildWebSocketURL(base: String, conversationId: String, token: String) -> String {
        var url = base

        // 确保 base URL 包含 /ws
        if !url.contains("/ws") {
            if url.hasSuffix("/") {
                url += "ws"
            } else {
                url += "/ws"
            }
        }

        // 添加认证参数
        let clientId = self.deviceId ?? getOrCreateDeviceId()
        let separator = url.contains("?") ? "&" : "?"
        url += "\(separator)role=user&conversationId=\(conversationId)&clientId=\(clientId)&clientToken=\(token)"

        return url
    }

    /// 设置 WebSocket 消息处理器
    private func setupWebSocketHandler() {
        wsClient.setMessageHandler { [weak self] event in
            self?.handleWebSocketEvent(event)
        }
    }

    /// 处理 WebSocket 事件
    private func handleWebSocketEvent(_ event: NativeWebSocketClient.Event) {
        switch event {
        case .connected:
            DispatchQueue.main.async {
                self.connectionState = .connected
                self.reconnectAttempts = 0
                self.botConnectionState = .connecting
                self.isConnectionActive = true
                self.startHeartbeat()
            }

        case .disconnected(let error):
            DispatchQueue.main.async {
                self.connectionState = .disconnected
                self.stopHeartbeat()
                self.isConnectionActive = false

                if let error = error {
                    SecureLogger.shared.error("[ClawbotChannel] WebSocket disconnected: \(error.localizedDescription)")
                }
            }

            // 尝试重连
            if reconnectAttempts < maxReconnectAttempts {
                reconnectAttempts += 1
                DispatchQueue.main.async {
                    self.connectionState = .reconnecting(attempt: self.reconnectAttempts)
                }
                attemptReconnect()
            }

        case .message(let data):
            handleMessageData(data)
        }
    }

    /// 处理收到的消息数据
    private func handleMessageData(_ data: Data) {
        // 解析 JSON envelope: { type: string, payload: any }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let eventType = json["type"] as? String else {
            NSLog("[TRIX-UI] ws message parse failed bytes=%{public}d", data.count)
            return
        }

        NSLog("[TRIX-UI] ws event type=%{public}@ bytes=%{public}d", eventType, data.count)
        let payload = json["payload"] as? [String: Any] ?? [:]

        switch eventType {
        case "connected":
            handleConnectedEvent(payload)

        case "agent.status":
            handleAgentStatusEvent(payload)

        case "message.created":
            handleMessageCreatedEvent(payload)

        case "study_room_state":
            handleStudyRoomStateEvent(payload)

        case "pong":
            isConnectionActive = true
            SecureLogger.shared.debug("[ClawbotChannel] Pong received")

        default:
            SecureLogger.shared.debug("[ClawbotChannel] Unknown event type: \(eventType)")
        }
    }

    /// 处理 connected 事件
    private func handleConnectedEvent(_ payload: [String: Any]) {
        let agentOnline = payload["agentOnline"] as? Bool ?? false
        let role = payload["role"] as? String ?? "user"

        SecureLogger.shared.info("[ClawbotChannel] Connected as \(role), agent online: \(agentOnline)")

        DispatchQueue.main.async {
            self.isBotOnline = agentOnline
            self.botConnectionState = agentOnline ? .online : .offline
        }
    }

    /// 处理 agent.status 事件
    private func handleAgentStatusEvent(_ payload: [String: Any]) {
        let isOnline = payload["online"] as? Bool ?? false

        DispatchQueue.main.async {
            self.isBotOnline = isOnline
            self.botConnectionState = isOnline ? .online : .offline
        }

        SecureLogger.shared.info("[ClawbotChannel] Agent status: \(isOnline ? "online" : "offline")")
    }

    /// 处理 message.created 事件
    private func handleMessageCreatedEvent(_ payload: [String: Any]) {
        let messagePayload = payload["message"] as? [String: Any] ?? payload
        let messageId = messagePayload["id"] as? String ?? generateMessageId()
        let content = messagePayload["text"] as? String ?? messagePayload["content"] as? String ?? ""
        let senderRaw = messagePayload["sender"] as? String ?? messagePayload["senderId"] as? String ?? ""
        let replyToMessageId = messagePayload["replyToMessageId"] as? String
        let timestampMs = messagePayload["createdAt"] as? Int ?? messagePayload["timestamp"] as? Int
        let timestamp = timestampMs.map { Date(timeIntervalSince1970: TimeInterval($0) / 1000) } ?? Date()

        // 判断发送者 - 来自 agent/bot 的消息
        let isFromBot = senderRaw.lowercased() == "agent" ||
                       senderRaw.lowercased() == "bot" ||
                       senderRaw.lowercased().hasPrefix("openclaw:") ||
                       senderRaw != (userId ?? "")

        NSLog("[TRIX-UI] ws message.created id=%{public}@ sender=%{public}@ userId=%{public}@ fromBot=%{public}@ text=%{public}@",
              messageId,
              senderRaw,
              userId ?? "",
              String(isFromBot),
              String(content.prefix(80)))

        if !isFromBot {
            // 忽略自己发送的消息
            NSLog("[TRIX-UI] ws ignored self-authored message id=%{public}@", messageId)
            return
        }

        let attachments = messagePayload["attachments"] as? [[String: Any]] ?? []
        let firstAttachment = attachments.first

        let message = ClawbotMessage(
            id: messageId,
            content: content,
            contentType: attachments.isEmpty ? .text : .mixed,
            mediaUrl: firstAttachment?["publicUrl"] as? String ?? firstAttachment?["url"] as? String ?? messagePayload["mediaUrl"] as? String,
            mediaMimeType: firstAttachment?["mimeType"] as? String ?? messagePayload["mediaMimeType"] as? String,
            timestamp: timestamp,
            sender: .bot
        )

        DispatchQueue.main.async {
            self.clearPendingReplyKey(replyToMessageId)
            self.lastMessage = message
            self.syncBotBehaviorState()
            NSLog("[TRIX-UI] ws accepted bot message id=%{public}@ replyTo=%{public}@",
                  messageId,
                  replyToMessageId ?? "")
        }

        if ttsEnabled && !content.isEmpty {
            DispatchQueue.main.async {
                Task {
                    await self.speakBotMessage(content)
                }
            }
        }
    }

    /// 尝试重连
    private func attemptReconnect() {
        guard let convId = conversationId, let token = clientToken, let wsUrl = websocketUrl else {
            return
        }

        DispatchQueue.global().asyncAfter(deadline: .now() + 2.0) { [weak self] in
            let wsFullUrl = self?.buildWebSocketURL(base: wsUrl, conversationId: convId, token: token) ?? ""
            if let url = URL(string: wsFullUrl) {
                self?.wsClient.connect(to: url)
            }
        }
    }

    @MainActor
    private func observeTtsState() {
        TTSService.shared.$isSpeaking
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isSpeaking in
                self?.isTtsSpeaking = isSpeaking
                self?.syncBotBehaviorState()
            }
            .store(in: &cancellables)
    }

    private func syncBotBehaviorState() {
        if isTtsSpeaking {
            setBotBehaviorState(.speaking)
            return
        }

        if !pendingReplyKeys.isEmpty {
            setBotBehaviorState(.thinking)
            return
        }

        setBotBehaviorState(.idle)
    }

    private func registerPendingReplyKey(_ canonicalKey: String) {
        pendingReplyKeys.insert(canonicalKey)
        replyAliasMap[canonicalKey] = canonicalKey
    }

    private func attachPendingReplyAlias(alias: String?, canonicalKey: String) {
        guard let alias, !alias.isEmpty else {
            return
        }
        replyAliasMap[alias] = canonicalKey
    }

    private func clearPendingReplyKey(_ alias: String?) {
        guard let alias, !alias.isEmpty else {
            return
        }

        let canonicalKey = replyAliasMap[alias] ?? alias
        pendingReplyKeys.remove(canonicalKey)
        replyAliasMap = replyAliasMap.filter { key, value in
            key != canonicalKey && value != canonicalKey
        }
    }

    private func uploadAttachmentIdsIfNeeded(
        mediaData: Data?,
        mediaMimeType: String?,
        mediaFileName: String?,
        conversationId: String,
        clientToken: String
    ) async throws -> [String] {
        guard let mediaData, !mediaData.isEmpty else {
            return []
        }

        let fileName = mediaFileName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? mediaFileName!
            : "attachment-\(Int(Date().timeIntervalSince1970)).jpg"
        let mimeType = mediaMimeType?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? mediaMimeType!
            : "image/jpeg"

        return try await withCheckedThrowingContinuation { continuation in
            httpClient.uploadMedia(
                data: mediaData,
                mimeType: mimeType,
                filename: fileName,
                conversationId: conversationId,
                clientToken: clientToken
            ) { result in
                switch result {
                case .success(let response):
                    continuation.resume(returning: [response.id])
                case .failure(let error):
                    continuation.resume(throwing: ClawbotError.messageFailed(error.localizedDescription))
                }
            }
        }
    }

    private func restorePairingSessionIfNeeded(for userId: String) async -> Bool {
        let clientIdValue = deviceId ?? getOrCreateDeviceId()
        let resolvedAccountId = accountId ?? "default"

        return await withCheckedContinuation { continuation in
            httpClient.restorePairingSession(
                accountId: resolvedAccountId,
                clientId: clientIdValue,
                deviceName: deviceName
            ) { [weak self] result in
                switch result {
                case .success(let response):
                    guard let self else {
                        continuation.resume(returning: false)
                        return
                    }
                    self.userId = userId
                    self.handlePairingSuccess(response)
                    continuation.resume(returning: true)
                case .failure:
                    continuation.resume(returning: false)
                }
            }
        }
    }

    /// Helper method to set bot behavior state and sync with backward compatible botState
    private func setBotBehaviorState(_ state: BotBehaviorState) {
        botBehaviorState = state
        botState = state
    }

    private func beginConnectIfNeeded() -> Bool {
        connectStateLock.lock()
        defer { connectStateLock.unlock() }

        if isConnectInFlight {
            return false
        }

        switch connectionState {
        case .connected where isConnectionActive:
            return false
        case .connecting, .reconnecting:
            return false
        default:
            break
        }

        isConnectInFlight = true
        return true
    }

    private func endConnectAttempt() {
        connectStateLock.lock()
        isConnectInFlight = false
        connectStateLock.unlock()
    }

    private func describeConnectionState(_ state: ClawbotConnectionState) -> String {
        switch state {
        case .disconnected:
            return "disconnected"
        case .connecting:
            return "connecting"
        case .connected:
            return "connected"
        case .reconnecting(let attempt):
            return "reconnecting(\(attempt))"
        case .error(let message):
            return "error(\(message))"
        }
    }

    // MARK: - Study Room Helpers

    /// 处理 study_room_state 事件
    private func handleStudyRoomStateEvent(_ payload: [String: Any]) {
        let roomCode = payload["roomCode"] as? String ?? ""
        let reason = payload["reason"] as? String ?? ""

        SecureLogger.shared.info("[ClawbotChannel] Study room state event: \(reason) for room \(roomCode)")

        // 解析房间数据
        if let roomData = payload["room"] as? [String: Any] {
            if let room = parseStudyRoomState(from: roomData) {
                DispatchQueue.main.async {
                    self.currentStudyRoomState = room
                }
            }
        }

        // 如果房间被删除，清除状态
        if reason == "deleted" || payload["room"] == nil {
            DispatchQueue.main.async {
                self.currentStudyRoomState = nil
            }
        }
    }

    /// 解析 StudyRoomState JSON (使用 snake_case)
    private func parseStudyRoomState(from json: [String: Any]) -> StudyRoomState? {
        guard let roomCode = json["room_code"] as? String ?? json["roomCode"] as? String,
              let hostUserId = json["host_user_id"] as? String ?? json["hostUserId"] as? String else {
            return nil
        }

        let sessionStateRaw = json["session_state"] as? String ?? json["sessionState"] as? String ?? "idle"
        let sessionState = StudyRoomSessionState(rawValue: sessionStateRaw) ?? .idle

        let members: [StudyRoomMember] = (json["members"] as? [[String: Any]] ?? []).compactMap { m in
            guard let userId = m["user_id"] as? String ?? m["userId"] as? String,
                  let displayName = m["display_name"] as? String ?? m["displayName"] as? String else {
                return nil
            }
            let statusRaw = m["status"] as? String ?? "online"
            let joinedAtValue = m["joined_at"] as? Int ?? m["joinedAt"] as? Int ?? 0
            let lastActiveAtValue = m["last_active_at"] as? Int ?? m["lastActiveAt"] as? Int ?? 0
            return StudyRoomMember(
                userId: userId,
                displayName: displayName,
                avatarUrl: m["avatar_url"] as? String ?? m["avatarUrl"] as? String,
                joinedAt: Date(timeIntervalSince1970: TimeInterval(joinedAtValue) / 1000),
                lastActiveAt: Date(timeIntervalSince1970: TimeInterval(lastActiveAtValue) / 1000),
                status: StudyRoomMemberStatus(rawValue: statusRaw) ?? .online
            )
        }

        var timer: StudyRoomTimerState? = nil
        if let timerData = json["timer"] as? [String: Any] {
            let durationSec = timerData["duration_seconds"] as? Int ?? timerData["durationSeconds"] as? Int ?? 0
            let startedAtVal = timerData["started_at"] as? Int ?? timerData["startedAt"] as? Int ?? 0
            let endsAtVal = timerData["ends_at"] as? Int ?? timerData["endsAt"] as? Int ?? 0
            let remainingSec = timerData["remaining_seconds"] as? Int ?? timerData["remainingSeconds"] as? Int ?? 0
            timer = StudyRoomTimerState(
                durationSeconds: durationSec,
                startedAt: Date(timeIntervalSince1970: TimeInterval(startedAtVal) / 1000),
                endsAt: Date(timeIntervalSince1970: TimeInterval(endsAtVal) / 1000),
                remainingSeconds: remainingSec
            )
        }

        let createdAtValue = json["created_at"] as? Int ?? json["createdAt"] as? Int ?? 0
        let updatedAtValue = json["updated_at"] as? Int ?? json["updatedAt"] as? Int ?? 0

        return StudyRoomState(
            roomCode: roomCode,
            hostUserId: hostUserId,
            sessionState: sessionState,
            members: members,
            maxMembers: json["max_members"] as? Int ?? json["maxMembers"] as? Int ?? 10,
            version: json["version"] as? Int ?? 1,
            createdAt: Date(timeIntervalSince1970: TimeInterval(createdAtValue) / 1000),
            updatedAt: Date(timeIntervalSince1970: TimeInterval(updatedAtValue) / 1000),
            timer: timer
        )
    }

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

        SecItemDelete(query as CFDictionary)
        SecItemAdd(addQuery as CFDictionary, nil)

        return newId
    }

    private func generateSecureRandomString(_ length: Int) -> String {
        var randomBytes = [UInt8](repeating: 0, count: length)
        let status = SecRandomCopyBytes(kSecRandomDefault, length, &randomBytes)

        guard status == errSecSuccess else {
            let uuid = UUID().uuidString.replacingOccurrences(of: "-", with: "")
            return String(uuid.prefix(length))
        }

        return randomBytes.map { String(format: "%02x", $0) }.joined()
    }

    private func generateMessageId() -> String {
        return "\(Int(Date().timeIntervalSince1970 * 1000))-\(generateSecureRandomString(9))"
    }

    private func resolveChannelUserId() async -> String? {
        if let userId = await getSupabaseUserId() {
            return userId
        }

        #if DEBUG
        let fallbackFromDefaults = UserDefaults.standard
            .string(forKey: debugChannelUserIdDefaultsKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !fallbackFromDefaults.isEmpty {
            return fallbackFromDefaults
        }

        if let deviceId, !deviceId.isEmpty {
            return "debug-\(deviceId)"
        }
        #endif

        return nil
    }

    private func getSupabaseUserId() async -> String? {
        await MainActor.run {
            AuthService.shared.currentUser?.id
        }
    }

    @MainActor
    private func speakBotMessage(_ text: String) async {
        let ttsService = TTSService.shared

        await ttsService.stop()
        await ttsService.setVoice(language: ttsLanguage)

        do {
            try await ttsService.speak(text, language: ttsLanguage.rawValue)
        } catch {
            SecureLogger.shared.error("TTS Error: \(error.localizedDescription)")
        }
    }

    // MARK: - Persistence

    private func persistPairingState() {
        if let deviceId = deviceId {
            do {
                try KeychainManager.shared.savePairedDevice(deviceId: deviceId, deviceName: deviceName)
            } catch {
                SecureLogger.shared.error("Failed to save paired device to Keychain: \(error)")
            }
        }

        let defaults = UserDefaults.standard
        let resolvedAccountId = accountId ?? "default"
        defaults.set(isPaired, forKey: "clawbot_paired")
        defaults.set(deviceId, forKey: "clawbot_device_id")
        defaults.set(resolvedAccountId, forKey: "clawbot_active_account_id")
        defaults.set(resolvedAccountId, forKey: "clawbot_account_id")
        defaults.set(userId, forKey: sessionDefaultsKey("app_user_id", accountId: resolvedAccountId))
        defaults.set(conversationId, forKey: sessionDefaultsKey("conversation_id", accountId: resolvedAccountId))
        defaults.set(clientToken, forKey: sessionDefaultsKey("client_token", accountId: resolvedAccountId))
        defaults.set(websocketUrl, forKey: sessionDefaultsKey("websocket_url", accountId: resolvedAccountId))
        defaults.set(serverUrl, forKey: sessionDefaultsKey("server_url", accountId: resolvedAccountId))
        defaults.set(userId, forKey: "clawbot_app_user_id")
        defaults.set(conversationId, forKey: "clawbot_conversation_id")
        defaults.set(clientToken, forKey: "clawbot_client_token")
        defaults.set(websocketUrl, forKey: "clawbot_websocket_url")
        defaults.set(serverUrl, forKey: "clawbot_server_url")
    }

    private func loadPersistedState() {
        let defaults = UserDefaults.standard
        isPaired = KeychainManager.shared.isDevicePaired()
        deviceId = KeychainManager.shared.getPairedDeviceId()
        let resolvedAccountId = defaults.string(forKey: "clawbot_active_account_id")
            ?? defaults.string(forKey: "clawbot_account_id")
            ?? "default"
        accountId = resolvedAccountId
        pairedAppUserId = defaults.string(forKey: sessionDefaultsKey("app_user_id", accountId: resolvedAccountId))
            ?? defaults.string(forKey: "clawbot_app_user_id")
        conversationId = defaults.string(forKey: sessionDefaultsKey("conversation_id", accountId: resolvedAccountId))
            ?? defaults.string(forKey: "clawbot_conversation_id")
        clientToken = defaults.string(forKey: sessionDefaultsKey("client_token", accountId: resolvedAccountId))
            ?? defaults.string(forKey: "clawbot_client_token")
        websocketUrl = defaults.string(forKey: sessionDefaultsKey("websocket_url", accountId: resolvedAccountId))
            ?? defaults.string(forKey: "clawbot_websocket_url")
        serverUrl = defaults.string(forKey: sessionDefaultsKey("server_url", accountId: resolvedAccountId))
            ?? defaults.string(forKey: "clawbot_server_url")
        httpClient.overrideBaseURL = serverUrl

        if !isPaired {
            isPaired = defaults.bool(forKey: "clawbot_paired")
        }
        if deviceId == nil {
            deviceId = defaults.string(forKey: "clawbot_device_id")
        }
    }

    private func clearPersistedState() {
        try? KeychainManager.shared.removePairedDevice()
        UserDefaults.standard.removeObject(forKey: "clawbot_paired")
        UserDefaults.standard.removeObject(forKey: "clawbot_device_id")
        UserDefaults.standard.removeObject(forKey: "clawbot_conversation_id")
        UserDefaults.standard.removeObject(forKey: "clawbot_client_token")
        UserDefaults.standard.removeObject(forKey: "clawbot_websocket_url")
        UserDefaults.standard.removeObject(forKey: "clawbot_server_url")
        UserDefaults.standard.removeObject(forKey: "clawbot_account_id")
        UserDefaults.standard.removeObject(forKey: "clawbot_active_account_id")
        UserDefaults.standard.removeObject(forKey: "clawbot_app_user_id")
    }

    private func clearPersistedPairingState() {
        let defaults = UserDefaults.standard
        let resolvedAccountId = accountId ?? defaults.string(forKey: "clawbot_active_account_id") ?? "default"
        defaults.removeObject(forKey: sessionDefaultsKey("conversation_id", accountId: resolvedAccountId))
        defaults.removeObject(forKey: sessionDefaultsKey("client_token", accountId: resolvedAccountId))
        defaults.removeObject(forKey: sessionDefaultsKey("websocket_url", accountId: resolvedAccountId))
        defaults.removeObject(forKey: sessionDefaultsKey("server_url", accountId: resolvedAccountId))
        defaults.removeObject(forKey: sessionDefaultsKey("app_user_id", accountId: resolvedAccountId))
        clearPersistedState()
    }

    private func sessionDefaultsKey(_ suffix: String, accountId: String) -> String {
        "clawbot_session_\(accountId)_\(suffix)"
    }

    // MARK: - Heartbeat

    private func startHeartbeat() {
        stopHeartbeat()
        isConnectionActive = true

        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: heartbeatInterval, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            // 发送 ping 消息
            let pingEnvelope: [String: Any] = ["type": "ping", "payload": [:]]
            if let data = try? JSONSerialization.data(withJSONObject: pingEnvelope),
               let text = String(data: data, encoding: .utf8) {
                self.wsClient.send(text) { error in
                    if let error = error {
                        SecureLogger.shared.warning("[ClawbotChannel] Ping failed: \(error.localizedDescription)")
                        self.handleConnectionLost()
                    } else {
                        SecureLogger.shared.debug("[ClawbotChannel] Ping sent")
                    }
                }
            }
        }

        if let timer = heartbeatTimer {
            RunLoop.main.add(timer, forMode: .common)
        }
    }

    private func handleConnectionLost() {
        DispatchQueue.main.async {
            self.connectionState = .reconnecting(attempt: self.reconnectAttempts + 1)
            self.botConnectionState = .connecting
            self.isConnectionActive = false
        }

        if reconnectAttempts < maxReconnectAttempts {
            attemptReconnect()
        }
    }

    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }

    // MARK: - Cleanup

    deinit {
        stopHeartbeat()
        pendingMessageCompletions.removeAll()
        SecureLogger.shared.info("[ClawbotChannel] Service deallocated")
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
