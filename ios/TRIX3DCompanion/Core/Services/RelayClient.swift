//
//  RelayClient.swift
//  TRIX3DCompanion
//
//  Relay Client - 使用原生 WebSocket + JSON-RPC 协议
//  兼容 ClawPilot NPM 包
//

import Foundation
import Combine
import CryptoKit

// MARK: - Connection Mode

enum ConnectionMode: String, Codable {
    case relay      // 中继模式 (扫码/输入配对码)
    case gateway    // 直连 Gateway
    case socketIO   // Socket.IO 配对 (已废弃)
}

// MARK: - Relay QR Payload

struct RelayQRPayload: Codable {
    let version: Int
    let server: String
    let gatewayId: String
    let accessCode: String
    let displayName: String?
}

// MARK: - JSON-RPC Frame Types

enum FrameType: String, Codable {
    case req
    case res
    case event
}

struct RequestFrame: Codable {
    let type: FrameType
    let id: String
    let method: String
    let params: [String: AnyCodable]?
}

struct ResponseFrame: Codable {
    let type: FrameType
    let id: String
    let ok: Bool
    let payload: AnyCodable?
    let error: ErrorFrame?
}

struct EventFrame: Codable {
    let type: FrameType
    let event: String
    let payload: AnyCodable?
    let seq: Int?
}

struct ErrorFrame: Codable {
    let message: String
}

// MARK: - Relay Client

final class RelayClient: NSObject, ObservableObject {
    static let shared = RelayClient()

    // MARK: - Properties

    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession!

    @Published private(set) var connected = false
    @Published private(set) var authenticated = false
    @Published private(set) var gatewayId: String?
    @Published private(set) var displayName: String?

    private var serverUrl: String?
    private var currentGatewayId: String?
    private var currentAccessCode: String?
    private var gatewaySessionKey: String?
    private var connectChallengeNonce: String?
    private var gatewayModeEnabled = false
    private var directGatewayMode = false

    private var eventHandlers = [String: [((Any?) -> Void)]]()
    private var pendingRequests = [String: CheckedContinuation<[String: Any], Error>]()
    private var messageQueue: [RequestFrame] = []

    private var reconnectAttempts = 0
    private var maxReconnectAttempts = 10
    private var reconnectDelay: TimeInterval = 2000
    private var stopped = false

    // MARK: - Subjects

    let connectionSubject = CurrentValueSubject<Bool, Never>(false)
    let errorSubject = PassthroughSubject<Error, Never>()
    let messageSubject = PassthroughSubject<[String: Any], Never>()

    // MARK: - Initialization

    private override init() {
        super.init()
        setupURLSession()
    }

    private func setupURLSession() {
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        urlSession = URLSession(configuration: config, delegate: self, delegateQueue: .main)
    }

    // MARK: - Parse QR Code

    /// 解析 QR 码内容
    func parseQRContent(_ content: String) -> RelayQRPayload? {
        guard let data = content.data(using: .utf8) else { return nil }

        do {
            let payload = try JSONDecoder().decode(RelayQRPayload.self, from: data)
            return payload
        } catch {
            SecureLogger.shared.warning("RelayClient: Failed to parse QR content: \(error.localizedDescription)")
            return nil
        }
    }

    // MARK: - Connect

