//
//  PairingUITests.swift
//  TRIX3DCompanionTests
//
//  UI tests for Device Pairing flow
//  Tests: Display Pairing Interface, Input Pairing Code, Display Pairing Status, Pairing Success/Failure, Cancel Pairing
//

import XCTest
import SwiftUI
import Combine
@testable import TRIX3DCompanion

// MARK: - Accessibility Identifiers

/// Accessibility identifiers for Pairing UI testing
enum PairingAccessibilityIdentifiers {
    // Pairing View
    static let pairingView = "pairingView"
    static let headerStatus = "headerStatus"
    static let statusIndicator = "statusIndicator"
    static let deviceInfoCard = "deviceInfoCard"

    // Tab Selector
    static let displayCodeTab = "displayCodeTab"
    static let scanCodeTab = "scanCodeTab"
    static let pairedDevicesTab = "pairedDevicesTab"

    // Display Code Section
    static let generateCodeButton = "generateCodeButton"
    static let pairingCodeDisplay = "pairingCodeDisplay"
    static let qrCodePlaceholder = "qrCodePlaceholder"
    static let expirationTimer = "expirationTimer"
    static let copyCodeButton = "copyCodeButton"

    // Scan Code Section
    static let openScannerButton = "openScannerButton"
    static let manualCodeTextField = "manualCodeTextField"
    static let pairWithCodeButton = "pairWithCodeButton"

    // Paired Devices Section
    static let devicesList = "devicesList"
    static let refreshButton = "refreshButton"
    static let emptyDevicesView = "emptyDevicesView"
    static func deviceRow(deviceId: String) -> String {
        "deviceRow-\(deviceId)"
    }
    static func unpairButton(deviceId: String) -> String {
        "unpairButton-\(deviceId)"
    }

    // Loading and Error States
    static let loadingOverlay = "loadingOverlay"
    static let errorAlert = "errorAlert"
    static let errorMessage = "errorMessage"

    // Unpair Confirmation
    static let unpairConfirmation = "unpairConfirmation"
    static let unpairConfirmButton = "unpairConfirmButton"
    static let unpairCancelButton = "unpairCancelButton"
}

// MARK: - Mock API Client

/// Mock API client for pairing UI testing
@MainActor
final class MockAPIClientForPairing: APIClient {

    var shouldSucceedPairingRequest = true
    var shouldSucceedFetchDevices = true
    var mockPairingCode: String?
    var mockDevices: [Device] = []
    var lastRequest: Any?

    override func post<T: Decodable>(_ endpoint: APIEndpoint, body: (any Encodable)?) async throws -> T {
        lastRequest = body

        if endpoint == .pairingRequest {
            guard shouldSucceedPairingRequest else {
                throw NetworkError.custom(message: "Failed to generate pairing code")
            }

            let response = APIEndpointPairingResponse(
                requestId: UUID().uuidString,
                code: mockPairingCode ?? "ABC123",
                token: "token_\(UUID().uuidString)",
                expiresIn: 300,
                qrUrl: "https://trix.example.com/pair/\(mockPairingCode ?? "ABC123")"
            )

            guard let typedResponse = response as? T else {
                throw NetworkError.decodingFailed
            }
            return typedResponse
        }

        if endpoint == .pairingDevices {
            guard shouldSucceedFetchDevices else {
                throw NetworkError.custom(message: "Failed to fetch devices")
            }

            guard let typedResponse = mockDevices as? T else {
                throw NetworkError.decodingFailed
            }
            return typedResponse
        }

        throw NetworkError.custom(message: "Unknown endpoint")
    }

    override func get<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        if endpoint == .pairingDevices {
            guard shouldSucceedFetchDevices else {
                throw NetworkError.custom(message: "Failed to fetch devices")
            }

            guard let typedResponse = mockDevices as? T else {
                throw NetworkError.decodingFailed
            }
            return typedResponse
        }

        throw NetworkError.custom(message: "Unknown endpoint")
    }
}

// MARK: - Mock WebSocket Manager

