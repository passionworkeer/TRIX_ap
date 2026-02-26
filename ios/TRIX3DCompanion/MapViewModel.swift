//
//  MapViewModel.swift
//  TRIX3DCompanion
//
//  Map ViewModel for managing location-based features
//

import Foundation
import CoreLocation
import Combine

/// Map ViewModel for managing location-based features
@MainActor
final class MapViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var nearbyLocations: [Location] = []
    @Published var selectedLocation: Location?
    @Published var userLocation: CLLocation?
    @Published var searchQuery: String = ""
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    // MARK: - Region for Map Display

    @Published var mapRegion: MKCoordinateRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
        span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
    )

    // MARK: - Dependencies

    private let locationService: LocationServiceProtocol

    // MARK: - Private Properties

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init(locationService: LocationServiceProtocol = LocationService.shared) {
        self.locationService = locationService

        setupSearchBinding()
    }

    // MARK: - Setup

    private func setupSearchBinding() {
        $searchQuery
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] query in
                Task {
                    await self?.performSearch(query: query)
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Load nearby locations
    func loadNearbyLocations(radius: Double = 1000) async {
        isLoading = true
        errorMessage = nil

        let result = await locationService.fetchNearbyLocations(radius: radius)

        switch result {
        case .success(let locations):
            nearbyLocations = locations
        case .failure(let error):
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Search locations with query filter
    func searchLocations(query: String) async {
        guard !query.isEmpty else {
            await loadNearbyLocations()
            return
        }

        isLoading = true
        errorMessage = nil

        let result = await locationService.fetchNearbyLocations(radius: 5000)

        switch result {
        case .success(let locations):
            nearbyLocations = locations.filter { location in
                location.name.localizedCaseInsensitiveContains(query) ||
                (location.description?.localizedCaseInsensitiveContains(query) ?? false) ||
                (location.address?.localizedCaseInsensitiveContains(query) ?? false)
            }
        case .failure(let error):
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Select a location
    func selectLocation(_ location: Location?) {
        selectedLocation = location
    }

    /// Center map on user location
    func centerOnUserLocation() async {
        guard let location = locationService.getCurrentLocation() else {
            errorMessage = "无法获取当前位置"
            return
        }

        userLocation = location
        mapRegion = MKCoordinateRegion(
            center: location.coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
        )
    }

    /// Share selected location
    func shareLocation(companionId: String) async -> Bool {
        guard let location = selectedLocation ?? (userLocation.map { Location(
            id: "current",
            userId: "",
            name: "Current Location",
            description: nil,
            latitude: $0.coordinate.latitude,
            longitude: $0.coordinate.longitude,
            address: nil,
            category: nil,
            createdAt: Date(),
            updatedAt: Date()
        )}) else {
            errorMessage = "没有可分享的位置"
            return false
        }

        let result = await locationService.shareLocation(with: companionId)

        switch result {
        case .success:
            return true
        case .failure(let error):
            errorMessage = error.localizedDescription
            return false
        }
    }

    /// Clear selection
    func clearSelection() {
        selectedLocation = nil
    }

    /// Refresh locations
    func refresh() async {
        await loadNearbyLocations()
    }

    // MARK: - Private Methods

    private func performSearch(query: String) async {
        await searchLocations(query: query)
    }
}

// MARK: - MKCoordinateRegion Import

import MapKit
