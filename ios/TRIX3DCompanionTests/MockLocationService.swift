//
//  MockLocationService.swift
//  TRIX3DCompanionTests
//
//  Mock implementation of LocationServiceProtocol for testing
//

import Foundation
import CoreLocation
@testable import TRIX3DCompanion

/// Mock implementation of LocationServiceProtocol for unit testing
final class MockLocationService: LocationServiceProtocol {

    // MARK: - Mock Properties

    var currentLocation: CLLocation?
    var authorizationStatus: CLAuthorizationStatus = .notDetermined
    var isLocationUpdating: Bool = false

    // Mock configuration
    var mockPermissionResult: Bool = true
    var mockFetchNearbyLocationsResult: Result<[Location], LocationError>?
    var mockShareLocationResult: Result<Bool, LocationError>?
    var mockShouldReturnCachedLocation: Bool = true

    // Call tracking
    var requestPermissionCallCount: Int = 0
    var getCurrentLocationCallCount: Int = 0
    var startLocationUpdatesCallCount: Int = 0
    var stopLocationUpdatesCallCount: Int = 0
    var fetchNearbyLocationsCallCount: Int = 0
    var shareLocationCallCount: Int = 0

    // MARK: - Initialization

    init() {}

    // MARK: - LocationServiceProtocol

    func requestPermission() -> Bool {
        requestPermissionCallCount += 1
        return mockPermissionResult
    }

    func getCurrentLocation() -> CLLocation? {
        getCurrentLocationCallCount += 1

        // Return cached location if available and configured to do so
        if mockShouldReturnCachedLocation, let location = currentLocation {
            return location
        }

        return currentLocation
    }

    func startLocationUpdates() {
        startLocationUpdatesCallCount += 1
        isLocationUpdating = true
    }

    func stopLocationUpdates() {
        stopLocationUpdatesCallCount += 1
        isLocationUpdating = false
    }

    func fetchNearbyLocations(radius: Double) async -> LocationResult<[Location]> {
        fetchNearbyLocationsCallCount += 1
        return mockFetchNearbyLocationsResult ?? .success([])
    }

    func shareLocation(with companionId: String) async -> LocationResult<Bool> {
        shareLocationCallCount += 1
        return mockShareLocationResult ?? .success(true)
    }

    // MARK: - Helper Methods

    func setMockLocation(latitude: Double, longitude: Double) {
        currentLocation = CLLocation(
            latitude: latitude,
            longitude: longitude
        )
    }

    func setAuthorizationStatus(_ status: CLAuthorizationStatus) {
        authorizationStatus = status
    }

    func resetCallCounts() {
        requestPermissionCallCount = 0
        getCurrentLocationCallCount = 0
        startLocationUpdatesCallCount = 0
        stopLocationUpdatesCallCount = 0
        fetchNearbyLocationsCallCount = 0
        shareLocationCallCount = 0
    }
}
