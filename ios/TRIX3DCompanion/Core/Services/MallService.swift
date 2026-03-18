//
//  MallService.swift
//  TRIX3DCompanion
//
//  Mall service for points mall/shop operations
//

import Foundation
import Combine

// MARK: - Mall Service Error

enum MallServiceError: Error, LocalizedError {
    case fetchFailed(underlying: Error)
    case purchaseFailed(underlying: Error)
    case insufficientPoints
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .fetchFailed(let error):
            return "Failed to fetch mall items: \(error.localizedDescription)"
        case .purchaseFailed(let error):
            return "Failed to purchase item: \(error.localizedDescription)"
        case .insufficientPoints:
            return "Insufficient points balance"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown error"
        }
    }
}

// MARK: - Mall Service

@MainActor
final class MallService: ObservableObject, MallServiceProtocol {

    static let shared = MallService()

    // MARK: - Published Properties

    @Published private(set) var items: [MallItem] = []
    @Published private(set) var purchaseHistory: [PurchaseHistoryItem] = []
    @Published private(set) var userPoints: Int = 0
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: MallServiceError?

    // MARK: - Dependencies

    private let supabaseService: SupabaseService

    // MARK: - Initialization

    init(supabaseService: SupabaseService = .shared) {
        self.supabaseService = supabaseService
    }

    // MARK: - Public Methods

    /// Fetch mall items with optional category filter
    func fetchItems(category: MallCategory? = nil) async throws -> [MallItem] {
        isLoading = true
        lastError = nil

        do {
            let response = try await supabaseService.fetchMallItems(category: category?.rawValue)
            self.items = response

            // Also fetch user points balance
            let balance = try await supabaseService.fetchUserPointsBalance()
            self.userPoints = balance.availablePoints

            isLoading = false
            return response
        } catch {
            let serviceError = MallServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Purchase an item
    func purchaseItem(itemId: String, quantity: Int? = nil) async throws -> PurchaseResponse {
        isLoading = true
        lastError = nil

        do {
            let response = try await supabaseService.purchaseMallItem(itemId: itemId, quantity: quantity ?? 1)

            // Update local items list if purchase was successful
            if response.success {
                if let index = self.items.firstIndex(where: { $0.id == itemId }) {
                    let updatedItem = MallItem(
                        id: self.items[index].id,
                        name: self.items[index].name,
                        description: self.items[index].description,
                        image: self.items[index].image,
                        price: self.items[index].price,
                        category: self.items[index].category,
                        isOwned: true
                    )
                    self.items[index] = updatedItem
                }
                // Update user points
                self.userPoints = response.remainingPoints
            }

            isLoading = false
            return response
        } catch let error as MallServiceError {
            lastError = error
            isLoading = false
            throw error
        } catch {
            let serviceError = MallServiceError.purchaseFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Fetch purchase history
    func fetchPurchaseHistory() async throws -> [PurchaseHistoryItem] {
        isLoading = true
        lastError = nil

        do {
            let response = try await supabaseService.fetchPurchaseHistory()
            self.purchaseHistory = response
            isLoading = false
            return response
        } catch {
            let serviceError = MallServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    // MARK: - Points

    /// Refresh user points balance
    func refreshUserPoints() async throws -> Int {
        do {
            let balance = try await supabaseService.fetchUserPointsBalance()
            self.userPoints = balance.availablePoints
            return balance.availablePoints
        } catch {
            let serviceError = MallServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            throw serviceError
        }
    }

    // MARK: - Helper Methods

    /// Get item by ID
    func item(byId id: String) -> MallItem? {
        return items.first { $0.id == id }
    }

    /// Get items by category
    func items(byCategory category: MallCategory) -> [MallItem] {
        return items.filter { $0.category == category }
    }

    /// Get unowned items
    func unownedItems() -> [MallItem] {
        return items.filter { !$0.isOwned }
    }

    /// Get owned items
    func ownedItems() -> [MallItem] {
        return items.filter { $0.isOwned }
    }
}
