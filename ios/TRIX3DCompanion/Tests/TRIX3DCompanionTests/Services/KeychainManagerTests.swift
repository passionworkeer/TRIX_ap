//
//  KeychainManagerTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for KeychainManager
//
//  Test Coverage:
//  - Token storage (access token, refresh token)
//  - Session management
//  - Device pairing state
//  - Biometric settings
//  - Data size validation
//  - Jailbreak detection integration
//  - Thread safety
//  - Error handling
//  - Generic data operations
//

import XCTest
import KeychainAccess
@testable import TRIX3DCompanion

// MARK: - Mock Keychain Manager for Testing

/// Testable KeychainManager that allows injecting a mock keychain
final class MockKeychainManager {

    /// Mock keychain storage
    var storage: [String: String] = [:]

    /// Mock keychain for testing
    let mockKeychain: Keychain

    init() {
        // Create a mock keychain that uses in-memory storage
        mockKeychain = Keychain(service: "com.trix3d.test")
            .synchronizable(false)
            .accessibility(.whenUnlockedThisDeviceOnly)
    }

    func set(_ value: String, key: String) throws {
        storage[key] = value
    }

    func get(_ key: String) throws -> String? {
        return storage[key]
    }

    func remove(_ key: String) throws {
        storage.removeValue(forKey: key)
    }

    func removeAll() throws {
        storage.removeAll()
    }

    func getData(_ key: String) throws -> Data? {
        guard let string = storage[key] else { return nil }
        return string.data(using: .utf8)
    }

    func setData(_ data: Data, key: String) throws {
        guard let string = String(data: data, encoding: .utf8) else {
            throw KeychainError.dataTooLarge(maxSize: data.count, actualSize: data.count)
        }
        storage[key] = string
    }

    func allKeys() -> [String] {
        return Array(storage.keys)
    }
}

// MARK: - Keychain Manager Tests

final class KeychainManagerTests: XCTestCase {

    // MARK: - Properties

    private let legacyPairedKey = "clawbot_paired"
    private let legacyDeviceIdKey = "clawbot_device_id"

    var sut: KeychainManager!
    var testKeychain: MockKeychainManager!

    // MARK: - Setup & Teardown

    override func setUp() {
        super.setUp()
        // Use the shared instance for integration testing
        sut = KeychainManager.shared

        // Clear any existing test data
        #if DEBUG
        try? sut.clearAll()
        #endif
        clearLegacyPairingDefaults()
    }

    override func tearDown() {
        clearLegacyPairingDefaults()
        #if DEBUG
        try? sut.clearAll()
        #endif
        super.tearDown()
    }

    private func clearLegacyPairingDefaults() {
        UserDefaults.standard.removeObject(forKey: legacyPairedKey)
        UserDefaults.standard.removeObject(forKey: legacyDeviceIdKey)
    }
}

// MARK: - Access Token Tests

extension KeychainManagerTests {

    func testSaveAccessToken() throws {
        // Given
        let token = "test_access_token_12345"

        // When
        try sut.saveAccessToken(token)

        // Then
        let retrievedToken = sut.getAccessToken()
        XCTAssertEqual(retrievedToken, token, "Access token should be saved and retrieved correctly")
    }

    func testGetAccessTokenWhenNotSet() {
        // When
        let token = sut.getAccessToken()

        // Then
        XCTAssertNil(token, "Access token should be nil when not set")
    }

    func testDeleteAccessToken() throws {
        // Given
        try sut.saveAccessToken("test_token")

        // When
        try sut.deleteAccessToken()

        // Then
        let token = sut.getAccessToken()
        XCTAssertNil(token, "Access token should be nil after deletion")
    }

    func testOverwriteAccessToken() throws {
        // Given
        let oldToken = "old_token"
        let newToken = "new_token"

        // When
        try sut.saveAccessToken(oldToken)
        try sut.saveAccessToken(newToken)

        // Then
        let retrievedToken = sut.getAccessToken()
        XCTAssertEqual(retrievedToken, newToken, "Access token should be overwritten with new value")
    }
}

// MARK: - Refresh Token Tests

