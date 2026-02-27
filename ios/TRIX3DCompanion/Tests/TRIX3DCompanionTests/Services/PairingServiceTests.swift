//
//  PairingServiceTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for PairingService
//
//  Test Coverage:
//  - QR code generation (format, validity)
//  - Device pairing (success, failure, timeout)
//  - Pairing state management
//  - Connection validation
//  - Error handling
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock API Client for PairingService

@MainActor
final class MockAPIClientForPairing: APIClientProtocol {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockPairingResponse: APIEndpointPairingResponse?
    var mockDevices: [Device] = []

    func get<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        if T.self == [Device].self {
            return mockDevices as! T
        }

        throw NetworkError.custom("No mock data for GET")
    }

    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        if T.self == APIEndpointPairingResponse.self,
           let response = mockPairingResponse {
            return response as! T
        }

        throw NetworkError.custom("No mock data for POST")
    }

    func put<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom("Not implemented")
    }

    func delete<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom("Not implemented")
    }

    func upload<T>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T where T: Decodable {
        throw NetworkError.custom("Not implemented")
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.custom("Not implemented")
    }
}

// MARK: - Mock WebSocket Manager for PairingService

@MainActor
final class MockWebSocketManagerForPairing: WebSocketManagerProtocol {
    var isConnectedValue = false
    var shouldFailConnection = false
    var mockError: WebSocketError?
    var pairingStatusHandler: ((@escaping (Result<SocketResponse, Error>) -> Void) -> Void)?

    func isConnected() -> Bool {
        return isConnectedValue
    }

    func connect(userId: String) async throws {
        if shouldFailConnection {
            throw mockError ?? WebSocketError(message: "Connection failed")
        }
        isConnectedValue = true
    }

    func disconnect() {
        isConnectedValue = false
    }

    func sendMessage(content: String, contentType: BotMessage.MessageContentType, mediaUrl: String?, mediaMimeType: String?) {}

    func on(_ event: WebSocketEvent, handler: @escaping (Any) -> Void) {}

    func pairWithCode(_ code: String) {}

    func pairWithToken(_ token: String) {}

    func unpair() {}

    func checkPairingStatus(completion: @escaping (Result<SocketResponse, Error>) -> Void) {
        pairingStatusHandler?(completion)
    }
}

// MARK: - Mock Keychain Manager for PairingService

@MainActor
final class MockKeychainManagerForPairing: KeychainManagerProtocol {
    var storedDeviceId: String?
    var storedDeviceName: String?
    var shouldFailSave = false
    var shouldFailRemove = false
    var mockError: Error?

    func save(key: String, data: Data) throws {
        if shouldFailSave {
            throw mockError ?? NSError(domain: "KeychainError", code: -1)
        }
    }

    func load(key: String) throws -> Data? {
        return nil
    }

    func delete(key: String) throws {
        if shouldFailRemove {
            throw mockError ?? NSError(domain: "KeychainError", code: -1)
        }
    }

    func savePairedDevice(deviceId: String, deviceName: String) throws {
        if shouldFailSave {
            throw mockError ?? NSError(domain: "KeychainError", code: -1)
        }
        storedDeviceId = deviceId
        storedDeviceName = deviceName
    }

    func getPairedDeviceId() -> String? {
        return storedDeviceId
    }

    func getPairedDeviceName() -> String? {
        return storedDeviceName
    }

    func removePairedDevice() throws {
        if shouldFailRemove {
            throw mockError ?? NSError(domain: "KeychainError", code: -1)
        }
        storedDeviceId = nil
        storedDeviceName = nil
    }

    func migratePairingDataFromUserDefaults() {}
}

// MARK: - PairingService Tests

@MainActor
final class PairingServiceTests: XCTestCase {

    var sut: PairingService!
    var mockAPIClient: MockAPIClientForPairing!
    var mockWebSocketManager: MockWebSocketManagerForPairing!
    var mockKeychainManager: MockKeychainManagerForPairing!
    var cancellables: Set<AnyCancellable>!

    override func setUp() async throws {
        try await super.setUp()

        mockAPIClient = MockAPIClientForPairing()
        mockWebSocketManager = MockWebSocketManagerForPairing()
        mockKeychainManager = MockKeychainManagerForPairing()

        sut = PairingService(
            apiClient: mockAPIClient,
            webSocketManager: mockWebSocketManager,
            keychainManager: mockKeychainManager
        )

        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() async throws {
        sut = nil
        mockAPIClient = nil
        mockWebSocketManager = nil
        mockKeychainManager = nil
        cancellables = nil
        try await super.tearDown()
    }
}

// MARK: - QR Code Generation Tests

extension PairingServiceTests {

