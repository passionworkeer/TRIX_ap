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
    @Published var connectionMode: ConnectionMode = .socketIO

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

    // MARK: - Initialization

    private init() {
        setupBindings()
        setupRelayBindings()
    }

    // MARK: - Relay Connection Methods

    /// Connect via Relay server (QR code or manual input)
    func connectRelay(server: String, gatewayId: String, accessCode: String) async -> Bool {
        lastError = nil
        isSending = true

        do {
            try await relayClient.connect(server: server, gatewayId: gatewayId, accessCode: accessCode)
            relayConnected = true
            relayDeviceName = relayClient.displayName
            isPaired = true
            isSending = false
            return true
        } catch {
            lastError = error.localizedDescription
            relayConnected = false
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
            lastError = "无效的 QR 码内容"
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
        isPaired = false
    }

    /// Send message via Relay
    func sendMessageRelay(_ content: String) async -> Bool {
        guard relayConnected else {
            lastError = "未连接到 Relay"
            return false
        }

        isSending = true

        do {
            try await relayClient.sendToDevice(method: "chat.send", params: ["message": content])
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
                // Handle incoming message from device
                if let content = data["content"] as? String {
                    let botMessage = ClawbotMessage(
                        id: self?.generateMessageId() ?? UUID().uuidString,
                        content: content,
                        contentType: .text,
                        mediaUrl: nil,
                        mediaMimeType: nil,
                        timestamp: Date(),
                        sender: .bot
                    )
                    self?.messages.append(botMessage)
                }
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
            try await service.connect()
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Disconnect from Clawbot Channel
    func disconnect() {
        service.disconnect()
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
            let success = try await service.pairWithToken(token)
            if success {
                isPaired = true
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
        isPaired = false
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
            lastError = "Not paired with any device"
            return false
        }

        isSending = true
        lastError = nil

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
}
