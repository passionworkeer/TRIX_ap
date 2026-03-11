//
//  ClawbotPairingService.swift
//  TRIX3DCompanion
//
//  Clawbot Pairing Service - Manages Clawbot device pairing
//

import Foundation
import Combine

// MARK: - Error Types

/// Clawbot Pairing Service error types
enum ClawbotPairingServiceError: Error, LocalizedError {
    case notAuthenticated
    case invalidCode
    case deviceNotFound
    case alreadyPaired
    case pairingFailed(underlying: Error)
    case unpairFailed(underlying: Error)
    case networkError(underlying: Error)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to manage devices"
        case .invalidCode:
            return "Invalid pairing code"
        case .deviceNotFound:
            return "Device not found"
        case .alreadyPaired:
            return "This device is already paired"
        case .pairingFailed(let error):
            return "Pairing failed: \(error.localizedDescription)"
        case .unpairFailed(let error):
            return "Failed to unpair: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }
}

// MARK: - Service Implementation

/// Main service handling Clawbot device pairing
@MainActor
final class ClawbotPairingService: ObservableObject, ClawbotPairingServiceProtocol {

    // MARK: - Singleton

    static let shared = ClawbotPairingService()

    // MARK: - Published Properties

    /// Current list of paired devices
    @Published private(set) var pairedDevices: [PairedDevice] = []

    /// Whether currently loading devices
    @Published private(set) var isLoading: Bool = false

    /// Whether a pairing operation is in progress
    @Published private(set) var isPairing: Bool = false

    /// Last error if any
    @Published private(set) var lastError: ClawbotPairingServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClient
    private let authService: AuthService

    // MARK: - Private Properties

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - apiClient: API client instance (defaults to shared)
    ///   - authService: Auth service instance (defaults to shared)
    init(
        apiClient: APIClient? = nil,
        authService: AuthService? = nil
    ) {
        self.apiClient = apiClient ?? .shared
        self.authService = authService ?? .shared
    }

    // MARK: - Public Methods

    /// Fetch all paired devices
    /// - Returns: Array of paired devices
    func getPairedDevices() async throws -> [PairedDevice] {
        guard authService.isLoggedIn else {
            let error = ClawbotPairingServiceError.notAuthenticated
            lastError = error
            throw error
        }

        isLoading = true
        lastError = nil

        do {
            let devices: [PairedDevice] = try await apiClient.get(.pairingDevices)
            pairedDevices = devices
            isLoading = false

            SecureLogger.shared.info("Fetched \(devices.count) paired devices")
            return devices

        } catch let error as NetworkError {
            isLoading = false
            let serviceError = mapNetworkError(error)
            lastError = serviceError
            SecureLogger.shared.error("Failed to fetch devices: \(error.localizedDescription)")
            throw serviceError
        } catch {
            isLoading = false
            let serviceError = ClawbotPairingServiceError.unknown(underlying: error)
            lastError = serviceError
            SecureLogger.shared.error("Failed to fetch devices: \(error.localizedDescription)")
            throw serviceError
        }
    }

