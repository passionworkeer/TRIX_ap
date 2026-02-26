//
//  WebSocketManager.swift
//  TRIX3DCompanion
//
//  WebSocket manager based on Starscream
//

import Foundation
import Security
import Starscream

// MARK: - WebSocket Events

/// WebSocket event types
enum WebSocketEvent {
    case connected
    case disconnected(reason: String)
    case reconnecting(attempt: Int)

    // Pairing events
    case pairingSuccess(deviceId: String, deviceName: String)
    case unpaired

    // Message events
    case botMessage(BotMessage)
    case messageSent(MessageSentResponse)
    case messageError(messageId: String, error: String)

    // Bot status events
    case botOnline(DeviceStatus)
    case botOffline(DeviceStatus)

    // Study room events
    case studyRoomState(StudyRoomStateEvent)

    // Error events
    case error(WebSocketError)
}

// MARK: - WebSocket Error

struct WebSocketError: Error {
    let code: String?
    let message: String
}

// MARK: - Message Types

struct BotMessage: Codable {
    let content: String
    let contentType: MessageContentType?
    let mediaUrl: String?
    let mediaMimeType: String?
    let timestamp: Int
    let messageId: String?

    enum MessageContentType: String, Codable {
        case text
        case image
        case video
        case file
        case mixed
    }
}

struct MessageSentResponse: Codable {
    let success: Bool
    let messageId: String?
    let timestamp: Int?
    let error: String?
}

struct DeviceStatus: Codable {
    let deviceId: String
    let message: String
    let timestamp: Int
}

struct StudyRoomStateEvent: Codable {
    let roomCode: String?
    let room: StudyRoomState?
    let action: String?
    let timestamp: Int
}

struct StudyRoomState: Codable {
    let code: String
    let name: String
    let hostId: String
    let members: [StudyRoomMember]
    let maxMembers: Int
    let status: String
    let createdAt: String
}

struct StudyRoomMember: Codable {
    let odUserId: String
    let displayName: String
    let avatarUrl: String?
    let joinedAt: String
    let isOnline: Bool
}

// MARK: - Request Payloads

struct AppRegisterRequest: Codable {
    let userId: String
}

struct AppMessageRequest: Codable {
    let content: String
    let contentType: String
    let mediaUrl: String?
    let mediaMimeType: String?
    let messageId: String
}

struct PairWithCodeRequest: Codable {
    let code: String
    let userId: String
}

struct PairWithTokenRequest: Codable {
    let token: String
    let userId: String
}

struct StudyRoomCreateRequest: Codable {
    let userId: String
    let displayName: String
    let avatarUrl: String?
    let maxMembers: Int?
}

struct StudyRoomJoinRequest: Codable {
    let userId: String
    let roomCode: String
    let displayName: String
    let avatarUrl: String?
}

struct StudyRoomLeaveRequest: Codable {
    let userId: String
    let roomCode: String?
}

struct StudyRoomHostActionRequest: Codable {
    let userId: String
    let roomCode: String
    let action: String
}

struct StudyRoomGetStateRequest: Codable {
    let userId: String
    let roomCode: String?
}

// MARK: - Response Types

struct SocketResponse: Codable {
    let success: Bool
    let paired: Bool?
    let error: String?
    let deviceId: String?
    let deviceName: String?
    let message: String?
    let pairingId: String?
    let status: String?
    let data: SocketResponseData?
}

struct SocketResponseData: Codable {
    let paired: Bool?
    let deviceId: String?
    let deviceName: String?
    let botOnline: Bool?
    let pairedAt: String?
}

struct StudyRoomAckPayload: Codable {
    let success: Bool
    let room: StudyRoomState?
    let error: String?
}

// MARK: - WebSocket Manager

/// WebSocket connection manager
final class WebSocketManager: NSObject {

    // MARK: - Singleton
    static let shared = WebSocketManager()

    // MARK: - Properties
    private var socket: WebSocket?
    private var isConnected = false
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 10
    private var reconnectTimer: Timer?
    private var heartbeatTimer: Timer?
    private var lastPongTime: Date = Date()
    private let heartbeatInterval: TimeInterval = 30 // 30 seconds

    private var userId: String?
    private var deviceId: String?

    // Event listeners
    private var eventListeners: [String: [EventCallback]] = [:]

    // MARK: - Types
    typealias EventCallback = (Any) -> Void

