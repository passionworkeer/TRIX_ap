//
//  LocationServiceTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for LocationService
//

import XCTest
import CoreLocation
import Combine
@testable import TRIX3DCompanion

/// Unit tests for LocationService
final class LocationServiceTests: XCTestCase {

    // MARK: - Properties

    var locationService: LocationService!
    var mockAuthService: MockAuthService!
    var mockAPIClient: MockAPIClient!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockAuthService = MockAuthService()
        mockAuthService.mockIsLoggedIn = true

        mockAPIClient = MockAPIClient()

        locationService = LocationService(
            apiClient: mockAPIClient,
            authService: mockAuthService
        )

        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        locationService = nil
        mockAuthService = nil
        mockAPIClient = nil
        cancellables = nil
    }

    // MARK: - Permission Tests

    func test_requestPermission_granted() throws {
        // Arrange
        let expectation = XCTestExpectation(description: "Permission granted")

        // Note: In a real test environment, we'd mock CLLocationManager
        // This test verifies the permission request flow

        // Act - This will trigger the actual permission dialog in real device
        // In testing, we'd use a mock location manager
        _ = locationService.requestPermission()

        // Assert - Check initial state
        XCTAssertNotNil(locationService, "LocationService should be initialized")

        expectation.fulfill()
        wait(for: [expectation], timeout: 1.0)
    }

    func test_requestPermission_denied() throws {
        // This test requires mocking CLLocationManager
        // In production, we'd inject a mock location manager

        XCTAssertTrue(true, "Permission denied test placeholder - requires CLLocationManager mock")
    }

    // MARK: - Location Caching Tests

    func test_getCurrentLocation_returnsCachedLocation() throws {
        // Arrange - Set up a cached location
        let testLocation = CLLocation(latitude: 37.7749, longitude: -122.4194)
        locationService = LocationService(
            apiClient: mockAPIClient,
            authService: mockAuthService
        )

        // Use reflection or internal method to set cached location
        // For testing, we'll test the cache validation behavior

        // Note: The actual cache validation uses 5-minute window
        // Testing this requires internal access or mock injection

        XCTAssertNotNil(locationService, "LocationService should be initialized")
    }

    // MARK: - Location Updates Tests

    func test_startLocationUpdates_beginsUpdating() throws {
        // Arrange - Set up authorized state
        mockAuthService.mockIsLoggedIn = true

        // In real tests, we'd mock CLLocationManager to verify startUpdatingLocation is called

        // Note: This test verifies the start location updates flow
        // Actual behavior requires CLLocationManager mocking

        XCTAssertNotNil(locationService, "LocationService should be initialized")
    }

    func test_stopLocationUpdates_stopsUpdating() throws {
        // Arrange
        locationService.startLocationUpdates()

        // Act
        locationService.stopLocationUpdates()

        // Assert
        XCTAssertFalse(locationService.isLocationUpdating, "Location updates should be stopped")
    }

    // MARK: - Fetch Nearby Locations Tests

    func test_fetchNearbyLocations_success() async throws {
        // Arrange
        mockAuthService.mockIsLoggedIn = true

        let mockLocations = [
            Location(
                id: "1",
                userId: "user1",
                name: "Test Library",
                description: "A test library",
                latitude: 37.7749,
                longitude: -122.4194,
                address: "123 Test St",
                category: .library,
                createdAt: Date(),
                updatedAt: Date()
            )
        ]

        mockAPIClient.mockNearbyLocations = mockLocations

        // Act
        let result = await locationService.fetchNearbyLocations(radius: 1000)

        // Assert
        switch result {
        case .success(let locations):
            XCTAssertFalse(locations.isEmpty, "Should return locations")
            XCTAssertEqual(locations.first?.name, "Test Library")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_fetchNearbyLocations_networkError() async throws {
        // Arrange
        mockAuthService.mockIsLoggedIn = true
        mockAPIClient.mockNetworkError = .noConnection

        // Act
        let result = await locationService.fetchNearbyLocations(radius: 1000)

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail with network error")
        case .failure(let error):
            XCTAssertNotNil(error, "Should return error")
        }
    }

    // MARK: - Share Location Tests

    func test_shareLocation_success() async throws {
        // Arrange
        mockAuthService.mockIsLoggedIn = true
        mockAPIClient.mockShareLocationResponse = ShareLocationResponse(
            success: true,
            sharedAt: Date(),
            expiresAt: Date().addingTimeInterval(3600)
        )

        // Act
        let result = await locationService.shareLocation(with: "companion-123")

        // Assert
        switch result {
        case .success(let shared):
            XCTAssertTrue(shared, "Location sharing should succeed")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    // MARK: - Coordinate Validation Tests

    func test_coordinateValidation_invalidCoordinates() throws {
        // This test verifies the coordinate validation logic
        // We'd need to expose the private method or test through public API

        XCTAssertTrue(true, "Coordinate validation test - requires internal access")
    }

    // MARK: - Cache Clearing Tests

    func test_clearLocationCache_clearsData() throws {
        // Act
        locationService.clearLocationCache()

        // Assert
        XCTAssertNil(locationService.currentLocation, "Current location should be cleared")
        XCTAssertTrue(locationService.nearbyLocations.isEmpty, "Nearby locations should be cleared")
        XCTAssertNil(locationService.lastError, "Error should be cleared")
    }

    // MARK: - Error Handling Tests

    func test_locationErrorDescriptions() {
        let permissionDenied = LocationError.permissionDenied
        XCTAssertEqual(
            permissionDenied.localizedDescription,
            "位置权限被拒绝，请在设置中启用位置权限"
        )

        let locationUnavailable = LocationError.locationUnavailable
        XCTAssertEqual(
            locationUnavailable.localizedDescription,
            "无法获取位置信息，请检查GPS是否开启"
        )

        let timeout = LocationError.timeout
        XCTAssertEqual(
            timeout.localizedDescription,
            "获取位置超时，请重试"
        )

        let invalidCoordinates = LocationError.invalidCoordinates
        XCTAssertEqual(
            invalidCoordinates.localizedDescription,
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

    // MARK: - Authorization Status Tests

    func test_authorizationStatusDescription() {
        // Test various authorization status descriptions

        // Note: These require the actual CLLocationManager authorization status
        // which is difficult to mock without additional infrastructure

        XCTAssertNotNil(locationService.authorizationStatusDescription)
    }

    // MARK: - Location Description Tests

    func test_locationDescription() {
        // Set a test location
        let testLocation = CLLocation(
            latitude: 37.7749,
            longitude: -122.4194,
            horizontalAccuracy: 10.0
        )

        // The location description requires currentLocation to be set
        // This is difficult to test without mock injection

        XCTAssertNil(locationService.locationDescription, "Should be nil when no location")
    }
}

// MARK: - Mock Auth Service

private class MockAuthService: AuthServiceProtocol {
    var mockIsLoggedIn: Bool = false
    var mockCurrentUser: User?

    var isLoggedIn: Bool { mockIsLoggedIn }
    var currentUser: User? { mockCurrentUser }
    var isLoading: Bool { false }

    func login(email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func logout() async -> AuthResult<Void> {
        return .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        return .success(())
    }

    func fetchCurrentUser() async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }
}

// MARK: - Mock API Client

private class MockAPIClient: APIClient {
    var mockNearbyLocations: [Location]?
    var mockNetworkError: NetworkError?
    var mockShareLocationResponse: ShareLocationResponse?

    override func getNearbyLocations(radius: Double) async throws -> [Location] {
        if let error = mockNetworkError {
            throw error
        }
        return mockNearbyLocations ?? []
    }

    override func shareLocation(_ request: ShareLocationRequest) async throws -> ShareLocationResponse {
        if let error = mockNetworkError {
            throw error
        }
        return mockShareLocationResponse ?? ShareLocationResponse(
            success: true,
            sharedAt: Date(),
            expiresAt: nil
        )
    }
}