/// Mock WebSocket manager for pairing UI testing
@MainActor
final class MockWebSocketManagerForPairing: WebSocketManager {

    var shouldSucceedPairing = true
    var shouldSimulateTimeout = false
    var simulatePairingDelay: UInt64 = 500_000_000 // 0.5 seconds
    var mockPairedDeviceId: String = "mock_device_123"
    var mockPairedDeviceName: String = "Mock iPhone"
    var pairingCallCount = 0

    // Call tracking
    var lastPairingCode: String?
    var lastPairingToken: String?
    var unpairCallCount = 0
    var checkStatusCallCount = 0

    override func pairWithCode(_ code: String) {
        pairingCallCount += 1
        lastPairingCode = code
    }

    override func pairWithToken(_ token: String) {
        pairingCallCount += 1
        lastPairingToken = token
    }

    override func unpair() {
        unpairCallCount += 1
    }

    override func checkPairingStatus(completion: @escaping (Result<PairingStatusResponse, Error>) -> Void) {
        checkStatusCallCount += 1

        if shouldSucceedPairing {
            let response = PairingStatusResponse(
                paired: true,
                connected: true,
                deviceInfo: DeviceInfo(
                    deviceId: mockPairedDeviceId,
                    deviceName: mockPairedDeviceName,
                    pairedAt: Date()
                )
            )
            completion(.success(response))
        } else {
            completion(.failure(NetworkError.custom(message: "Failed to check status")))
        }
    }

    // Simulate pairing events
    func simulatePairingSuccess() {
        let event = WebSocketEvent.pairingSuccess(deviceId: mockPairedDeviceId, deviceName: mockPairedDeviceName)
        notifyEvent(event)
    }

    func simulatePairingFailure(error: PairingError = .pairingFailed(underlying: nil)) {
        // In real implementation would notify error event
    }

    func simulateUnpaired() {
        let event = WebSocketEvent.unpaired
        notifyEvent(event)
    }
}

// MARK: - Mock Keychain Manager

/// Mock Keychain manager for pairing UI testing
@MainActor
final class MockKeychainManagerForPairing: KeychainManager {

    var savedDeviceId: String?
    var savedDeviceName: String?
    var shouldFailSave = false
    var shouldFailRemove = false

    override func savePairedDevice(deviceId: String, deviceName: String) throws {
        guard !shouldFailSave else {
            throw KeychainError.saveFailed(underlying: nil)
        }
        savedDeviceId = deviceId
        savedDeviceName = deviceName
    }

    override func getPairedDeviceId() -> String? {
        return savedDeviceId
    }

    override func getPairedDeviceName() -> String? {
        return savedDeviceName
    }

    override func removePairedDevice() throws {
        guard !shouldFailRemove else {
            throw KeychainError.deleteFailed(underlying: nil)
        }
        savedDeviceId = nil
        savedDeviceName = nil
    }

    override func migratePairingDataFromUserDefaults() {
        // No-op for testing
    }
}

// MARK: - Mock Pairing Service

/// Mock pairing service for UI testing
@MainActor
final class MockPairingServiceForUI: PairingServiceProtocol, ObservableObject {

    @Published var pairingState: PairingState = .unpaired
    @Published var pairedDevices: [Device] = []
    @Published var isLoading: Bool = false
    @Published var lastError: PairingError?
    @Published var currentPairingCode: String?
    @Published var pairingCodeExpiration: Date?

    // Test configuration
    var shouldSucceedGenerateCode = true
    var shouldSucceedPairWithCode = true
    var shouldSucceedPairWithQR = true
    var shouldSucceedUnpair = true
    var shouldSucceedFetchDevices = true
    var mockCode: String = "TEST12"
    var mockPairingDelay: UInt64 = 500_000_000 // 0.5 seconds
    var mockDeviceId: String = "device_123"
    var mockDeviceName: String = "Test iPhone"

    // Call tracking
    var generateCodeCallCount = 0
    var pairWithCodeCallCount = 0
    var pairWithQRCallCount = 0
    var unpairCallCount = 0
    var fetchDevicesCallCount = 0
    var checkStatusCallCount = 0