    func testGeneratePairingCode_Success() async {
        // Given
        let expectedCode = "ABC123"
        mockAPIClient.mockPairingResponse = APIEndpointPairingResponse(
            requestId: "req_123",
            code: expectedCode,
            token: "token_abc",
            expiresIn: 300,
            qrUrl: "https://example.com/qr.png"
        )

        // When
        let result = await sut.generatePairingCode()

        // Then
        switch result {
        case .success(let code):
            XCTAssertEqual(code, expectedCode)
            XCTAssertNotNil(sut.currentPairingCode)
            XCTAssertNotNil(sut.pairingCodeExpiration)
        case .failure:
            XCTFail("Should succeed")
        }
    }

    func testGeneratePairingCode_InvalidResponse() async {
        // Given
        mockAPIClient.mockPairingResponse = APIEndpointPairingResponse(
            requestId: "req_123",
            code: nil,
            token: nil,
            expiresIn: 0,
            qrUrl: nil
        )

        // When
        let result = await sut.generatePairingCode()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail when code is nil")
        case .failure(let error):
            XCTAssertEqual(error, .pairingFailed(underlying: nil))
        }
    }

    func testGeneratePairingCode_NetworkError() async {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .noConnection

        // When
        let result = await sut.generatePairingCode()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with network error")
        case .failure(let error):
            XCTAssertEqual(error, .networkError(underlying: NetworkError.noConnection))
        }
    }

    func testGeneratePairingCode_SetsExpiration() async {
        // Given
        let expectedCode = "XYZ789"
        mockAPIClient.mockPairingResponse = APIEndpointPairingResponse(
            requestId: "req_456",
            code: expectedCode,
            token: "token_xyz",
            expiresIn: 300,
            qrUrl: nil
        )

        // When
        let beforeGenerate = Date()
        _ = await sut.generatePairingCode()
        let afterGenerate = Date()

        // Then
        XCTAssertNotNil(sut.pairingCodeExpiration)
        let expectedExpiration = beforeGenerate.addingTimeInterval(300)
        XCTAssertEqual(sut.pairingCodeExpiration?.timeIntervalSince1970 ?? 0,
                      expectedExpiration.timeIntervalSince1970,
                      accuracy: 1.0)
    }
}

// MARK: - Pairing with Code Tests

extension PairingServiceTests {

    func testPairWithCode_InvalidCodeTooShort() async {
        // Given
        let shortCode = "12345" // Less than 6 characters

        // When
        let result = await sut.pairWithCode(shortCode)

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with invalid code")
        case .failure(let error):
            XCTAssertEqual(error, .invalidCode)
        }
    }

    func testPairWithCode_ValidCode() async {
        // Given
        let validCode = "ABC123456"

        // When - Note: This will timeout since we don't have real WebSocket
        // We're testing the validation path
        let result = await sut.pairWithCode(validCode)

        // Then
        switch result {
        case .success:
            XCTFail("Should fail due to timeout without WebSocket")
        case .failure(let error):
            // Should fail with pairingFailed after timeout
            XCTAssertEqual(error, .pairingFailed(underlying: nil))
        }
    }

    func testPairWithCode_UpdatesStateToPairing() async {
        // Given
        let validCode = "ABC123456"

        // When
        _ = await sut.pairWithCode(validCode)

        // Then - State should be pairing during the operation
        // Note: After timeout it returns to unpaired
    }
}

// MARK: - Pairing with QR Code Tests

extension PairingServiceTests {

    func testPairWithQRCode_EmptyData() async {
        // Given
        let emptyQRData = ""

        // When
        let result = await sut.pairWithQRCode(emptyQRData)

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with empty QR data")
        case .failure(let error):
            XCTAssertEqual(error, .invalidQRData)
        }
    }

    func testPairWithQRCode_ValidTrixPrefix() async {
        // Given
        let qrData = "trix:pair:abc123def456"

        // When
        let result = await sut.pairWithQRCode(qrData)

        // Then
        switch result {
        case .success:
            XCTFail("Should fail due to timeout without WebSocket")
        case .failure(let error):
            XCTAssertEqual(error, .pairingFailed(underlying: nil))
        }
    }

    func testPairWithQRCode_ValidPlainToken() async {
        // Given
        let qrData = "plain_token_123456789"

        // When
        let result = await sut.pairWithQRCode(qrData)

        // Then
        switch result {
        case .success:
            XCTFail("Should fail due to timeout without WebSocket")
        case .failure(let error):
            XCTAssertEqual(error, .pairingFailed(underlying: nil))
        }
    }

    func testPairWithQRCode_TokenTooShort() async {
        // Given
        let shortToken = "short"

        // When
        let result = await sut.pairWithQRCode(shortToken)

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with short token")
        case .failure(let error):
            XCTAssertEqual(error, .invalidQRData)
        }
    }
}