extension KeychainManagerTests {

    func testSaveRefreshToken() throws {
        // Given
        let token = "test_refresh_token_67890"

        // When
        try sut.saveRefreshToken(token)

        // Then
        let retrievedToken = sut.getRefreshToken()
        XCTAssertEqual(retrievedToken, token, "Refresh token should be saved and retrieved correctly")
    }

    func testGetRefreshTokenWhenNotSet() {
        // When
        let token = sut.getRefreshToken()

        // Then
        XCTAssertNil(token, "Refresh token should be nil when not set")
    }

    func testDeleteRefreshToken() throws {
        // Given
        try sut.saveRefreshToken("test_refresh_token")

        // When
        try sut.deleteRefreshToken()

        // Then
        let token = sut.getRefreshToken()
        XCTAssertNil(token, "Refresh token should be nil after deletion")
    }
}

// MARK: - Session Token Tests

extension KeychainManagerTests {

    func testSaveSessionToken() throws {
        // Given
        let token = "test_session_token_abcde"

        // When
        try sut.saveSessionToken(token)

        // Then
        let retrievedToken = sut.getSessionToken()
        XCTAssertEqual(retrievedToken, token, "Session token should be saved and retrieved correctly")
    }

    func testGetSessionTokenWhenNotSet() {
        // When
        let token = sut.getSessionToken()

        // Then
        XCTAssertNil(token, "Session token should be nil when not set")
    }

    func testDeleteSessionToken() throws {
        // Given
        try sut.saveSessionToken("test_session_token")

        // When
        try sut.deleteSessionToken()

        // Then
        let token = sut.getSessionToken()
        XCTAssertNil(token, "Session token should be nil after deletion")
    }
}

// MARK: - User ID Tests

extension KeychainManagerTests {

    func testSaveUserId() throws {
        // Given
        let userId = "test_user_id_123"

        // When
        try sut.saveUserId(userId)

        // Then
        let retrievedUserId = sut.getUserId()
        XCTAssertEqual(retrievedUserId, userId, "User ID should be saved and retrieved correctly")
    }

    func testGetUserIdWhenNotSet() {
        // When
        let userId = sut.getUserId()

        // Then
        XCTAssertNil(userId, "User ID should be nil when not set")
    }

    func testDeleteUserId() throws {
        // Given
        try sut.saveUserId("test_user_id")

        // When
        try sut.deleteUserId()

        // Then
        let userId = sut.getUserId()
        XCTAssertNil(userId, "User ID should be nil after deletion")
    }
}

// MARK: - Device ID Tests

extension KeychainManagerTests {

    func testSaveDeviceId() throws {
        // Given
        let deviceId = "test_device_id_456"

        // When
        try sut.saveDeviceId(deviceId)

        // Then
        let retrievedDeviceId = sut.getDeviceId()
        XCTAssertEqual(retrievedDeviceId, deviceId, "Device ID should be saved and retrieved correctly")
    }

    func testGetOrCreateDeviceIdWhenNotSet() {
        // When
        let deviceId = sut.getOrCreateDeviceId()

        // Then
        XCTAssertNotNil(deviceId, "Device ID should be created if not set")
        XCTAssertTrue(deviceId.hasPrefix("trix_"), "Device ID should have trix_ prefix")
    }

    func testGetOrCreateDeviceIdReturnsExisting() throws {
        // Given
        let existingDeviceId = "existing_device_id"
        try sut.saveDeviceId(existingDeviceId)

        // When
        let retrievedDeviceId = sut.getOrCreateDeviceId()

        // Then
        XCTAssertEqual(retrievedDeviceId, existingDeviceId, "Should return existing device ID")
    }

    func testDeviceIdFormat() {
        // When
        let deviceId = sut.getOrCreateDeviceId()

        // Then
        XCTAssertTrue(deviceId.count > 40, "Device ID should be at least 40 characters (trix_ + 32 hex chars)")
    }
}

// MARK: - Session Management Tests

extension KeychainManagerTests {

