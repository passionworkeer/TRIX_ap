//
//  ClawbotPairingServiceTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for ClawbotPairingService
//
//  Test Coverage:
//  - getPairedDevices: Success, not authenticated, network error
//  - pairWithCode: Success, invalid code, not authenticated, already paired
//  - unpair: Success, device not found, network error
//  - syncDevices: Success
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock API Client for ClawbotPairingService

@MainActor
final class MockAPIClientForClawbotPairing: ObservableObject {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockDevices: [PairedDevice] = []
    var lastPairingCode: String?
    var lastPairingUserId: String?
    var lastDeviceIdToDelete: String?

    func get<T>(_ endpoint: APIEndpoint, parameters: [String: Any]? = nil) async throws -> T {
        if shouldFailRequests {
            throw mockError ?? NetworkError.custom("Request failed")
        }

        guard let devices = mockDevices as? T else {
            throw NetworkError.custom("Invalid mock data")
        }

        return devices
    }

    func post<T: Decodable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        if shouldFailRequests {
            throw mockError ?? NetworkError.custom("Pairing failed")
        }

        // Parse the pairing request
        if let request = body as? PairWithCodeRequest {
            lastPairingCode = request.code
            lastPairingUserId = request.userId
        }

        // Return the first device as the paired device
        guard let device = mockDevices.first as? T else {
            throw NetworkError.custom("Invalid mock data")
        }

        return device
    }

    func delete<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        if shouldFailRequests {
            throw mockError ?? NetworkError.custom("Unpair failed")
        }

        // Extract device ID from endpoint
        if endpoint.path.contains("/pairing/device/") {
            lastDeviceIdToDelete = endpoint.path.replacingOccurrences(of: "/pairing/device/", with: "")
        }

        // Return empty response
        return EmptyResponse() as! T
    }
}

// MARK: - Mock Auth Service for ClawbotPairingService

@MainActor
final class MockAuthServiceForClawbotPairing: AuthServiceProtocol {
    var isLoggedIn: Bool = false
    var shouldFailGetCurrentUser = false

    var currentUser: User? {
        if shouldFailGetCurrentUser {
            return nil
        }
        return isLoggedIn ? User(
            id: "test_user_id",
            username: "test_user",
            email: "test@example.com",
            avatarUrl: nil,
            fullName: nil,
            displayName: "Test User",
            bio: nil,
            points: 0,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            createdAt: Date(),
            updatedAt: Date()
        ) : nil
    }

    var isLoading: Bool = false
    var lastError: AuthError?
}

// MARK: - ClawbotPairingService Tests

@MainActor
final class ClawbotPairingServiceTests: XCTestCase {

    var sut: ClawbotPairingService!
    var mockAPIClient: MockAPIClientForClawbotPairing!
    var mockAuthService: MockAuthServiceForClawbotPairing!

    override func setUp() async throws {
        try await super.setUp()

        mockAPIClient = MockAPIClientForClawbotPairing()
        mockAuthService = MockAuthServiceForClawbotPairing()

        // Setup default mock data
        mockAPIClient.mockDevices = createMockDevices()

        sut = ClawbotPairingService(
            apiClient: mockAPIClient as! APIClient,
            authService: mockAuthService as! AuthService
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockAPIClient = nil
        mockAuthService = nil
        try await super.tearDown()
    }
}

// MARK: - GetPairedDevices Tests

extension ClawbotPairingServiceTests {

    func testGetPairedDevicesSuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true

        // When
        let devices = try await sut.getPairedDevices()

        // Then
        XCTAssertEqual(devices.count, 2, "Should return 2 devices")
        XCTAssertEqual(sut.pairedDevices.count, 2, "Should update paired devices state")
        XCTAssertFalse(sut.isLoading, "Should not be loading after success")
    }

    func testGetPairedDevicesNotAuthenticated() async throws {
        // Given
        mockAuthService.isLoggedIn = false

        // When & Then
        do {
            _ = try await sut.getPairedDevices()
            XCTFail("Should throw not authenticated error")
        } catch let error as ClawbotPairingServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
            XCTAssertNotNil(sut.lastError, "Should set last error")
        }
    }

    func testGetPairedDevicesNetworkError() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When & Then
        do {
            _ = try await sut.getPairedDevices()
            XCTFail("Should throw network error")
        } catch let error as ClawbotPairingServiceError {
            if case .networkError = error {
                XCTAssertTrue(true, "Should throw network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testGetPairedDevicesUnauthorized() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .unauthorized

        // When & Then
        do {
            _ = try await sut.getPairedDevices()
            XCTFail("Should throw not authenticated error")
        } catch let error as ClawbotPairingServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
        }
    }
}

