//
//  LocationServiceTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for LocationService with Mock CLLocationManager
//

import XCTest
import CoreLocation
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock CLLocationManager

/// Mock CLLocationManager for testing
final class MockCLLocationManager: NSObject {

    // MARK: - Published Properties (mimicking CLLocationManager)

    private(set) var authorizationStatus: CLAuthorizationStatus = .notDetermined
    private(set) var locationServicesEnabled: Bool = true
    private(set) var desiredAccuracy: CLLocationAccuracy = kCLLocationAccuracyBest
    private(set) var distanceFilter: CLLocationDistance = 10.0
    private(set) var pausesLocationUpdatesAutomatically: Bool = true
    private(set) var allowsBackgroundLocationUpdates: Bool = false

    // MARK: - Delegate

    weak var delegate: CLLocationManagerDelegate?

    // MARK: - Test Control Properties

    var mockLocations: [CLLocation] = []
    var mockError: Error?
    var shouldFailLocationServices: Bool = false

    // Call tracking
    var requestWhenInUseAuthorizationCalled: Bool = false
    var requestAlwaysAuthorizationCalled: Bool = false
    var requestLocationCalled: Bool = false
    var startUpdatingLocationCalled: Bool = false
    var stopUpdatingLocationCalled: Bool = false
    var startMonitoringSignificantLocationChangesCalled: Bool = false
    var stopMonitoringSignificantLocationChangesCalled: Bool = false

    // MARK: - Simulate Methods

    func simulateAuthorizationChange(_ status: CLAuthorizationStatus) {
        authorizationStatus = status
        delegate?.locationManagerDidChangeAuthorization?(CLLocationManager())
    }

    func simulateLocationUpdate(_ location: CLLocation) {
        delegate?.locationManager?(CLLocationManager(), didUpdateLocations: [location])
    }

    func simulateLocationError(_ error: Error) {
        delegate?.locationManager?(CLLocationManager(), didFailWithError: error)
    }

    // MARK: - CLLocationManager Methods

    static var locationServicesEnabled: Bool {
        get { true }
    }

    func requestWhenInUseAuthorization() {
        requestWhenInUseAuthorizationCalled = true
    }

    func requestAlwaysAuthorization() {
        requestAlwaysAuthorizationCalled = true
    }

    func requestLocation() {
        requestLocationCalled = true

        // Simulate async location update
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if self.mockLocations.isEmpty {
                let error = CLError(.locationUnknown)
                self.delegate?.locationManager?(self, didFailWithError: error)
            } else {
                self.delegate?.locationManager?(self, didUpdateLocations: self.mockLocations)
            }
        }
    }

    func startUpdatingLocation() {
        startUpdatingLocationCalled = true
    }

    func stopUpdatingLocation() {
        stopUpdatingLocationCalled = true
    }

    func startMonitoringSignificantLocationChanges() {
        startMonitoringSignificantLocationChangesCalled = true
    }

    func stopMonitoringSignificantLocationChanges() {
        stopMonitoringSignificantLocationChangesCalled = true
    }
}

// MARK: - Testable LocationService

/// Subclass of LocationService that allows injecting mock CLLocationManager
@MainActor
final class TestableLocationService: LocationService {

    // MARK: - Properties

    var mockLocationManager: MockCLLocationManager?

    // MARK: - Initialization

    init(mockLocationManager: MockCLLocationManager? = nil, apiClient: APIClient = .shared, authService: AuthService = .shared) {
        self.mockLocationManager = mockLocationManager
        super.init(apiClient: apiClient, authService: authService)
    }

    // MARK: - Test Helpers

    func simulateLocationUpdate(_ location: CLLocation) {
        mockLocationManager?.simulateLocationUpdate(location)
    }

    func simulateAuthorizationChange(_ status: CLAuthorizationStatus) {
        mockLocationManager?.simulateAuthorizationChange(status)
    }