    func testSaveSession() throws {
        // Given
        let session = UserSession(
            id: "session_id",
            userId: "user_id",
            accessToken: "access_token",
            refreshToken: "refresh_token",
            expiresAt: Date().addingTimeInterval(3600)
        )

        // When
        try sut.saveSession(session)

        // Then
        XCTAssertEqual(sut.getAccessToken(), "access_token", "Access token should be saved")
        XCTAssertEqual(sut.getRefreshToken(), "refresh_token", "Refresh token should be saved")
        XCTAssertEqual(sut.getUserId(), "user_id", "User ID should be saved")
        let savedExpiration = try XCTUnwrap(sut.getTokenExpirationDate(), "Token expiration should be saved")
        XCTAssertEqual(savedExpiration.timeIntervalSince1970, session.expiresAt.timeIntervalSince1970, accuracy: 1.0)
    }

    func testClearSession() throws {
        // Given
        let session = UserSession(
            id: "session_id",
            userId: "user_id",
            accessToken: "access_token",
            refreshToken: "refresh_token",
            expiresAt: Date().addingTimeInterval(3600)
        )
        try sut.saveSession(session)

        // When
        try sut.clearSession()

        // Then
        XCTAssertNil(sut.getAccessToken(), "Access token should be cleared")
        XCTAssertNil(sut.getRefreshToken(), "Refresh token should be cleared")
        XCTAssertNil(sut.getUserId(), "User ID should be cleared")
        XCTAssertNil(sut.getTokenExpirationDate(), "Token expiration should be cleared")
    }

    func testHasValidSessionWhenAllTokensPresent() throws {
        // Given
        try sut.saveAccessToken("access_token")
        try sut.saveRefreshToken("refresh_token")
        try sut.saveUserId("user_id")

        // When
        let hasValidSession = sut.hasValidSession()

        // Then
        XCTAssertTrue(hasValidSession, "Should have valid session when all tokens are present")
    }

    func testHasValidSessionWhenAccessTokenMissing() throws {
        // Given
        try sut.saveRefreshToken("refresh_token")
        try sut.saveUserId("user_id")

        // When
        let hasValidSession = sut.hasValidSession()

        // Then
        XCTAssertFalse(hasValidSession, "Should not have valid session when access token is missing")
    }

    func testHasValidSessionWhenRefreshTokenMissing() throws {
        // Given
        try sut.saveAccessToken("access_token")
        try sut.saveUserId("user_id")

        // When
        let hasValidSession = sut.hasValidSession()

        // Then
        XCTAssertFalse(hasValidSession, "Should not have valid session when refresh token is missing")
    }

    func testHasValidSessionWhenUserIdMissing() throws {
        // Given
        try sut.saveAccessToken("access_token")
        try sut.saveRefreshToken("refresh_token")

        // When
        let hasValidSession = sut.hasValidSession()

        // Then
        XCTAssertFalse(hasValidSession, "Should not have valid session when user ID is missing")
    }

    func testHasValidSessionWhenNoTokens() {
        // When
        let hasValidSession = sut.hasValidSession()

        // Then
        XCTAssertFalse(hasValidSession, "Should not have valid session when no tokens are present")
    }
}

// MARK: - Pairing State Tests

extension KeychainManagerTests {

    func testSavePairedDevice() throws {
        // Given
        let deviceId = "paired_device_123"
        let deviceName = "Test iPhone"

        // When
        try sut.savePairedDevice(deviceId: deviceId, deviceName: deviceName)

        // Then
        XCTAssertEqual(sut.getPairedDeviceId(), deviceId, "Paired device ID should be saved")
        XCTAssertEqual(sut.getPairedDeviceName(), deviceName, "Paired device name should be saved")
        XCTAssertTrue(sut.isDevicePaired(), "Device should be paired")
    }

    func testGetPairedDeviceIdWhenNotPaired() {
        // When
        let deviceId = sut.getPairedDeviceId()

        // Then
        XCTAssertNil(deviceId, "Paired device ID should be nil when not paired")
    }

    func testGetPairedDeviceNameWhenNotPaired() {
        // When
        let deviceName = sut.getPairedDeviceName()

        // Then
        XCTAssertNil(deviceName, "Paired device name should be nil when not paired")
    }

