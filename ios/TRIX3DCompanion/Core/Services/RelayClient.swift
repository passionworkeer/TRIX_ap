//
//  RelayClient.swift
//  TRIX3DCompanion
//
//  Relay Client - 连接 ClawPilot 兼容的中继服务器
//

import Foundation
import Combine
import SocketIO

// MARK: - Connection Mode

enum ConnectionMode: String, Codable {
    case relay      // 中继模式 (扫码/输入配对码)
    case gateway    // 直连 Gateway
    case socketIO   // Socket.IO 配对
}

// MARK: - Relay Client

final class RelayClient: ObservableObject {
    static let shared = RelayClient()

    // MARK: - Properties

    private var socketManager: SocketManager?
    private var socket: SocketIOClient?

    @Published private(set) var connected = false
    @Published private(set) var authenticated = false
    @Published private(set) var gatewayId: String?
    @Published private(set) var displayName: String?

    private var serverUrl: String?
    private var currentGatewayId: String?
    private var currentAccessCode: String?

    private var eventHandlers = [String: [((Any?) -> Void)]]()

    // MARK: - Subjects

    let connectionSubject = CurrentValueSubject<Bool, Never>(false)
    let errorSubject = PassthroughSubject<Error, Never>()
    let messageSubject = PassthroughSubject<[String: Any], Never>()

    // MARK: - Initialization

    private init() {}

    // MARK: - Parse QR Code

    /// 解析 QR 码内容
    func parseQRContent(_ content: String) -> RelayQRPayload? {
        guard let data = content.data(using: .utf8) else { return nil }

        do {
            let payload = try JSONDecoder().decode(RelayQRPayload.self, from: data)
            return payload
        } catch {
            print("[RelayClient] Failed to parse QR content: \(error)")
            return nil
        }
    }

    // MARK: - Connect

    /// 连接到中继服务器
    func connect(server: String, gatewayId: String, accessCode: String) async throws {
        // 转换 http/https 到 ws/wss
        let wsServer = server.replacingOccurrences(of: "http://", with: "ws://")
            .replacingOccurrences(of: "https://", with: "wss://")

        let relayUrl = "\(wsServer)/relay-client"
        print("[RelayClient] Connecting to: \(relayUrl)")

        self.serverUrl = server
        self.currentGatewayId = gatewayId
        self.currentAccessCode = accessCode

        return try await withCheckedThrowingContinuation { continuation in
            guard let url = URL(string: relayUrl) else {
                continuation.resume(throwing: RelayError.invalidURL)
                return
            }

            self.socketManager = SocketManager(socketURL: url, config: [
                .transports([.websocket]),
                .reconnects(true),
                .reconnectAttempts(10),
                .reconnectWait(2000),
            ])

            self.socket = self.socketManager?.defaultSocket

            // 连接事件
            self.socket?.on(clientEvent: .connect) { [weak self] _, _ in
                print("[RelayClient] Socket connected")

                // 认证
                self?.socket?.emit("auth", [
                    "gatewayId": gatewayId,
                    "accessCode": accessCode
                ]) { [weak self] response in
                    guard let data = response.first as? [String: Any] else {
                        continuation.resume(throwing: RelayError.authenticationFailed)
                        return
                    }

                    let ok = data["ok"] as? Bool ?? false
                    if ok {
                        self?.connected = true
                        self?.authenticated = true
                        self?.gatewayId = gatewayId

                        if let deviceInfo = data["device"] as? [String: Any] {
                            self?.displayName = deviceInfo["displayName"] as? String
                        }

                        self?.connectionSubject.send(true)
                        continuation.resume()
                    } else {
                        let error = data["error"] as? String ?? "Authentication failed"
                        continuation.resume(throwing: RelayError.authenticationFailed)
                    }
                }
            }

            self.socket?.on(clientEvent: .disconnect) { [weak self] _, _ in
                print("[RelayClient] Disconnected")
                self?.connected = false
                self?.authenticated = false
                self?.connectionSubject.send(false)
            }

            self.socket?.on(clientEvent: .error) { [weak self] data, _ in
                print("[RelayClient] Error: \(data)")
                self?.errorSubject.send(RelayError.connectionFailed)
            }

            // 接收设备消息
            self.socket?.on("from_device") { [weak self] data, _ in
                if let dict = data.first as? [String: Any] {
                    self?.messageSubject.send(dict)
                }
            }

            self.socket?.connect()
        }
    }

    // MARK: - Disconnect

    /// 断开连接
    func disconnect() {
        socket?.disconnect()
        socketManager = nil
        socket = nil
        connected = false
        authenticated = false
        gatewayId = nil
        displayName = nil
        connectionSubject.send(false)
    }

    // MARK: - Send to Device

    /// 发送消息到设备
    func sendToDevice(method: String, params: [String: Any]? = nil) async throws {
        guard let socket = socket, connected, authenticated else {
            throw RelayError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            socket.emit("to_device", [
                "method": method,
                "params": params ?? [:]
            ]) { [weak self] response in
                guard let data = response.first as? [String: Any] else {
                    continuation.resume(throwing: RelayError.sendFailed)
                    return
                }

                let ok = data["ok"] as? Bool ?? false
                if ok {
                    continuation.resume()
                } else {
                    let error = data["error"] as? String ?? "Send failed"
                    continuation.resume(throwing: RelayError.sendFailed)
                }
            }
        }
    }

    // MARK: - Request Gateway Connection

    /// 请求连接设备 Gateway
    func requestGatewayConnection() async throws {
        guard let socket = socket, connected, authenticated else {
            throw RelayError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            socket.emit("connect_gateway", [:]) { [weak self] response in
                guard let data = response.first as? [String: Any] else {
                    continuation.resume(throwing: RelayError.sendFailed)
                    return
                }

                let ok = data["ok"] as? Bool ?? false
                if ok {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: RelayError.sendFailed)
                }
            }
        }
    }

    // MARK: - Helpers

    var isConnected: Bool {
        return connected && authenticated
    }

    // MARK: - Event Handlers

    func on(_ event: String, handler: @escaping (Any?) -> Void) {
        if eventHandlers[event] == nil {
            eventHandlers[event] = []
        }
        eventHandlers[event]?.append(handler)

        // 注册 socket 监听
        socket?.on(event) { data, _ in
            handler(data.first)
        }
    }

    func off(_ event: String) {
        eventHandlers[event] = nil
        socket?.off(event)
    }
}

// MARK: - Errors

enum RelayError: Error, LocalizedError {
    case invalidURL
    case connectionFailed
    case authenticationFailed
    case notConnected
    case sendFailed

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
        }
    }
}
