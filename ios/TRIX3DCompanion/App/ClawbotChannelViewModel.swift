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
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        setupBindings()
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
    func sendMessage(_ content: String) async -> Bool {
        guard isPaired else {
            lastError = "Not paired with any device"
            return false
        }

        isSending = true
        lastError = nil

        do {
            try await service.sendMessage(content, contentType: .text)
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