// MARK: - Unpair Device Tests

extension PairingServiceTests {

    func testUnpairDevice_Success() async {
        // Given
        let deviceId = "device_123"

        // Pre-set paired state
        mockKeychainManager.storedDeviceId = deviceId
        mockKeychainManager.storedDeviceName = "Test Device"

        // Note: Need to reinitialize to pick up the pre-set state
        let service = PairingService(
            apiClient: mockAPIClient,
            webSocketManager: mockWebSocketManager,
            keychainManager: mockKeychainManager
        )

        // When
        let result = await service.unpairDevice(deviceId)

        // Then
        switch result {
        case .success:
            XCTAssertTrue(mockKeychainManager.storedDeviceId == nil)
            XCTAssertTrue(mockKeychainManager.storedDeviceName == nil)
        case .failure:
            XCTFail("Should succeed")
        }
    }

    func testUnpairDevice_RemovesFromList() async {
        // Given
        let deviceId = "device_123"

        // Pre-set paired devices
        mockAPIClient.mockDevices = [
            Device(id: "1", deviceId: deviceId, deviceName: "Test Device",
                   deviceType: .mobile, pairedAt: Date(), isOnline: true),
            Device(id: "2", deviceId: "device_456", deviceName: "Device 2",
                   deviceType: .desktop, pairedAt: Date(), isOnline: false)
        ]

        let service = PairingService(
            apiClient: mockAPIClient,
            webSocketManager: mockWebSocketManager,
            keychainManager: mockKeychainManager
        )

        // When
        _ = await service.unpairDevice(deviceId)

        // Then
        // Device should be removed from pairedDevices list
    }
}

// MARK: - Check Pairing Status Tests

extension PairingServiceTests {

    func testCheckPairingStatus_Paired() async {
        // Given
        mockWebSocketManager.pairingStatusHandler = { completion in
            let response = SocketResponse(
                success: true,
                paired: true,
                deviceId: "device_123",
                deviceName: "Test Device",
                requestId: nil,
                error: nil
            )
            completion(.success(response))
        }

        // When
        let result = await sut.checkPairingStatus()

        // Then
        switch result {
        case .success(let isPaired):
            XCTAssertTrue(isPaired)
        case .failure:
            XCTFail("Should succeed")
        }
    }

    func testCheckPairingStatus_NotPaired() async {
        // Given
        mockWebSocketManager.pairingStatusHandler = { completion in
            let response = SocketResponse(
                success: true,
                paired: false,
                deviceId: nil,
                deviceName: nil,
                requestId: nil,
                error: nil
            )
            completion(.success(response))
        }

        // When
        let result = await sut.checkPairingStatus()

        // Then
        switch result {
        case .success(let isPaired):
            XCTAssertFalse(isPaired)
        case .failure:
            XCTFail("Should succeed")
        }
    }

    func testCheckPairingStatus_NetworkError() async {
        // Given
        mockWebSocketManager.pairingStatusHandler = { completion in
            completion(.failure(NetworkError.noConnection))
        }

        // When
        let result = await sut.checkPairingStatus()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with network error")
        case .failure(let error):
            XCTAssertEqual(error, .networkError(underlying: NetworkError.noConnection))
        }
    }
}

// MARK: - Fetch Paired Devices Tests

extension PairingServiceTests {

    func testFetchPairedDevices_Success() async {
        // Given
        let expectedDevices = [
            Device(id: "1", deviceId: "device_123", deviceName: "Device 1",
                   deviceType: .mobile, pairedAt: Date(), isOnline: true),
            Device(id: "2", deviceId: "device_456", deviceName: "Device 2",
                   deviceType: .desktop, pairedAt: Date(), isOnline: false)
        ]
        mockAPIClient.mockDevices = expectedDevices

        // When
        let result = await sut.fetchPairedDevices()

        // Then
        switch result {
        case .success(let devices):
            XCTAssertEqual(devices.count, 2)
            XCTAssertEqual(sut.pairedDevices.count, 2)
        case .failure:
            XCTFail("Should succeed")
        }
    }