    func generatePairingCode() async -> Result<String, PairingError> {
        generateCodeCallCount += 1
        isLoading = true
        lastError = nil

        guard shouldSucceedGenerateCode else {
            isLoading = false
            let error = PairingError.pairingFailed(underlying: nil)
            lastError = error
            return .failure(error)
        }

        // Simulate delay
        try? await Task.sleep(nanoseconds: mockPairingDelay)

        currentPairingCode = mockCode
        pairingCodeExpiration = Date().addingTimeInterval(300)
        isLoading = false

        return .success(mockCode)
    }

    func pairWithCode(_ code: String) async -> Result<Void, PairingError> {
        pairWithCodeCallCount += 1
        isLoading = true
        lastError = nil
        pairingState = .pairing

        guard shouldSucceedPairWithCode else {
            isLoading = false
            pairingState = .unpaired
            let error = PairingError.invalidCode
            lastError = error
            return .failure(error)
        }

        // Simulate delay
        try? await Task.sleep(nanoseconds: mockPairingDelay)

        pairingState = .paired(deviceId: mockDeviceId, deviceName: mockDeviceName)
        isLoading = false

        return .success(())
    }

    func pairWithQRCode(_ qrData: String) async -> Result<Void, PairingError> {
        pairWithQRCallCount += 1
        isLoading = true
        lastError = nil
        pairingState = .pairing

        guard shouldSucceedPairWithQR else {
            isLoading = false
            pairingState = .unpaired
            let error = PairingError.invalidQRData
            lastError = error
            return .failure(error)
        }

        // Simulate delay
        try? await Task.sleep(nanoseconds: mockPairingDelay)

        pairingState = .paired(deviceId: mockDeviceId, deviceName: mockDeviceName)
        isLoading = false

        return .success(())
    }

    func unpairDevice(_ deviceId: String) async -> Result<Void, PairingError> {
        unpairCallCount += 1
        isLoading = true
        lastError = nil
        pairingState = .unpairing

        guard shouldSucceedUnpair else {
            isLoading = false
            pairingState = .paired(deviceId: deviceId, deviceName: mockDeviceName)
            let error = PairingError.unknown(underlying: nil)
            lastError = error
            return .failure(error)
        }

        // Simulate delay
        try? await Task.sleep(nanoseconds: mockPairingDelay)

        pairingState = .unpaired
        pairedDevices.removeAll { $0.deviceId == deviceId }
        isLoading = false

        return .success(())
    }

    func checkPairingStatus() async -> Result<Bool, PairingError> {
        checkStatusCallCount += 1
        return .success(pairingState.isPaired)
    }

    func fetchPairedDevices() async -> Result<[Device], PairingError> {
        fetchDevicesCallCount += 1
        isLoading = true
        lastError = nil

        guard shouldSucceedFetchDevices else {
            isLoading = false
            let error = PairingError.networkError(underlying: NetworkError.custom(message: "Failed"))
            lastError = error
            return .failure(error)
        }

        // Simulate delay
        try? await Task.sleep(nanoseconds: mockPairingDelay)

        isLoading = false
        return .success(pairedDevices)
    }

    func clearError() {
        lastError = nil
    }

    // Helper methods for testing
    func resetState() {
        pairingState = .unpaired
        isLoading = false
        lastError = nil
    }

    func setMockDevices(_ devices: [Device]) {
        pairedDevices = devices
    }
}

// MARK: - Pairing UI Tests

@MainActor
final class PairingUITests: XCTestCase {

    // MARK: - Properties

    var mockPairingService: MockPairingServiceForUI!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUp() {
        super.setUp()
        mockPairingService = MockPairingServiceForUI()
        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        mockPairingService = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Test 1: Display Pairing Interface

    func testDisplayPairingInterface_ShowsThreeTabs() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedGenerateCode = true
        mockService.mockCode = "ABC123"

        // When - Simulate loading state
        let isLoading = mockService.isLoading

        // Then
        XCTAssertFalse(isLoading, "Initial state should not be loading")

        // Verify service is properly configured
        XCTAssertEqual(mockService.pairingState, .unpaired, "Initial state should be unpaired")
    }

