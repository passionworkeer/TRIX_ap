//
//  PairingService.swift
//  TRIX3DCompanion
//
//  Device pairing service for managing device connections
//

import Foundation
import Combine

// MARK: - Pairing Error

/// Pairing error types
enum PairingError: Error, LocalizedError {
    case invalidCode
    case invalidQRData
    case deviceNotFound
    case pairingFailed(underlying: Error?)
    case notPaired
    case networkError(underlying: Error)
    case permissionDenied
    case expiredCode
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .invalidCode:
            return "Invalid pairing code. Please check and try again."
        case .invalidQRData:
            return "Invalid QR code data. Please scan a valid pairing QR code."
        case .deviceNotFound:
            return "Device not found. Please make sure the device is online."
        case .pairingFailed(let error):
            return "Pairing failed: \(error?.localizedDescription ?? "Unknown error")"
        case .notPaired:
            return "No device is currently paired."
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .permissionDenied:
            return "Permission denied. Please check your account settings."
        case .expiredCode:
            return "Pairing code has expired. Please generate a new one."
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }
}

// MARK: - Pairing State

/// Current pairing state
enum PairingState: Equatable {
    case unpaired
    case pairing
    case paired(deviceId: String, deviceName: String)
    case unpairing

    var isPaired: Bool {
        if case .paired = self {
            return true
        }
        return false
    }

    var deviceId: String? {
        if case .paired(let deviceId, _) = self {
            return deviceId
        }
        return nil
    }

    var deviceName: String? {
        if case .paired(_, let deviceName) = self {
            return deviceName
        }
        return nil
    }
}

// MARK: - Pairing Service Protocol

/// Protocol defining pairing service interface
protocol PairingServiceProtocol {
    var pairingState: PairingState { get }
    var pairedDevices: [Device] { get }
    var isLoading: Bool { get }

    func generatePairingCode() async -> Result<String, PairingError>
    func pairWithCode(_ code: String) async -> Result<Void, PairingError>
    func pairWithQRCode(_ qrData: String) async -> Result<Void, PairingError>
    func unpairDevice(_ deviceId: String) async -> Result<Void, PairingError>
    func checkPairingStatus() async -> Result<Bool, PairingError>
    func fetchPairedDevices() async -> Result<[Device], PairingError>
}

// MARK: - Pairing Service

/// Main pairing service handling device pairing operations
@MainActor
final class PairingService: ObservableObject, PairingServiceProtocol {

    // MARK: - Singleton

    static let shared = PairingService()

    // MARK: - Published Properties

    /// Current pairing state
    @Published private(set) var pairingState: PairingState = .unpaired

    /// List of paired devices
    @Published private(set) var pairedDevices: [Device] = []

    /// Whether a pairing operation is in progress
    @Published private(set) var isLoading: Bool = false

    /// Last pairing error if any
    @Published private(set) var lastError: PairingError?

    /// Current pairing code (if generated)
    @Published private(set) var currentPairingCode: String?

    /// Expiration date for current pairing code
    @Published private(set) var pairingCodeExpiration: Date?

    // MARK: - Dependencies

    private let apiClient: APIClient
    private let webSocketManager: WebSocketManager
    private let userDefaultsManager: UserDefaultsManager

    // MARK: - Private Properties

    /// Timer for pairing code expiration
    private var expirationTimer: Timer?

    /// Pairing code validity duration (5 minutes)
    private let pairingCodeValidityDuration: TimeInterval = 300

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - apiClient: API client instance (defaults to shared)
    ///   - webSocketManager: WebSocket manager instance (defaults to shared)
    ///   - userDefaultsManager: UserDefaults manager instance (defaults to shared)
    init(
        apiClient: APIClient = .shared,
        webSocketManager: WebSocketManager = .shared,
        userDefaultsManager: UserDefaultsManager = .shared
    ) {
        self.apiClient = apiClient
        self.webSocketManager = webSocketManager
        self.userDefaultsManager = userDefaultsManager

        // Restore pairing state
        restorePairingState()

        // Setup WebSocket listeners
        setupWebSocketListeners()

        // Monitor pairing state changes
        setupStateMonitoring()
    }

    deinit {
        expirationTimer?.invalidate()
    }

    // MARK: - Public Methods

    /// Generate a new pairing code
    /// - Returns: Result containing the generated pairing code
    func generatePairingCode() async -> Result<String, PairingError> {
        isLoading = true
        lastError = nil

        do {
            // Request pairing code from API
            let request: APIEndpointPairingRequest = APIEndpointPairingRequest(
                userId: userDefaultsManager.getUserId() ?? ""
            )

            let response: APIEndpointPairingResponse = try await apiClient.post(
                .pairingRequest,
                body: request
            )

            guard let code = response.code else {
                isLoading = false
                let error = PairingError.pairingFailed(underlying: nil)
                lastError = error
                return .failure(error)
            }

            // Store pairing code
            currentPairingCode = code
            pairingCodeExpiration = Date().addingTimeInterval(pairingCodeValidityDuration)

            // Start expiration timer
            startExpirationTimer()

            isLoading = false

            return .success(code)

        } catch let error as NetworkError {
            isLoading = false
            let pairingError = mapNetworkError(error)
            lastError = pairingError
            return .failure(pairingError)
        } catch {
            isLoading = false
            let pairingError = PairingError.unknown(underlying: error)
            lastError = pairingError
            return .failure(pairingError)
        }
    }

