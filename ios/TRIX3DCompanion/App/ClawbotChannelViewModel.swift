//
//  ClawbotChannelViewModel.swift
//  TRIX3DCompanion
//
//  ViewModel for Clawbot Channel - manages pairing and messaging state
//

import Foundation
import Combine
import AVFoundation

@MainActor
final class ClawbotChannelViewModel: ObservableObject {

    // MARK: - Singleton

    static let shared = ClawbotChannelViewModel()

    // MARK: - Published Properties

    @Published private(set) var isConnected: Bool = false
    @Published private(set) var isPaired: Bool = false
    @Published private(set) var connectionState: ClawbotConnectionState = .disconnected
    @Published private(set) var lastError: String?
    @Published private(set) var botState: BotState = .idle

    // Connection mode
    @Published var connectionMode: ConnectionMode = .nativeService

    // Relay specific
    @Published private(set) var relayConnected: Bool = false
    @Published private(set) var relayDeviceName: String?

    @Published var messages: [ClawbotMessage] = []
    @Published var isSending: Bool = false

    // TTS Settings
    @Published var ttsEnabled: Bool = true {
        didSet { service.ttsEnabled = ttsEnabled }
    }
    @Published var ttsLanguage: TTSLanguage = .chinese {
        didSet { service.ttsLanguage = ttsLanguage }
    }

    // MARK: - Private Properties

    private let service = ClawbotChannelService.shared
    private let relayClient = RelayClient.shared
    private var cancellables = Set<AnyCancellable>()
    private var relayStreamBuffers: [String: String] = [:]

    // MARK: - Initialization

    private init() {
        setupBindings()
        setupRelayBindings()
    }

    private func activateNativeConnectionMode() {
        connectionMode = .nativeService
        relayConnected = false
        relayDeviceName = nil
    }

    // MARK: - Relay Connection Methods

    /// Connect via Relay server (QR code or manual input)
    func connectRelay(server: String, gatewayId: String, accessCode: String) async -> Bool {
        lastError = nil
        isSending = true

        do {
            service.disconnect()
            try await relayClient.connect(server: server, gatewayId: gatewayId, accessCode: accessCode)
            connectionMode = .relay
            relayConnected = true
            relayDeviceName = relayClient.displayName
            isConnected = true
            isPaired = true
            isSending = false
            return true
        } catch {
            lastError = error.localizedDescription
            relayConnected = false
            activateNativeConnectionMode()
            isSending = false
            return false
        }
    }

    /// Parse QR code content for Relay
    func parseRelayQR(_ content: String) -> RelayQRPayload? {
        return relayClient.parseQRContent(content)
    }

    /// Connect via Relay QR code
    func connectRelayWithQR(_ qrContent: String) async -> Bool {
        guard let payload = parseRelayQR(qrContent) else {
            lastError = NSLocalizedString("error.clawbot.qr.invalid", comment: "")
            return false
        }

        return await connectRelay(
            server: payload.server,
            gatewayId: payload.gatewayId,
            accessCode: payload.accessCode
        )
    }

    /// Connect Relay with manual input (server + gatewayId + accessCode)
    func connectRelayManual(server: String, gatewayId: String, accessCode: String) async -> Bool {
        return await connectRelay(server: server, gatewayId: gatewayId, accessCode: accessCode)
    }

    /// Disconnect from Relay
    func disconnectRelay() {
        relayClient.disconnect()
        relayConnected = false
        relayDeviceName = nil
        relayStreamBuffers.removeAll()
        isPaired = false
        activateNativeConnectionMode()
    }

    /// Send message via Relay
    func sendMessageRelay(_ content: String) async -> Bool {
        guard relayConnected else {
            lastError = NSLocalizedString("error.clawbot.relay.not.connected", comment: "")
            return false
        }

        isSending = true

        do {
            var relayParams: [String: Any] = ["message": content]
            relayParams["stream"] = true
            try await relayClient.sendToDevice(method: "chat.send", params: relayParams)
            // Add user message to local list
            let userMessage = ClawbotMessage(
                id: generateMessageId(),
                content: content,
                contentType: .text,
                mediaUrl: nil,
                mediaMimeType: nil,
                timestamp: Date(),
                sender: .user
            )
            messages.append(userMessage)
            isSending = false
            return true
        } catch {
            lastError = error.localizedDescription
            isSending = false
            return false
        }
    }