    // MARK: - Initialization
    private override init() {
        super.init()
        self.deviceId = getOrCreateDeviceId()
    }

    // MARK: - Public Methods

    /// Connect to WebSocket server
    func connect(userId: String) async throws {
        self.userId = userId

        guard !isConnected else { return }

        let urlString = WebSocketURL.current
        guard let url = URL(string: urlString) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 10

        socket = WebSocket(request: request)
        socket?.delegate = self
        socket?.connect()

        // Wait for connection
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            // Set up a temporary listener for connection
            let listener: (WebSocketEvent) -> Void = { event in
                switch event {
                case .connected:
                    continuation.resume()
                case .error(let error):
                    continuation.resume(throwing: error)
                default:
                    break
                }
            }

            // Add temporary listener
            self.addTemporaryListener(for: .connected, handler: listener)

            // Timeout after 10 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
                continuation.resume(throwing: NetworkError.timeout)
            }
        }
    }

    /// Disconnect from WebSocket server
    func disconnect() {
        stopHeartbeat()
        stopReconnectTimer()

        socket?.disconnect()
        socket = nil
        isConnected = false

        emit(.disconnected(reason: "User disconnected"))
    }

    /// Add event listener
    func on(_ event: WebSocketEventType, handler: @escaping EventCallback) {
        let key = event.rawValue
        if eventListeners[key] == nil {
            eventListeners[key] = []
        }
        eventListeners[key]?.append(handler)
    }

    /// Remove event listener
    func off(_ event: WebSocketEventType, handler: @escaping EventCallback) {
        let key = event.rawValue
        eventListeners[key]?.removeAll { $0 === handler }
    }

    /// Remove all event listeners
    func removeAllListeners() {
        eventListeners.removeAll()
    }

    // MARK: - Send Methods

    /// Send app registration
    func sendAppRegister() {
        guard let userId = userId else { return }

        let payload = AppRegisterRequest(userId: userId)
        emitEvent("app_register", payload: payload)
    }

    /// Send message to bot
    func sendMessage(
        content: String,
        contentType: BotMessage.MessageContentType = .text,
        mediaUrl: String? = nil,
        mediaMimeType: String? = nil
    ) {
        let messageId = generateMessageId()

        let payload = AppMessageRequest(
            content: content,
            contentType: contentType.rawValue,
            mediaUrl: mediaUrl,
            mediaMimeType: mediaMimeType,
            messageId: messageId
        )

        emitEvent("app_message", payload: payload)
    }

    /// Pair with code
    func pairWithCode(_ code: String) {
        guard let userId = userId else { return }

        let payload = PairWithCodeRequest(code: code.uppercased(), userId: userId)
        emitEvent("pair_with_code", payload: payload)
    }

    /// Pair with token (QR code)
    func pairWithToken(_ token: String) {
        guard let userId = userId else { return }

        let payload = PairWithTokenRequest(token: token, userId: userId)
        emitEvent("pair_with_token", payload: payload)
    }

    /// Check pairing status
    func checkPairingStatus(completion: @escaping (Result<SocketResponse, Error>) -> Void) {
        guard let userId = userId else {
            completion(.failure(WebSocketError(code: nil, message: "User not logged in")))
            return
        }

        emitEventWithAck("check_pairing_status", payload: ["userId": userId], completion: completion)
    }

    /// Unpair device
    func unpair() {
        emitEvent("unpair", payload: nil)
    }

    // MARK: - Study Room Methods

    /// Create study room
    func createStudyRoom(
        displayName: String,
        avatarUrl: String? = nil,
        maxMembers: Int? = nil,
        completion: @escaping (Result<StudyRoomAckPayload, Error>) -> Void
    ) {
        guard let userId = userId else {
            completion(.failure(WebSocketError(code: nil, message: "User not logged in")))
            return
        }

        let payload = StudyRoomCreateRequest(
            userId: userId,
            displayName: displayName,
            avatarUrl: avatarUrl,
            maxMembers: maxMembers
        )

        emitEventWithAck("study_room_create", payload: payload, completion: completion)
    }

    /// Join study room
    func joinStudyRoom(
        roomCode: String,
        displayName: String,
        avatarUrl: String? = nil,
        completion: @escaping (Result<StudyRoomAckPayload, Error>) -> Void
    ) {
        guard let userId = userId else {
            completion(.failure(WebSocketError(code: nil, message: "User not logged in")))
            return
        }

        let payload = StudyRoomJoinRequest(
            userId: userId,
            roomCode: roomCode,
            displayName: displayName,
            avatarUrl: avatarUrl
        )

        emitEventWithAck("study_room_join", payload: payload, completion: completion)
    }

    /// Leave study room
    func leaveStudyRoom(roomCode: String? = nil, completion: @escaping (Result<StudyRoomAckPayload, Error>) -> Void) {
        guard let userId = userId else {
            completion(.failure(WebSocketError(code: nil, message: "User not logged in")))
            return
        }

        let payload = StudyRoomLeaveRequest(userId: userId, roomCode: roomCode)
        emitEventWithAck("study_room_leave", payload: payload, completion: completion)
    }

    /// Host action in study room
    func hostActionStudyRoom(roomCode: String, action: String, completion: @escaping (Result<StudyRoomAckPayload, Error>) -> Void) {
        guard let userId = userId else {
            completion(.failure(WebSocketError(code: nil, message: "User not logged in")))
            return
        }

        let payload = StudyRoomHostActionRequest(userId: userId, roomCode: roomCode, action: action)
        emitEventWithAck("study_room_host_action", payload: payload, completion: completion)
    }

    /// Get study room state
    func getStudyRoomState(roomCode: String? = nil, completion: @escaping (Result<StudyRoomAckPayload, Error>) -> Void) {
        guard let userId = userId else {
            completion(.failure(WebSocketError(code: nil, message: "User not logged in")))
            return
        }

        let payload = StudyRoomGetStateRequest(userId: userId, roomCode: roomCode)
        emitEventWithAck("study_room_get_state", payload: payload, completion: completion)
    }

    // MARK: - Connection Status

    /// Check if connected
    func isConnected() -> Bool {
        return isConnected
    }

    // MARK: - Private Methods

    /// Get or create device ID using KeychainManager with cryptographic security
    private func getOrCreateDeviceId() -> String {
        return KeychainManager.shared.getOrCreateDeviceId()
    }

    /// Generate message ID using cryptographically secure random
    private func generateMessageId() -> String {
        var randomBytes = [UInt8](repeating: 0, count: 8)
        let status = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)

        if status == errSecSuccess {
            let hexString = randomBytes.map { String(format: "%02x", $0) }.joined()
            return "\(Int(Date().timeIntervalSince1970))-\(hexString)"
        } else {
            // Fallback
            return "\(Int(Date().timeIntervalSince1970))-\(UUID().uuidString.prefix(9))"
        }
    }

    private func emitEvent(_ event: String, payload: Encodable?) {
        guard isConnected else {
            SecureLogger.shared.warning("Not connected, cannot emit event: \(event)")
            return
        }

        var message: String
        if let payload = payload {
            do {
                let encoder = JSONEncoder()
                let data = try encoder.encode(payload)
                if let jsonString = String(data: data, encoding: .utf8) {
                    message = "[\"\(event)\",\(jsonString)]"
                } else {
                    message = "[\"\(event)\",{}]"
                }
            } catch {
                message = "[\"\(event)\",{}]"
            }
        } else {
            message = "[\"\(event)\",{}]"
        }

        socket?.write(string: message)
    }

    private func emitEventWithAck<T: Codable>(
        _ event: String,
        payload: [String: Any],
        completion: @escaping (Result<T, Error>) -> Void
    ) {
        guard isConnected else {
            completion(.failure(WebSocketError(code: nil, message: "Not connected to channel server")))
            return
        }

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: payload)
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"

            // Create ACK handler
            let ackEvent = "\(event)_ack"

            // Set up response handler
            self.on(ackEvent) { result in
                if let response = result as? T {
                    completion(.success(response))
                } else {
                    completion(.failure(WebSocketError(code: nil, message: "Invalid response")))
                }
            }

            // Send event with callback
            let message = "[\"\(event)\",\(jsonString),\"\(ackEvent)\"]"
            socket?.write(string: message)

            // Timeout after 10 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
                self?.off(ackEvent, handler: { _ in })
                completion(.failure(NetworkError.timeout))
            }

        } catch {
            completion(.failure(error))
        }
    }

    private func emit(_ event: WebSocketEvent) {
        let key: String
        switch event {
        case .connected:
            key = WebSocketEventType.connected.rawValue
        case .disconnected:
            key = WebSocketEventType.disconnected.rawValue
        case .reconnecting:
            key = WebSocketEventType.reconnecting.rawValue
        case .pairingSuccess:
            key = WebSocketEventType.pairingSuccess.rawValue
        case .unpaired:
            key = WebSocketEventType.unpaired.rawValue
        case .botMessage:
            key = WebSocketEventType.botMessage.rawValue
        case .messageSent:
            key = WebSocketEventType.messageSent.rawValue
        case .messageError:
            key = WebSocketEventType.messageError.rawValue
        case .botOnline:
            key = WebSocketEventType.botOnline.rawValue
        case .botOffline:
            key = WebSocketEventType.botOffline.rawValue
        case .studyRoomState:
            key = WebSocketEventType.studyRoomState.rawValue
        case .error:
            key = WebSocketEventType.error.rawValue
        }

        let listeners = eventListeners[key] ?? []
        listeners.forEach { callback in
            callback(event)
        }
    }

    private func addTemporaryListener(for event: WebSocketEventType, handler: @escaping (WebSocketEvent) -> Void) {
        let wrapper: EventCallback = { anyEvent in
            if let wsEvent = anyEvent as? WebSocketEvent {
                handler(wsEvent)
            }
        }
        on(event, handler: wrapper)
    }

    // MARK: - Heartbeat

    private func startHeartbeat() {
        stopHeartbeat()
        lastPongTime = Date()

        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: heartbeatInterval, repeats: true) { [weak self] _ in
            self?.sendPing()
        }
    }

    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }

    private func sendPing() {
        // Check if timed out without receiving pong for over 60 seconds
        if Date().timeIntervalSince(lastPongTime) > 60 {
            SecureLogger.shared.warning("[WebSocket] Pong timeout, reconnecting...")
            socket?.disconnect()
            socket?.connect()
            return
        }

        socket?.write(ping: Data())
    }

    // MARK: - Reconnection

    private func startReconnecting() {
        guard reconnectAttempts < maxReconnectAttempts else {
            SecureLogger.shared.error("[WebSocket] Max reconnection attempts reached")
            emit(.error(WebSocketError(code: "MAX_RECONNECT", message: "Max reconnection attempts reached")))
            return
        }

        reconnectAttempts += 1
        emit(.reconnecting(attempt: reconnectAttempts))

        // Exponential backoff: 2s, 4s, 8s, ... max 30s
        let delay = min(pow(2.0, Double(reconnectAttempts)), 30.0)

        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.socket?.connect()
        }
    }

    private func stopReconnectTimer() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
    }

    // MARK: - Event Handling

    private func handleEvent(_ eventName: String, data: Any?) {
        switch eventName {
        case "connect":
            isConnected = true
            reconnectAttempts = 0
            startHeartbeat()
            sendAppRegister()
            emit(.connected)

        case "disconnect":
            isConnected = false
            stopHeartbeat()
            let reason = (data as? String) ?? "Unknown"
            emit(.disconnected(reason: reason))

        case "pairing_success":
            if let dict = data as? [String: Any],
               let deviceId = dict["deviceId"] as? String,
               let deviceName = dict["deviceName"] as? String {
                // Save paired state
                UserDefaults.standard.set(true, forKey: "clawbot_paired")
                UserDefaults.standard.set(deviceId, forKey: "clawbot_device_id")
                emit(.pairingSuccess(deviceId: deviceId, deviceName: deviceName))
            }

        case "unpaired":
            // Remove from Keychain (secure storage)
            do {
                try KeychainManager.shared.removePairedDevice()
                SecureLogger.shared.info("Paired device removed from Keychain")
            } catch {
                SecureLogger.shared.error("Failed to remove paired device from Keychain: \(error.localizedDescription)")
            }
            emit(.unpaired)

        case "bot_message":
            if let dict = data as? [String: Any] {
                let jsonData = try? JSONSerialization.data(withJSONObject: dict)
                if let botMessage = jsonData.flatMap({ try? JSONDecoder().decode(BotMessage.self, from: $0) }) {
                    emit(.botMessage(botMessage))
                }
            }

        case "message_sent":
            if let dict = data as? [String: Any] {
                let jsonData = try? JSONSerialization.data(withJSONObject: dict)
                if let response = jsonData.flatMap({ try? JSONDecoder().decode(MessageSentResponse.self, from: $0) }) {
                    if response.success {
                        emit(.messageSent(response))
                    } else if let messageId = response.messageId {
                        emit(.messageError(messageId: messageId, error: response.error ?? "Unknown error"))
                    }
                }
            }

        case "bot_online":
            if let dict = data as? [String: Any] {
                let jsonData = try? JSONSerialization.data(withJSONObject: dict)
                if let status = jsonData.flatMap({ try? JSONDecoder().decode(DeviceStatus.self, from: $0) }) {
                    emit(.botOnline(status))
                }
            }

        case "bot_offline":
            if let dict = data as? [String: Any] {
                let jsonData = try? JSONSerialization.data(withJSONObject: dict)
                if let status = jsonData.flatMap({ try? JSONDecoder().decode(DeviceStatus.self, from: $0) }) {
                    emit(.botOffline(status))
                }
            }

        case "study_room_state":
            if let dict = data as? [String: Any] {
                let jsonData = try? JSONSerialization.data(withJSONObject: dict)
                if let stateEvent = jsonData.flatMap({ try? JSONDecoder().decode(StudyRoomStateEvent.self, from: $0) }) {
                    emit(.studyRoomState(stateEvent))
                }
            }

        case "pong":
            lastPongTime = Date()

        case "error":
            if let dict = data as? [String: Any],
               let message = dict["message"] as? String {
                let code = dict["code"] as? String
                emit(.error(WebSocketError(code: code, message: message)))
            }

        case "connect_error":
            startReconnecting()

        default:
            break
        }
    }
}