    /// Pair with a pairing code
    /// - Parameter code: The pairing code to use
    /// - Returns: Result indicating success or failure
    func pairWithCode(_ code: String) async -> Result<Void, PairingError> {
        // Validate input
        guard code.count >= 6 else {
            let error = PairingError.invalidCode
            lastError = error
            return .failure(error)
        }

        isLoading = true
        lastError = nil
        pairingState = .pairing

        do {
            // Send pairing request via WebSocket
            webSocketManager.pairWithCode(code)

            // Wait for pairing success event (handled by WebSocket listener)
            // Timeout after 30 seconds
            try await Task.sleep(nanoseconds: 30_000_000_000)

            if case .paired = pairingState {
                isLoading = false
                return .success(())
            } else {
                isLoading = false
                pairingState = .unpaired
                let error = PairingError.pairingFailed(underlying: nil)
                lastError = error
                return .failure(error)
            }

        } catch {
            isLoading = false
            pairingState = .unpaired
            let pairingError = PairingError.unknown(underlying: error)
            lastError = pairingError
            return .failure(pairingError)
        }
    }

    /// Pair with QR code data
    /// - Parameter qrData: The QR code data string
    /// - Returns: Result indicating success or failure
    func pairWithQRCode(_ qrData: String) async -> Result<Void, PairingError> {
        // Validate QR data
        guard qrData.count > 0 else {
            let error = PairingError.invalidQRData
            lastError = error
            return .failure(error)
        }

        // Parse QR data (format: "trix:pair:token" or just token)
        let token: String
        if qrData.hasPrefix("trix:pair:") {
            token = String(qrData.dropFirst(10))
        } else {
            token = qrData
        }

        guard token.count >= 10 else {
            let error = PairingError.invalidQRData
            lastError = error
            return .failure(error)
        }

        isLoading = true
        lastError = nil
        pairingState = .pairing

        do {
            // Send pairing request via WebSocket with token
            webSocketManager.pairWithToken(token)

            // Wait for pairing success event (handled by WebSocket listener)
            // Timeout after 30 seconds
            try await Task.sleep(nanoseconds: 30_000_000_000)

            if case .paired = pairingState {
                isLoading = false
                return .success(())
            } else {
                isLoading = false
                pairingState = .unpaired
                let error = PairingError.pairingFailed(underlying: nil)
                lastError = error
                return .failure(error)
            }

        } catch {
            isLoading = false
            pairingState = .unpaired
            let pairingError = PairingError.unknown(underlying: error)
            lastError = pairingError
            return .failure(pairingError)
        }
    }

    /// Unpair a device
    /// - Parameter deviceId: The device ID to unpair
    /// - Returns: Result indicating success or failure
    func unpairDevice(_ deviceId: String) async -> Result<Void, PairingError> {
        isLoading = true
        lastError = nil
        pairingState = .unpairing

        do {
            // Send unpair request via WebSocket
            webSocketManager.unpair()

            // Remove from local storage
            userDefaultsManager.removePairedDevice()

            // Update state
            pairingState = .unpaired
            pairedDevices.removeAll { $0.deviceId == deviceId }

            isLoading = false

            return .success(())

        } catch {
            isLoading = false
            pairingState = .unpaired
            let pairingError = PairingError.unknown(underlying: error)
            lastError = pairingError
            return .failure(pairingError)
        }
    }

    /// Check current pairing status
    /// - Returns: Result containing pairing status
    func checkPairingStatus() async -> Result<Bool, PairingError> {
        isLoading = true
        lastError = nil

        return await withCheckedContinuation { continuation in
            webSocketManager.checkPairingStatus { result in
                self.isLoading = false

                switch result {
                case .success(let response):
                    let isPaired = response.paired ?? false
                    continuation.resume(returning: .success(isPaired))

                case .failure(let error):
                    let pairingError = PairingError.networkError(underlying: error)
                    self.lastError = pairingError
                    continuation.resume(returning: .failure(pairingError))
                }
            }
        }
    }

    /// Fetch all paired devices
    /// - Returns: Result containing list of paired devices
    func fetchPairedDevices() async -> Result<[Device], PairingError> {
        isLoading = true
        lastError = nil

        do {
            let devices: [Device] = try await apiClient.get(.pairingDevices)

            pairedDevices = devices
            isLoading = false

            return .success(devices)

        } catch let error as NetworkError {
            isLoading = false
            let pairingError = mapNetworkError(error)
            lastError = pairingError
            return .failure(pairingError)
        } catch {
            isLoading = false
            let pairingError = PairingError.unknown(underlying: error)
            lastError = pairingError
            return .failure(pairingError)
        }
    }