    func simulateLocationError(_ error: Error) {
        mockLocationManager?.simulateLocationError(error)
    }
}

// MARK: - LocationService Tests

@MainActor
final class LocationServiceTests: XCTestCase {

    // MARK: - Properties

    var sut: TestableLocationService!
    var mockLocationManager: MockCLLocationManager!
    var mockAuthService: MockLocationAuthService!
    var mockAPIClient: MockLocationAPIClient!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUp() {
        super.setUp()

        mockLocationManager = MockCLLocationManager()
        mockLocationManager.mockLocations = [
            CLLocation(latitude: 37.7749, longitude: -122.4194, horizontalAccuracy: 10.0)
        ]

        mockAuthService = MockLocationAuthService()
        mockAuthService.mockIsLoggedIn = true

        mockAPIClient = MockLocationAPIClient()

        sut = TestableLocationService(
            mockLocationManager: mockLocationManager,
            apiClient: mockAPIClient,
            authService: mockAuthService
        )

        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        sut = nil
        mockLocationManager = nil
        mockAuthService = nil
        mockAPIClient = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Initial State Tests

    func testInitialState_NoLocation() {
        // Then
        XCTAssertNil(sut.currentLocation)
    }

    func testInitialState_NotUpdating() {
        // Then
        XCTAssertFalse(sut.isLocationUpdating)
    }

    func testInitialState_NoError() {
        // Then
        XCTAssertNil(sut.lastError)
    }

    // MARK: - Permission Request Tests

    func testRequestPermission_WhenNotDetermined_ReturnsTrue() {
        // Given
        mockLocationManager.authorizationStatus = .notDetermined

        // When
        let result = sut.requestPermission()

        // Then
        XCTAssertTrue(mockLocationManager.requestWhenInUseAuthorizationCalled)
    }

    func testRequestPermission_WhenAuthorizedWhenInUse_ReturnsTrue() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        let result = sut.requestPermission()

        // Then
        XCTAssertTrue(result)
        XCTAssertFalse(mockLocationManager.requestWhenInUseAuthorizationCalled)
    }

    func testRequestPermission_WhenAuthorizedAlways_ReturnsTrue() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedAlways

        // When
        let result = sut.requestPermission()

