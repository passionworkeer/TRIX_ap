//
//  ClawbotPairingServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for Clawbot Pairing Service
//

import Foundation
import Combine

/// Protocol defining Clawbot pairing service interface
protocol ClawbotPairingServiceProtocol {
    /// Current list of paired devices
    var pairedDevices: [PairedDevice] { get }

    /// Whether currently loading devices
    var isLoading: Bool { get }

    /// Whether a pairing operation is in progress
    var isPairing: Bool { get }

    /// Last error if any
    var lastError: ClawbotPairingServiceError? { get }

    /// Fetch all paired devices
    /// - Returns: Array of paired devices
    func getPairedDevices() async throws -> [PairedDevice]

    /// Pair with a device using a code
    /// - Parameter code: The pairing code
    /// - Returns: The paired device
    func pairWithCode(code: String) async throws -> PairedDevice

    /// Unpair a device
    /// - Parameter deviceId: The device ID to unpair
    func unpair(deviceId: String) async throws

    /// Sync device list from server
    func syncDevices() async throws -> [PairedDevice]
}