    /// Setup Relay event bindings
    private func setupRelayBindings() {
        relayClient.messageSubject
            .receive(on: DispatchQueue.main)
            .sink { [weak self] data in
                self?.handleRelayIncomingMessage(data)
            }
            .store(in: &cancellables)

        relayClient.connectionSubject
            .receive(on: DispatchQueue.main)
            .sink { [weak self] connected in
                self?.relayConnected = connected
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Connect to Clawbot Channel
    func connect() async {
        do {
            relayClient.disconnect()
            try await service.connect()
            activateNativeConnectionMode()
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Disconnect from Clawbot Channel
    func disconnect() {
        service.disconnect()
        relayClient.disconnect()
        activateNativeConnectionMode()
    }

    /// Check current pairing status
    func checkPairingStatus() async {
        do {
            let status = try await service.checkPairingStatus()
            isPaired = status.paired
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Pair with code from OpenClaw
    func pairWithCode(_ code: String) async -> Bool {
        isSending = true
        lastError = nil

        do {
            let success = try await service.pairWithCode(code)
            if success {
                isPaired = true
                relayClient.disconnect()
                activateNativeConnectionMode()
            }
            isSending = false
            return success
        } catch {
            lastError = error.localizedDescription
            isSending = false
            return false
        }
    }

    /// Pair with QR token from OpenClaw
    func pairWithToken(_ token: String) async -> Bool {
        isSending = true
        lastError = nil

        do {
            let success = try await service.pairWithQR(token)
            if success {
                isPaired = true
                relayClient.disconnect()
                activateNativeConnectionMode()
            }
            isSending = false
            return success
        } catch {
            lastError = error.localizedDescription
            isSending = false
            return false
        }
    }

    /// Pair with QR code data (convenience method)
    func pairWithQR(_ qrData: String) async -> Bool {
        return await pairWithToken(qrData)
    }

    /// Unpair from current device
    func unpair() {
        service.unpair()
        relayClient.disconnect()
        isPaired = false
        activateNativeConnectionMode()
        messages.removeAll()
    }

    /// Send message to bot
    func sendMessage(
        _ content: String,
        contentType: ClawbotMessageContentType = .text,
        mediaUrl: String? = nil,
        mediaMimeType: String? = nil
    ) async -> Bool {
        guard isPaired else {
            lastError = NSLocalizedString("error.clawbot.not.paired", comment: "")
            return false
        }

        isSending = true
        lastError = nil

        if connectionMode == .relay && relayConnected {
            let relaySuccess = await sendMessageRelay(content)
            isSending = false
            return relaySuccess
        }

        do {
            try await service.sendMessage(
                content,
                contentType: contentType,
                mediaUrl: mediaUrl,
                mediaMimeType: mediaMimeType
            )
            // Add user message to local list
            let userMessage = ClawbotMessage(
                id: generateMessageId(),
                content: content,
                contentType: contentType,
                mediaUrl: mediaUrl,
                mediaMimeType: mediaMimeType,
                timestamp: Date(),
                sender: .user
            )
            messages.append(userMessage)
            isSending = false
            return true
        } catch {
            lastError = error.localizedDescription
            isSending = false
            return false
        }
    }

    // MARK: - Private Methods

    private func setupBindings() {
        // Bind connection state
        service.$connectionState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.connectionState = state
                if case .connected = state {
                    self?.isConnected = true
                } else {
                    self?.isConnected = false
                }
            }
            .store(in: &cancellables)

        // Bind pairing state
        service.$isPaired
            .receive(on: DispatchQueue.main)
            .assign(to: &$isPaired)

        // Bind last message
        service.$lastMessage
            .receive(on: DispatchQueue.main)
            .compactMap { $0 }
            .sink { [weak self] message in
                self?.messages.append(message)
            }
            .store(in: &cancellables)

        // Bind bot state
        service.$botState
            .receive(on: DispatchQueue.main)
            .map { botBehaviorState -> BotState in
                switch botBehaviorState {
                case .idle: return .idle
                case .thinking: return .thinking
                case .speaking: return .speaking
                }
            }
            .assign(to: &$botState)
    }

    private func generateMessageId() -> String {
        return "\(Int(Date().timeIntervalSince1970 * 1000))-\(Int.random(in: 100000...999999))"
    }

    private func handleRelayIncomingMessage(_ data: [String: Any]) {
        let relayEvent = (data["event"] as? String)?.lowercased()
        let (payload, streamId) = normalizeRelayPayload(data)

        let delta = firstString(
            in: payload,
            keys: ["delta", "contentDelta", "content_delta"]
        ) ?? nestedString(
            in: payload,
            dictKey: "data",
            keys: ["delta", "contentDelta", "content_delta"]
        )

        let content = firstString(
            in: payload,
            keys: ["content", "message", "text", "reply"]
        ) ?? nestedString(
            in: payload,
            dictKey: "data",
            keys: ["content", "message", "text", "reply"]
        ) ?? nestedString(
            in: payload,
            dictKey: "message",
            keys: ["content", "text", "reply"]
        ) ?? extractGatewayMessageText(from: payload)

        let eventIsFinal = relayEvent == "chat.final" ||
            relayEvent == "agent.final" ||
            relayEvent == "chat.done" ||
            relayEvent == "agent.done" ||
            relayEvent == "chat.completed" ||
            relayEvent == "agent.completed"
        let isFinal = eventIsFinal || detectFinalFlag(in: payload)

        if let delta, !delta.isEmpty {
            relayStreamBuffers[streamId, default: ""].append(delta)
        } else if let content, !content.isEmpty, !isFinal {
            relayStreamBuffers[streamId, default: ""].append(content)
        }

        if isFinal {
            var finalText = relayStreamBuffers.removeValue(forKey: streamId) ?? ""
            if let content, !content.isEmpty, !finalText.hasSuffix(content) {
                finalText += content
            }
            if finalText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return
            }
            appendBotMessage(finalText)
            return
        }

        if let content,
           !content.isEmpty,
           delta == nil,
           relayStreamBuffers[streamId] == nil {
            appendBotMessage(content)
        }
    }

    private func normalizeRelayPayload(_ raw: [String: Any]) -> ([String: Any], String) {
        var payload = raw

        if let params = raw["params"] as? [String: Any] {
            payload = params
        } else if let nestedPayload = raw["payload"] as? [String: Any] {
            payload = nestedPayload
        }

        let streamId = firstString(
            in: payload,
            keys: ["runId", "messageId", "id", "requestId", "sessionId"]
        ) ?? firstString(
            in: raw,
            keys: ["runId", "messageId", "id", "requestId", "sessionId"]
        ) ?? "default-stream"

        return (payload, streamId)
    }

    private func detectFinalFlag(in payload: [String: Any]) -> Bool {
        if let final = payload["final"] as? Bool, final { return true }
        if let done = payload["done"] as? Bool, done { return true }
        if let finished = payload["finished"] as? Bool, finished { return true }

        if let status = (payload["status"] as? String)?.lowercased(),
           ["final", "done", "completed", "stop", "stopped", "finished"].contains(status) {
            return true
        }
        if let state = (payload["state"] as? String)?.lowercased(),
           ["final", "done", "completed", "stop", "stopped", "finished"].contains(state) {
            return true
        }

        if let data = payload["data"] as? [String: Any] {
            if let final = data["final"] as? Bool, final { return true }
            if let done = data["done"] as? Bool, done { return true }
            if let finishReason = data["finishReason"] as? String, !finishReason.isEmpty { return true }
            if let finishReason = data["finish_reason"] as? String, !finishReason.isEmpty { return true }
            if let status = (data["status"] as? String)?.lowercased(),
               ["final", "done", "completed", "stop", "stopped", "finished"].contains(status) {
                return true
            }
            if let state = (data["state"] as? String)?.lowercased(),
               ["final", "done", "completed", "stop", "stopped", "finished"].contains(state) {
                return true
            }
        }

        return false
    }

    private func firstString(in dict: [String: Any], keys: [String]) -> String? {
        for key in keys {
            if let value = dict[key] as? String {
                return value
            }
        }
        return nil
    }

    private func nestedString(in dict: [String: Any], dictKey: String, keys: [String]) -> String? {
        guard let nested = dict[dictKey] as? [String: Any] else { return nil }
        return firstString(in: nested, keys: keys)
    }

    private func appendBotMessage(_ content: String) {
        let botMessage = ClawbotMessage(
            id: generateMessageId(),
            content: content,
            contentType: .text,
            mediaUrl: nil,
            mediaMimeType: nil,
            timestamp: Date(),
            sender: .bot
        )
        messages.append(botMessage)
    }

    private func extractGatewayMessageText(from payload: [String: Any]) -> String? {
        guard let message = payload["message"] as? [String: Any] else { return nil }
        if let text = message["text"] as? String, !text.isEmpty {
            return text
        }
        if let content = message["content"] as? String, !content.isEmpty {
            return content
        }
        if let blocks = message["content"] as? [[String: Any]] {
            let text = blocks
                .compactMap { $0["text"] as? String }
                .joined()
            return text.isEmpty ? nil : text
        }
        return nil
    }
}
