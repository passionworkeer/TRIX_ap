//
//  WardrobeServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for WardrobeService
//

import Foundation

/// Protocol defining wardrobe service interface
@MainActor
protocol WardrobeServiceProtocol {
    /// Current outfits
    var outfits: [Outfit] { get }

    /// Whether an operation is in progress
    var isLoading: Bool { get }

    /// Fetch all outfits
    func fetchOutfits() async throws -> [Outfit]

    /// Equip an outfit
    func equipOutfit(outfitId: String) async throws -> EquipResponse

    /// Unequip an outfit
    func unequipOutfit(outfitId: String) async throws -> EquipResponse
}