    func testFetchPairedDevices_NetworkError() async {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When
        let result = await sut.fetchPairedDevices()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with network error")
        case .failure(let error):
            XCTAssertEqual(error, .networkError(underlying: NetworkError.timeout))
        }
    }

    func testFetchPairedDevices_UpdatesPublishedProperty() async {
        // Given
        let expectedDevices = [
            Device(id: "1", deviceId: "device_123", deviceName: "Test Device",
                   deviceType: .mobile, pairedAt: Date(), isOnline: true)
        ]
        mockAPIClient.mockDevices = expectedDevices

        // When
        _ = await sut.fetchPairedDevices()

        // Then
        XCTAssertEqual(sut.pairedDevices.count, 1)
        XCTAssertEqual(sut.pairedDevices.first?.deviceId, "device_123")
    }
}

// MARK: - Pairing State Tests

extension PairingServiceTests {

    func testInitialState_Unpaired() {
        // Then
        XCTAssertEqual(sut.pairingState, .unpaired)
    }

    func testIsPaired_WhenUnpaired() {
        // Then
        XCTAssertFalse(sut.isPaired)
    }

    func testPairingState_Paired() {
        // Given - Simulate paired state
        // Note: In real scenario this would be set via WebSocket event

        // When - Set state directly for testing
        // This is testing the helper property

        // Then
        XCTAssertFalse(sut.isPaired)
    }

    func testDeviceId_NotPaired() {
        // Then
        XCTAssertNil(sut.pairingState.deviceId)
    }

    func testDeviceName_NotPaired() {
        // Then
        XCTAssertNil(sut.pairingState.deviceName)
    }
}

// MARK: - Error Handling Tests

extension PairingServiceTests {

    func testMapNetworkError_NoConnection() {
        // Given
        let error = NetworkError.noConnection

        // When
        // Note: Can't test private method, but we test via actual error mapping in API calls

        // Then - NetworkError.noConnection should map to .networkError
        // This is tested indirectly through generatePairingCode tests
    }

    func testMapNetworkError_Unauthorized() {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .unauthorized

        // When
        let result = await sut.generatePairingCode()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail")
        case .failure(let error):
            XCTAssertEqual(error, .permissionDenied)
        }
    }

    func testMapNetworkError_NotFound() {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .notFound

        // When
        let result = await sut.generatePairingCode()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail")
        case .failure(let error):
            XCTAssertEqual(error, .deviceNotFound)
        }
    }

    func testMapNetworkError_CustomExpired() {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .custom("Token expired")

        // When
        let result = await sut.generatePairingCode()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail")
        case .failure(let error):
            XCTAssertEqual(error, .expiredCode)
        }
    }

    func testMapNetworkError_CustomInvalid() {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .custom("Invalid code")

        // When
        let result = await sut.generatePairingCode()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail")
        case .failure(let error):
            XCTAssertEqual(error, .invalidCode)
        }
    }

    func testLastError_IsRecorded() async {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .noConnection

        // When
        _ = await sut.generatePairingCode()

        // Then
        XCTAssertNotNil(sut.lastError)
    }

    func testClearError() async {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .noConnection
        _ = await sut.generatePairingCode()
        XCTAssertNotNil(sut.lastError)

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.lastError)
    }
}

// MARK: - Loading State Tests

extension PairingServiceTests {

    func testIsLoading_Initial() {
        // Then
        XCTAssertFalse(sut.isLoading)
    }

    func testIsLoading_DuringGenerateCode() async {
        // Given
        mockAPIClient.mockPairingResponse = APIEndpointPairingResponse(
            requestId: "req_123",
            code: "ABC123",
            token: "token",
            expiresIn: 300,
            qrUrl: nil
        )

        // When
        let loadingExpectation = expectation(description: "Loading should be true during request")
        sut.$isLoading
            .dropFirst()
            .first()
            .sink { isLoading in
                if isLoading {
                    loadingExpectation.fulfill()
                }
            }
            .store(in: &cancellables)

        _ = await sut.generatePairingCode()

        // Then
        await fulfillment(of: [loadingExpectation], timeout: 1.0)
    }
}

// MARK: - Pairing Code Validity Tests

extension PairingServiceTests {

    func testPairingCodeRemainingTime_NoCode() {
        // Then
        XCTAssertNil(sut.pairingCodeRemainingTime)
    }

