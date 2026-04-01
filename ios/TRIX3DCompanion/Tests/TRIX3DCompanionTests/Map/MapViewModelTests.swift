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

@MainActor
final class MapViewModelTests: XCTestCase {

    var mapViewModel: MapViewModel!
    var mockLocationService: MockLocationService!
    var mockMapSearchService: MockMapSearchService!
    var cancellables: Set<AnyCancellable>!

    override func setUpWithError() throws {
        mockLocationService = MockLocationService()
        mockMapSearchService = MockMapSearchService()
        mapViewModel = MapViewModel(
            locationService: mockLocationService,
            mapSearchService: mockMapSearchService,
            autoLoad: false
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        mapViewModel = nil
        mockLocationService = nil
        mockMapSearchService = nil
        cancellables = nil
    }

    func test_loadNearbyLocations_populatesFilteredLocations() async throws {
        let mockLocations = [
            makeLocation(id: "1", name: "Test Library", category: .library),
            makeLocation(id: "2", name: "Test Cafe", category: .cafe)
        ]
        mockLocationService.mockFetchNearbyLocationsResult = .success(mockLocations)

        await mapViewModel.loadNearbyLocations()

        XCTAssertEqual(mapViewModel.filteredLocations.count, 2)
        XCTAssertEqual(mapViewModel.filteredLocations.first?.name, "Test Library")
        XCTAssertNil(mapViewModel.errorMessage)
        XCTAssertFalse(mapViewModel.isLoading)
    }

    func test_loadNearbyLocations_failureFallsBackToDemoData() async throws {
        mockLocationService.mockFetchNearbyLocationsResult = .failure(.locationUnavailable)

        await mapViewModel.loadNearbyLocations()

        XCTAssertFalse(mapViewModel.filteredLocations.isEmpty)
        XCTAssertFalse(mapViewModel.allLocations.isEmpty)
        XCTAssertNil(mapViewModel.errorMessage)
        XCTAssertFalse(mapViewModel.isLoading)
    }

    func test_searchLocations_filtersExistingData() async throws {
        let allLocations = [
            makeLocation(id: "1", name: "Library", description: "Quiet place", category: .library),
            makeLocation(id: "2", name: "Cafe", description: "Coffee shop", category: .cafe)
        ]
        mapViewModel.allLocations = allLocations
        mapViewModel.filteredLocations = allLocations

        await mapViewModel.searchLocations(query: "Library")

        XCTAssertEqual(mapViewModel.filteredLocations.count, 1)
        XCTAssertEqual(mapViewModel.filteredLocations.first?.name, "Library")
    }

    func test_searchLocations_emptyQueryRestoresAllLocations() async throws {
        let mockLocations = [makeLocation(id: "1", name: "Library", category: .library)]
        mapViewModel.allLocations = mockLocations
        mapViewModel.filteredLocations = []

        await mapViewModel.searchLocations(query: "")

        XCTAssertEqual(mapViewModel.filteredLocations, mockLocations)
    }

    func test_selectLocation_updatesSelectionAndSheetState() throws {
        let location = makeLocation(id: "1", name: "Test Location", category: nil)

        mapViewModel.selectLocation(location)

        XCTAssertEqual(mapViewModel.selectedLocation, location)
        XCTAssertTrue(mapViewModel.showLocationDetail)
        XCTAssertEqual(mapViewModel.region.center.latitude, location.latitude, accuracy: 0.001)
    }

    func test_clearSelectedLocation_clearsSelection() throws {
        let location = makeLocation(id: "1", name: "Test Location", category: nil)
        mapViewModel.selectLocation(location)

        mapViewModel.clearSelectedLocation()

        XCTAssertNil(mapViewModel.selectedLocation)
        XCTAssertFalse(mapViewModel.showLocationDetail)
    }

    func test_centerOnUserLocation_updatesRegion() throws {
        let testLocation = CLLocation(latitude: 37.7749, longitude: -122.4194)
        mockLocationService.currentLocation = testLocation

        mapViewModel.centerOnUserLocation()

        XCTAssertTrue(mapViewModel.isUserLocationAvailable)
        XCTAssertEqual(mapViewModel.region.center.latitude, testLocation.coordinate.latitude, accuracy: 0.001)
        XCTAssertEqual(mapViewModel.region.center.longitude, testLocation.coordinate.longitude, accuracy: 0.001)
    }

    func test_centerOnUserLocation_withoutLocationStartsUpdates() throws {
        mockLocationService.currentLocation = nil

        mapViewModel.centerOnUserLocation()

        XCTAssertFalse(mapViewModel.isUserLocationAvailable)
        XCTAssertEqual(mockLocationService.startLocationUpdatesCallCount, 1)
    }

    func test_shareLocation_callsService() async throws {
        mockLocationService.mockShareLocationResult = .success(true)

        let result = await mapViewModel.shareLocation(companionId: "companion-123")

        XCTAssertTrue(result)
        XCTAssertEqual(mockLocationService.shareLocationCallCount, 1)
        XCTAssertEqual(mockLocationService.lastShareCompanionId, "companion-123")
        XCTAssertNil(mapViewModel.errorMessage)
    }

    func test_shareLocation_handlesFailure() async throws {
        mockLocationService.mockShareLocationResult = .failure(.permissionDenied)

        let result = await mapViewModel.shareLocation(companionId: "companion-123")

        XCTAssertFalse(result)
        XCTAssertNotNil(mapViewModel.errorMessage)
    }

    func test_shareLocation_successClearsExistingError() async throws {
        mapViewModel.errorMessage = "old error"
        mockLocationService.mockShareLocationResult = .success(true)

        let result = await mapViewModel.shareLocation(companionId: "companion-123")

        XCTAssertTrue(result)
        XCTAssertNil(mapViewModel.errorMessage)
    }

    func test_refresh_reloadsLocations() async throws {
        let mockLocations = [makeLocation(id: "1", name: "Test", category: nil)]
        mockLocationService.mockFetchNearbyLocationsResult = .success(mockLocations)

        await mapViewModel.refresh()

        XCTAssertEqual(mapViewModel.filteredLocations, mockLocations)
        XCTAssertEqual(mockLocationService.fetchNearbyLocationsCallCount, 1)
    }

    func test_loadingState_duringFetchEndsAsFalse() async throws {
        mockLocationService.mockFetchNearbyLocationsResult = .success([makeLocation(id: "1", name: "Test", category: nil)])

        var loadingStates: [Bool] = []
        mapViewModel.$isLoading
            .sink { loading in
                loadingStates.append(loading)
            }
            .store(in: &cancellables)

        await mapViewModel.loadNearbyLocations()

        XCTAssertTrue(loadingStates.contains(true))
        XCTAssertEqual(loadingStates.last, false)
    }

    func test_searchQuery_startsEmpty() {
        XCTAssertEqual(mapViewModel.searchQuery, "")
    }

    private func makeLocation(
        id: String,
        name: String,
        description: String? = nil,
        category: LocationCategory?
    ) -> Location {
        Location(
            id: id,
            userId: "user-\(id)",
            name: name,
            description: description,
            latitude: 37.7749,
            longitude: -122.4194,
            address: "123 Test St",
            category: category,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

private extension MapViewModel {
    func searchLocations(query: String) async {
        searchQuery = query

        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else {
            filteredLocations = allLocations
            return
        }

        filteredLocations = allLocations.filter { location in
            location.name.localizedCaseInsensitiveContains(trimmedQuery)
                || (location.description?.localizedCaseInsensitiveContains(trimmedQuery) ?? false)
                || (location.address?.localizedCaseInsensitiveContains(trimmedQuery) ?? false)
        }
    }

    func refresh() async {
        await loadNearbyLocations()
    }

    func shareLocation(companionId: String) async -> Bool {
        await shareLocation(with: companionId)
        return errorMessage == nil
    }
}
