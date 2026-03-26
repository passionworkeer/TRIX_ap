//
//  ClawbotChannelViewModel.swift
//  TRIX3DCompanion
//
//  Native-only view model for TRIX pairing and messaging.
//

import Foundation
import Combine

@MainActor
final class ClawbotChannelViewModel: ObservableObject {

    static let shared = ClawbotChannelViewModel()

    @Published private(set) var isConnected: Bool = false
    @Published private(set) var isPaired: Bool = false
    @Published private(set) var connectionState: ClawbotConnectionState = .disconnected
    @Published private(set) var lastError: String?
    @Published private(set) var botState: BotState = .idle
    @Published var messages: [ClawbotMessage] = []
    @Published var isSending: Bool = false

    @Published var ttsEnabled: Bool = true {
        didSet { service.ttsEnabled = ttsEnabled }
    }

    @Published var ttsLanguage: TTSLanguage = .chinese {
        didSet { service.ttsLanguage = ttsLanguage }
    }

    private let service = ClawbotChannelService.shared
    private var cancellables = Set<AnyCancellable>()

    private init() {
        setupBindings()
    }

    func connect() async {
        do {
            try await service.connect()
        } catch {
            lastError = error.localizedDescription
        }
    }

    func disconnect() {
        service.disconnect()
    }

    func checkPairingStatus() async {
        do {
            let status = try await service.checkPairingStatus()
            isPaired = status.paired
        } catch {
            lastError = error.localizedDescription
        }
    }

    func pairWithCode(_ code: String) async -> Bool {
        isSending = true
        lastError = nil

        defer {
            isSending = false
        }

        do {
            let success = try await service.pairWithCode(code)
            if success {
                isPaired = true
            }
            return success
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    func pairWithQR(_ qrData: String) async -> Bool {
        isSending = true
        lastError = nil

        defer {
            isSending = false
        }

        do {
            let success = try await service.pairWithQR(qrData)
            if success {
                isPaired = true
            }
            return success
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    func unpair() {
        service.unpair()
        isPaired = false
        messages.removeAll()
    }

    func sendMessage(
        _ content: String,
        contentType: ClawbotMessageContentType = .text,
        mediaUrl: String? = nil,
        mediaMimeType: String? = nil,
        mediaData: Data? = nil,
        mediaFileName: String? = nil
    ) async -> Bool {
        // No pairing gate here — when unpaired, messages flow via cloud service (same as web).
        isSending = true
        lastError = nil

        defer {
            isSending = false
        }

        do {
            NSLog("[TRIX-UI] viewModel send begin text=%{public}@ type=%{public}@ media=%{public}@",
                  content,
                  contentType.rawValue,
                  String(mediaData != nil || mediaUrl != nil))
            try await service.sendMessage(
                content,
                contentType: contentType,
                mediaUrl: mediaUrl,
                mediaMimeType: mediaMimeType,
                mediaData: mediaData,
                mediaFileName: mediaFileName
            )
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
            NSLog("[TRIX-UI] viewModel send appended local user message id=%{public}@", userMessage.id)
            return true
        } catch {
            NSLog("[TRIX-UI] viewModel send failed text=%{public}@ error=%{public}@",
                  content,
                  error.localizedDescription)
            lastError = error.localizedDescription
            return false
        }
    }

    private func setupBindings() {
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

        service.$isPaired
            .receive(on: DispatchQueue.main)
            .assign(to: &$isPaired)

        service.$lastMessage
            .receive(on: DispatchQueue.main)
            .compactMap { $0 }
            .sink { [weak self] message in
                NSLog("[TRIX-UI] viewModel received bot message id=%{public}@ text=%{public}@",
                      message.id,
                      String(message.content.prefix(80)))
                self?.messages.append(message)
            }
            .store(in: &cancellables)

        service.$botState
            .receive(on: DispatchQueue.main)
            .map { state -> BotState in
                switch state {
                case .idle: return .idle
                case .thinking: return .thinking
                case .speaking: return .speaking
                }
            }
            .assign(to: &$botState)
    }

    private func generateMessageId() -> String {
        "\(Int(Date().timeIntervalSince1970 * 1000))-\(Int.random(in: 100000...999999))"
    }
}