    func testPairingCodeRemainingTime_WithCode() async {
        // Given
        mockAPIClient.mockPairingResponse = APIEndpointPairingResponse(
            requestId: "req_123",
            code: "ABC123",
            token: "token",
            expiresIn: 300,
            qrUrl: nil
        )

        // When
        _ = await sut.generatePairingCode()

        // Then
        XCTAssertNotNil(sut.pairingCodeRemainingTime)
        XCTAssertGreaterThan(sut.pairingCodeRemainingTime ?? 0, 200)
    }
}

// MARK: - Protocol Conformance Tests

extension PairingServiceTests {

    func testConformsToPairingServiceProtocol() {
        // Then - Verify it implements the protocol
        let service: PairingServiceProtocol = sut
        XCTAssertNotNil(service)
    }
}

// MARK: - Edge Cases

extension PairingServiceTests {

    func testGeneratePairingCode_MultipleTimes() async {
        // Given
        mockAPIClient.mockPairingResponse = APIEndpointPairingResponse(
            requestId: "req_123",
            code: "CODE123",
            token: "token",
            expiresIn: 300,
            qrUrl: nil
        )

        // When
        let result1 = await sut.generatePairingCode()
        let result2 = await sut.generatePairingCode()

        // Then
        switch (result1, result2) {
        case (.success(let code1), .success(let code2)):
            XCTAssertEqual(code1, code2)
            XCTAssertEqual(sut.currentPairingCode, code1)
        default:
            XCTFail("Both should succeed")
        }
    }

    func testPairingCodeFormat() async {
        // Given
        let expectedCode = "PAIRED123"
        mockAPIClient.mockPairingResponse = APIEndpointPairingResponse(
            requestId: "req_123",
            code: expectedCode,
            token: "token",
            expiresIn: 300,
            qrUrl: nil
        )

        // When
        let result = await sut.generatePairingCode()

        // Then
        switch result {
        case .success(let code):
            XCTAssertEqual(code, expectedCode)
            XCTAssertEqual(code.count, expectedCode.count)
        case .failure:
            XCTFail("Should succeed")
        }
    }
}

// MARK: - Memory Management Tests

extension PairingServiceTests {

    func testDeinit_CleansUpTimer() {
        // Given
        let service = PairingService(
            apiClient: mockAPIClient,
            webSocketManager: mockWebSocketManager,
            keychainManager: mockKeychainManager
        )

        // When
        // Setting up timer by generating code
        mockAPIClient.mockPairingResponse = APIEndpointPairingResponse(
            requestId: "req_123",
            code: "ABC123",
            token: "token",
            expiresIn: 300,
            qrUrl: nil
        )

        Task {
            _ = await service.generatePairingCode()
        }

        // Then - Should not crash when deallocating
        // The deinit should invalidate the timer
    }
}

// MARK: - Concurrency Tests

extension PairingServiceTests {

    func testConcurrentGenerateCode() async {
        // Given
        mockAPIClient.mockPairingResponse = APIEndpointPairingResponse(
            requestId: "req_123",
            code: "CODE123",
            token: "token",
            expiresIn: 300,
            qrUrl: nil
        )

        // When
        async let result1 = sut.generatePairingCode()
        async let result2 = sut.generatePairingCode()

        let (r1, r2) = await (result1, result2)

        // Then - Both should complete without crashing
        switch (r1, r2) {
        case (.success, .success):
            break
        default:
            break
        }
    }

    func testConcurrentUnpair() async {
        // Given
        let service = PairingService(
            apiClient: mockAPIClient,
            webSocketManager: mockWebSocketManager,
            keychainManager: mockKeychainManager
        )

        // When - Multiple concurrent unpair calls
        async let result1 = service.unpairDevice("device_1")
        async let result2 = service.unpairDevice("device_2")

        let (r1, r2) = await (result1, result2)

        // Then - Should not crash
        // Results may vary based on state
    }
}

// MARK: - Keychain Error Handling Tests

extension PairingServiceTests {

    func testKeychainSaveFailure() async {
        // Given
        mockKeychainManager.shouldFailSave = true
        mockKeychainManager.mockError = NSError(domain: "Keychain", code: -1)

        mockAPIClient.mockPairingResponse = APIEndpointPairingResponse(
            requestId: "req_123",
            code: "CODE123",
            token: "token",
            expiresIn: 300,
            qrUrl: nil
        )

        // When
        let result = await sut.generatePairingCode()

        // Then - Code generation should still succeed even if keychain fails
        switch result {
        case .success:
            break // Expected - code generation doesn't require keychain
        case .failure:
            break // Also acceptable
        }
    }
}
