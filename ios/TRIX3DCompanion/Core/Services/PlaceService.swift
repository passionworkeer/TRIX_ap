//
//  PlaceService.swift
//  TRIX3DCompanion
//
//  Place service for location-based features
//

import Foundation
import Combine

// MARK: - Place Service Error

enum PlaceServiceError: Error, LocalizedError {
    case fetchFailed(underlying: Error)
    case searchFailed(underlying: Error)
    case favoriteFailed(underlying: Error)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .fetchFailed(let error):
            return "Failed to fetch places: \(error.localizedDescription)"
        case .searchFailed(let error):
            return "Failed to search places: \(error.localizedDescription)"
        case .favoriteFailed(let error):
            return "Failed to update favorite: \(error.localizedDescription)"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown error"
        }
    }
}

// MARK: - Place Service Protocol

@MainActor
protocol PlaceServiceProtocol {
    var places: [Place] { get }
    var favoritePlaces: [Place] { get }
    var isLoading: Bool { get }

    func fetchNearbyPlaces(latitude: Double, longitude: Double, radius: Double) async throws -> [Place]
    func searchPlaces(query: String) async throws -> [Place]
    func fetchPlacesByCategory(_ category: PlaceCategory) async throws -> [Place]
    func fetchFavoritePlaces() async throws -> [Place]
    func toggleFavorite(placeId: String) async throws -> Place
}

// MARK: - Place Service

@MainActor
final class PlaceService: ObservableObject, PlaceServiceProtocol {

    static let shared = PlaceService()

    // MARK: - Published Properties

    @Published private(set) var places: [Place] = []
    @Published private(set) var favoritePlaces: [Place] = []
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: PlaceServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClient

    // MARK: - Initialization

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Public Methods

    /// Fetch nearby places
    func fetchNearbyPlaces(latitude: Double, longitude: Double, radius: Double = 1000) async throws -> [Place] {
        isLoading = true
        lastError = nil

        do {
            let params: [String: Any] = [
                "lat": latitude,
                "lng": longitude,
                "radius": radius
            ]
            let response: [Place] = try await apiClient.get(.placeNearby, parameters: params)
            self.places = response
            isLoading = false
            return response
        } catch {
            let serviceError = PlaceServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Search places by query
    func searchPlaces(query: String) async throws -> [Place] {
        isLoading = true
        lastError = nil

        do {
            let params: [String: Any] = ["q": query]
            let response: [Place] = try await apiClient.get(.placeSearch, parameters: params)
            isLoading = false
            return response
        } catch {
            let serviceError = PlaceServiceError.searchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Fetch places by category
    func fetchPlacesByCategory(_ category: PlaceCategory) async throws -> [Place] {
        isLoading = true
        lastError = nil

        do {
            let params: [String: Any] = ["category": category.rawValue]
            let response: [Place] = try await apiClient.get(.placeNearby, parameters: params)
            isLoading = false
            return response
        } catch {
            let serviceError = PlaceServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Fetch favorite places
    func fetchFavoritePlaces() async throws -> [Place] {
        isLoading = true
        lastError = nil

        do {
            let response: [Place] = try await apiClient.get(.placeFavorite)
            self.favoritePlaces = response
            isLoading = false
            return response
        } catch {
            let serviceError = PlaceServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Toggle favorite status for a place
    func toggleFavorite(placeId: String) async throws -> Place {
        isLoading = true
        lastError = nil

        do {
            let response: Place = try await apiClient.post(.placeFavoriteToggle(placeId: placeId))

            // Update local list
            if let index = self.places.firstIndex(where: { $0.id == placeId }) {
                self.places[index] = response
            }

            // Update favorites list
            if response.isFavorite {
                if !self.favoritePlaces.contains(where: { $0.id == placeId }) {
                    self.favoritePlaces.append(response)
                }
            } else {
                self.favoritePlaces.removeAll { $0.id == placeId }
            }

            isLoading = false
            return response
        } catch {
            let serviceError = PlaceServiceError.favoriteFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    // MARK: - Helper Methods

    /// Get place by ID
    func place(byId id: String) -> Place? {
        return places.first { $0.id == id }
    }

    /// Get places by category
    func places(byCategory category: PlaceCategory) -> [Place] {
        return places.filter { $0.category == category }
    }
}