// MARK: - WebSocketDelegate

extension WebSocketManager: WebSocketDelegate {

    func didReceive(event: Starscream.WebSocketEvent, client: any Starscream.WebSocketClient) {
        switch event {
        case .connected(_):
            isConnected = true
            reconnectAttempts = 0
            startHeartbeat()
            sendAppRegister()
            emit(.connected)

        case .disconnected(let reason, _):
            isConnected = false
            stopHeartbeat()
            emit(.disconnected(reason: reason))
            startReconnecting()

        case .text(let text):
            parseAndHandleMessage(text)

        case .binary(let data):
            if let text = String(data: data, encoding: .utf8) {
                parseAndHandleMessage(text)
            }

        case .ping(_):
            socket?.write(pong: Data())

        case .pong(_):
            lastPongTime = Date()

        case .viabilityChanged(let isViable):
            if !isViable {
                startReconnecting()
            }

        case .reconnectSuggested(let shouldReconnect):
            if shouldReconnect {
                startReconnecting()
            }

        case .cancelled:
            isConnected = false
            emit(.disconnected(reason: "Cancelled"))

        case .error(let error):
            let message = error?.localizedDescription ?? "Unknown error"
            emit(.error(WebSocketError(code: nil, message: message)))
            startReconnecting()

        case .peerClosed:
            isConnected = false
            emit(.disconnected(reason: "Peer closed"))
            startReconnecting()
        }
    }