    /// Pair with a device using a code
    /// - Parameter code: The pairing code
    /// - Returns: The paired device
    func pairWithCode(code: String) async throws -> PairedDevice {
        // Validate code
        let trimmedCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedCode.isEmpty else {
            let error = ClawbotPairingServiceError.invalidCode
            lastError = error
            throw error
        }

        guard authService.isLoggedIn else {
            let error = ClawbotPairingServiceError.notAuthenticated
            lastError = error
            throw error
        }

        isPairing = true
        lastError = nil

        do {
            // Get current user ID
            guard let userId = authService.currentUser?.id else {
                let error = ClawbotPairingServiceError.notAuthenticated
                lastError = error
                isPairing = false
                throw error
            }

            // Create pairing request
            let request = PairWithCodeRequest(code: trimmedCode, userId: userId)

            // Call API
            let device: PairedDevice = try await apiClient.post(.pairingDevices, body: request)

            // Add to local list
            pairedDevices.append(device)
            isPairing = false

            SecureLogger.shared.info("Successfully paired device: \(device.deviceName)")
            return device

        } catch let error as NetworkError {
            isPairing = false
            let serviceError = mapPairingError(error)
            lastError = serviceError
            SecureLogger.shared.error("Pairing failed: \(error.localizedDescription)")
            throw serviceError
        } catch let error as ClawbotPairingServiceError {
            isPairing = false
            lastError = error
            throw error
        } catch {
            isPairing = false
            let serviceError = ClawbotPairingServiceError.pairingFailed(underlying: error)
            lastError = serviceError
            SecureLogger.shared.error("Pairing failed: \(error.localizedDescription)")
            throw serviceError
        }
    }

    /// Unpair a device
    /// - Parameter deviceId: The device ID to unpair
    func unpair(deviceId: String) async throws {
        guard authService.isLoggedIn else {
            let error = ClawbotPairingServiceError.notAuthenticated
            lastError = error
            throw error
        }

        // Check if device exists
        guard pairedDevices.contains(where: { $0.id == deviceId }) else {
            let error = ClawbotPairingServiceError.deviceNotFound
            lastError = error
            throw error
        }

        isLoading = true
        lastError = nil

        do {
            // Call API to unpair
            let _: EmptyResponse = try await apiClient.delete(.pairingDevice(id: deviceId))

            // Remove from local list
            pairedDevices.removeAll { $0.id == deviceId }
            isLoading = false

            SecureLogger.shared.info("Successfully unpaired device: \(deviceId)")

        } catch let error as NetworkError {
            isLoading = false
            let serviceError = mapNetworkError(error)
            lastError = serviceError
            SecureLogger.shared.error("Unpair failed: \(error.localizedDescription)")
            throw serviceError
        } catch {
            isLoading = false
            let serviceError = ClawbotPairingServiceError.unpairFailed(underlying: error)
            lastError = serviceError
            SecureLogger.shared.error("Unpair failed: \(error.localizedDescription)")
            throw serviceError
        }
    }

    /// Sync device list from server
    /// - Returns: Array of paired devices
    func syncDevices() async throws -> [PairedDevice] {
        return try await getPairedDevices()
    }

    // MARK: - Private Methods

    /// Map network errors to pairing service errors
    private func mapNetworkError(_ error: NetworkError) -> ClawbotPairingServiceError {
        switch error {
        case .noConnection, .timeout:
            return .networkError(underlying: error)
        case .unauthorized:
            return .notAuthenticated
        case .notFound:
            return .deviceNotFound
        default:
            return .unknown(underlying: error)
        }
    }

    /// Map pairing-specific errors
    private func mapPairingError(_ error: NetworkError) -> ClawbotPairingServiceError {
        switch error {
        case .badRequest:
            return .invalidCode
        case .conflict:
            return .alreadyPaired
        case .notFound:
            return .deviceNotFound
        default:
            return mapNetworkError(error)
        }
    }
}

// MARK: - Convenience Methods

extension ClawbotPairingService {

    /// Get device by ID
    func device(byId id: String) -> PairedDevice? {
        return pairedDevices.first { $0.id == id }
    }

    /// Get online devices
    var onlineDevices: [PairedDevice] {
        return pairedDevices.filter { $0.isOnline }
    }

    /// Get offline devices
    var offlineDevices: [PairedDevice] {
        return pairedDevices.filter { !$0.isOnline }
    }

    /// Check if any device is online
    var hasOnlineDevice: Bool {
        return pairedDevices.contains { $0.isOnline }
    }

    /// Get device count
    var deviceCount: Int {
        return pairedDevices.count
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    /// Refresh device list
    func refresh() async throws -> [PairedDevice] {
        return try await syncDevices()
    }
}
