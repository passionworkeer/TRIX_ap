//
//  PlaceCheckInService.swift
//  TRIX3DCompanion
//
//  Feature-focused service for place check-in side effects.
//

import Foundation

@MainActor
protocol PlaceCheckInServiceProtocol {
    func checkIn(placeId: String) async throws
}

@MainActor
final class PlaceCheckInService: PlaceCheckInServiceProtocol {
    static let shared = PlaceCheckInService()

    private let apiClient: APIClientProtocol

    init(apiClient: APIClientProtocol = APIClient.shared) {
        self.apiClient = apiClient
    }

    func checkIn(placeId: String) async throws {
        let _: EmptyResponse = try await apiClient.post(.placeCheckIn(placeId: placeId), body: EmptyRequest())
    }
}