    func testIsDevicePairedWhenNotPaired() {
        // When
        let isPaired = sut.isDevicePaired()

        // Then
        XCTAssertFalse(isPaired, "Device should not be paired initially")
    }

    func testIsDevicePairedWhenOnlyFlagSet() throws {
        // Given - set isPaired flag but no device info
        try sut.saveString("true", forKey: "com.trix3d.isPaired")

        // When
        let isPaired = sut.isDevicePaired()

        // Then
        XCTAssertFalse(isPaired, "Device should not be paired without device ID")
    }

    func testRemovePairedDevice() throws {
        // Given
        try sut.savePairedDevice(deviceId: "paired_device", deviceName: "Test Device")

        // When
        try sut.removePairedDevice()

        // Then
        XCTAssertNil(sut.getPairedDeviceId(), "Paired device ID should be nil after removal")
        XCTAssertNil(sut.getPairedDeviceName(), "Paired device name should be nil after removal")
        XCTAssertFalse(sut.isDevicePaired(), "Device should not be paired after removal")
    }

    func testMigratePairingDataFromUserDefaultsNoData() {
        // When - no data in UserDefaults
        let migrated = sut.migratePairingDataFromUserDefaults()

        // Then
        XCTAssertFalse(migrated, "Migration should return false when no data to migrate")
    }

    func testMigratePairingDataFromUserDefaultsWithData() throws {
        // Given - simulate old UserDefaults data
        UserDefaults.standard.set(true, forKey: legacyPairedKey)
        UserDefaults.standard.set("old_device_id", forKey: legacyDeviceIdKey)

        // Clear any existing pairing
        try? sut.removePairedDevice()

        defer {
            clearLegacyPairingDefaults()
            try? sut.removePairedDevice()
        }

        // When
        let migrated = sut.migratePairingDataFromUserDefaults()

        // Then
        XCTAssertTrue(migrated, "Migration should succeed when data exists")
        XCTAssertEqual(sut.getPairedDeviceId(), "old_device_id", "Device ID should be migrated")
    }

    func testMigratePairingDataSkipsWhenAlreadyPaired() throws {
        // Given - device already paired in keychain
        try sut.savePairedDevice(deviceId: "existing_paired", deviceName: "Existing Device")

        // And - old UserDefaults data exists
        UserDefaults.standard.set(true, forKey: legacyPairedKey)
        UserDefaults.standard.set("old_device_id", forKey: legacyDeviceIdKey)

        defer {
            clearLegacyPairingDefaults()
        }

        // When
        let migrated = sut.migratePairingDataFromUserDefaults()

        // Then
        XCTAssertFalse(migrated, "Migration should be skipped when already paired")
        XCTAssertEqual(sut.getPairedDeviceId(), "existing_paired", "Existing pairing should be preserved")
    }
}

// MARK: - Biometric Tests

extension KeychainManagerTests {

    func testSaveBiometricEnabledTrue() throws {
        // When
        try sut.saveBiometricEnabled(true)

        // Then
        XCTAssertTrue(sut.isBiometricEnabled(), "Biometric should be enabled")
    }

    func testSaveBiometricEnabledFalse() throws {
        // Given
        try sut.saveBiometricEnabled(true)

        // When
        try sut.saveBiometricEnabled(false)

        // Then
        XCTAssertFalse(sut.isBiometricEnabled(), "Biometric should be disabled")
    }

    func testIsBiometricEnabledDefault() {
        // When
        let enabled = sut.isBiometricEnabled()

        // Then
        XCTAssertFalse(enabled, "Biometric should be disabled by default")
    }
}

// MARK: - Data Size Validation Tests

extension KeychainManagerTests {

    func testSaveStringWithinSizeLimit() throws {
        // Given
        let smallString = String(repeating: "a", count: 1000)

        // When
        try sut.saveString(smallString, forKey: "test_small_string")

        // Then
        XCTAssertEqual(sut.getString(forKey: "test_small_string"), smallString)
    }

