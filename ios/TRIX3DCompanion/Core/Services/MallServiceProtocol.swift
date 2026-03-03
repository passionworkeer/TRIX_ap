//
//  MallServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for MallService
//

import Foundation

/// Protocol defining mall service interface
protocol MallServiceProtocol {
    /// Current mall items
    var items: [MallItem] { get }

    /// Whether an operation is in progress
    var isLoading: Bool { get }

    /// Fetch mall items with optional category filter
    func fetchItems(category: MallCategory?) async throws -> [MallItem]

    /// Purchase an item
    func purchaseItem(itemId: String, quantity: Int?) async throws -> PurchaseResponse

    /// Fetch purchase history
    func fetchPurchaseHistory() async throws -> [PurchaseHistoryItem]
}