    /// 连接到中继服务器
    func connect(server: String, gatewayId: String, accessCode: String) async throws {
        let relayUrl = buildWebSocketURL(server: server)
        directGatewayMode = isDirectGatewayURL(server)
        SecureLogger.shared.info("RelayClient: Connecting to \(relayUrl)")

        self.serverUrl = server
        self.currentGatewayId = gatewayId
        self.currentAccessCode = accessCode
        self.stopped = false

        guard let url = URL(string: relayUrl) else {
            throw RelayError.invalidURL
        }

        return try await withCheckedThrowingContinuation { continuation in
            let finishLock = NSLock()
            var continuationRef: CheckedContinuation<Void, Error>? = continuation
            var timeoutWorkItem: DispatchWorkItem?
            func finish(_ result: Result<Void, Error>) {
                let toResume: CheckedContinuation<Void, Error>?
                finishLock.lock()
                toResume = continuationRef
                continuationRef = nil
                timeoutWorkItem?.cancel()
                finishLock.unlock()

                guard let toResume else { return }
                switch result {
                case .success:
                    toResume.resume()
                case let .failure(error):
                    toResume.resume(throwing: error)
                }
            }

            webSocket = urlSession.webSocketTask(with: url)
            webSocket?.resume()

            // 等待连接
            self.receiveMessage()

            // 连接超时
            let workItem = DispatchWorkItem { [weak self] in
                if !(self?.connected ?? false) {
                    self?.webSocket?.cancel()
                    finish(.failure(RelayError.connectionFailed))
                }
            }
            timeoutWorkItem = workItem
            DispatchQueue.main.asyncAfter(deadline: .now() + 10, execute: workItem)

            // 认证
            Task {
                do {
                    let displayName = try await self.authenticateWithOpenClawGateway(
                        gatewayId: gatewayId,
                        accessCode: accessCode
                    )
                    await MainActor.run {
                        self.connected = true
                        self.authenticated = true
                        self.gatewayId = gatewayId
                        self.displayName = displayName
                        self.reconnectAttempts = 0
                        self.connectionSubject.send(true)
                    }
                    self.flushMessageQueue()
                    finish(.success(()))
                } catch {
                    if !self.directGatewayMode && self.shouldFallbackToLegacyRelay(error) {
                        // Legacy relay fallback: old /relay auth flow.
                        do {
                            let displayName = try await self.authenticate(gatewayId: gatewayId, accessCode: accessCode)
                            await MainActor.run {
                                self.connected = true
                                self.authenticated = true
                                self.gatewayId = gatewayId
                                self.displayName = displayName
                                self.reconnectAttempts = 0
                                self.gatewayModeEnabled = false
                                self.connectionSubject.send(true)
                            }
                            self.flushMessageQueue()
                            finish(.success(()))
                        } catch {
                            await MainActor.run {
                                self.connected = false
                                self.authenticated = false
                                self.webSocket?.cancel()
                            }
                            finish(.failure(error))
                        }
                    } else {
                        await MainActor.run {
                            self.connected = false
                            self.authenticated = false
                            self.webSocket?.cancel()
                        }
                        finish(.failure(error))
                    }
                }
            }
        }
    }

    private func authenticateWithOpenClawGateway(gatewayId: String, accessCode: String) async throws -> String? {
        connectChallengeNonce = nil

        let params: [String: Any] = [
            "minProtocol": 3,
            "maxProtocol": 3,
            "role": "operator",
            "scopes": ["operator.read", "operator.write"],
            "client": [
                // OpenClaw local gateway schema currently only accepts these values.
                "id": "cli",
                "displayName": "TRIX iOS",
                "version": "1.0.0",
                "platform": "ios",
                "mode": "backend",
                "instanceId": "ios-\(UUID().uuidString)"
            ],
            "auth": [
                "token": accessCode
            ]
        ]

        _ = try await request(method: "connect", params: params)
        gatewayModeEnabled = true
        gatewaySessionKey = resolveGatewaySessionKey(from: gatewayId)
        return "OpenClaw"
    }

    private func shouldFallbackToLegacyRelay(_ error: Error) -> Bool {
        guard case let RelayError.serverError(message) = error else {
            return false
        }
        let lowercased = message.lowercased()
        return lowercased.contains("unknown method")
            || lowercased.contains("method not found")
            || lowercased.contains("unsupported method")
    }

    private func buildWebSocketURL(server: String) -> String {
        let trimmed = server.trimmingCharacters(in: .whitespacesAndNewlines)
        let wsServer = trimmed
            .replacingOccurrences(of: "http://", with: "ws://")
            .replacingOccurrences(of: "https://", with: "wss://")

        if wsServer.hasSuffix("/relay") {
            return wsServer
        }

        if isDirectGatewayURL(trimmed) {
            return wsServer
        }

        return wsServer + "/relay"
    }

    private func isDirectGatewayURL(_ server: String) -> Bool {
        guard let components = URLComponents(string: server) else {
            return server.contains(":18789") || server.contains("/ws")
        }

        if components.port == 18789 {
            return true
        }

        let path = components.path.lowercased()
        return path == "/ws" || path.hasPrefix("/ws/")
    }

    private func resolveGatewaySessionKey(from gatewayId: String) -> String {
        let trimmed = gatewayId.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("agent:") {
            return trimmed
        }
        return "agent:main:main"
    }