    private func parseAndHandleMessage(_ text: String) {
        // Parse message format: ["event_name", data] or ["event_name", data, ack_id]
        guard let data = text.data(using: .utf8),
              let jsonArray = try? JSONSerialization.jsonObject(with: data) as? [Any],
              jsonArray.count >= 2,
              let eventName = jsonArray[0] as? String else {
            return
        }

        let eventData = jsonArray[1]

        // Handle ACK responses
        if jsonArray.count >= 3, let ackId = jsonArray[2] as? String {
            // This is an ACK response, handle it specially
            handleAckResponse(ackId, data: eventData)
            return
        }

        handleEvent(eventName, data: eventData)
    }

    private func handleAckResponse(_ ackId: String, data: Any) {
        // Notify listeners waiting for this ACK
        let key = ackId
        let listeners = eventListeners[key] ?? []
        listeners.forEach { callback in
            callback(data)
        }
    }
}

// MARK: - WebSocket Event Type

enum WebSocketEventType: String {
    case connected
    case disconnected
    case reconnecting
    case pairingSuccess = "pairing_success"
    case unpaired
    case botMessage = "bot_message"
    case messageSent = "message_sent"
    case messageError
    case botOnline = "bot_online"
    case botOffline = "bot_offline"
    case studyRoomState = "study_room_state"
    case error
}
