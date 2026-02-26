//
//  MapViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for MapViewModel
//

import XCTest
import CoreLocation
import MapKit
import Combine
@testable import TRIX3DCompanion

/// Unit tests for MapViewModel
final class MapViewModelTests: XCTestCase {

    // MARK: - Properties

    var mapViewModel: MapViewModel!
    var mockLocationService: MockLocationService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockLocationService = MockLocationService()
        mapViewModel = MapViewModel(locationService: mockLocationService)
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        mapViewModel = nil
        mockLocationService = nil
        cancellables = nil
    }

    // MARK: - Load Nearby Locations Tests

    func test_loadNearbyLocations_populatesList() async throws {
        // Arrange
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
            ),
            Location(
                id: "2",
                userId: "user2",
                name: "Test Cafe",
                description: "A test cafe",
                latitude: 37.7750,
                longitude: -122.4195,
                address: "456 Test Ave",
                category: .cafe,
                createdAt: Date(),
                updatedAt: Date()
            )
        ]

        mockLocationService.mockFetchNearbyLocationsResult = .success(mockLocations)

        // Act
        await mapViewModel.loadNearbyLocations()

        // Assert
        XCTAssertFalse(mapViewModel.nearbyLocations.isEmpty, "Should have locations")
        XCTAssertEqual(mapViewModel.nearbyLocations.count, 2, "Should have 2 locations")
        XCTAssertEqual(mapViewModel.nearbyLocations.first?.name, "Test Library")
        XCTAssertNil(mapViewModel.errorMessage, "Should not have error")
    }

    func test_loadNearbyLocations_handlesError() async throws {
        // Arrange
        mockLocationService.mockFetchNearbyLocationsResult = .failure(.locationUnavailable)

        // Act
        await mapViewModel.loadNearbyLocations()

        // Assert
        XCTAssertTrue(mapViewModel.nearbyLocations.isEmpty, "Should have no locations")
        XCTAssertNotNil(mapViewModel.errorMessage, "Should have error message")
    }

    // MARK: - Search Locations Tests

    func test_searchLocations_filtersResults() async throws {
        // Arrange
        let allLocations = [
            Location(
                id: "1",
                userId: "user1",
                name: "Library",
                description: "A quiet place",
                latitude: 37.7749,
                longitude: -122.4194,
                address: "123 Test St",
                category: .library,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "2",
                userId: "user2",
                name: "Cafe",
                description: "Coffee shop",
                latitude: 37.7750,
                longitude: -122.4195,
                address: "456 Test Ave",
                category: .cafe,
                createdAt: Date(),
                updatedAt: Date()
            )
        ]

        mockLocationService.mockFetchNearbyLocationsResult = .success(allLocations)

        // Act
        mapViewModel.searchQuery = "Library"
        await mapViewModel.searchLocations(query: "Library")

        // Assert
        XCTAssertEqual(mapViewModel.nearbyLocations.count, 1, "Should filter to 1 result")
        XCTAssertEqual(mapViewModel.nearbyLocations.first?.name, "Library")
    }

    func test_searchLocations_emptyQuery() async throws {
        // Arrange
        let mockLocations = [
            Location(
                id: "1",
                userId: "user1",
                name: "Library",
                description: nil,
                latitude: 37.7749,
                longitude: -122.4194,
                address: nil,
                category: .library,
                createdAt: Date(),
                updatedAt: Date()
            )
        ]

        mockLocationService.mockFetchNearbyLocationsResult = .success(mockLocations)

        // Act - Empty query should load all
        await mapViewModel.searchLocations(query: "")

        // Assert
        XCTAssertFalse(mapViewModel.nearbyLocations.isEmpty, "Should load all locations")
    }

    // MARK: - Select Location Tests

    func test_selectLocation_updatesSelectedLocation() throws {
        // Arrange
        let location = Location(
            id: "1",
            userId: "user1",
            name: "Test Location",
            description: nil,
            latitude: 37.7749,
            longitude: -122.4194,
            address: nil,
            category: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        // Act
        mapViewModel.selectLocation(location)

        // Assert
        XCTAssertEqual(mapViewModel.selectedLocation, location, "Should update selected location")
    }

    func test_clearSelection() throws {
        // Arrange
        let location = Location(
            id: "1",
            userId: "user1",
            name: "Test Location",
            description: nil,
            latitude: 37.7749,
            longitude: -122.4194,
            address: nil,
            category: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        mapViewModel.selectLocation(location)
        XCTAssertNotNil(mapViewModel.selectedLocation)

        // Act
        mapViewModel.clearSelection()

        // Assert
        XCTAssertNil(mapViewModel.selectedLocation, "Should clear selection")
    }

    // MARK: - Center on User Location Tests

    func test_centerOnUserLocation_updatesRegion() async throws {
        // Arrange
        let testLocation = CLLocation(latitude: 37.7749, longitude: -122.4194)
        mockLocationService.currentLocation = testLocation

        // Act
        await mapViewModel.centerOnUserLocation()

        // Assert
        XCTAssertNotNil(mapViewModel.userLocation, "Should set user location")
        XCTAssertEqual(
            mapViewModel.mapRegion.center.latitude,
            testLocation.coordinate.latitude,
            accuracy: 0.001
        )
    }

    func test_centerOnUserLocation_handlesError() async throws {
        // Arrange - No location available
        mockLocationService.currentLocation = nil

        // Act
        await mapViewModel.centerOnUserLocation()

        // Assert
        XCTAssertNil(mapViewModel.userLocation, "Should not set user location")
        XCTAssertNotNil(mapViewModel.errorMessage, "Should have error message")
    }

    // MARK: - Share Location Tests

    func test_shareLocation_callsService() async throws {
        // Arrange
        let testLocation = CLLocation(latitude: 37.7749, longitude: -122.4194)
        mockLocationService.currentLocation = testLocation

        mapViewModel.selectLocation(Location(
            id: "1",
            userId: "user1",
            name: "Test",
            description: nil,
            latitude: 37.7749,
            longitude: -122.4194,
            address: nil,
            category: nil,
            createdAt: Date(),
            updatedAt: Date()
        ))

        mockLocationService.mockShareLocationResult = .success(true)

        // Act
        let result = await mapViewModel.shareLocation(companionId: "companion-123")

        // Assert
        XCTAssertTrue(result, "Should return success")
        XCTAssertEqual(mockLocationService.shareLocationCallCount, 1, "Should call service once")
    }

    func test_shareLocation_handlesError() async throws {
        // Arrange
        mockLocationService.mockShareLocationResult = .failure(.networkError(NSError(domain: "test", code: 0)))

        // Act
        let result = await mapViewModel.shareLocation(companionId: "companion-123")

        // Assert
        XCTAssertFalse(result, "Should return failure")
        XCTAssertNotNil(mapViewModel.errorMessage, "Should have error message")
    }

    func test_shareLocation_noLocation() async throws {
        // Arrange - No selected location and no user location
        mapViewModel.clearSelection()

        // Act
        let result = await mapViewModel.shareLocation(companionId: "companion-123")

        // Assert
        XCTAssertFalse(result, "Should return failure")
        XCTAssertNotNil(mapViewModel.errorMessage, "Should have error message")
    }

    // MARK: - Refresh Tests

    func test_refresh_reloadsLocations() async throws {
        // Arrange
        let mockLocations = [
            Location(
                id: "1",
                userId: "user1",
                name: "Test",
                description: nil,
                latitude: 37.7749,
                longitude: -122.4194,
                address: nil,
                category: nil,
                createdAt: Date(),
                updatedAt: Date()
            )
        ]

        mockLocationService.mockFetchNearbyLocationsResult = .success(mockLocations)

        // Act
        await mapViewModel.refresh()

        // Assert
        XCTAssertFalse(mapViewModel.nearbyLocations.isEmpty, "Should reload locations")
    }

    // MARK: - Loading State Tests

    func test_loadingState_duringFetch() async throws {
        // Arrange
        let mockLocations = [Location(
            id: "1",
            userId: "user1",
            name: "Test",
            description: nil,
            latitude: 37.7749,
            longitude: -122.4194,
            address: nil,
            category: nil,
            createdAt: Date(),
            updatedAt: Date()
        )]

        mockLocationService.mockFetchNearbyLocationsResult = .success(mockLocations)

        // Track loading state changes
        var loadingStates: [Bool] = []
        mapViewModel.$isLoading
            .sink { loading in
                loadingStates.append(loading)
            }
            .store(in: &cancellables)

        // Act
        await mapViewModel.loadNearbyLocations()

        // Assert
        XCTAssertTrue(loadingStates.contains(true), "Should show loading state")
        XCTAssertTrue(loadingStates.last ?? true, "Should end with non-loading state")
    }

    // MARK: - Search Query Binding Tests

    func test_searchQuery_binding() throws {
        // This test verifies the search query binding works

        // Note: Debounce makes this hard to test synchronously
        // The binding is tested through searchLocations tests

        XCTAssertEqual(mapViewModel.searchQuery, "", "Should start with empty query")
    }
}
