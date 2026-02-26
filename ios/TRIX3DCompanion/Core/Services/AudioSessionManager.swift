//
//  AudioSessionManager.swift
//  TRIX3DCompanion
//
//  Audio session manager for handling audio interruptions and route changes
//

import Foundation
import AVFoundation
import Combine

/// Audio session manager
final class AudioSessionManager {

    // MARK: - Singleton

    static let shared = AudioSessionManager()

    // MARK: - Published Properties

    @Published private(set) var isAudioSessionActive: Bool = false
    @Published private(set) var currentRoute: AVAudioSessionRouteDescription?
    @Published private(set) var interruptionType: InterruptionType?

    // MARK: - Publishers

    var interruptionPublisher: AnyPublisher<InterruptionType, Never> {
        interruptionSubject.eraseToAnyPublisher()
    }

    var routeChangePublisher: AnyPublisher<RouteChangeReason, Never> {
        routeChangeSubject.eraseToAnyPublisher()
    }

    // MARK: - Properties

    private let audioSession = AVAudioSession.sharedInstance()
    private let interruptionSubject = PassthroughSubject<InterruptionType, Never>()
    private let routeChangeSubject = PassthroughSubject<RouteChangeReason, Never>()

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        setupObservers()
    }

    // MARK: - Configuration

    /// Configure audio session for playback
    func configureForPlayback() throws {
        try audioSession.setCategory(
            .playback,
            mode: .spokenAudio,
            options: [.duckOthers, .allowBluetooth]
        )
        try audioSession.setActive(true)
        isAudioSessionActive = true

        // Update current route
        currentRoute = audioSession.currentRoute
    }

    /// Configure audio session for recording
    func configureForRecording() throws {
        try audioSession.setCategory(
            .record,
            mode: .default,
            options: [.allowBluetooth]
        )
        try audioSession.setActive(true)
        isAudioSessionActive = true
    }

    /// Deactivate audio session
    func deactivate() throws {
        try audioSession.setActive(false)
        isAudioSessionActive = false
    }

    // MARK: - Setup

    private func setupObservers() {
        // Interruption notification
        NotificationCenter.default.publisher(for: AVAudioSession.interruptionNotification)
            .sink { [weak self] notification in
                self?.handleInterruption(notification)
            }
            .store(in: &cancellables)

        // Route change notification
        NotificationCenter.default.publisher(for: AVAudioSession.routeChangeNotification)
            .sink { [weak self] notification in
                self?.handleRouteChange(notification)
            }
            .store(in: &cancellables)

        // Media services were lost notification
        NotificationCenter.default.publisher(for: AVAudioSession.mediaServicesWereLostNotification)
            .sink { [weak self] _ in
                self?.handleMediaServicesLost()
            }
            .store(in: &cancellables)

        // Media services were reset notification
        NotificationCenter.default.publisher(for: AVAudioSession.mediaServicesWereResetNotification)
            .sink { [weak self] _ in
                self?.handleMediaServicesReset()
            }
            .store(in: &cancellables)
    }

    // MARK: - Handlers

    private func handleInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }

        switch type {
        case .began:
            interruptionType = .began
            interruptionSubject.send(.began)

        case .ended:
            interruptionType = .ended
            interruptionSubject.send(.ended)

            // Resume playback if needed
            if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume) {
                    // Notify to resume
                    interruptionSubject.send(.shouldResume)
                }
            }

        @unknown default:
            break
        }
    }

    private func handleRouteChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
            return
        }

        // Update current route
        currentRoute = audioSession.currentRoute

        // Map to our reason type
        let routeReason: RouteChangeReason
        switch reason {
        case .oldDeviceUnavailable:
            routeReason = .deviceDisconnected
        case .newDeviceAvailable:
            routeReason = .deviceConnected
        case .categoryChange:
            routeReason = .categoryChanged
        case .override:
            routeReason = .override
        case .wakeFromSleep:
            routeReason = .wakeFromSleep
        case .noSuitableRouteForCategory:
            routeReason = .noSuitableRoute
        case .routeConfigurationChange:
            routeReason = .configurationChanged
        @unknown default:
            routeReason = .unknown
        }

        routeChangeSubject.send(routeReason)
    }

    private func handleMediaServicesLost() {
        isAudioSessionActive = false
    }

    private func handleMediaServicesReset() {
        // Reconfigure audio session after reset
        if isAudioSessionActive {
            try? configureForPlayback()
        }
    }

    // MARK: - Public Methods

    /// Check if headphones are connected
    var areHeadphonesConnected: Bool {
        audioSession.currentRoute.outputs.contains { output in
            output.portType == .headphones ||
            output.portType == .bluetoothA2DP ||
            output.portType == .bluetoothHFP
        }
    }

    /// Check if bluetooth is connected
    var isBluetoothConnected: Bool {
        audioSession.currentRoute.outputs.contains { output in
            output.portType == .bluetoothA2DP ||
            output.portType == .bluetoothHFP
        }
    }

    /// Get available outputs
    var availableOutputs: [AVAudioSessionPortDescription] {
        return audioSession.availableInputs?.flatMap { input in
            input.dataSources ?? []
        } ?? []
    }
}

// MARK: - Interruption Type

enum InterruptionType {
    case began
    case ended
    case shouldResume
}

// MARK: - Route Change Reason

enum RouteChangeReason {
    case deviceConnected
    case deviceDisconnected
    case categoryChanged
    case override
    case wakeFromSleep
    case noSuitableRoute
    case configurationChanged
    case unknown
}