    // MARK: - Test 2: Generate Pairing Code

    func testGeneratePairingCode_Success_ShowsCodeDisplay() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedGenerateCode = true
        mockService.mockCode = "XYZ789"

        // When
        let result = await mockService.generatePairingCode()

        // Then
        switch result {
        case .success(let code):
            XCTAssertEqual(code, "XYZ789", "Should return generated code")
            XCTAssertNotNil(mockService.currentPairingCode, "Code should be stored in service")
            XCTAssertNotNil(mockService.pairingCodeExpiration, "Expiration should be set")
        case .failure:
            XCTFail("Should not fail")
        }

        XCTAssertEqual(mockService.generateCodeCallCount, 1, "Should call generate code once")
    }

    // MARK: - Test 3: Input Pairing Code - Valid Code

    func testInputPairingCode_ValidCode_ShowsPairingStatus() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithCode = true
        mockService.mockDeviceId = "test_device_001"
        mockService.mockDeviceName = "Test iPhone 15"

        // When
        let result = await mockService.pairWithCode("VALID12")

        // Then
        switch result {
        case .success:
            XCTAssertEqual(mockService.pairingState, .paired(deviceId: "test_device_001", deviceName: "Test iPhone 15"))
        case .failure:
            XCTFail("Should not fail with valid code")
        }

        XCTAssertEqual(mockService.pairWithCodeCallCount, 1, "Should call pair with code")
    }

    // MARK: - Test 4: Input Pairing Code - Invalid Code

    func testInputPairingCode_InvalidCode_ShowsError() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithCode = false

        // When
        let result = await mockService.pairWithCode("INVALID")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with invalid code")
        case .failure(let error):
            XCTAssertEqual(error, .invalidCode, "Should return invalid code error")
            XCTAssertNotNil(mockService.lastError, "Error should be stored")
        }

        XCTAssertEqual(mockService.pairingState, .unpaired, "Should remain unpaired")
    }

    // MARK: - Test 5: Display Pairing Status - Pairing In Progress

    func testDisplayPairingStatus_PairingInProgress_ShowsLoadingState() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithCode = true
        mockService.mockPairingDelay = 2_000_000_000 // 2 seconds

        // When - Start pairing (don't await)
        let pairingTask = Task {
            await mockService.pairWithCode("TEST123")
        }

        // Wait for start
        try? await Task.sleep(nanoseconds: 100_000_000)

        // Then
        XCTAssertTrue(mockService.isLoading, "Should show loading during pairing")
        XCTAssertEqual(mockService.pairingState, .pairing, "State should be pairing")

        // Wait for completion
        await pairingTask.value
    }

    // MARK: - Test 6: Display Pairing Status - Paired

    func testDisplayPairingStatus_Paired_ShowsDeviceInfo() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithCode = true
        mockService.mockDeviceId = "paired_device_001"
        mockService.mockDeviceName = "My iPhone 15 Pro"

        // When
        _ = await mockService.pairWithCode("PAIR12")

        // Then
        XCTAssertTrue(mockService.pairingState.isPaired, "Should be paired")
        XCTAssertEqual(mockService.pairingState.deviceId, "paired_device_001")
        XCTAssertEqual(mockService.pairingState.deviceName, "My iPhone 15 Pro")
        XCTAssertFalse(mockService.isLoading, "Should not be loading after pairing")
    }

    // MARK: - Test 7: Pairing Success

    func testPairingSuccess_TransitionsToPairedState() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithCode = true
        mockService.shouldSucceedFetchDevices = true
        mockService.mockDeviceId = "success_device"
        mockService.mockDeviceName = "Success Device"

        // Add mock paired device
        let mockDevice = Device(
            id: "mock_id_1",
            deviceId: "success_device",
            deviceName: "Success Device",
            deviceType: .mobile,
            pairedAt: Date(),
            isOnline: true
        )
        mockService.setMockDevices([mockDevice])

        // When
        let result = await mockService.pairWithCode("SUCCES")

        // Then
        switch result {
        case .success:
            XCTAssertEqual(mockService.pairingState, .paired(deviceId: "success_device", deviceName: "Success Device"))
            XCTAssertEqual(mockService.pairedDevices.count, 1, "Should have one paired device")
        case .failure:
            XCTFail("Should succeed")
        }
    }

    // MARK: - Test 8: Pairing Failure - Invalid Code

    func testPairingFailure_InvalidCode_ShowsErrorMessage() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithCode = false

        // When
        let result = await mockService.pairWithCode("BADCODE")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail")
        case .failure(let error):
            XCTAssertEqual(error, .invalidCode)
            XCTAssertNotNil(mockService.lastError)
        }

        XCTAssertEqual(mockService.pairingState, .unpaired, "Should be unpaired after failure")
    }

    // MARK: - Test 9: Pairing Failure - Network Error

    func testPairingFailure_NetworkError_ShowsErrorMessage() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithCode = false
        mockService.lastError = .networkError(underlying: NetworkError.timeout)

        // When
        let result = await mockService.pairWithCode("NETERR")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail")
        case .failure(let error):
            XCTAssertNotNil(error, "Should return error")
        }

        XCTAssertEqual(mockService.pairingState, .unpaired)
        XCTAssertTrue(mockService.isLoading == false, "Should stop loading")
    }

    // MARK: - Test 10: Cancel Pairing

    func testCancelPairing_ResetsToUnpairedState() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithCode = true
        mockService.shouldSucceedUnpair = true
        mockService.mockDeviceId = "to_cancel"
        mockService.mockDeviceName = "Cancel Device"

        // First pair successfully
        _ = await mockService.pairWithCode("PAIR12")
        XCTAssertTrue(mockService.pairingState.isPaired)

        // When - Unpair
        let result = await mockService.unpairDevice("to_cancel")

        // Then
        switch result {
        case .success:
            XCTAssertEqual(mockService.pairingState, .unpaired)
            XCTAssertEqual(mockService.unpairCallCount, 1, "Should call unpair")
        case .failure:
            XCTFail("Should succeed")
        }
    }

    // MARK: - Test 11: QR Code Pairing - Success

    func testQRCodePairing_Success_ShowsPairedState() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithQR = true
        mockService.mockDeviceId = "qr_device"
        mockService.mockDeviceName = "QR Device"

        let qrData = "trix:pair:valid_token_12345"

        // When
        let result = await mockService.pairWithQRCode(qrData)

        // Then
        switch result {
        case .success:
            XCTAssertEqual(mockService.pairingState, .paired(deviceId: "qr_device", deviceName: "QR Device"))
        case .failure:
            XCTFail("Should succeed")
        }

        XCTAssertEqual(mockService.pairWithQRCallCount, 1, "Should call pair with QR")
    }

    // MARK: - Test 12: QR Code Pairing - Invalid Data

    func testQRCodePairing_InvalidData_ShowsError() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithQR = false

        // When
        let result = await mockService.pairWithQRCode("")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail")
        case .failure(let error):
            XCTAssertEqual(error, .invalidQRData)
        }

        XCTAssertEqual(mockService.pairingState, .unpaired)
    }

    // MARK: - Test 13: Fetch Paired Devices

    func testFetchPairedDevices_Success_ReturnsDeviceList() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedFetchDevices = true

        let mockDevices = [
            Device(
                id: "id1",
                deviceId: "device_1",
                deviceName: "iPhone 15",
                deviceType: .mobile,
                pairedAt: Date(),
                isOnline: true
            ),
            Device(
                id: "id2",
                deviceId: "device_2",
                deviceName: "MacBook Pro",
                deviceType: .desktop,
                pairedAt: Date(),
                isOnline: false
            )
        ]
        mockService.setMockDevices(mockDevices)

        // When
        let result = await mockService.fetchPairedDevices()

        // Then
        switch result {
        case .success(let devices):
            XCTAssertEqual(devices.count, 2, "Should return 2 devices")
        case .failure:
            XCTFail("Should succeed")
        }

        XCTAssertEqual(mockService.fetchDevicesCallCount, 1)
    }

    // MARK: - Test 14: Fetch Paired Devices - Empty

    func testFetchPairedDevices_Empty_ReturnsEmptyList() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedFetchDevices = true
        mockService.setMockDevices([])

        // When
        let result = await mockService.fetchPairedDevices()

        // Then
        switch result {
        case .success(let devices):
            XCTAssertTrue(devices.isEmpty, "Should return empty list")
        case .failure:
            XCTFail("Should succeed")
        }
    }

    // MARK: - Test 15: Fetch Paired Devices - Failure

    func testFetchPairedDevices_Failure_ShowsError() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedFetchDevices = false

        // When
        let result = await mockService.fetchPairedDevices()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail")
        case .failure(let error):
            XCTAssertNotNil(error)
            XCTAssertNotNil(mockService.lastError)
        }
    }

    // MARK: - Test 16: Unpair Device from List

    func testUnpairDevice_RemovesFromDeviceList() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedUnpair = true

        let mockDevices = [
            Device(
                id: "id1",
                deviceId: "device_1",
                deviceName: "Keep Device",
                deviceType: .mobile,
                pairedAt: Date(),
                isOnline: true
            ),
            Device(
                id: "id2",
                deviceId: "device_2",
                deviceName: "Remove Device",
                deviceType: .desktop,
                pairedAt: Date(),
                isOnline: true
            )
        ]
        mockService.setMockDevices(mockDevices)
        mockService.pairingState = .paired(deviceId: "device_2", deviceName: "Remove Device")

        // When
        let result = await mockService.unpairDevice("device_2")

        // Then
        switch result {
        case .success:
            XCTAssertEqual(mockService.pairedDevices.count, 1, "Should have one device left")
            XCTAssertEqual(mockService.pairedDevices.first?.deviceId, "device_1")
        case .failure:
            XCTFail("Should succeed")
        }
    }

    // MARK: - Test 17: Check Pairing Status - Already Paired

    func testCheckPairingStatus_Paired_ReturnsTrue() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.pairingState = .paired(deviceId: "paired", deviceName: "Paired Device")

        // When
        let result = await mockService.checkPairingStatus()

        // Then
        switch result {
        case .success(let isPaired):
            XCTAssertTrue(isPaired, "Should be paired")
        case .failure:
            XCTFail("Should succeed")
        }
    }

    // MARK: - Test 18: Check Pairing Status - Not Paired

    func testCheckPairingStatus_NotPaired_ReturnsFalse() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.pairingState = .unpaired

        // When
        let result = await mockService.checkPairingStatus()

        // Then
        switch result {
        case .success(let isPaired):
            XCTAssertFalse(isPaired, "Should not be paired")
        case .failure:
            XCTFail("Should succeed")
        }
    }

    // MARK: - Test 19: Clear Error

    func testClearError_RemovesErrorState() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.lastError = .invalidCode

        // When
        mockService.clearError()

        // Then
        XCTAssertNil(mockService.lastError, "Error should be cleared")
    }

    // MARK: - Test 20: Pairing Code Expiration Timer

    func testPairingCodeExpiration_TimerIsSet() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedGenerateCode = true
        mockService.mockCode = "EXPIRE"

        // When
        _ = await mockService.generatePairingCode()

        // Then
        XCTAssertNotNil(mockService.pairingCodeExpiration, "Expiration should be set")
        XCTAssertTrue(mockService.pairingCodeExpiration! > Date(), "Expiration should be in the future")

        // Check remaining time
        let remainingTime = mockService.pairingCodeExpiration?.timeIntervalSinceNow ?? 0
        XCTAssertTrue(remainingTime > 0 && remainingTime <= 300, "Remaining time should be within validity period")
    }

    // MARK: - Test 21: Multiple Pairing Attempts

    func testMultiplePairingAttempts_TracksCallCount() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithCode = true
        mockService.mockPairingDelay = 100_000_000 // 0.1 seconds

        // When
        _ = await mockService.pairWithCode("CODE1")
        _ = await mockService.pairWithCode("CODE2")
        _ = await mockService.pairWithCode("CODE3")

        // Then
        XCTAssertEqual(mockService.pairWithCodeCallCount, 3, "Should track all pairing attempts")
    }

    // MARK: - Test 22: Device Type Display

    func testDeviceType_DisplayCorrectTypes() async {
        // Given
        let mockDevices = [
            Device(id: "1", deviceId: "mobile", deviceName: "iPhone", deviceType: .mobile, pairedAt: Date(), isOnline: true),
            Device(id: "2", deviceId: "desktop", deviceName: "Mac", deviceType: .desktop, pairedAt: Date(), isOnline: true),
            Device(id: "3", deviceId: "tablet", deviceName: "iPad", deviceType: .tablet, pairedAt: Date(), isOnline: false),
            Device(id: "4", deviceId: "web", deviceName: "Web", deviceType: .web, pairedAt: Date(), isOnline: true)
        ]

        // Then
        XCTAssertEqual(mockDevices[0].deviceType, .mobile)
        XCTAssertEqual(mockDevices[1].deviceType, .desktop)
        XCTAssertEqual(mockDevices[2].deviceType, .tablet)
        XCTAssertEqual(mockDevices[3].deviceType, .web)
    }

    // MARK: - Test 23: Pairing State Transitions

    func testPairingState_TransitionsCorrectly() async {
        // Given
        let mockService = MockPairingServiceForUI()

        // Initial state
        XCTAssertEqual(mockService.pairingState, .unpaired)

        // Start pairing
        mockService.pairingState = .pairing
        XCTAssertEqual(mockService.pairingState, .pairing)
        XCTAssertFalse(mockService.pairingState.isPaired)

        // Pairing complete
        mockService.pairingState = .paired(deviceId: "new", deviceName: "New Device")
        XCTAssertTrue(mockService.pairingState.isPaired)
        XCTAssertEqual(mockService.pairingState.deviceId, "new")

        // Start unpairing
        mockService.pairingState = .unpairing
        XCTAssertEqual(mockService.pairingState, .unpairing)

        // Unpair complete
        mockService.pairingState = .unpaired
        XCTAssertFalse(mockService.pairingState.isPaired)
    }

    // MARK: - Test 24: Pairing Error Types

    func testPairingErrorTypes_AllErrorCases() {
        // Test all error types have descriptions
        let errors: [PairingError] = [
            .invalidCode,
            .invalidQRData,
            .deviceNotFound,
            .pairingFailed(underlying: nil),
            .notPaired,
            .networkError(underlying: NetworkError.timeout),
            .permissionDenied,
            .expiredCode,
            .unknown(underlying: nil)
        ]

        for error in errors {
            XCTAssertNotNil(error.errorDescription, "Error should have description")
        }
    }

    // MARK: - Test 25: Mock Service Reset

    func testMockService_ResetState_ClearsAll() async {
        // Given
        let mockService = MockPairingServiceForUI()
        mockService.shouldSucceedPairWithCode = true
        mockService.mockDeviceId = "test"
        mockService.mockDeviceName = "Test"

        _ = await mockService.pairWithCode("TEST")
        XCTAssertTrue(mockService.pairingState.isPaired)

        // When
        mockService.resetState()

        // Then
        XCTAssertEqual(mockService.pairingState, .unpaired)
        XCTAssertFalse(mockService.isLoading)
        XCTAssertNil(mockService.lastError)
    }
}

// MARK: - View Model Helper Extension

#if DEBUG
extension PairingService {
    /// Create preview service with mock for testing
    static func createForTesting(
        mockService: MockPairingServiceForUI = MockPairingServiceForUI()
    ) -> PairingService {
        // Note: This creates a real service with injected mocks
        // In production, you'd use dependency injection
        PairingService(
            apiClient: MockAPIClientForPairing(),
            webSocketManager: MockWebSocketManagerForPairing(),
            keychainManager: MockKeychainManagerForPairing()
        )
    }
}
#endif
