//
//  GatewayClient.swift
//  TRIX3DCompanion
//
//  Gateway Client - WebSocket client for OpenClaw Gateway
//

import Foundation
import Combine
import CryptoKit

// MARK: - Connection Options

struct GatewayConnectionOptions {
    let url: String
    let token: String?
    let password: String?
    let deviceId: String?
    let deviceKey: String?
    let reconnect: Bool
    let reconnectAttempts: Int
    let reconnectDelay: TimeInterval
}

// MARK: - Event Handler

typealias EventHandler = (Any?) -> Void

// MARK: - Gateway Client

final class GatewayClient: NSObject {
    static let shared = GatewayClient()

    // MARK: - Properties

    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession!
    private var options: GatewayConnectionOptions?
    private var deviceId: String?
    private var deviceKey: String?

    private(set) var connected = false
    private(set) var authenticated = false

    private var reconnectAttempts = 0
    private var maxReconnectAttempts = 10
    private var reconnectDelay: TimeInterval = 2000

    private var pendingRequests = [String: CheckedContinuation<Any?, Error>]()
    private var messageQueue: [(method: String, params: [String: Any]?)] = []
    private var eventListeners = [String: Set<EventHandler>]()
    private var lastMessageTime = Date()

    private var heartbeatTimer: Timer?
    private var reconnectTimer: Timer?

    // MARK: - Subjects

    let connectionSubject = CurrentValueSubject<Bool, Never>(false)
    let errorSubject = PassthroughSubject<Error, Never>()

    // MARK: - Initialization

    private override init() {
        super.init()
        loadDeviceCredentials()
        setupURLSession()
    }

    private func setupURLSession() {
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        urlSession = URLSession(configuration: config, delegate: self, delegateQueue: .main)
    }

    // MARK: - Device Credentials

    private func loadDeviceCredentials() {
        deviceId = UserDefaults.standard.string(forKey: "gateway_device_id")
        deviceKey = UserDefaults.standard.string(forKey: "gateway_device_key")
    }

    private func saveDeviceCredentials() {
        if let deviceId = deviceId {
            UserDefaults.standard.set(deviceId, forKey: "gateway_device_id")
        }
        if let deviceKey = deviceKey {
            UserDefaults.standard.set(deviceKey, forKey: "gateway_device_key")
        }
    }

    // MARK: - Connection

    func connect(options: GatewayConnectionOptions) async throws {
        self.options = options
        self.maxReconnectAttempts = options.reconnectAttempts
        self.reconnectDelay = options.reconnectDelay

        // Generate or use provided device credentials
        if let providedId = options.deviceId, let providedKey = options.deviceKey {
            deviceId = providedId
            deviceKey = providedKey
        } else if deviceId == nil || deviceKey == nil {
            let keyPair = generateKeyPair()
            deviceId = "device_\(generateRandomId(16))"
            deviceKey = keyPair.privateKey
            saveDeviceCredentials()
        }

        try await establishConnection(to: options.url)
    }

