//
//  LocationCheckInViewModel.swift
//  TRIX3DCompanion
//
//  Manages place check-in state so the sheet can distinguish success from failure.
//

import Foundation

@MainActor
final class LocationCheckInViewModel: ObservableObject {
    @Published private(set) var isCheckingIn = false
    @Published var errorMessage: String?

    private let service: PlaceCheckInServiceProtocol

    init(service: PlaceCheckInServiceProtocol = PlaceCheckInService.shared) {
        self.service = service
    }

    @discardableResult
    func checkIn(placeId: String) async -> Bool {
        guard !isCheckingIn else { return false }

        isCheckingIn = true
        errorMessage = nil
        defer { isCheckingIn = false }

        do {
            try await service.checkIn(placeId: placeId)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func clearError() {
        errorMessage = nil
    }
}
