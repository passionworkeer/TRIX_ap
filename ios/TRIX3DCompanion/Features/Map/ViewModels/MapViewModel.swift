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

// MARK: - Friend Map Location Model

/// Friend location on map for displaying user avatars
struct FriendMapLocation: Identifiable {
    let id: String
    let name: String
    let avatarUrl: String?
    let latitude: Double
    let longitude: Double
    let isStudying: Bool
    let status: String  // "online", "away", "offline"

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

// MARK: - Heat Zone Model

/// Heat zone for displaying activity intensity on map
struct HeatZone: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
    let color: Color
    let size: CGFloat
}

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

    /// Whether to show heat map overlay
    @Published var showHeatMap: Bool = true

    /// Friend locations on map
    @Published var friendLocations: [FriendMapLocation] = []

    // MARK: - Dependencies

    private let locationService: LocationServiceProtocol
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Constants

    /// Default region span
    private let defaultSpan = MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)

    /// Default coordinate (Shanghai Lujiazui)
    private let defaultCoordinate = CLLocationCoordinate2D(latitude: 31.2304, longitude: 121.4737)

    /// Search radius in meters
    private let searchRadius: Double = 5000

    /// Clustering distance in meters (for coordinate aggregation)
    private let clusteringDistance: Double = 50 // 50m clustering distance

    // MARK: - Initialization

    /// Initialize MapViewModel
    /// - Parameter locationService: Location service dependency
    init(locationService: LocationServiceProtocol = LocationService.shared) {
        self.locationService = locationService

        // Initialize region with default location (Shanghai Lujiazui)
        self.region = MKCoordinateRegion(
            center: defaultCoordinate,
            span: defaultSpan
        )

        // Setup bindings
        setupBindings()

        // Check location permission
        checkLocationPermission()

        // Don't load mock data - use real API data for 真机测试
    }

    // MARK: - Mock Data

    /// Load mock data for demonstration
    private func loadMockData() {
        // Load mock places
        loadMockPlaces()

        // Load mock friends
        loadMockFriends()
    }

    /// Load mock places (similar to Web端的 mockPlaces)
    private func loadMockPlaces() {
        let baseLat = 31.2304
        let baseLng = 121.4737

        let mockPlaces: [Location] = [
            Location(
                id: "place-1",
                userId: "system",
                name: "星巴克咖啡",
                description: "和朋友聚会喝咖啡",
                latitude: baseLat + 0.001,
                longitude: baseLng + 0.002,
                address: "陆家嘴环路",
                category: .cafe,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-2",
                userId: "system",
                name: "海底捞火锅",
                description: "热闹的火锅聚餐",
                latitude: baseLat - 0.001,
                longitude: baseLng + 0.003,
                address: "世纪大道",
                category: .other,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-3",
                userId: "system",
                name: "万达影城",
                description: "最新电影上映中",
                latitude: baseLat + 0.002,
                longitude: baseLng - 0.002,
                address: "浦东南路",
                category: .other,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-4",
                userId: "system",
                name: "静安雕塑公园",
                description: "适合散步和聊天",
                latitude: baseLat - 0.002,
                longitude: baseLng - 0.003,
                address: "静安区",
                category: .park,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-5",
                userId: "system",
                name: "24小时自习室",
                description: "安静的学习环境",
                latitude: baseLat + 0.003,
                longitude: baseLng + 0.001,
                address: "浦东新区",
                category: .library,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-6",
                userId: "system",
                name: "KTV 唱歌",
                description: "聚会唱K放松",
                latitude: baseLat - 0.003,
                longitude: baseLng + 0.001,
                address: "长宁区",
                category: .other,
                createdAt: Date(),
                updatedAt: Date()
            )
        ]

        allLocations = mockPlaces
        filteredLocations = mockPlaces
    }

    /// Load mock friend locations (similar to Web端的 mockFriends)
    private func loadMockFriends() {
        let baseLat = 31.2304
        let baseLng = 121.4737

        // Helper to generate offset positions
        let offsets: [(Double, Double)] = [
            (0.001, 0.002),
            (-0.001, 0.003),
            (0.002, -0.002)
        ]

        friendLocations = [
            FriendMapLocation(
                id: "friend-1",
                name: "Ava",
                avatarUrl: nil,  // Will use default avatar
                latitude: baseLat + offsets[0].0,
                longitude: baseLng + offsets[0].1,
                isStudying: true,
                status: "online"
            ),
            FriendMapLocation(
                id: "friend-2",
                name: "Leo",
                avatarUrl: nil,
                latitude: baseLat + offsets[1].0,
                longitude: baseLng + offsets[1].1,
                isStudying: false,
                status: "online"
            ),
            FriendMapLocation(
                id: "friend-3",
                name: "Mia",
                avatarUrl: nil,
                latitude: baseLat + offsets[2].0,
                longitude: baseLng + offsets[2].1,
                isStudying: true,
                status: "away"
            )
        ]
    }

    /// Get heat zones for map overlay
    var heatZones: [HeatZone] {
        guard showHeatMap else { return [] }

        let baseLat = 31.231
        let baseLng = 121.474

        return [
            HeatZone(
                coordinate: CLLocationCoordinate2D(latitude: baseLat, longitude: baseLng),
                color: Color.red.opacity(0.15),
                size: 300
            ),
            HeatZone(
                coordinate: CLLocationCoordinate2D(latitude: baseLat - 0.002, longitude: baseLng - 0.002),
                color: Color.blue.opacity(0.12),
                size: 250
            ),
            HeatZone(
                coordinate: CLLocationCoordinate2D(latitude: baseLat + 0.002, longitude: baseLng + 0.002),
                color: Color.purple.opacity(0.1),
                size: 280
            )
        ]
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
            if locations.isEmpty {
                // Use mock data as fallback when API returns empty
                loadMockData()
            } else {
                allLocations = locations
                filteredLocations = locations
                applyCategoryFilter()
            }

        case .failure(let error):
            errorMessage = error.errorDescription
            // Use mock data as fallback when API fails
            loadMockData()
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

    /// Select a friend on the map
    /// - Parameter friend: Friend to select
    func selectFriend(_ friend: FriendMapLocation) {
        // Center map on friend's location
        withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
            region = MKCoordinateRegion(
                center: friend.coordinate,
                span: defaultSpan
            )
        }

        // TODO: Show friend detail popup/sheet
        SecureLogger.shared.debug("Selected friend: \(friend.name)")
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
