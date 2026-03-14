//
//  WebSocketService.swift
//  TRIX Native
//

import Foundation
import Starscream

class WebSocketService: ObservableObject, WebSocketDelegate {
    static let shared = WebSocketService()

    @Published var isConnected = false
    @Published var connectionError: String?

    private var socket: WebSocket?
    private var pingTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    private let reconnectDelay: TimeInterval = 3.0

    // Callbacks
    var onMessageReceived: ((ChatMessage) -> Void)?
    var onStatusUpdate: ((String) -> Void)?

    // MARK: - Connection

    func connect(pairingCode: String, serverURL: String) {
        disconnect()

        guard let url = URL(string: "\(serverURL)/ws/phone?code=\(pairingCode)") else {
            connectionError = "Invalid URL"
            return
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 30

        socket = WebSocket(request: request)
        socket?.delegate = self
        socket?.connect()

        startPingTimer()
    }

    func disconnect() {
        stopPingTimer()
        socket?.disconnect()
        socket = nil
        isConnected = false
    }

    // MARK: - Send Message

    func sendMessage(_ message: ChatMessage) {
        guard isConnected else {
            connectionError = "Not connected"
            return
        }

        do {
            let encoder = JSONEncoder()
            let data = try encoder.encode(message)
            socket?.write(data: data)
        } catch {
            print("[WebSocket] Failed to encode message:", error)
        }
    }

    // MARK: - WebSocketDelegate

    func didReceive(event: WebSocketEvent, client: WebSocketClient) {
        switch event {
        case .connected(let headers):
            print("[WebSocket] Connected:", headers)
            isConnected = true
            connectionError = nil
            reconnectAttempts = 0
            onStatusUpdate?("connected")

        case .disconnected(let reason, let code):
            print("[WebSocket] Disconnected:", reason, code)
            isConnected = false
            onStatusUpdate?("disconnected")
            attemptReconnect()

        case .text(let text):
            handleTextMessage(text)

        case .binary(let data):
            handleBinaryMessage(data)

        case .ping:
            socket?.write(pong: Data())

        case .pong:
            break

        case .viabilityChanged(let viable):
            print("[WebSocket] Viability changed:", viable)

        case .reconnectSuggested(let suggested):
            if suggested {
                attemptReconnect()
            }

        case .cancelled:
            isConnected = false
            onStatusUpdate?("cancelled")

        case .error(let error):
            print("[WebSocket] Error:", error ?? "unknown")
            connectionError = error?.localizedDescription
            isConnected = false
            attemptReconnect()

        case .peerClosed:
            isConnected = false
            attemptReconnect()
        }
    }

    // MARK: - Message Handling

    private func handleTextMessage(_ text: String) {
        guard let data = text.data(using: .utf8) else { return }
        handleBinaryMessage(data)
    }

    private func handleBinaryMessage(_ data: Data) {
        do {
            let decoder = JSONDecoder()
            let message = try decoder.decode(ChatMessage.self, from: data)
            DispatchQueue.main.async {
                self.onMessageReceived?(message)
            }
        } catch {
            print("[WebSocket] Failed to decode message:", error)
        }
    }

    // MARK: - Ping/Pong

    private func startPingTimer() {
        stopPingTimer()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.socket?.write(ping: Data())
        }
    }

    private func stopPingTimer() {
        pingTimer?.invalidate()
        pingTimer = nil
    }

    // MARK: - Reconnection

    private func attemptReconnect() {
        guard reconnectAttempts < maxReconnectAttempts else {
            print("[WebSocket] Max reconnect attempts reached")
            return
        }

        reconnectAttempts += 1
        print("[WebSocket] Attempting reconnect (\(reconnectAttempts)/\(maxReconnectAttempts))...")

        DispatchQueue.main.asyncAfter(deadline: .now() + reconnectDelay) { [weak self] in
            self?.socket?.connect()
        }
    }
}
