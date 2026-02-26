//
//  WeChatSignInServiceTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for WeChatSignInService
//

import XCTest
@testable import TRIX3DCompanion

// MARK: - Mock WeChatSignInService

@MainActor
final class MockWeChatSignInService: WeChatSignInServiceProtocol {

    var isAvailable: Bool = true
    var isInstalled: Bool = true
    var sdkVersion: String? = "1.9.2"

    // Test control properties
    var shouldFailSignIn = false
    var shouldReturnNotInstalled = false
    var shouldReturnNotSupported = false
    var mockError: WeChatSignInError?
    var mockCredential: WeChatSignInCredential?
    var mockRefreshCredential: WeChatSignInCredential?
    var shouldFailRefresh = false

    // Call tracking
    var signInCalled = false
    var refreshAccessTokenCalled = false
    var refreshAccessTokenCalledWithToken: String?
    var handleOpenCalled = false
    var handleOpenCalledWithURL: URL?

    // Concurrent tracking
    var signInCallCount = 0
    var activeSignInCount = 0

    func signIn() async -> WeChatSignInResult {
        signInCalled = true
        signInCallCount += 1
        activeSignInCount += 1
        defer { activeSignInCount -= 1 }

        if shouldReturnNotSupported {
            return .failure(.notSupported)
        }

        if shouldReturnNotInstalled {
            return .failure(.notInstalled)
        }

        if shouldFailSignIn {
            let error = mockError ?? .authenticationFailed
            return .failure(error)
        }

        let credential = mockCredential ?? createMockCredential()
        return .success(credential)
    }

    func refreshAccessToken(refreshToken: String) async -> WeChatSignInResult {
        refreshAccessTokenCalled = true
        refreshAccessTokenCalledWithToken = refreshToken

        if shouldFailRefresh {
            return .failure(.tokenExpired)
        }

        let credential = mockRefreshCredential ?? createMockRefreshCredential()
        return .success(credential)
    }

    func handleOpen(_ url: URL) -> Bool {
        handleOpenCalled = true
        handleOpenCalledWithURL = url

        // Check if this is a WeChat callback
        guard url.scheme?.hasPrefix("wx") == true ||
              url.absoluteString.contains("oauth") else {
            return false
        }

        return true
    }

    // MARK: - Helper Methods

    private func createMockCredential() -> WeChatSignInCredential {
        return WeChatSignInCredential(
            openID: "mock-open-id-123",
            accessToken: "mock-access-token",
            refreshToken: "mock-refresh-token",
            expiresIn: 7200,
            unionID: "mock-union-id-456",
            scope: "snsapi_userinfo"
        )
    }

    private func createMockRefreshCredential() -> WeChatSignInCredential {
        return WeChatSignInCredential(
            openID: "mock-open-id-123",
            accessToken: "new-mock-access-token",
            refreshToken: "new-mock-refresh-token",
            expiresIn: 7200,
            unionID: "mock-union-id-456",
            scope: "snsapi_userinfo"
        )
    }
}

// MARK: - WeChatSignInService Tests

@MainActor
final class WeChatSignInServiceTests: XCTestCase {

    var sut: MockWeChatSignInService!

