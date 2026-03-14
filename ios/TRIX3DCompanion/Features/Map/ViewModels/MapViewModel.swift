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

    /// Whether to show location permission banner (can be dismissed)
    @Published var showLocationPermissionBanner: Bool = true

    /// Whether user location is available
    @Published var isUserLocationAvailable: Bool = false

    /// Selected category filter
    @Published var selectedCategory: LocationCategory?

    /// Whether to show heat map overlay
    @Published var showHeatMap: Bool = true

    /// Friend locations on map
    @Published var friendLocations: [FriendMapLocation] = []

    /// Currently selected friend
    @Published var selectedFriend: FriendMapLocation?

    /// Whether to show friend detail sheet
    @Published var showFriendDetail: Bool = false

    // MARK: - Dependencies

    private let locationService: any LocationServiceProtocol
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
    init(locationService: (any LocationServiceProtocol)? = nil) {
        self.locationService = locationService ?? LocationService.shared

        // Initialize region with default location (Shanghai Lujiazui)
        self.region = MKCoordinateRegion(
            center: defaultCoordinate,
            span: defaultSpan
        )

        // Setup bindings
        setupBindings()

        // Check location permission
        checkLocationPermission()

        // Load data from API (falls back to mock for demo)
        Task {
            await loadLocationsFromAPI()
        }

        // Load friend locations (falls back to mock for demo)
        Task {
            await loadFriendLocationsFromAPI()
        }
    }

    // MARK: - API Data Loading

    /// Load locations from backend API
    private func loadLocationsFromAPI() async {
        isLoading = true
        errorMessage = nil

        do {
            let locations: [Location] = try await APIClient.shared.get(.placeNearby)
            // If API returns empty, fallback to mock data for demo
            if locations.isEmpty {
                loadMockData()
            } else {
                allLocations = locations
                filteredLocations = locations
                applyCategoryFilter()
            }
        } catch {
            // API failed - fallback to mock data for demo
            print("[MapViewModel] loadLocationsFromAPI failed: \(error.localizedDescription), using mock data")
            loadMockData()
        }

        isLoading = false
    }

    /// Load friend locations from API
    /// - Note: Requires backend API endpoint (e.g., GET /friends/locations)
    /// - Currently returns empty until API is implemented
    private func loadFriendLocationsFromAPI() async {
        // Friend locations API not yet implemented - use mock for demo
        loadMockFriends()
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
            // 学习场所
            Location(
                id: "place-study-1",
                userId: "system",
                name: "24H 沉浸自习室",
                description: "提供绝对安静的学习环境，配备人体工学椅与护眼灯，适合考研党凌晨冲刺。",
                latitude: baseLat + 0.0015,
                longitude: baseLng - 0.0015,
                address: "市中心",
                category: .library,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-study-2",
                userId: "system",
                name: "中心区市立图书馆",
                description: "全市最大的综合性图书馆，藏书丰富，顶层有绝佳的观景阅读区。",
                latitude: baseLat - 0.0018,
                longitude: baseLng - 0.0026,
                address: "中心区",
                category: .library,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-study-3",
                userId: "system",
                name: "TRIX 青年创客空间",
                description: "独立开发者的聚集地，网速极快，咖啡免费续杯。",
                latitude: baseLat + 0.0028,
                longitude: baseLng + 0.0022,
                address: "科技园区",
                category: .library,
                createdAt: Date(),
                updatedAt: Date()
            ),
            // 餐饮场所
            Location(
                id: "place-dining-1",
                userId: "system",
                name: "Blue Bottle 蓝瓶咖啡",
                description: "在简约静谧的工业风空间里，享受一杯顶级的单品手冲咖啡。",
                latitude: baseLat + 0.0006,
                longitude: baseLng + 0.0012,
                address: "静安区",
                category: .cafe,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-dining-2",
                userId: "system",
                name: "Fumin Bagel",
                description: "现烤健康贝果与特调拿铁，排队人数经常爆满的网红店！",
                latitude: baseLat - 0.0012,
                longitude: baseLng + 0.0018,
                address: "法租界",
                category: .cafe,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-dining-3",
                userId: "system",
                name: "Giglio La Pizza",
                description: "柴火窑烤的正宗那不勒斯披萨，满口都是芝士与麦香。",
                latitude: baseLat + 0.0022,
                longitude: baseLng + 0.0036,
                address: "意式餐厅区",
                category: .restaurant,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-dining-4",
                userId: "system",
                name: "深夜食堂·和风居居酒屋",
                description: "温暖疲惫灵魂的寿司与烧鸟，学习完来这里抚慰一下肠胃吧。",
                latitude: baseLat - 0.0016,
                longitude: baseLng + 0.0028,
                address: "长宁区",
                category: .restaurant,
                createdAt: Date(),
                updatedAt: Date()
            ),
            // 娱乐和公园场所
            Location(
                id: "place-ent-1",
                userId: "system",
                name: "光年 Livehouse 星光 KTV",
                description: "百万级音响设备，周末放松解压、跟好友尽情嗨唱的绝佳去处！",
                latitude: baseLat - 0.0028,
                longitude: baseLng + 0.0008,
                address: "娱乐中心",
                category: .entertainment,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-ent-2",
                userId: "system",
                name: "VR 零界探索·超空间",
                description: "全沉浸式的虚拟现实体验馆，带你穿越到赛博朋克异世界。",
                latitude: baseLat + 0.0032,
                longitude: baseLng - 0.0012,
                address: "科技馆",
                category: .entertainment,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-park-1",
                userId: "system",
                name: "城市绿洲极客公园",
                description: "繁华都市中的自然氧吧，林荫大道与慢跑径，适合傍晚散步放松。",
                latitude: baseLat - 0.0008,
                longitude: baseLng - 0.0032,
                address: "滨江绿地",
                category: .park,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Location(
                id: "place-park-2",
                userId: "system",
                name: "滨江现代艺术展览中心",
                description: "依水而建的现代艺术展览馆，近期正在举办《未来科技与艺术》特展。",
                latitude: baseLat + 0.0042,
                longitude: baseLng - 0.0028,
                address: "滨江新区",
                category: .park,
                createdAt: Date(),
                updatedAt: Date()
            ),
        ]

        allLocations = mockPlaces
        filteredLocations = mockPlaces
    }

    /// Load mock friend locations (similar to Web端的 mockFriends)
    private func loadMockFriends() {
        let baseLat = 31.2304
        let baseLng = 121.4737

        // Helper to generate offset positions similar to web
        let offsets: [(Double, Double)] = [
            (0.0015, -0.0015),
            (-0.0018, -0.0026),
            (0.0028, 0.0022),
            (-0.0012, 0.0018),
            (0.0022, 0.0036),
            (-0.0016, 0.0028)
        ]

        // Mock avatar URLs (using pravatar.cc for demo)
        let avatarURLs = [
            "https://i.pravatar.cc/150?img=1",   // Ava
            "https://i.pravatar.cc/150?img=3",   // Leo
            "https://i.pravatar.cc/150?img=5",   // Mia
            "https://i.pravatar.cc/150?img=8",   // David
            "https://i.pravatar.cc/150?img=11",  // Bob
            "https://i.pravatar.cc/150?img=9"    // Alice
        ]

        friendLocations = [
            FriendMapLocation(
                id: "friend-1",
                name: "Ava",
                avatarUrl: avatarURLs[0],
                latitude: baseLat + offsets[0].0,
                longitude: baseLng + offsets[0].1,
                isStudying: true,
                status: "online"
            ),
            FriendMapLocation(
                id: "friend-2",
                name: "Leo",
                avatarUrl: avatarURLs[1],
                latitude: baseLat + offsets[1].0,
                longitude: baseLng + offsets[1].1,
                isStudying: false,
                status: "online"
            ),
            FriendMapLocation(
                id: "friend-3",
                name: "Mia",
                avatarUrl: avatarURLs[2],
                latitude: baseLat + offsets[2].0,
                longitude: baseLng + offsets[2].1,
                isStudying: true,
                status: "away"
            ),
            FriendMapLocation(
                id: "friend-4",
                name: "David",
                avatarUrl: avatarURLs[3],
                latitude: baseLat + offsets[3].0,
                longitude: baseLng + offsets[3].1,
                isStudying: false,
                status: "offline"
            ),
            FriendMapLocation(
                id: "friend-5",
                name: "Bob",
                avatarUrl: avatarURLs[4],
                latitude: baseLat + offsets[4].0,
                longitude: baseLng + offsets[4].1,
                isStudying: false,
                status: "online"
            ),
            FriendMapLocation(
                id: "friend-6",
                name: "Alice",
                avatarUrl: avatarURLs[5],
                latitude: baseLat + offsets[5].0,
                longitude: baseLng + offsets[5].1,
                isStudying: true,
                status: "online"
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
            // Use API result - if empty, fallback to mock for demo
            if locations.isEmpty {
                loadMockData()
            } else {
                allLocations = locations
                filteredLocations = locations
                applyCategoryFilter()
            }

        case .failure(let error):
            // API failed, fallback to mock data for demo
            print("[MapViewModel] API failed: \(error.errorDescription), using mock data")
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
        selectedFriend = friend
        showFriendDetail = true

        // Center map on friend's location
        withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
            region = MKCoordinateRegion(
                center: friend.coordinate,
                span: defaultSpan
            )
        }
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

    /// Clear selected friend
    func clearSelectedFriend() {
        selectedFriend = nil
        showFriendDetail = false
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
        case .restaurant:
            return .red
        case .entertainment:
            return .pink
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
        case .restaurant:
            return "fork.knife"
        case .entertainment:
            return "gamecontroller.fill"
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