// MARK: - PairWithCode Tests

extension ClawbotPairingServiceTests {

    func testPairWithCodeSuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let code = "123456"

        // When
        let device = try await sut.pairWithCode(code: code)

        // Then
        XCTAssertNotNil(device, "Should return paired device")
        XCTAssertEqual(sut.pairedDevices.count, 3, "Should add device to list")
        XCTAssertEqual(mockAPIClient.lastPairingCode, code, "Should use correct pairing code")
        XCTAssertEqual(mockAPIClient.lastPairingUserId, "test_user_id", "Should use correct user ID")
        XCTAssertFalse(sut.isPairing, "Should not be pairing after success")
    }

    func testPairWithCodeInvalidCode() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let emptyCode = ""

        // When & Then
        do {
            _ = try await sut.pairWithCode(code: emptyCode)
            XCTFail("Should throw invalid code error")
        } catch let error as ClawbotPairingServiceError {
            XCTAssertEqual(error, .invalidCode, "Should throw invalid code error")
            XCTAssertNotNil(sut.lastError, "Should set last error")
        }
    }

    func testPairWithCodeWhitespaceOnly() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let whitespaceCode = "   "

        // When & Then
        do {
            _ = try await sut.pairWithCode(code: whitespaceCode)
            XCTFail("Should throw invalid code error")
        } catch let error as ClawbotPairingServiceError {
            XCTAssertEqual(error, .invalidCode, "Should throw invalid code error")
        }
    }

    func testPairWithCodeNotAuthenticated() async throws {
        // Given
        mockAuthService.isLoggedIn = false

        // When & Then
        do {
            _ = try await sut.pairWithCode(code: "123456")
            XCTFail("Should throw not authenticated error")
        } catch let error as ClawbotPairingServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
        }
    }

    func testPairWithCodeNoCurrentUser() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAuthService.shouldFailGetCurrentUser = true

        // When & Then
        do {
            _ = try await sut.pairWithCode(code: "123456")
            XCTFail("Should throw not authenticated error")
        } catch let error as ClawbotPairingServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
        }
    }

    func testPairWithCodeNetworkError() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When & Then
        do {
            _ = try await sut.pairWithCode(code: "123456")
            XCTFail("Should throw network error")
        } catch let error as ClawbotPairingServiceError {
            if case .networkError = error {
                XCTAssertTrue(true, "Should throw network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testPairWithCodeBadRequest() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .badRequest

        // When & Then
        do {
            _ = try await sut.pairWithCode(code: "123456")
            XCTFail("Should throw invalid code error")
        } catch let error as ClawbotPairingServiceError {
            XCTAssertEqual(error, .invalidCode, "Should throw invalid code error for bad request")
        }
    }

    func testPairWithCodeAlreadyPaired() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .conflict

        // When & Then
        do {
            _ = try await sut.pairWithCode(code: "123456")
            XCTFail("Should throw already paired error")
        } catch let error as ClawbotPairingServiceError {
            XCTAssertEqual(error, .alreadyPaired, "Should throw already paired error")
        }
    }
}

// MARK: - Unpair Tests

extension ClawbotPairingServiceTests {

    func testUnpairSuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let deviceId = "device_1"

        // Pre-populate paired devices
        _ = try await sut.getPairedDevices()
        XCTAssertEqual(sut.pairedDevices.count, 2, "Should have 2 devices before unpair")

        // When
        try await sut.unpair(deviceId: deviceId)