    /// 认证
    private func authenticate(gatewayId: String, accessCode: String) async throws -> String? {
        let result: [String: Any] = try await request(method: "relay.auth", params: [
            "gatewayId": gatewayId,
            "accessCode": accessCode
        ])

        guard let ok = result["ok"] as? Bool, ok else {
            let error = result["error"] as? String ?? "Authentication failed"
            throw RelayError.authenticationFailed
        }

        if let device = result["device"] as? [String: Any] {
            return (device["displayName"] as? String)
        }

        return (nil)
    }

    // MARK: - Disconnect

    /// 断开连接
    func disconnect() {
        stopped = true
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        connected = false
        authenticated = false
        gatewayId = nil
        displayName = nil
        gatewaySessionKey = nil
        connectChallengeNonce = nil
        gatewayModeEnabled = false

        // 拒绝所有待处理请求
        for (_, continuation) in pendingRequests {
            continuation.resume(throwing: RelayError.disconnected)
        }
        pendingRequests.removeAll()

        connectionSubject.send(false)
    }

    // MARK: - Send to Device

    /// 发送消息到设备
    func sendToDevice(method: String, params: [String: Any]? = nil) async throws {
        guard connected, authenticated else {
            throw RelayError.notConnected
        }

        // OpenClaw native path: send chat directly to agent session.
        if gatewayModeEnabled && method == "chat.send" {
            let text = (params?["message"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return }

            _ = try await request(method: "chat.send", params: [
                "sessionKey": gatewaySessionKey ?? "agent:main:main",
                "message": text,
                "idempotencyKey": UUID().uuidString
            ])
            return
        }

        let result: [String: Any] = try await request(method: "relay.to_device", params: [
            "method": method,
            "params": params ?? [:]
        ])

        guard let ok = result["ok"] as? Bool, ok else {
            throw RelayError.sendFailed
        }
    }

    // MARK: - Request Gateway Connection

    /// 请求连接设备 Gateway
    func requestGatewayConnection() async throws {
        guard connected, authenticated else {
            throw RelayError.notConnected
        }

        let result: [String: Any] = try await request(method: "relay.connect_gateway", params: [:])

        guard let ok = result["ok"] as? Bool, ok else {
            throw RelayError.sendFailed
        }
    }

    // MARK: - Request/Response

    private func request(method: String, params: [String: Any]) async throws -> [String: Any] {
        guard let webSocket = webSocket else {
            throw RelayError.notConnected
        }

        let id = generateId()
        let frame = RequestFrame(
            type: .req,
            id: id,
            method: method,
            params: params.mapValues { AnyCodable($0) }
        )

        return try await withCheckedThrowingContinuation { continuation in
            // 超时
            Task {
                try await Task.sleep(nanoseconds: 30_000_000_000) // 30 秒
                if pendingRequests.removeValue(forKey: id) != nil {
                    continuation.resume(throwing: RelayError.requestTimeout)
                }
            }

            pendingRequests[id] = continuation

            do {
                let data = try JSONEncoder().encode(frame)
                let message = URLSessionWebSocketTask.Message.data(data)
                webSocket.send(message) { error in
                    if let error = error {
                        if let cont = self.pendingRequests.removeValue(forKey: id) {
                            cont.resume(throwing: error)
                        }
                    }
                }
            } catch {
                if let cont = self.pendingRequests.removeValue(forKey: id) {
                    cont.resume(throwing: error)
                }
            }
        }
    }

    // MARK: - Message Handling

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                self?.handleMessage(message)
                self?.receiveMessage() // 继续接收

            case .failure(let error):
                SecureLogger.shared.error("RelayClient: Receive error: \(error.localizedDescription)")
                self?.handleDisconnection()
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        do {
            var data: Data?

            switch message {
            case .data(let msgData):
                data = msgData
            case .string(let text):
                guard let textData = text.data(using: .utf8) else { return }
                data = textData
            @unknown default:
                return
            }

            guard let data = data,
                  let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return
            }

            handleFrame(json)
        } catch {
            SecureLogger.shared.warning("RelayClient: Parse error: \(error.localizedDescription)")
        }
    }

    private func handleFrame(_ frame: [String: Any]) {
        guard let type = frame["type"] as? String else { return }

        switch type {
        case "res":
            handleResponse(frame)
        case "event":
            handleEvent(frame)
        default:
            SecureLogger.shared.debug("RelayClient: Unknown frame type: \(type)")
        }
    }

    private func handleResponse(_ frame: [String: Any]) {
        guard let id = frame["id"] as? String,
              let ok = frame["ok"] as? Bool else { return }

        if let continuation = pendingRequests.removeValue(forKey: id) {
            if ok {
                let payload = frame["payload"] as? [String: Any] ?? [:]
                continuation.resume(returning: payload)
            } else {
                let errorMessage = (frame["error"] as? [String: Any])?["message"] as? String ?? "Request failed"
                continuation.resume(throwing: RelayError.serverError(errorMessage))
            }
        }
    }

    private func handleEvent(_ frame: [String: Any]) {
        guard let event = frame["event"] as? String else { return }

        let payload = frame["payload"]

        if event == "connect.challenge",
           let dict = payload as? [String: Any],
           let nonce = dict["nonce"] as? String {
            connectChallengeNonce = nonce
            return
        }

        // 处理设备消息
        if event == "from_device" {
            if let dict = payload as? [String: Any] {
                messageSubject.send(dict)
            }
            return;
        }

        // OpenClaw chat stream events
        if event == "chat" ||
            event == "agent" ||
            event.hasPrefix("chat.") ||
            event.hasPrefix("agent.") {
            if let dict = payload as? [String: Any] {
                messageSubject.send([
                    "event": event,
                    "payload": dict
                ])
            }
            return
        }

        // 处理网关状态
        if event == "gateway_status" {
            // 转发事件
            notifyHandlers(event: event, data: payload)
            return;
        }

        // 转发其他事件
        notifyHandlers(event: event, data: payload)
    }

    private func notifyHandlers(event: String, data: Any?) {
        if let handlers = eventHandlers[event] {
            for handler in handlers {
                handler(data)
            }
        }
    }

    // MARK: - Message Queue

    private func flushMessageQueue() {
        while !messageQueue.isEmpty {
            let frame = messageQueue.removeFirst()
            if let data = try? JSONEncoder().encode(frame) {
                webSocket?.send(.data(data)) { _ in }
            }
        }
    }

    // MARK: - Reconnection

    private func handleDisconnection() {
        connected = false
        authenticated = false
        connectionSubject.send(false)

        guard !stopped, reconnectAttempts < maxReconnectAttempts else { return }
        attemptReconnect()
    }

    private func attemptReconnect() {
        reconnectAttempts += 1
        let delay = reconnectDelay * pow(2, Double(reconnectAttempts - 1))

        SecureLogger.shared.info("RelayClient: Reconnecting in \(Int(delay))ms (attempt \(reconnectAttempts))")

        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self,
                  let server = self.serverUrl,
                  let gatewayId = self.currentGatewayId,
                  let accessCode = self.currentAccessCode else { return }

            Task {
                do {
                    try await self.connect(server: server, gatewayId: gatewayId, accessCode: accessCode)
                    SecureLogger.shared.info("RelayClient: Reconnected successfully")
                } catch {
                    SecureLogger.shared.error("RelayClient: Reconnection failed: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - Helpers

    var isConnected: Bool {
        return connected && authenticated
    }

    private func generateId() -> String {
        return "\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(9))"
    }

    // MARK: - Event Handlers

    func on(_ event: String, handler: @escaping (Any?) -> Void) {
        if eventHandlers[event] == nil {
            eventHandlers[event] = []
        }
        eventHandlers[event]?.append(handler)
    }

    func off(_ event: String) {
        eventHandlers[event] = nil
    }
}

// MARK: - URLSessionWebSocketDelegate

extension RelayClient: URLSessionWebSocketDelegate {
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        SecureLogger.shared.info("RelayClient: Connected")
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        handleDisconnection()
    }
}

// MARK: - Errors

enum RelayError: Error, LocalizedError {
    case invalidURL
    case connectionFailed
    case authenticationFailed
    case notConnected
    case sendFailed
    case requestTimeout
    case disconnected
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .connectionFailed:
            return "Connection failed"
        case .authenticationFailed:
            return "Authentication failed"
        case .notConnected:
            return "Not connected"
        case .sendFailed:
            return "Send failed"
        case .requestTimeout:
            return "Request timeout"
        case .disconnected:
            return "Disconnected"
        case .serverError(let message):
            return message
        }
    }
}
