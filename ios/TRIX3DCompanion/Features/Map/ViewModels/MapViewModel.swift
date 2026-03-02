//
//  MapViewModel.swift
//  TRIX3DCompanion
//
//  Map feature ViewModel - manages map state and location interactions
//

import Foundation
import MapKit
import CoreLocation
import Combine
import SwiftUI

// MARK: - Map ViewModel

/// Map view model managing map state, locations, and search
@MainActor
final class MapViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Current map region
    @Published var region: MKCoordinateRegion

    /// Currently selected location
    @Published var selectedLocation: Location?

    /// Whether to show location detail sheet
    @Published var showLocationDetail: Bool = false

    /// Search query text
    @Published var searchQuery: String = ""

    /// Filtered locations based on search
    @Published var filteredLocations: [Location] = []

    /// All nearby locations
    @Published var allLocations: [Location] = []

    /// Whether currently loading locations
    @Published var isLoading: Bool = false

    /// Error message to display
    @Published var errorMessage: String?

    /// Whether location permission is granted
    @Published var hasLocationPermission: Bool = false

    /// Whether user location is available
    @Published var isUserLocationAvailable: Bool = false

    /// Selected category filter
    @Published var selectedCategory: LocationCategory?

    // MARK: - Dependencies

    private let locationService: LocationServiceProtocol
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Constants

    /// Default region span
    private let defaultSpan = MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)

    /// Default coordinate (Beijing, China)
    private let defaultCoordinate = CLLocationCoordinate2D(latitude: 39.9042, longitude: 116.4074)

    /// Search radius in meters
    private let searchRadius: Double = 5000

    /// Clustering distance in meters (for coordinate aggregation)
    private let clusteringDistance: Double = 50 // 50m clustering distance

    // MARK: - Initialization

    /// Initialize MapViewModel
    /// - Parameter locationService: Location service dependency
    init(locationService: LocationServiceProtocol = LocationService.shared) {
        self.locationService = locationService

        // Initialize region with default location
        self.region = MKCoordinateRegion(
            center: defaultCoordinate,
            span: defaultSpan
        )

        // Setup bindings
        setupBindings()

        // Check location permission
        checkLocationPermission()
    }

    // MARK: - Setup

    /// Setup Combine bindings
    private func setupBindings() {
        // Filter locations when search query changes
        $searchQuery
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] query in
                self?.filterLocations(query: query)
            }
            .store(in: &cancellables)

        // Filter locations when category changes
        $selectedCategory
            .sink { [weak self] _ in
                self?.applyCategoryFilter()
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Check location permission status
    func checkLocationPermission() {
        let status = locationService.authorizationStatus
        hasLocationPermission = (status == .authorizedWhenInUse || status == .authorizedAlways)
    }

    /// Request location permission
    func requestLocationPermission() {
        _ = locationService.requestPermission()
        checkLocationPermission()
    }

    /// Center map on user's current location
    func centerOnUserLocation() {
        guard let location = locationService.currentLocation else {
            // Start location updates if not available
            locationService.startLocationUpdates()
            return
        }

        withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
            region = MKCoordinateRegion(
                center: location.coordinate,
                span: defaultSpan
            )
        }

        isUserLocationAvailable = true
    }

    /// Load nearby locations
    func loadNearbyLocations() async {
        isLoading = true
        errorMessage = nil

        let result = await locationService.fetchNearbyLocations(radius: searchRadius)

        switch result {
        case .success(let locations):
            allLocations = locations
            filteredLocations = locations
            applyCategoryFilter()

        case .failure(let error):
            errorMessage = error.errorDescription
            allLocations = []
            filteredLocations = []
        }

        isLoading = false
    }

    /// Select a location
    /// - Parameter location: Location to select
    func selectLocation(_ location: Location) {
        selectedLocation = location
        showLocationDetail = true

        // Center map on selected location
        withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
            region = MKCoordinateRegion(
                center: location.coordinate,
                span: defaultSpan
            )
        }
    }

    /// Share location with companion
    /// - Parameter companionId: Companion device ID
    func shareLocation(with companionId: String) async {
        let result = await locationService.shareLocation(with: companionId)

        switch result {
        case .success:
            // Location shared successfully
            errorMessage = nil

        case .failure(let error):
            errorMessage = error.errorDescription
        }
    }

    /// Clear selected location
    func clearSelectedLocation() {
        selectedLocation = nil
        showLocationDetail = false
    }

    /// Clear search query
    func clearSearch() {
        searchQuery = ""
        filteredLocations = allLocations
        applyCategoryFilter()
    }

    /// Clear error message
    func clearError() {
        errorMessage = nil
    }

    // MARK: - Category Filter

    /// Set category filter
    /// - Parameter category: Category to filter by, or nil for all
    func setCategoryFilter(_ category: LocationCategory?) {
        selectedCategory = category
    }

    // MARK: - Private Methods

    /// Filter locations based on search query
    /// - Parameter query: Search query string
    private func filterLocations(query: String) {
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        guard !trimmedQuery.isEmpty else {
            filteredLocations = allLocations
            applyCategoryFilter()
            return
        }

        filteredLocations = allLocations.filter { location in
            location.name.lowercased().contains(trimmedQuery) ||
            (location.address?.lowercased().contains(trimmedQuery) ?? false) ||
            (location.description?.lowercased().contains(trimmedQuery) ?? false)
        }

        applyCategoryFilter()
    }

    /// Apply category filter to locations
    private func applyCategoryFilter() {
        guard let category = selectedCategory else {
            // If no category selected, keep current search-filtered results
            return
        }

        // If we have a search query, filter from already filtered results
        let sourceLocations = searchQuery.isEmpty ? allLocations : filteredLocations

        filteredLocations = sourceLocations.filter { location in
            location.category == category
        }
    }
}

// MARK: - Map Annotations Helper

extension MapViewModel {

    /// Get marker color for location category
    /// - Parameter location: Location to get color for
    /// - Returns: Color for the marker
    func markerColor(for location: Location) -> Color {
        switch location.category {
        case .school:
            return .blue
        case .library:
            return .purple
        case .cafe:
            return .orange
        case .home:
            return .green
        case .park:
            return .mint
        case .other:
            return .gray
        case .none:
            return .secondary
        }
    }

    /// Get icon name for location category
    /// - Parameter location: Location to get icon for
    /// - Returns: SF Symbol name
    func iconName(for location: Location) -> String {
        switch location.category {
        case .school:
            return "graduationcap.fill"
        case .library:
            return "books.vertical.fill"
        case .cafe:
            return "cup.and.saucer.fill"
        case .home:
            return "house.fill"
        case .park:
            return "tree.fill"
        case .other:
            return "mappin.circle.fill"
        case .none:
            return "mappin.circle"
        }
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension MapViewModel {
    /// Create preview view model with sample data
    static var preview: MapViewModel {
        let vm = MapViewModel()
        vm.allLocations = [
            Location(
                id: "1",
                userId: "user1",
                name: "Central Library",
                description: "Main city library with study rooms",
                latitude: 39.9042,
                longitude: 116.4074,
                address: "123 Library Street",
                category: .library,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "2",
                userId: "user1",
                name: "Coffee Corner",
                description: "Cozy cafe with free WiFi",
                latitude: 39.9100,
                longitude: 116.4100,
                address: "456 Coffee Lane",
                category: .cafe,
                createdAt: Date(),
                updatedAt: Date()
            )
        ]
        vm.filteredLocations = vm.allLocations
        return vm
    }
}
#endif