        // Then
        XCTAssertEqual(sut.pairedDevices.count, 1, "Should have 1 device after unpair")
        XCTAssertEqual(mockAPIClient.lastDeviceIdToDelete, deviceId, "Should delete correct device")
        XCTAssertFalse(sut.isLoading, "Should not be loading after success")
    }

    func testUnpairDeviceNotFound() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let nonExistentDeviceId = "non_existent"

        // Pre-populate paired devices
        _ = try await sut.getPairedDevices()

        // When & Then
        do {
            try await sut.unpair(deviceId: nonExistentDeviceId)
            XCTFail("Should throw device not found error")
        } catch let error as ClawbotPairingServiceError {
            XCTAssertEqual(error, .deviceNotFound, "Should throw device not found error")
        }
    }

    func testUnpairNotAuthenticated() async throws {
        // Given
        mockAuthService.isLoggedIn = false

        // When & Then
        do {
            try await sut.unpair(deviceId: "device_1")
            XCTFail("Should throw not authenticated error")
        } catch let error as ClawbotPairingServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
        }
    }

    func testUnpairNetworkError() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // Pre-populate paired devices
        _ = try await sut.getPairedDevices()

        // When & Then
        do {
            try await sut.unpair(deviceId: "device_1")
            XCTFail("Should throw network error")
        } catch let error as ClawbotPairingServiceError {
            if case .networkError = error {
                XCTAssertTrue(true, "Should throw network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }
}

// MARK: - SyncDevices Tests

extension ClawbotPairingServiceTests {

    func testSyncDevicesSuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true

        // When
        let devices = try await sut.syncDevices()

        // Then
        XCTAssertEqual(devices.count, 2, "Should return synced devices")
        XCTAssertEqual(sut.pairedDevices.count, 2, "Should update paired devices state")
    }

    func testSyncDevicesNotAuthenticated() async throws {
        // Given
        mockAuthService.isLoggedIn = false

        // When & Then
        do {
            _ = try await sut.syncDevices()
            XCTFail("Should throw not authenticated error")
        } catch let error as ClawbotPairingServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
        }
    }
}

// MARK: - Convenience Methods Tests

extension ClawbotPairingServiceTests {

    func testDeviceById() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        _ = try await sut.getPairedDevices()

        // When
        let device = sut.device(byId: "device_1")

        // Then
        XCTAssertNotNil(device, "Should find device by ID")
        XCTAssertEqual(device?.deviceName, "Device One", "Should return correct device")
    }

    func testOnlineDevices() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.mockDevices = [
            PairedDevice(
                id: "device_1",
                deviceId: "dev_1",
                deviceName: "Device One",
                deviceType: .clawbot,
                pairedAt: Date(),
                isOnline: true
            ),
            PairedDevice(
                id: "device_2",
                deviceId: "dev_2",
                deviceName: "Device Two",
                deviceType: .clawbot,
                pairedAt: Date(),
                isOnline: false
            )
        ]
        _ = try await sut.getPairedDevices()

        // When
        let onlineDevices = sut.onlineDevices

        // Then
        XCTAssertEqual(onlineDevices.count, 1, "Should have 1 online device")
        XCTAssertTrue(onlineDevices.first?.isOnline ?? false, "Device should be online")
    }

    func testOfflineDevices() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.mockDevices = [
            PairedDevice(
                id: "device_1",
                deviceId: "dev_1",
                deviceName: "Device One",
                deviceType: .clawbot,
                pairedAt: Date(),
                isOnline: true
            ),
            PairedDevice(
                id: "device_2",
                deviceId: "dev_2",
                deviceName: "Device Two",
                deviceType: .clawbot,
                pairedAt: Date(),
                isOnline: false
            )
        ]
        _ = try await sut.getPairedDevices()

        // When
        let offlineDevices = sut.offlineDevices

        // Then
        XCTAssertEqual(offlineDevices.count, 1, "Should have 1 offline device")
        XCTAssertFalse(offlineDevices.first?.isOnline ?? true, "Device should be offline")
    }

    func testHasOnlineDevice() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.mockDevices = [
            PairedDevice(
                id: "device_1",
                deviceId: "dev_1",
                deviceName: "Device One",
                deviceType: .clawbot,
                pairedAt: Date(),
                isOnline: false
            )
        ]
        _ = try await sut.getPairedDevices()

        // When
        let hasOnline = sut.hasOnlineDevice

        // Then
        XCTAssertFalse(hasOnline, "Should not have online device")
    }

    func testDeviceCount() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        _ = try await sut.getPairedDevices()

        // When
        let count = sut.deviceCount

        // Then
        XCTAssertEqual(count, 2, "Should return correct device count")
    }

    func testClearError() async throws {
        // Given
        mockAuthService.isLoggedIn = false
        _ = try? await sut.getPairedDevices()
        XCTAssertNotNil(sut.lastError, "Should have error after failed request")

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.lastError, "Should clear error")
    }
}

// MARK: - Helper Methods

extension ClawbotPairingServiceTests {

    private func createMockDevices() -> [PairedDevice] {
        [
            PairedDevice(
                id: "device_1",
                deviceId: "dev_1",
                deviceName: "Device One",
                deviceType: .clawbot,
                pairedAt: Date(),
                isOnline: true
            ),
            PairedDevice(
                id: "device_2",
                deviceId: "dev_2",
                deviceName: "Device Two",
                deviceType: .clawbot,
                pairedAt: Date(),
                isOnline: false
            )
        ]
    }
}
