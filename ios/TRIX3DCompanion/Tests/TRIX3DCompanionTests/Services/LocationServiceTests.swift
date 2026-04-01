//
//  LocationServiceTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for LocationService
//

import XCTest
import CoreLocation
import Supabase
@testable import TRIX3DCompanion

@MainActor
final class LocationServiceTests: XCTestCase {

    private var locationService: LocationService!
    private var mockAuthService: LocationServiceTestsMockAuthService!
    private var mockAPIClient: LocationServiceTestsMockAPIClient!

    override func setUpWithError() throws {
        mockAuthService = LocationServiceTestsMockAuthService()
        mockAPIClient = LocationServiceTestsMockAPIClient()
        locationService = LocationService(
            apiClient: mockAPIClient,
            authService: mockAuthService
        )
    }

    override func tearDownWithError() throws {
        locationService = nil
        mockAuthService = nil
        mockAPIClient = nil
    }

    func test_initialization_succeeds() {
        XCTAssertNotNil(locationService)
    }

    func test_fetchNearbyLocations_withoutAuthentication_fails() async {
        mockAuthService.mockIsLoggedIn = false

        let result = await locationService.fetchNearbyLocations(radius: 1000)

        switch result {
        case .success:
            XCTFail("Expected unauthenticated fetch to fail")
        case .failure(let error):
            guard case .networkError(let underlying) = error else {
                return XCTFail("Expected networkError(Auth), got \(error)")
            }
            XCTAssertEqual((underlying as NSError).domain, "Auth")
        }
    }

    func test_shareLocation_withoutAuthentication_fails() async {
        mockAuthService.mockIsLoggedIn = false

        let result = await locationService.shareLocation(with: "companion-123")

        switch result {
        case .success:
            XCTFail("Expected unauthenticated share to fail")
        case .failure(let error):
            guard case .networkError(let underlying) = error else {
                return XCTFail("Expected networkError(Auth), got \(error)")
            }
            XCTAssertEqual((underlying as NSError).domain, "Auth")
        }
    }

    func test_shareLocation_emptyCompanionId_failsBeforeLocationLookup() async {
        mockAuthService.mockIsLoggedIn = true

        let result = await locationService.shareLocation(with: "")

        switch result {
        case .success:
            XCTFail("Expected empty companion id to fail")
        case .failure(let error):
            guard case .networkError(let underlying) = error else {
                return XCTFail("Expected networkError(Validation), got \(error)")
            }
            XCTAssertEqual((underlying as NSError).domain, "Validation")
        }
    }

    func test_clearLocationCache_resetsState() {
        locationService.clearLocationCache()

        XCTAssertNil(locationService.currentLocation)
        XCTAssertTrue(locationService.nearbyLocations.isEmpty)
        XCTAssertNil(locationService.lastError)
    }

    func test_authorizationStatusDescription_isAvailable() {
        XCTAssertFalse(locationService.authorizationStatusDescription.isEmpty)
    }

    func test_locationDescription_isNilWithoutLocation() {
        XCTAssertNil(locationService.locationDescription)
    }

    func test_locationErrorDescriptions() {
        XCTAssertEqual(
            LocationError.permissionDenied.localizedDescription,
            "位置权限被拒绝，请在设置中启用位置权限"
        )
        XCTAssertEqual(
            LocationError.locationUnavailable.localizedDescription,
            "无法获取位置信息，请检查GPS是否开启"
        )
        XCTAssertEqual(
            LocationError.timeout.localizedDescription,
            "获取位置超时，请重试"
        )
        XCTAssertEqual(
            LocationError.invalidCoordinates.localizedDescription,
            "无效的坐标数据"
        )
    }

    func test_locationErrorRecoverability() {
        XCTAssertFalse(LocationError.permissionDenied.isRecoverable)
        XCTAssertFalse(LocationError.locationUnavailable.isRecoverable)
        XCTAssertTrue(LocationError.networkError(NSError(domain: "test", code: 0)).isRecoverable)
        XCTAssertTrue(LocationError.timeout.isRecoverable)
        XCTAssertTrue(LocationError.invalidCoordinates.isRecoverable)
    }
}

@MainActor
private final class LocationServiceTestsMockAuthService: AuthServiceProtocol {
    var mockIsLoggedIn = false
    var mockCurrentUser: TRIX3DCompanion.User?

    var isLoggedIn: Bool { mockIsLoggedIn }
    var currentUser: TRIX3DCompanion.User? { mockCurrentUser }
    var isLoading: Bool { false }
    var supabase: SupabaseClient? { nil }

    func login(email: String, password: String) async -> AuthResult<TRIX3DCompanion.User> {
        .failure(.invalidCredentials)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<TRIX3DCompanion.User> {
        .failure(.invalidCredentials)
    }

    func logout() async -> AuthResult<Void> {
        .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        .success(())
    }

    func fetchCurrentUser() async -> AuthResult<TRIX3DCompanion.User> {
        guard let mockCurrentUser else {
            return .failure(.invalidCredentials)
        }
        return .success(mockCurrentUser)
    }

    func updateProfile(_ updates: TRIX3DCompanion.User) async -> AuthResult<TRIX3DCompanion.User> {
        mockCurrentUser = updates
        return .success(updates)
    }

    func deleteAccount() async -> AuthResult<Void> {
        .success(())
    }

    func updateCurrentUser(_ user: TRIX3DCompanion.User?) {
        mockCurrentUser = user
    }

    func updateLoginStatus(_ loggedIn: Bool) {
        mockIsLoggedIn = loggedIn
    }

    func resetEmailConfirmationSuccess() {}

    func clearError() {}
}

private final class LocationServiceTestsMockAPIClient: APIClientProtocol {
    func get<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        throw NetworkError.custom(message: "Not implemented")
    }

    func get<T: Decodable>(_ endpoint: APIEndpoint, parameters: [String: Any]) async throws -> T {
        throw NetworkError.custom(message: "Not implemented")
    }

    func post<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        throw NetworkError.custom(message: "Not implemented")
    }

    func put<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        throw NetworkError.custom(message: "Not implemented")
    }

    func delete<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        throw NetworkError.custom(message: "Not implemented")
    }

    func upload<T: Codable>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T {
        throw NetworkError.custom(message: "Not implemented")
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.custom(message: "Not implemented")
    }
}