    // MARK: - State Management

    /// Restore pairing state from UserDefaults
    private func restorePairingState() {
        if let deviceId = userDefaultsManager.getPairedDeviceId(),
           let deviceName = userDefaultsManager.getPairedDeviceName() {
            pairingState = .paired(deviceId: deviceId, deviceName: deviceName)
        } else {
            pairingState = .unpaired
        }
    }

    /// Setup WebSocket event listeners
    private func setupWebSocketListeners() {
        // Listen for pairing success
        webSocketManager.on(.pairingSuccess) { [weak self] event in
            guard let self = self,
                  case .pairingSuccess(let deviceId, let deviceName) = event as? WebSocketEvent else {
                return
            }

            self.pairingState = .paired(deviceId: deviceId, deviceName: deviceName)
            self.userDefaultsManager.savePairedDevice(deviceId: deviceId, deviceName: deviceName)

            // Fetch paired devices list
            Task {
                _ = await self.fetchPairedDevices()
            }
        }

        // Listen for unpaired event
        webSocketManager.on(.unpaired) { [weak self] event in
            guard let self = self else { return }

            self.pairingState = .unpaired
            self.userDefaultsManager.removePairedDevice()
            self.pairedDevices.removeAll()
        }
    }

    /// Setup state monitoring
    private func setupStateMonitoring() {
        $pairingState
            .sink { [weak self] state in
                self?.handleStateChange(state)
            }
            .store(in: &cancellables)
    }

    /// Handle pairing state changes
    private func handleStateChange(_ state: PairingState) {
        // Additional logic when state changes
        switch state {
        case .paired(let deviceId, let deviceName):
            SecureLogger.shared.info("Successfully paired to device: \(deviceName) (\(deviceId))")
        case .unpaired:
            SecureLogger.shared.info("Device unpaired")
        case .pairing:
            SecureLogger.shared.debug("Pairing in progress...")
        case .unpairing:
            SecureLogger.shared.debug("Unpairing in progress...")
        }
    }

    // MARK: - Timer Management

    /// Start the expiration timer for pairing code
    private func startExpirationTimer() {
        expirationTimer?.invalidate()

        expirationTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            if let expiration = self.pairingCodeExpiration,
               Date() >= expiration {
                // Code expired
                self.currentPairingCode = nil
                self.pairingCodeExpiration = nil
                self.expirationTimer?.invalidate()
                self.expirationTimer = nil
            }
        }
    }

    // MARK: - Error Mapping

    /// Map network errors to pairing errors
    /// - Parameter error: Network error
    /// - Returns: Corresponding pairing error
    private func mapNetworkError(_ error: NetworkError) -> PairingError {
        switch error {
        case .noConnection, .timeout:
            return .networkError(underlying: error)
        case .unauthorized:
            return .permissionDenied
        case .notFound:
            return .deviceNotFound
        case .custom(let message):
            if message.lowercased().contains("expired") {
                return .expiredCode
            } else if message.lowercased().contains("invalid") {
                return .invalidCode
            } else {
                return .pairingFailed(underlying: error)
            }
        default:
            return .pairingFailed(underlying: error)
        }
    }
}

// MARK: - Convenience Extensions

extension PairingService {

    /// Check if currently paired
    var isPaired: Bool {
        return pairingState.isPaired
    }

    /// Get paired device ID
    var pairedDeviceId: String? {
        return pairingState.deviceId
    }

    /// Get paired device name
    var pairedDeviceName: String? {
        return pairingState.deviceName
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    /// Get remaining time for pairing code validity
    var pairingCodeRemainingTime: TimeInterval? {
        guard let expiration = pairingCodeExpiration else { return nil }
        return max(0, expiration.timeIntervalSinceNow)
    }
}

// MARK: - UserDefaults Helpers

extension UserDefaultsManager {

    private static let pairedDeviceIdKey = "trix_paired_device_id"
    private static let pairedDeviceNameKey = "trix_paired_device_name"

    func savePairedDevice(deviceId: String, deviceName: String) {
        UserDefaults.standard.set(deviceId, forKey: Self.pairedDeviceIdKey)
        UserDefaults.standard.set(deviceName, forKey: Self.pairedDeviceNameKey)
    }

    func getPairedDeviceId() -> String? {
        return UserDefaults.standard.string(forKey: Self.pairedDeviceIdKey)
    }

    func getPairedDeviceName() -> String? {
        return UserDefaults.standard.string(forKey: Self.pairedDeviceNameKey)
    }

    func removePairedDevice() {
        UserDefaults.standard.removeObject(forKey: Self.pairedDeviceIdKey)
        UserDefaults.standard.removeObject(forKey: Self.pairedDeviceNameKey)
    }
}

// MARK: - API Request/Response Types

struct APIEndpointPairingRequest: Codable {
    let userId: String
}

struct APIEndpointPairingResponse: Codable {
    let requestId: String
    let code: String?
    let token: String?
    let expiresIn: Int
    let qrUrl: String?
}