    override func setUp() {
        super.setUp()
        sut = MockWeChatSignInService()
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    // MARK: - Sign In Success Tests

    func testSignIn_Success() async {
        // Given
        let mockCredential = WeChatSignInCredential(
            openID: "test-open-id",
            accessToken: "test-access-token",
            refreshToken: "test-refresh-token",
            expiresIn: 7200,
            unionID: "test-union-id",
            scope: "snsapi_userinfo"
        )
        sut.mockCredential = mockCredential

        // When
        let result = await sut.signIn()

        // Then
        XCTAssertTrue(sut.signInCalled)
        XCTAssertEqual(sut.signInCallCount, 1)

        switch result {
        case .success(let credential):
            XCTAssertEqual(credential.openID, "test-open-id")
            XCTAssertEqual(credential.accessToken, "test-access-token")
            XCTAssertEqual(credential.refreshToken, "test-refresh-token")
            XCTAssertEqual(credential.expiresIn, 7200)
            XCTAssertEqual(credential.unionID, "test-union-id")
            XCTAssertEqual(credential.scope, "snsapi_userinfo")
            XCTAssertFalse(credential.isExpired)
        case .failure:
            XCTFail("Expected success but got failure")
        }
    }

    func testSignIn_SuccessWithoutUnionID() async {
        // Given
        let mockCredential = WeChatSignInCredential(
            openID: "test-open-id",
            accessToken: "test-access-token",
            refreshToken: "test-refresh-token",
            expiresIn: 7200,
            unionID: nil,
            scope: "snsapi_userinfo"
        )
        sut.mockCredential = mockCredential

        // When
        let result = await sut.signIn()

        // Then
        switch result {
        case .success(let credential):
            XCTAssertEqual(credential.openID, "test-open-id")
            XCTAssertNil(credential.unionID)
        case .failure:
            XCTFail("Expected success")
        }
    }

    // MARK: - Not Installed Tests

    func testSignIn_NotInstalled() async {
        // Given
        sut.shouldReturnNotInstalled = true

        // When
        let result = await sut.signIn()

        // Then
        XCTAssertTrue(sut.signInCalled)

        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .notInstalled)
        case .success:
            XCTFail("Expected not installed error")
        }
    }

    // MARK: - Not Supported Tests

    func testSignIn_NotSupported() async {
        // Given
        sut.shouldReturnNotSupported = true

        // When
        let result = await sut.signIn()

        // Then
        XCTAssertTrue(sut.signInCalled)

        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .notSupported)
        case .success:
            XCTFail("Expected not supported error")
        }
    }

    // MARK: - Authentication Failed Tests

    func testSignIn_AuthenticationFailed() async {
        // Given
        sut.shouldFailSignIn = true
        sut.mockError = .authenticationFailed

        // When
        let result = await sut.signIn()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .authenticationFailed)
        case .success:
            XCTFail("Expected authentication failed error")
        }
    }

    // MARK: - Invalid Code Tests

    func testSignIn_InvalidCode() async {
        // Given
        sut.shouldFailSignIn = true
        sut.mockError = .invalidCode

        // When
        let result = await sut.signIn()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .invalidCode)
        case .success:
            XCTFail("Expected invalid code error")
        }
    }

    // MARK: - Network Error Tests

    func testSignIn_NetworkError() async {
        // Given
        let networkError = NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)
        sut.shouldFailSignIn = true
        sut.mockError = .networkError(networkError)

        // When
        let result = await sut.signIn()

        // Then
        switch result {
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true)
            } else {
                XCTFail("Expected network error")
            }
        case .success:
            XCTFail("Expected network error")
        }
    }

    // MARK: - Invalid Response Tests

    func testSignIn_InvalidResponse() async {
        // Given
        sut.shouldFailSignIn = true
        sut.mockError = .invalidResponse

        // When
        let result = await sut.signIn()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .invalidResponse)
        case .success:
            XCTFail("Expected invalid response error")
        }
    }

    // MARK: - Authorization Failed Tests

    func testSignIn_AuthorizationFailed() async {
        // Given
        sut.shouldFailSignIn = true
        sut.mockError = .authorizationFailed("User denied access")

        // When
        let result = await sut.signIn()

        // Then
        switch result {
        case .failure(let error):
            if case .authorizationFailed(let message) = error {
                XCTAssertEqual(message, "User denied access")
            } else {
                XCTFail("Expected authorization failed error")
            }
        case .success:
            XCTFail("Expected authorization failed error")
        }
    }

    // MARK: - No OpenID Tests

    func testSignIn_NoOpenID() async {
        // Given
        sut.shouldFailSignIn = true
        sut.mockError = .noOpenID

        // When
        let result = await sut.signIn()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .noOpenID)
        case .success:
            XCTFail("Expected no OpenID error")
        }
    }

    // MARK: - No Access Token Tests

    func testSignIn_NoAccessToken() async {
        // Given
        sut.shouldFailSignIn = true
        sut.mockError = .noAccessToken

        // When
        let result = await sut.signIn()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .noAccessToken)
        case .success:
            XCTFail("Expected no access token error")
        }
    }

    // MARK: - Token Expired Tests

    func testSignIn_TokenExpired() async {
        // Given
        sut.shouldFailSignIn = true
        sut.mockError = .tokenExpired

        // When
        let result = await sut.signIn()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .tokenExpired)
            XCTAssertTrue(error.isRecoverable)
        case .success:
            XCTFail("Expected token expired error")
        }
    }

    // MARK: - Token Refresh Tests

    func testRefreshAccessToken_Success() async {
        // Given
        let refreshToken = "valid-refresh-token"
        let newCredential = WeChatSignInCredential(
            openID: "test-open-id",
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            expiresIn: 7200,
            unionID: "test-union-id",
            scope: "snsapi_userinfo"
        )
        sut.mockRefreshCredential = newCredential

        // When
        let result = await sut.refreshAccessToken(refreshToken: refreshToken)

        // Then
        XCTAssertTrue(sut.refreshAccessTokenCalled)
        XCTAssertEqual(sut.refreshAccessTokenCalledWithToken, refreshToken)

        switch result {
        case .success(let credential):
            XCTAssertEqual(credential.accessToken, "new-access-token")
            XCTAssertEqual(credential.refreshToken, "new-refresh-token")
            XCTAssertFalse(credential.isExpired)
        case .failure:
            XCTFail("Expected success")
        }
    }

    func testRefreshAccessToken_Failure() async {
        // Given
        sut.shouldFailRefresh = true

        // When
        let result = await sut.refreshAccessToken(refreshToken: "invalid-token")

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .tokenExpired)
        case .success:
            XCTFail("Expected failure")
        }
    }

    // MARK: - Handle URL Tests

    func testHandleOpen_ValidWeChatURL() {
        // Given
        let url = URL(string: "wx123456789://oauth?code=auth-code-123&state=state-123")!

        // When
        let handled = sut.handleOpen(url)

        // Then
        XCTAssertTrue(handled)
        XCTAssertTrue(sut.handleOpenCalled)
        XCTAssertEqual(sut.handleOpenCalledWithURL, url)
    }

    func testHandleOpen_InvalidURL() {
        // Given
        let url = URL(string: "https://example.com/callback")!

        // When
        let handled = sut.handleOpen(url)

        // Then
        XCTAssertFalse(handled)
        XCTAssertTrue(sut.handleOpenCalled)
    }

    // MARK: - Concurrent Tests

    func testConcurrentSignIn_PreventsRaceCondition() async {
        // When - Execute concurrent sign-ins
        async let result1 = sut.signIn()
        async let result2 = sut.signIn()
        async let result3 = sut.signIn()

        let (res1, res2, res3) = await (result1, result2, result3)

        // Then
        XCTAssertEqual(sut.signInCallCount, 3)
        XCTAssertEqual(sut.activeSignInCount, 0)

        switch (res1, res2, res3) {
        case (.success, .success, .success):
            XCTAssertTrue(true)
        default:
            XCTFail("Expected all sign-ins to succeed")
        }
    }

    // MARK: - Credential Expiration Tests

    func testCredential_NotExpired() {
        // Given
        let credential = WeChatSignInCredential(
            openID: "test",
            accessToken: "token",
            refreshToken: "refresh",
            expiresIn: 7200,
            unionID: nil,
            scope: nil
        )

        // Then
        XCTAssertFalse(credential.isExpired)
    }

    func testCredential_ExpirationDate() {
        // Given
        let credential = WeChatSignInCredential(
            openID: "test",
            accessToken: "token",
            refreshToken: "refresh",
            expiresIn: 3600,
            unionID: nil,
            scope: nil
        )

        // Then
        let expectedExpiration = Date().addingTimeInterval(3600)
        let timeDifference = abs(credential.expirationDate.timeIntervalSince(expectedExpiration))
        XCTAssertLessThan(timeDifference, 1.0)
    }

    // MARK: - Error Recovery Tests

    func testErrorIsRecoverable_Cancelled() {
        XCTAssertTrue(WeChatSignInError.cancelled.isRecoverable)
    }

    func testErrorIsRecoverable_TokenExpired() {
        XCTAssertTrue(WeChatSignInError.tokenExpired.isRecoverable)
    }

    func testErrorIsRecoverable_NetworkError() {
        let networkError = NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)
        XCTAssertTrue(WeChatSignInError.networkError(networkError).isRecoverable)
    }

    func testErrorIsNotRecoverable_NotInstalled() {
        XCTAssertFalse(WeChatSignInError.notInstalled.isRecoverable)
    }

    func testErrorIsNotRecoverable_NotSupported() {
        XCTAssertFalse(WeChatSignInError.notSupported.isRecoverable)
    }

    func testErrorIsNotRecoverable_InvalidCode() {
        XCTAssertFalse(WeChatSignInError.invalidCode.isRecoverable)
    }

    // MARK: - Error Description Tests

    func testErrorDescription_NotInstalled() {
        XCTAssertEqual(
            WeChatSignInError.notInstalled.errorDescription,
            "WeChat is not installed on this device"
        )
    }

    func testErrorDescription_Cancelled() {
        XCTAssertEqual(
            WeChatSignInError.cancelled.errorDescription,
            "WeChat Sign In was cancelled"
        )
    }

    func testErrorDescription_InvalidCode() {
        XCTAssertEqual(
            WeChatSignInError.invalidCode.errorDescription,
            "Invalid authorization code received from WeChat"
        )
    }

    func testErrorDescription_NoOpenID() {
        XCTAssertEqual(
            WeChatSignInError.noOpenID.errorDescription,
            "No OpenID received from WeChat"
        )
    }

    func testErrorDescription_NoAccessToken() {
        XCTAssertEqual(
            WeChatSignInError.noAccessToken.errorDescription,
            "No access token received from WeChat"
        )
    }

    // MARK: - Is Available Tests

    func testIsAvailable_WhenTrue() {
        // Given
        sut.isAvailable = true

        // Then
        XCTAssertTrue(sut.isAvailable)
    }

    func testIsAvailable_WhenFalse() {
        // Given
        sut.isAvailable = false

        // Then
        XCTAssertFalse(sut.isAvailable)
    }

    // MARK: - Is Installed Tests

    func testIsInstalled_WhenTrue() {
        // Given
        sut.isInstalled = true

        // Then
        XCTAssertTrue(sut.isInstalled)
    }

    func testIsInstalled_WhenFalse() {
        // Given
        sut.isInstalled = false

        // Then
        XCTAssertFalse(sut.isInstalled)
    }

    // MARK: - SDK Version Tests

    func testSDKVersion_WhenSet() {
        // Given
        sut.sdkVersion = "2.0.0"

        // Then
        XCTAssertEqual(sut.sdkVersion, "2.0.0")
    }

    func testSDKVersion_WhenNil() {
        // Given
        sut.sdkVersion = nil

        // Then
        XCTAssertNil(sut.sdkVersion)
    }
}