    private func establishConnection(to urlString: String) async throws {
        guard let url = URL(string: urlString) else {
            throw GatewayError.invalidURL
        }

        webSocket = urlSession.webSocketTask(with:Socket?.resume()

        // Wait for connection
        try await withChecked url)
        webThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            var receivedConnect = false
            let timeout = Task {
                try await Task.sleep(nanoseconds: 10_000_000_000) // 10 seconds
                if !receivedConnect {
                    webSocket?.cancel()
                    continuation.resume(throwing: GatewayError.connectionTimeout)
                }
            }

            let connectHandler: EventHandler = { [weak self] _ in
                receivedConnect = true
                timeout.cancel()
                Task {
                    do {
                        try await self?.authenticate()
                        continuation.resume()
                    } catch {
                        continuation.resume(throwing: error)
                    }
                }
            }

            on("*", handler: connectHandler)

            // Also try to receive messages
            receiveMessage()
        }
    }

    func disconnect() {
        stopHeartbeat()
        maxReconnectAttempts = 0
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        connected = false
        authenticated = false

        // Reject pending requests
        for (_, continuation) in pendingRequests {
            continuation.resume(throwing: GatewayError.disconnected)
        }
        pendingRequests.removeAll()

        connectionSubject.send(false)
    }

    var isConnected: Bool {
        return connected && authenticated
    }

    func getDeviceId() -> String? {
        return deviceId
    }

    // MARK: - Authentication

    private func authenticate() async throws {
        guard let deviceId = deviceId, let deviceKey = deviceKey else {
            throw GatewayError.noCredentials
        }

        let timestamp = Int(Date().timeIntervalSince1970 * 1000)
        let payload = ["deviceId": deviceId, "timestamp": timestamp] as [String: Any]
        let signature = try sign(payload: payload, privateKey: deviceKey)

        var authMessage: [String: Any] = [
            "type": "auth",
            "deviceId": deviceId,
            "timestamp": timestamp,
            "signature": signature
        ]

        if let token = options?.token {
            authMessage["token"] = token
        } else if let password = options?.password {
            authMessage["password"] = password
        }

        return try await withCheckedThrowingContinuation { continuation in
            let id = generateId()

            // Set timeout
            Task {
                try await Task.sleep(nanoseconds: 10_000_000_000) // 10 seconds
                pendingRequests.removeValue(forKey: id)
                continuation.resume(throwing: GatewayError.authenticationTimeout)
            }

            pendingRequests[id] = { result in
                switch result {
                case .success:
                    continuation.resume()
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }

            sendFrame(GatewayRequestFrame(
                type: "req",
                id: id,
                method: "auth",
                params: AnyCodable.toAnyCodable(authMessage)
            ))

            // Also wait for tick as confirmation
            var receivedTick = false
            let tickHandler: EventHandler = { [weak self] _ in
                if !receivedTick {
                    receivedTick = true
                    self?.authenticated = true
                    self?.flushMessageQueue()
                    self?.startHeartbeat()
                    self?.connectionSubject.send(true)
                }
            }

            on("tick", handler: tickHandler)
        }
    }

    // MARK: - Key Generation

    private func generateKeyPair() -> (publicKey: String, privateKey: String) {
        let privateKey = Curve25519.Signing.PrivateKey()
        let publicKey = privateKey.publicKey

        return (
            publicKey: publicKey.rawRepresentation.base64EncodedString(),
            privateKey: privateKey.rawRepresentation.base64EncodedString()
        )
    }

    private func sign(payload: [String: Any], privateKey: String) throws -> String {
        guard let keyData = Data(base64Encoded: privateKey) else {
            throw GatewayError.invalidKey
        }

        let privateKey = try Curve25519.Signing.PrivateKey(rawRepresentation: keyData)
        let jsonData = try JSONSerialization.data(withJSONObject: payload)
        let signature = try privateKey.signature(for: jsonData)

        return signature.base64EncodedString()
    }

    // MARK: - Request/Response

    func request<T: Decodable>(_ method: String, params: [String: Any]? = nil) async throws -> T {
        guard isConnected else {
            throw GatewayError.notConnected
        }

        let id = generateId()

        return try await withCheckedThrowingContinuation { continuation in
            // Set timeout
            Task {
                try await Task.sleep(nanoseconds: 60_000_000_000) // 60 seconds
                pendingRequests.removeValue(forKey: id)
                continuation.resume(throwing: GatewayError.requestTimeout)
            }

            pendingRequests[id] = { result in
                switch result {
                case .success(let value):
                    if let data = value as? Data {
                        do {
                            let decoded = try JSONDecoder().decode(T.self, from: data)
                            continuation.resume(returning: decoded)
                        } catch {
                            continuation.resume(throwing: error)
                        }
                    } else if let dict = value as? [String: Any] {
                        do {
                            let jsonData = try JSONSerialization.data(withJSONObject: dict)
                            let decoded = try JSONDecoder().decode(T.self, from: jsonData)
                            continuation.resume(returning: decoded)
                        } catch {
                            continuation.resume(throwing: error)
                        }
                    } else if let typedValue = value as? T {
                        continuation.resume(returning: typedValue)
                    } else {
                        continuation.resume(throwing: GatewayError.invalidResponse)
                    }
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }

            let frame = GatewayRequestFrame(
                type: "req",
                id: id,
                method: method,
                params: params.map { AnyCodable.toAnyCodable($0) }
            )

            sendFrame(frame)
        }
    }

    func send(_ method: String, params: [String: Any]? = nil) {
        if !isConnected {
            messageQueue.append((method, params))
            return
        }

        let frame = GatewayRequestFrame(
            type: "req",
            id: generateId(),
            method: method,
            params: params.map { AnyCodable.toAnyCodable($0) }
        )

        sendFrame(frame)
    }

    private func sendFrame<T: Encodable>(_ frame: T) {
        guard let webSocket = webSocket else { return }

        do {
            let data = try JSONEncoder().encode(frame)
            let message = URLSessionWebSocketTask.Message.data(data)
            webSocket.send(message) { error in
                if let error = error {
                    print("[GatewayClient] Send error: \(error)")
                }
            }
        } catch {
            print("[GatewayClient] Encode error: \(error)")
        }
    }

    // MARK: - Message Handling

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                self?.handleMessage(message)
                self?.receiveMessage()  // Continue receiving

            case .failure(let error):
                print("[GatewayClient] Receive error: \(error)")
                self?.handleDisconnection()
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        lastMessageTime = Date()

        do {

            switch message {
            case . let data: Datadata(let msgData):
                data = msgData
            case .string(let text):
                guard let textData = text.data(using: .utf8) else { return }
                data = textData
            @unknown default:
                return
            }

            // Try to parse as dictionary first
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                handleFrame(json)
            }
        } catch {
            print("[GatewayClient] Parse error: \(error)")
        }
    }

    private func handleFrame(_ frame: [String: Any]) {
        guard let type = frame["type"] as? String else { return }

        switch type {
        case "res":
            handleResponse(frame)
        case "event":
            handleEvent(frame)
        case "tick":
            handleTick()
        default:
            print("[GatewayClient] Unknown frame type: \(type)")
        }
    }

    private func handleResponse(_ frame: [String: Any]) {
        guard let id = frame["id"] as? String,
              let ok = frame["ok"] as? Bool else { return }

        if let continuation = pendingRequests.removeValue(forKey: id) {
            if ok {
                continuation.resume(returning: frame["payload"])
            } else {
                let errorMessage = (frame["error"] as? [String: Any])?["message"] as? String ?? "Request failed"
                continuation.resume(throwing: GatewayError.serverError(errorMessage))
            }
        }
    }

    private func handleEvent(_ frame: [String: Any]) {
        guard let event = frame["event"] as? String else { return }

        let payload = frame["payload"]

        // Notify listeners
        if let handlers = eventListeners[event] {
            for handler in handlers {
                handler(payload)
            }
        }

        // Notify wildcard listeners
        if let handlers = eventListeners["*"] {
            for handler in handlers {
                handler(frame)
            }
        }
    }

    private func handleTick() {
        // Send pong
        let pong = ["type": "tick", "timestamp": Int(Date().timeIntervalSince1970 * 1000)] as [String: Any]
        sendFrame(GatewayRequestFrame(
            type: "req",
            id: generateId(),
            method: "tick",
            params: AnyCodable.toAnyCodable(pong)
        ))
    }

    // MARK: - Message Queue

    private func flushMessageQueue() {
        while !messageQueue.isEmpty {
            let msg = messageQueue.removeFirst()
            send(msg.method, params: msg.params)
        }
    }

    // MARK: - Heartbeat

    private func startHeartbeat() {
        stopHeartbeat()

        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            if self.connected {
                self.webSocket?.sendPing { error in
                    if error != nil {
                        self.handleDisconnection()
                    }
                }

                // Check for stale connection
                if Date().timeIntervalSince(self.lastMessageTime) > 60 {
                    self.handleDisconnection()
                }
            }
        }
    }

    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }

    // MARK: - Reconnection

    private func handleDisconnection() {
        connected = false
        authenticated = false
        stopHeartbeat()
        connectionSubject.send(false)

        guard let options = options, options.reconnect else { return }
        attemptReconnect()
    }

    private func attemptReconnect() {
        guard reconnectAttempts < maxReconnectAttempts else {
            print("[GatewayClient] Max reconnection attempts reached")
            return
        }

        reconnectAttempts += 1
        let delay = reconnectDelay * pow(2, Double(reconnectAttempts - 1))

        print("[GatewayClient] Reconnecting in \(delay)ms (attempt \(reconnectAttempts))")

        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay / 1000, repeats: false) { [weak self] _ in
            guard let self = self, let url = self.options?.url else { return }

            Task {
                do {
                    try await self.establishConnection(to: url)
                    print("[GatewayClient] Reconnected successfully")
                } catch {
                    print("[GatewayClient] Reconnection failed: \(error)")
                }
            }
        }
    }

    // MARK: - Event Listeners

    func on(_ event: String, handler: @escaping EventHandler) {
        if eventListeners[event] == nil {
            eventListeners[event] = []
        }
        eventListeners[event]?.insert(handler)
    }

    func off(_ event: String, handler: @escaping EventHandler) {
        eventListeners[event]?.remove(handler)
    }

    func once(_ event: String, handler: @escaping EventHandler) {
        let wrapped: EventHandler = { [weak self] data in
            self?.off(event, handler: wrapped)
            handler(data)
        }
        on(event, handler: wrapped)
    }

    // MARK: - Helpers

    private func generateId() -> String {
        return "\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(9))"
    }

    private func generateRandomId(_ length: Int) -> String {
        let chars = "0123456789abcdef"
        return String((0..<length).map { _ in chars.randomElement()! })
    }
}

// MARK: - URLSessionWebSocketDelegate

extension GatewayClient: URLSessionWebSocketDelegate {
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        connected = true
        print("[GatewayClient] Connected")
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        handleDisconnection()
    }
}

// MARK: - Errors

enum GatewayError: Error, LocalizedError {
    case invalidURL
    case connectionTimeout
    case authenticationTimeout
    case noCredentials
    case invalidKey
    case notConnected
    case requestTimeout
    case invalidResponse
    case disconnected
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .connectionTimeout:
            return "Connection timeout"
        case .authenticationTimeout:
            return "Authentication timeout"
        case .noCredentials:
            return "No credentials"
        case .invalidKey:
            return "Invalid key"
        case .notConnected:
            return "Not connected"
        case .requestTimeout:
            return "Request timeout"
        case .invalidResponse:
            return "Invalid response"
        case .disconnected:
            return "Disconnected"
        case .serverError(let message):
            return message
        }
    }
}

// MARK: - AnyCodable Extension

extension AnyCodable {
    static func toAnyCodable(_ dictionary: [String: Any]) -> [String: AnyCodable] {
        var result = [String: AnyCodable]()
        for (key, value) in dictionary {
            result[key] = AnyCodable(value)
        }
        return result
    }
}