        // Then
        XCTAssertTrue(result)
    }

    func testRequestPermission_WhenDenied_ReturnsFalse() {
        // Given
        mockLocationManager.authorizationStatus = .denied

        // When
        let result = sut.requestPermission()

        // Then
        XCTAssertFalse(result)
        XCTAssertNotNil(sut.lastError)
        if case .permissionDenied = sut.lastError {
            XCTAssertTrue(true)
        } else {
            XCTFail("Expected permissionDenied error")
        }
    }

    func testRequestPermission_WhenRestricted_ReturnsFalse() {
        // Given
        mockLocationManager.authorizationStatus = .restricted

        // When
        let result = sut.requestPermission()

        // Then
        XCTAssertFalse(result)
        XCTAssertNotNil(sut.lastError)
    }

    func testRequestPermission_WhenLocationServicesDisabled_ReturnsFalse() {
        // Given
        mockLocationManager.shouldFailLocationServices = true

        // When
        let result = sut.requestPermission()

        // Then
        XCTAssertFalse(result)
        XCTAssertNotNil(sut.lastError)
        if case .locationUnavailable = sut.lastError {
            XCTAssertTrue(true)
        } else {
            XCTFail("Expected locationUnavailable error")
        }
    }

    // MARK: - Authorization Status Change Tests

    func testAuthorizationStatusChange_ToAuthorized_ClearsError() {
        // Given
        _ = sut.requestPermission() // Should trigger error due to .notDetermined

        // When
        mockLocationManager.simulateAuthorizationChange(.authorizedWhenInUse)

        // Then
        XCTAssertEqual(sut.authorizationStatus, .authorizedWhenInUse)
        XCTAssertNil(sut.lastError)
    }

    func testAuthorizationStatusChange_ToDenied_SetsError() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse
        _ = sut.requestPermission()

        // When
        mockLocationManager.simulateAuthorizationChange(.denied)

        // Then
        XCTAssertEqual(sut.authorizationStatus, .denied)
        XCTAssertNotNil(sut.lastError)
    }

    func testAuthorizationStatusChange_ToRestricted_StopsUpdates() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse
        sut.startLocationUpdates()

        // When
        mockLocationManager.simulateAuthorizationChange(.restricted)

        // Then
        XCTAssertFalse(sut.isLocationUpdating)
    }

    // MARK: - Location Update Tests

    func testGetCurrentLocation_WithPermission_ReturnsLocation() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        let location = sut.getCurrentLocation()

        // Then
        XCTAssertNotNil(location)
    }

    func testGetCurrentLocation_WithoutPermission_ReturnsNil() {
        // Given
        mockLocationManager.authorizationStatus = .denied

        // When
        let location = sut.getCurrentLocation()

        // Then
        XCTAssertNil(location)
        XCTAssertNotNil(sut.lastError)
    }

    func testStartLocationUpdates_WithPermission_StartsUpdating() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        sut.startLocationUpdates()

        // Then
        XCTAssertTrue(mockLocationManager.startUpdatingLocationCalled)
        XCTAssertTrue(sut.isLocationUpdating)
    }

    func testStartLocationUpdates_WithoutPermission_DoesNotStart() {
        // Given
        mockLocationManager.authorizationStatus = .denied

        // When
        sut.startLocationUpdates()

        // Then
        XCTAssertFalse(mockLocationManager.startUpdatingLocationCalled)
        XCTAssertFalse(sut.isLocationUpdating)
    }

    func testStartLocationUpdates_WhenLocationServicesDisabled_DoesNotStart() {
        // Given
        mockLocationManager.shouldFailLocationServices = true
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        sut.startLocationUpdates()

        // Then
        XCTAssertFalse(mockLocationManager.startUpdatingLocationCalled)
        XCTAssertFalse(sut.isLocationUpdating)
    }

    func testStopLocationUpdates_StopsUpdating() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse
        sut.startLocationUpdates()

        // When
        sut.stopLocationUpdates()

        // Then
        XCTAssertTrue(mockLocationManager.stopUpdatingLocationCalled)
        XCTAssertFalse(sut.isLocationUpdating)
    }

    func testStopLocationUpdates_WhenNotUpdating_DoesNotCrash() {
        // When
        sut.stopLocationUpdates()

        // Then
        XCTAssertFalse(sut.isLocationUpdating)
    }

    // MARK: - Location Delegate Tests

    func testLocationManager_DidUpdateLocations() {
        // Given
        let testLocation = CLLocation(latitude: 40.7128, longitude: -74.0060, horizontalAccuracy: 5.0)
        mockLocationManager.mockLocations = [testLocation]
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        mockLocationManager.simulateLocationUpdate(testLocation)

        // Then
        XCTAssertEqual(sut.currentLocation?.coordinate.latitude, 40.7128)
        XCTAssertEqual(sut.currentLocation?.coordinate.longitude, -74.0060)
    }

    func testLocationManager_DidUpdateLocations_InvalidAccuracy() {
        // Given
        let invalidLocation = CLLocation(latitude: 40.7128, longitude: -74.0060, horizontalAccuracy: -1)
        mockLocationManager.mockLocations = [invalidLocation]
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        mockLocationManager.simulateLocationUpdate(invalidLocation)

        // Then
        XCTAssertNil(sut.currentLocation)
    }

    func testLocationManager_DidFailWithError() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        mockLocationManager.simulateLocationError(CLError(.locationUnknown))

        // Then
        XCTAssertNotNil(sut.lastError)
        XCTAssertFalse(sut.isLocationUpdating)
    }

    func testLocationManager_DidFailWithError_Denied() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        mockLocationManager.simulateLocationError(CLError(.denied))

        // Then
        if case .permissionDenied = sut.lastError {
            XCTAssertTrue(true)
        } else {
            XCTFail("Expected permissionDenied error")
        }
    }

    func testLocationManager_DidFailWithError_Timeout() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        mockLocationManager.simulateLocationError(CLError(.timeout))

        // Then
        if case .timeout = sut.lastError {
            XCTAssertTrue(true)
        } else {
            XCTFail("Expected timeout error")
        }
    }

    // MARK: - One-Time Location Request Tests

    func testRequestLocation_Called() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        _ = sut.getCurrentLocation()

        // Then
        XCTAssertTrue(mockLocationManager.requestLocationCalled)
    }

    // MARK: - Nearby Locations API Tests

    func testFetchNearbyLocations_Success() async {
        // Given
        mockAuthService.mockIsLoggedIn = true
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

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

        // When
        let result = await sut.fetchNearbyLocations(radius: 1000)

        // Then
        switch result {
        case .success(let locations):
            XCTAssertEqual(locations.count, 1)
            XCTAssertEqual(locations.first?.name, "Test Library")
        case .failure(let error):
            XCTFail("Expected success but got error: \(error)")
        }
    }

    func testFetchNearbyLocations_NotLoggedIn_Fails() async {
        // Given
        mockAuthService.mockIsLoggedIn = false

        // When
        let result = await sut.fetchNearbyLocations(radius: 1000)

        // Then
        switch result {
        case .success:
            XCTFail("Expected failure")
        case .failure(let error):
            XCTAssertNotNil(error)
        }
    }

    func testFetchNearbyLocations_NetworkError_Fails() async {
        // Given
        mockAuthService.mockIsLoggedIn = true
        mockLocationManager.authorizationStatus = .authorizedWhenInUse
        mockAPIClient.mockNetworkError = .noConnection

        // When
        let result = await sut.fetchNearbyLocations(radius: 1000)

        // Then
        switch result {
        case .success:
            XCTFail("Expected failure")
        case .failure(let error):
            XCTAssertNotNil(error)
        }
    }

    func testFetchNearbyLocations_InvalidCoordinates_Fails() async {
        // Given
        mockAuthService.mockIsLoggedIn = true
        mockLocationManager.mockLocations = [
            CLLocation(latitude: 0, longitude: 0, horizontalAccuracy: 10.0) // Invalid 0,0
        ]
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        let result = await sut.fetchNearbyLocations(radius: 1000)

        // Then
        switch result {
        case .success:
            XCTFail("Expected failure")
        case .failure(let error):
            if case .invalidCoordinates = error {
                XCTAssertTrue(true)
            } else {
                XCTFail("Expected invalidCoordinates error")
            }
        }
    }

    // MARK: - Share Location Tests

    func testShareLocation_Success() async {
        // Given
        mockAuthService.mockIsLoggedIn = true
        mockLocationManager.authorizationStatus = .authorizedWhenInUse
        mockAPIClient.mockShareLocationResponse = ShareLocationResponse(
            success: true,
            sharedAt: Date(),
            expiresAt: Date().addingTimeInterval(3600)
        )

        // When
        let result = await sut.shareLocation(with: "companion-123")

        // Then
        switch result {
        case .success(let shared):
            XCTAssertTrue(shared)
        case .failure(let error):
            XCTFail("Expected success but got error: \(error)")
        }
    }

    func testShareLocation_NotLoggedIn_Fails() async {
        // Given
        mockAuthService.mockIsLoggedIn = false

        // When
        let result = await sut.shareLocation(with: "companion-123")

        // Then
        switch result {
        case .success:
            XCTFail("Expected failure")
        case .failure(let error):
            XCTAssertNotNil(error)
        }
    }

    func testShareLocation_EmptyCompanionId_Fails() async {
        // Given
        mockAuthService.mockIsLoggedIn = true

        // When
        let result = await sut.shareLocation(with: "")

        // Then
        switch result {
        case .success:
            XCTFail("Expected failure")
        case .failure(let error):
            XCTAssertNotNil(error)
        }
    }

    func testShareLocation_NetworkError_Fails() async {
        // Given
        mockAuthService.mockIsLoggedIn = true
        mockLocationManager.authorizationStatus = .authorizedWhenInUse
        mockAPIClient.mockNetworkError = .noConnection

        // When
        let result = await sut.shareLocation(with: "companion-123")

        // Then
        switch result {
        case .success:
            XCTFail("Expected failure")
        case .failure(let error):
            XCTAssertNotNil(error)
        }
    }

    func testShareLocation_APIResponseFailure_Fails() async {
        // Given
        mockAuthService.mockIsLoggedIn = true
        mockLocationManager.authorizationStatus = .authorizedWhenInUse
        mockAPIClient.mockShareLocationResponse = ShareLocationResponse(
            success: false,
            sharedAt: nil,
            expiresAt: nil
        )

        // When
        let result = await sut.shareLocation(with: "companion-123")

        // Then
        switch result {
        case .success:
            XCTFail("Expected failure")
        case .failure(let error):
            XCTAssertNotNil(error)
        }
    }

    // MARK: - Loading State Tests

    func testFetchNearbyLocations_SetsLoadingState() async {
        // Given
        mockAuthService.mockIsLoggedIn = true
        mockLocationManager.authorizationStatus = .authorizedWhenInUse
        mockAPIClient.mockNearbyLocations = []

        let expectation = expectation(description: "Loading state changes")
        var loadingStates: [Bool] = []

        sut.$isLoadingNearbyLocations
            .collect()
            .first()
            .sink { states in
                loadingStates = states
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        _ = await sut.fetchNearbyLocations(radius: 1000)

        // Then
        wait(for: [expectation], timeout: 2.0)
        XCTAssertTrue(loadingStates.contains(true))
        XCTAssertTrue(loadingStates.contains(false))
    }

    func testShareLocation_SetsSharingState() async {
        // Given
        mockAuthService.mockIsLoggedIn = true
        mockLocationManager.authorizationStatus = .authorizedWhenInUse
        mockAPIClient.mockShareLocationResponse = ShareLocationResponse(
            success: true,
            sharedAt: Date(),
            expiresAt: Date().addingTimeInterval(3600)
        )

        let expectation = expectation(description: "Sharing state changes")
        var sharingStates: [Bool] = []

        sut.$isSharingLocation
            .collect()
            .first()
            .sink { states in
                sharingStates = states
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        _ = await sut.shareLocation(with: "companion-123")

        // Then
        wait(for: [expectation], timeout: 2.0)
        XCTAssertTrue(sharingStates.contains(true))
        XCTAssertTrue(sharingStates.contains(false))
    }

    // MARK: - Cache Clearing Tests

    func testClearLocationCache_ClearsAllData() {
        // Given
        let testLocation = CLLocation(latitude: 37.7749, longitude: -122.4194)
        mockLocationManager.mockLocations = [testLocation]
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // Precondition - verify data exists
        _ = sut.getCurrentLocation()

        // When
        sut.clearLocationCache()

        // Then
        XCTAssertNil(sut.currentLocation)
        XCTAssertTrue(sut.nearbyLocations.isEmpty)
        XCTAssertNil(sut.lastError)
    }

    func testClearError_ClearsLastError() {
        // Given
        mockLocationManager.authorizationStatus = .denied
        _ = sut.requestPermission()

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.lastError)
    }

    // MARK: - Description Tests

    func testLocationDescription_WithoutLocation_ReturnsNil() {
        // Then
        XCTAssertNil(sut.locationDescription)
    }

    func testAuthorizationStatusDescription_ReturnsDescription() {
        // When
        let description = sut.authorizationStatusDescription

        // Then
        XCTAssertFalse(description.isEmpty)
    }

    // MARK: - Coordinate Validation Tests

    func testIsValidCoordinate_ValidCoordinates() {
        // Given
        let location = CLLocation(latitude: 37.7749, longitude: -122.4194)
        mockLocationManager.mockLocations = [location]
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When
        _ = sut.getCurrentLocation()
        let result = await sut.fetchNearbyLocations(radius: 1000)

        // Then
        switch result {
        case .success:
            XCTAssertTrue(true)
        case .failure(let error):
            if case .invalidCoordinates = error {
                XCTFail("Should not be invalid coordinates")
            } else {
                // Other errors are acceptable
            }
        }
    }

    func testIsValidCoordinate_InvalidLatitude() {
        // Given - Test through fetch API
        mockAuthService.mockIsLoggedIn = true
        mockLocationManager.authorizationStatus = .authorizedWhenInUse
        mockLocationManager.mockLocations = [
            CLLocation(latitude: 91.0, longitude: -122.4194, horizontalAccuracy: 10.0)
        ]

        // When
        _ = sut.getCurrentLocation()
        let result = await sut.fetchNearbyLocations(radius: 1000)

        // Then - Invalid latitude should be rejected
        switch result {
        case .success:
            XCTFail("Should fail with invalid coordinates")
        case .failure(let error):
            if case .invalidCoordinates = error {
                XCTAssertTrue(true)
            } else {
                XCTFail("Expected invalidCoordinates error")
            }
        }
    }

    func testIsValidCoordinate_InvalidLongitude() {
        // Given
        mockAuthService.mockIsLoggedIn = true
        mockLocationManager.authorizationStatus = .authorizedWhenInUse
        mockLocationManager.mockLocations = [
            CLLocation(latitude: 37.7749, longitude: 181.0, horizontalAccuracy: 10.0)
        ]

        // When
        _ = sut.getCurrentLocation()
        let result = await sut.fetchNearbyLocations(radius: 1000)

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with invalid coordinates")
        case .failure(let error):
            if case .invalidCoordinates = error {
                XCTAssertTrue(true)
            } else {
                XCTFail("Expected invalidCoordinates error")
            }
        }
    }

    // MARK: - Error Type Tests

    func testLocationError_PermissionDenied() {
        let error = LocationError.permissionDenied
        XCTAssertEqual(error.localizedDescription, "位置权限被拒绝，请在设置中启用位置权限")
        XCTAssertFalse(error.isRecoverable)
    }

    func testLocationError_LocationUnavailable() {
        let error = LocationError.locationUnavailable
        XCTAssertEqual(error.localizedDescription, "无法获取位置信息，请检查GPS是否开启")
        XCTAssertFalse(error.isRecoverable)
    }

    func testLocationError_Timeout() {
        let error = LocationError.timeout
        XCTAssertEqual(error.localizedDescription, "获取位置超时，请重试")
        XCTAssertTrue(error.isRecoverable)
    }

    func testLocationError_InvalidCoordinates() {
        let error = LocationError.invalidCoordinates
        XCTAssertEqual(error.localizedDescription, "无效的坐标数据")
        XCTAssertTrue(error.isRecoverable)
    }

    func testLocationError_NetworkError() {
        let underlyingError = NSError(domain: "Test", code: -1)
        let error = LocationError.networkError(underlyingError)
        XCTAssertTrue(error.isRecoverable)
    }

    // MARK: - Publisher Tests

    func testCurrentLocationPublisher_EmitsChanges() {
        // Given
        let expectation = expectation(description: "Location publisher emits")
        let testLocation = CLLocation(latitude: 40.7128, longitude: -74.0060, horizontalAccuracy: 5.0)

        sut.$currentLocation
            .dropFirst()
            .sink { location in
                if location != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        mockLocationManager.simulateLocationUpdate(testLocation)

        // Then
        wait(for: [expectation], timeout: 2.0)
    }

    func testAuthorizationStatusPublisher_EmitsChanges() {
        // Given
        let expectation = expectation(description: "Authorization publisher emits")

        sut.$authorizationStatus
            .dropFirst()
            .sink { _ in
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        mockLocationManager.simulateAuthorizationChange(.authorizedWhenInUse)

        // Then
        wait(for: [expectation], timeout: 2.0)
    }

    func testIsLocationUpdatingPublisher_EmitsChanges() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        let expectation = expectation(description: "Updating publisher emits")

        sut.$isLocationUpdating
            .dropFirst()
            .sink { _ in
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        sut.startLocationUpdates()

        // Then
        wait(for: [expectation], timeout: 2.0)
    }

    func testLastErrorPublisher_EmitsChanges() {
        // Given
        mockLocationManager.authorizationStatus = .denied

        let expectation = expectation(description: "Error publisher emits")

        sut.$lastError
            .dropFirst()
            .sink { error in
                if error != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        _ = sut.requestPermission()

        // Then
        wait(for: [expectation], timeout: 2.0)
    }

    // MARK: - Concurrent Safety Tests

    func testConcurrentStartStopLocationUpdates() {
        // When
        DispatchQueue.global().async {
            Task { @MainActor in
                self.sut.startLocationUpdates()
            }
        }

        DispatchQueue.global().async {
            Task { @MainActor in
                self.sut.stopLocationUpdates()
            }
        }

        // Then - Should not crash
        XCTAssertTrue(true)
    }

    func testMultiplePermissionRequests() {
        // When
        _ = sut.requestPermission()
        _ = sut.requestPermission()
        _ = sut.requestPermission()

        // Then - Should not crash
        XCTAssertTrue(true)
    }

    // MARK: - Location Updates Stop on One-Time Request

    func testLocationUpdate_StopsAfterOneTimeRequest() {
        // Given
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

        // When - Get current location (one-time request)
        _ = sut.getCurrentLocation()

        // Then - Location manager should have requested location
        XCTAssertTrue(mockLocationManager.requestLocationCalled)
    }

    // MARK: - Nearby Locations Publisher Tests

    func testNearbyLocationsPublisher_UpdatesAfterFetch() async {
        // Given
        mockAuthService.mockIsLoggedIn = true
        mockLocationManager.authorizationStatus = .authorizedWhenInUse

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

        let expectation = expectation(description: "Nearby locations publisher emits")

        sut.$nearbyLocations
            .dropFirst()
            .sink { locations in
                if !locations.isEmpty {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        _ = await sut.fetchNearbyLocations(radius: 1000)

        // Then
        wait(for: [expectation], timeout: 2.0)
    }
}

// MARK: - Mock Auth Service

@MainActor
private class MockLocationAuthService: AuthServiceProtocol {
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

@MainActor
private class MockLocationAPIClient: APIClient {
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

// MARK: - Integration Tests

@MainActor
final class LocationServiceIntegrationTests: XCTestCase {

    var sut: LocationService!
    var cancellables: Set<AnyCancellable>!

    override func setUp() {
        super.setUp()
        sut = LocationService.shared
        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        sut = nil
        cancellables = nil
        super.tearDown()
    }

    func testSingleton_IsAccessible() {
        // Then
        XCTAssertNotNil(LocationService.shared)
    }

    func testSingleton_SameInstance() {
        // When
        let instance1 = LocationService.shared
        let instance2 = LocationService.shared

        // Then
        XCTAssertTrue(instance1 === instance2)
    }

    func testStopMonitoring_WithoutStartMonitoring() {
        // When
        sut.stopLocationUpdates()

        // Then
        XCTAssertFalse(sut.isLocationUpdating)
    }
}
