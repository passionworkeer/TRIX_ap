//
//  KeychainManagerTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for KeychainManager - 密钥链管理测试
//

import XCTest
@testable import TRIX3DCompanion

/// KeychainManager 测试
/// 覆盖 Token 存储、用户数据、设备 ID、会话管理等功能
final class KeychainManagerTests: XCTestCase {

    // MARK: - Properties

    var sut: KeychainManager!
    let testTokenPrefix = "test_"

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        sut = KeychainManager.shared

        // 清理测试数据
        try? sut.clearAll()

        // 添加标识前缀以避免冲突
        // 注意：实际 Keychain 在应用间是隔离的，测试中使用 shared 实例
    }

    override func tearDownWithError() throws {
        // 清理测试数据
        try? sut.clearAll()
        sut = nil
    }

    // MARK: - Access Token Tests

    /// 测试保存和获取 Access Token
    func testSaveAndGetAccessToken() throws {
        // Given
        let accessToken = "\(testTokenPrefix)access_token_12345"

        // When
        try sut.saveAccessToken(accessToken)
        let retrievedToken = sut.getAccessToken()

        // Then
        XCTAssertEqual(retrievedToken, accessToken)
        XCTAssertNotNil(retrievedToken)
    }

    /// 测试删除 Access Token
    func testDeleteAccessToken() throws {
        // Given
        let accessToken = "\(testTokenPrefix)access_token_12345"
        try sut.saveAccessToken(accessToken)
        XCTAssertNotNil(sut.getAccessToken())

        // When
        try sut.deleteAccessToken()
        let retrievedToken = sut.getAccessToken()

        // Then
        XCTAssertNil(retrievedToken)
    }

    /// 测试获取不存在的 Access Token 返回 nil
    func testGetNonExistentAccessToken() {
        // Given - 确保 Keychain 中没有 token
        try? sut.deleteAccessToken()

        // When
        let token = sut.getAccessToken()

        // Then
        XCTAssertNil(token)
    }

    // MARK: - Refresh Token Tests

    /// 测试保存和获取 Refresh Token
    func testSaveAndGetRefreshToken() throws {
        // Given
        let refreshToken = "\(testTokenPrefix)refresh_token_67890"

        // When
        try sut.saveRefreshToken(refreshToken)
        let retrievedToken = sut.getRefreshToken()

        // Then
        XCTAssertEqual(retrievedToken, refreshToken)
        XCTAssertNotNil(retrievedToken)
    }

    /// 测试删除 Refresh Token
    func testDeleteRefreshToken() throws {
        // Given
        let refreshToken = "\(testTokenPrefix)refresh_token_67890"
        try sut.saveRefreshToken(refreshToken)

        // When
        try sut.deleteRefreshToken()
        let retrievedToken = sut.getRefreshToken()

        // Then
        XCTAssertNil(retrievedToken)
    }

    // MARK: - Session Token Tests

    /// 测试保存和获取 Session Token
    func testSaveAndGetSessionToken() throws {
        // Given
        let sessionToken = "\(testTokenPrefix)session_token_abcde"

        // When
        try sut.saveSessionToken(sessionToken)
        let retrievedToken = sut.getSessionToken()

        // Then
        XCTAssertEqual(retrievedToken, sessionToken)
    }

    /// 测试删除 Session Token
    func testDeleteSessionToken() throws {
        // Given
        let sessionToken = "\(testTokenPrefix)session_token_abcde"
        try sut.saveSessionToken(sessionToken)

        // When
        try sut.deleteSessionToken()
        let retrievedToken = sut.getSessionToken()

        // Then
        XCTAssertNil(retrievedToken)
    }

    // MARK: - User ID Tests

    /// 测试保存和获取用户 ID
    func testSaveAndGetUserId() throws {
        // Given
        let userId = "\(testTokenPrefix)user_12345"

        // When
        try sut.saveUserId(userId)
        let retrievedId = sut.getUserId()

        // Then
        XCTAssertEqual(retrievedId, userId)
    }

    /// 测试删除用户 ID
    func testDeleteUserId() throws {
        // Given
        let userId = "\(testTokenPrefix)user_12345"
        try sut.saveUserId(userId)

        // When
        try sut.deleteUserId()
        let retrievedId = sut.getUserId()

        // Then
        XCTAssertNil(retrievedId)
    }

    // MARK: - Device ID Tests

    /// 测试保存和获取设备 ID
    func testSaveAndGetDeviceId() throws {
        // Given
        let deviceId = "\(testTokenPrefix)device_xyz123"

        // When
        try sut.saveDeviceId(deviceId)
        let retrievedId = sut.getDeviceId()

        // Then
        XCTAssertEqual(retrievedId, deviceId)
    }

    /// 测试获取或创建设备 ID
    func testGetOrCreateDeviceId() {
        // Given - 第一次调用
        // When
        let deviceId1 = sut.getOrCreateDeviceId()

        // Then
        XCTAssertNotNil(deviceId1)
        XCTAssertTrue(UUID(uuidString: deviceId1) != nil, "Should be valid UUID")

        // Given - 第二次调用应该返回相同的 ID
        let deviceId2 = sut.getOrCreateDeviceId()

        // Then
        XCTAssertEqual(deviceId1, deviceId2)
    }

    // MARK: - Biometric Settings Tests

    /// 测试保存和获取生物识别启用状态
    func testBiometricEnabled() throws {
        // Given
        try sut.saveBiometricEnabled(true)

        // When
        let isEnabled = sut.isBiometricEnabled()

        // Then
        XCTAssertTrue(isEnabled)

        // When - 设置为 false
        try sut.saveBiometricEnabled(false)
        let isDisabled = !sut.isBiometricEnabled()

        // Then
        XCTAssertTrue(isDisabled)
    }

    // MARK: - Session Management Tests

    /// 测试保存完整会话
    func testSaveSession() throws {
        // Given
        let session = UserSession(
            accessToken: "\(testTokenPrefix)access",
            refreshToken: "\(testTokenPrefix)refresh",
            sessionToken: "\(testTokenPrefix)session",
            userId: "\(testTokenPrefix)user123",
            expiresAt: Date().addingTimeInterval(3600)
        )

        // When
        try sut.saveSession(session)

        // Then
        XCTAssertEqual(sut.getAccessToken(), session.accessToken)
        XCTAssertEqual(sut.getRefreshToken(), session.refreshToken)
        XCTAssertEqual(sut.getSessionToken(), session.sessionToken)
        XCTAssertEqual(sut.getUserId(), session.userId)
    }

    /// 测试检查有效会话
    func testHasValidSession() throws {
        // Given - 无会话
        try? sut.clearSession()

        // When
        let hasSession = sut.hasValidSession()

        // Then
        XCTAssertFalse(hasSession)

        // Given - 创建完整会话
        let session = UserSession(
            accessToken: "\(testTokenPrefix)access",
            refreshToken: "\(testTokenPrefix)refresh",
            sessionToken: "\(testTokenPrefix)session",
            userId: "\(testTokenPrefix)user123",
            expiresAt: Date().addingTimeInterval(3600)
        )
        try sut.saveSession(session)

        // When
        let hasValidSession = sut.hasValidSession()

        // Then
        XCTAssertTrue(hasValidSession)
    }

    /// 测试清除会话
    func testClearSession() throws {
        // Given - 创建完整会话
        let session = UserSession(
            accessToken: "\(testTokenPrefix)access",
            refreshToken: "\(testTokenPrefix)refresh",
            sessionToken: "\(testTokenPrefix)session",
            userId: "\(testTokenPrefix)user123",
            expiresAt: Date().addingTimeInterval(3600)
        )
        try sut.saveSession(session)
        XCTAssertTrue(sut.hasValidSession())

        // When
        try sut.clearSession()

        // Then
        XCTAssertFalse(sut.hasValidSession())
        XCTAssertNil(sut.getAccessToken())
        XCTAssertNil(sut.getRefreshToken())
        XCTAssertNil(sut.getSessionToken())
        XCTAssertNil(sut.getUserId())
    }

    // MARK: - Generic Data Storage Tests

    /// 测试保存和获取字符串数据
    func testSaveAndGetString() throws {
        // Given
        let key = "\(testTokenPrefix)test_key"
        let value = "\(testTokenPrefix)test_value"

        // When
        try sut.saveString(value, forKey: key)
        let retrievedValue = sut.getString(forKey: key)

        // Then
        XCTAssertEqual(retrievedValue, value)
    }

    /// 测试保存和获取二进制数据
    func testSaveAndGetData() throws {
        // Given
        let key = "\(testTokenPrefix)test_data_key"
        let data = "test data".data(using: .utf8)!

        // When
        try sut.saveData(data, forKey: key)
        let retrievedData = sut.getData(forKey: key)

        // Then
        XCTAssertEqual(retrievedData, data)
    }

    /// 测试删除指定键的数据
    func testRemoveForKey() throws {
        // Given
        let key = "\(testTokenPrefix)test_remove_key"
        try sut.saveString("value", forKey: key)
        XCTAssertNotNil(sut.getString(forKey: key))

        // When
        try sut.remove(forKey: key)
        let value = sut.getString(forKey: key)

        // Then
        XCTAssertNil(value)
    }

    // MARK: - Edge Cases Tests

    /// 测试空字符串处理
    func testEmptyStringHandling() throws {
        // Given
        let emptyToken = ""

        // When
        try sut.saveAccessToken(emptyToken)
        let retrievedToken = sut.getAccessToken()

        // Then - 空字符串应该被保存
        XCTAssertEqual(retrievedToken, "")
    }

    /// 测试特殊字符处理
    func testSpecialCharactersHandling() throws {
        // Given
        let specialToken = "test@#$%^&*()_+-=[]{}|;':\",./<>?`~"

        // When
        try sut.saveAccessToken(specialToken)
        let retrievedToken = sut.getAccessToken()

        // Then
        XCTAssertEqual(retrievedToken, specialToken)
    }

    /// 测试长字符串处理
    func testLongStringHandling() throws {
        // Given - 模拟很长的 JWT token
        let longToken = String(repeating: "a", count: 2048)

        // When
        try sut.saveAccessToken(longToken)
        let retrievedToken = sut.getAccessToken()

        // Then
        XCTAssertEqual(retrievedToken, longToken)
    }

    /// 测试覆盖已有数据
    func testOverwriteExistingData() throws {
        // Given
        let token1 = "\(testTokenPrefix)token_v1"
        let token2 = "\(testTokenPrefix)token_v2"

        try sut.saveAccessToken(token1)
        XCTAssertEqual(sut.getAccessToken(), token1)

        // When
        try sut.saveAccessToken(token2)

        // Then
        XCTAssertEqual(sut.getAccessToken(), token2)
    }

    // MARK: - Error Handling Tests

    /// 测试删除不存在的键不抛出错误
    func testDeleteNonExistentKey() {
        // Given - 确保 key 不存在
        let key = "\(testTokenPrefix)non_existent_key"
        try? sut.remove(forKey: key)

        // When/Then - 不应该抛出错误
        XCTAssertNoThrow(try sut.remove(forKey: key))
    }

    // MARK: - Performance Tests

    /// 测试连续读写性能
    func testPerformanceReadWrite() throws {
        measure {
            for i in 0..<100 {
                let token = "\(testTokenPrefix)perf_test_\(i)"
                try? sut.saveAccessToken(token)
                _ = sut.getAccessToken()
            }
        }
    }
}
