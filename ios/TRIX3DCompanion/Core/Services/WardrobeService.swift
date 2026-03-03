//
//  WardrobeService.swift
//  TRIX3DCompanion
//
//  Wardrobe service for avatar/outfit management
//

import Foundation
import Combine

// MARK: - Wardrobe Service Error

enum WardrobeServiceError: Error, LocalizedError {
    case fetchFailed(underlying: Error)
    case equipFailed(underlying: Error)
    case unequipFailed(underlying: Error)
    case notOwned
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .fetchFailed(let error):
            return "Failed to fetch outfits: \(error.localizedDescription)"
        case .equipFailed(let error):
            return "Failed to equip outfit: \(error.localizedDescription)"
        case .unequipFailed(let error):
            return "Failed to unequip outfit: \(error.localizedDescription)"
        case .notOwned:
            return "You don't own this outfit"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown error"
        }
    }
}

// MARK: - Wardrobe Service Protocol

protocol WardrobeServiceProtocol {
    var outfits: [Outfit] { get }
    var isLoading: Bool { get }

    func fetchOutfits() async throws -> [Outfit]
    func equipOutfit(outfitId: String) async throws -> EquipResponse
    func unequipOutfit(outfitId: String) async throws -> EquipResponse
}

// MARK: - Wardrobe Service

@MainActor
final class WardrobeService: ObservableObject, WardrobeServiceProtocol {

    static let shared = WardrobeService()

    // MARK: - Published Properties

    @Published private(set) var outfits: [Outfit] = []
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: WardrobeServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClient

    // MARK: - Initialization

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Public Methods

    /// Fetch all outfits
    func fetchOutfits() async throws -> [Outfit] {
        isLoading = true
        lastError = nil

        do {
            let response: [Outfit] = try await apiClient.get(.wardrobeOutfits)
            self.outfits = response
            isLoading = false
            return response
        } catch {
            let serviceError = WardrobeServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Equip an outfit
    func equipOutfit(outfitId: String) async throws -> EquipResponse {
        // Check if user owns the outfit
        guard let outfit = outfits.first(where: { $0.id == outfitId }), outfit.isOwned else {
            let error = WardrobeServiceError.notOwned
            lastError = error
            throw error
        }

        isLoading = true
        lastError = nil

        do {
            let response: EquipResponse = try await apiClient.post(.wardrobeEquip(outfitId: outfitId))

            // Update local outfits list
            if response.success {
                self.outfits = self.outfits.map { o in
                    if o.category == outfit.category {
                        return Outfit(
                            id: o.id,
                            name: o.name,
                            category: o.category,
                            image: o.image,
                            previewImage: o.previewImage,
                            isOwned: o.isOwned,
                            isEquipped: o.id == outfitId,
                            description: o.description,
                            price: o.price
                        )
                    }
                    return o
                }
            }

            isLoading = false
            return response
        } catch let error as WardrobeServiceError {
            lastError = error
            isLoading = false
            throw error
        } catch {
            let serviceError = WardrobeServiceError.equipFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Unequip an outfit
    func unequipOutfit(outfitId: String) async throws -> EquipResponse {
        isLoading = true
        lastError = nil

        do {
            let response: EquipResponse = try await apiClient.post(.wardrobeUnequip(outfitId: outfitId))

            // Update local outfits list
            if response.success {
                self.outfits = self.outfits.map { o in
                    if o.id == outfitId {
                        return Outfit(
                            id: o.id,
                            name: o.name,
                            category: o.category,
                            image: o.image,
                            previewImage: o.previewImage,
                            isOwned: o.isOwned,
                            isEquipped: false,
                            description: o.description,
                            price: o.price
                        )
                    }
                    return o
                }
            }

            isLoading = false
            return response
        } catch let error as WardrobeServiceError {
            lastError = error
            isLoading = false
            throw error
        } catch {
            let serviceError = WardrobeServiceError.unequipFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    // MARK: - Helper Methods

    /// Get outfit by ID
    func outfit(byId id: String) -> Outfit? {
        return outfits.first { $0.id == id }
    }

    /// Get outfits by category
    func outfits(byCategory category: OutfitCategory) -> [Outfit] {
        return outfits.filter { $0.category == category }
    }

    /// Get owned outfits
    func ownedOutfits() -> [Outfit] {
        return outfits.filter { $0.isOwned }
    }

    /// Get equipped outfits
    func equippedOutfits() -> [Outfit] {
        return outfits.filter { $0.isEquipped }
    }

    /// Get outfit for a specific category (the equipped one)
    func equippedOutfit(forCategory category: OutfitCategory) -> Outfit? {
        return outfits.first { $0.category == category && $0.isEquipped }
    }
}