    func testSaveDataWithinSizeLimit() throws {
        // Given
        let smallData = Data(repeating: 0, count: 1000)

        // When
        try sut.saveData(smallData, forKey: "test_small_data")

        // Then
        let retrieved = sut.getData(forKey: "test_small_data")
        XCTAssertEqual(retrieved, smallData)
    }

    func testSaveStringExceedingSizeLimit() throws {
        // Given - create string that exceeds 100KB limit
        let largeString = String(repeating: "a", count: 101 * 1024)

        // When/Then
        do {
            try sut.saveString(largeString, forKey: "test_large_string")
            XCTFail("Should throw error for data too large")
        } catch let error as KeychainError {
            if case .dataTooLarge(let maxSize, let actualSize) = error {
                XCTAssertEqual(maxSize, 100 * 1024, "Max size should be 100KB")
                XCTAssertEqual(actualSize, largeString.utf8.count, "Actual size should match")
            } else {
                XCTFail("Wrong error type")
            }
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func testSaveDataExceedingSizeLimit() throws {
        // Given - create data that exceeds 100KB limit
        let largeData = Data(repeating: 0, count: 101 * 1024)

        // When/Then
        do {
            try sut.saveData(largeData, forKey: "test_large_data")
            XCTFail("Should throw error for data too large")
        } catch let error as KeychainError {
            if case .dataTooLarge(let maxSize, let actualSize) = error {
                XCTAssertEqual(maxSize, 100 * 1024, "Max size should be 100KB")
                XCTAssertEqual(actualSize, largeData.count, "Actual size should match")
            } else {
                XCTFail("Wrong error type")
            }
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func testTokenWithinSizeLimit() throws {
        // Given - typical JWT token
        let jwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

        // When
        try sut.saveAccessToken(jwtToken)

        // Then
        XCTAssertEqual(sut.getAccessToken(), jwtToken, "JWT token should be saved successfully")
    }
}

// MARK: - Generic Data Operations Tests

extension KeychainManagerTests {

    func testSaveAndRetrieveString() throws {
        // Given
        let key = "custom_key"
        let value = "custom_value"

        // When
        try sut.saveString(value, forKey: key)

        // Then
        XCTAssertEqual(sut.getString(forKey: key), value)
    }

    func testSaveAndRetrieveData() throws {
        // Given
        let key = "custom_data_key"
        let value = "Hello, World!".data(using: .utf8)!

        // When
        try sut.saveData(value, forKey: key)

        // Then
        XCTAssertEqual(sut.getData(forKey: key), value)
    }

    func testGetStringWhenNotSet() {
        // When
        let value = sut.getString(forKey: "nonexistent_key")

        // Then
        XCTAssertNil(value, "Should return nil for nonexistent key")
    }

    func testGetDataWhenNotSet() {
        // When
        let value = sut.getData(forKey: "nonexistent_key")

        // Then
        XCTAssertNil(value, "Should return nil for nonexistent key")
    }

    func testRemoveForKey() throws {
        // Given
        try sut.saveString("value", forKey: "key_to_remove")

        // When
        try sut.remove(forKey: "key_to_remove")

        // Then
        XCTAssertNil(sut.getString(forKey: "key_to_remove"))
    }

    func testOverwriteExistingKey() throws {
        // Given
        let key = "overwrite_key"
        try sut.saveString("first_value", forKey: key)

        // When
        try sut.saveString("second_value", forKey: key)

        // Then
        XCTAssertEqual(sut.getString(forKey: key), "second_value")
    }
}

// MARK: - Thread Safety Tests

extension KeychainManagerTests {

    func testConcurrentWritesAreThreadSafe() throws {
        // Given
        let expectation = XCTestExpectation(description: "Concurrent writes complete")
        expectation.expectedFulfillmentCount = 10

        // When - perform concurrent writes
        let queue = DispatchQueue(label: "com.trix3d.test.concurrent", attributes: .concurrent)

        for i in 0..<10 {
            queue.async { [weak self] in
                do {
                    try self?.sut.saveString("value_\(i)", forKey: "concurrent_key_\(i)")
                } catch {
                    XCTFail("Concurrent write failed: \(error)")
                }
                expectation.fulfill()
            }
        }

        // Then - wait for all writes to complete
        wait(for: [expectation], timeout: 5.0)

        // Verify all values were saved
        for i in 0..<10 {
            let value = sut.getString(forKey: "concurrent_key_\(i)")
            XCTAssertEqual(value, "value_\(i)", "Concurrent write \(i) should succeed")
        }
    }

    func testConcurrentWritesToSameKey() throws {
        // Given
        let expectation = XCTestExpectation(description: "Concurrent writes to same key complete")
        expectation.expectedFulfillmentCount = 50

        let queue = DispatchQueue(label: "com.trix3d.test.samekey", attributes: .concurrent)

        // When - perform many concurrent writes to the same key
        for i in 0..<50 {
            queue.async { [weak self] in
                do {
                    try self?.sut.saveString("value_\(i)", forKey: "same_key")
                } catch {
                    // Ignore errors from concurrent access - lock should handle it
                }
                expectation.fulfill()
            }
        }

        // Then
        wait(for: [expectation], timeout: 10.0)

        // The final value should be one of the written values
        let finalValue = sut.getString(forKey: "same_key")
        XCTAssertTrue(finalValue?.hasPrefix("value_") ?? false, "Should have a valid final value")
    }

    func testMixedReadWriteOperations() throws {
        // Given
        try sut.saveString("initial", forKey: "mixed_key")

        let expectation = XCTestExpectation(description: "Mixed operations complete")
        expectation.expectedFulfillmentCount = 20

        let queue = DispatchQueue(label: "com.trix3d.test.mixed", attributes: .concurrent)

        // When - mix of reads and writes
        for i in 0..<20 {
            queue.async { [weak self] in
                if i % 2 == 0 {
                    // Write
                    try? self?.sut.saveString("value_\(i)", forKey: "mixed_key")
                } else {
                    // Read
                    _ = self?.sut.getString(forKey: "mixed_key")
                }
                expectation.fulfill()
            }
        }

        // Then
        wait(for: [expectation], timeout: 5.0)

        // Verify final value
        XCTAssertNotNil(sut.getString(forKey: "mixed_key"))
    }
}

// MARK: - Error Handling Tests

extension KeychainManagerTests {

    func testKeychainErrorDataTooLarge() {
        // Given
        let error = KeychainError.dataTooLarge(maxSize: 100, actualSize: 200)

        // Then
        XCTAssertEqual(error.errorDescription, "Data too large: 200 bytes exceeds maximum of 100 bytes")
    }

    func testKeychainErrorJailbreakDetected() {
        // Given
        let error = KeychainError.jailbreakDetected

        // Then
        XCTAssertEqual(error.errorDescription, "Device is jailbroken - security cannot be guaranteed")
    }

    func testKeychainErrorSecurityValidationFailed() {
        // Given
        let error = KeychainError.securityValidationFailed

        // Then
        XCTAssertEqual(error.errorDescription, "Keychain security validation failed")
    }

    func testKeychainErrorConcurrentWriteConflict() {
        // Given
        let error = KeychainError.concurrentWriteConflict

        // Then
        XCTAssertEqual(error.errorDescription, "Concurrent write operation detected")
    }
}

// MARK: - Debug Helper Tests

#if DEBUG
extension KeychainManagerTests {

    func testClearAllRemovesAllData() throws {
        // Given
        try sut.saveAccessToken("token")
        try sut.saveRefreshToken("refresh")
        try sut.saveUserId("user")
        try sut.saveDeviceId("device")

        // When
        try sut.clearAll()

        // Then
        XCTAssertNil(sut.getAccessToken())
        XCTAssertNil(sut.getRefreshToken())
        XCTAssertNil(sut.getUserId())
        XCTAssertNil(sut.getDeviceId())
    }

    func testPrintAllKeysDoesNotCrash() {
        // Given
        try? sut.saveString("value", forKey: "test_key_1")
        try? sut.saveString("value", forKey: "test_key_2")

        // When/Then - should not crash
        sut.printAllKeys()
    }
}
#endif

// MARK: - Integration Tests

extension KeychainManagerTests {

    func testFullLoginFlow() throws {
        // Simulate full login flow

        // 1. Save session
        let session = UserSession(
            id: "session_123",
            userId: "user_456",
            accessToken: "access_token_def",
            refreshToken: "refresh_token_ghi",
            expiresAt: Date().addingTimeInterval(3600)
        )
        try sut.saveSession(session)

        // 2. Enable biometric
        try sut.saveBiometricEnabled(true)

        // 3. Save device pairing
        try sut.savePairedDevice(deviceId: "paired_device_789", deviceName: "My iPhone")

        // Then - verify all data
        XCTAssertTrue(sut.hasValidSession())
        XCTAssertTrue(sut.isBiometricEnabled())
        XCTAssertTrue(sut.isDevicePaired())
    }

    func testFullLogoutFlow() throws {
        // Given - simulate logged in state
        try sut.saveSession(UserSession(
            id: "session_123",
            userId: "user_456",
            accessToken: "access_token",
            refreshToken: "refresh_token",
            expiresAt: Date()
        ))
        try sut.saveBiometricEnabled(true)
        try sut.savePairedDevice(deviceId: "device", deviceName: "iPhone")

        // When - logout
        try sut.clearSession()

        // Then - verify all cleared
        XCTAssertFalse(sut.hasValidSession())
        XCTAssertFalse(sut.isBiometricEnabled())
        // Note: Pairing is not cleared on logout - user may want to re-pair on next login
    }

    func testTokenRefreshFlow() throws {
        // Given - initial tokens
        try sut.saveUserId("user_456")
        try sut.saveAccessToken("old_access_token")
        try sut.saveRefreshToken("old_refresh_token")

        // When - tokens are refreshed
        try sut.saveAccessToken("new_access_token")
        try sut.saveRefreshToken("new_refresh_token")

        // Then
        XCTAssertEqual(sut.getAccessToken(), "new_access_token")
        XCTAssertEqual(sut.getRefreshToken(), "new_refresh_token")
        XCTAssertTrue(sut.hasValidSession())
    }
}

// MARK: - Edge Cases Tests

extension KeychainManagerTests {

    func testEmptyStringValue() throws {
        // Given
        let emptyString = ""

        // When
        try sut.saveString(emptyString, forKey: "empty_key")

        // Then
        XCTAssertEqual(sut.getString(forKey: "empty_key"), emptyString)
    }

    func testUnicodeStringValue() throws {
        // Given
        let unicodeString = "Hello 世界 🌍 你好"

        // When
        try sut.saveString(unicodeString, forKey: "unicode_key")

        // Then
        XCTAssertEqual(sut.getString(forKey: "unicode_key"), unicodeString)
    }

    func testSpecialCharactersInToken() throws {
        // Given - token with special characters
        let specialToken = "token_with_=special+characters/"

        // When
        try sut.saveAccessToken(specialToken)

        // Then
        XCTAssertEqual(sut.getAccessToken(), specialToken)
    }

    func testVeryLongUserId() throws {
        // Given - long user ID
        let longUserId = String(repeating: "user_id_", count: 100)

        // When
        try sut.saveUserId(longUserId)

        // Then
        XCTAssertEqual(sut.getUserId(), longUserId)
    }

    func testMultipleSessionsOverwrite() throws {
        // Given - first session
        try sut.saveSession(UserSession(
            id: "session_1",
            userId: "user_1",
            accessToken: "access_1",
            refreshToken: "refresh_1",
            expiresAt: Date()
        ))

        // When - second session overwrites
        try sut.saveSession(UserSession(
            id: "session_2",
            userId: "user_2",
            accessToken: "access_2",
            refreshToken: "refresh_2",
            expiresAt: Date()
        ))

        // Then - should have second session data
        XCTAssertEqual(sut.getAccessToken(), "access_2")
        XCTAssertEqual(sut.getRefreshToken(), "refresh_2")
        XCTAssertEqual(sut.getUserId(), "user_2")
    }
}
