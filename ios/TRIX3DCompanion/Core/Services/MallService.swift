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

// MARK: - Mall Service Protocol

protocol MallServiceProtocol {
    var items: [MallItem] { get }
    var isLoading: Bool { get }

    func fetchItems(category: MallCategory?) async throws -> [MallItem]
    func purchaseItem(itemId: String, quantity: Int?) async throws -> PurchaseResponse
    func fetchPurchaseHistory() async throws -> [PurchaseHistoryItem]
}

// MARK: - Mall Service

@MainActor
final class MallService: ObservableObject, MallServiceProtocol {

    static let shared = MallService()

    // MARK: - Published Properties

    @Published private(set) var items: [MallItem] = []
    @Published private(set) var purchaseHistory: [PurchaseHistoryItem] = []
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: MallServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClient

    // MARK: - Initialization

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Public Methods

    /// Fetch mall items with optional category filter
    func fetchItems(category: MallCategory? = nil) async throws -> [MallItem] {
        isLoading = true
        lastError = nil

        do {
            var params: [String: Any]? = nil
            if let category = category {
                params = ["category": category.rawValue]
            }

            let response: [MallItem] = try await apiClient.get(.mallItems, parameters: params)
            self.items = response
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
            let request = PurchaseRequest(itemId: itemId, quantity: quantity)
            let response: PurchaseResponse = try await apiClient.post(.mallPurchase, body: request)

            // Update local items list if purchase was successful
            if response.success {
                if let index = self.items.firstIndex(where: { $0.id == itemId }) {
                    var updatedItem = self.items[index]
                    updatedItem = MallItem(
                        id: updatedItem.id,
                        name: updatedItem.name,
                        description: updatedItem.description,
                        image: updatedItem.image,
                        price: updatedItem.price,
                        category: updatedItem.category,
                        isOwned: true
                    )
                    self.items[index] = updatedItem
                }
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
            let response: [PurchaseHistoryItem] = try await apiClient.get(.mallPurchaseHistory)
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
