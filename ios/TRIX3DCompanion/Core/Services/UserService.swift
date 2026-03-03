//
//  UserService.swift
//  TRIX3DCompanion
//
//  User service for profile management and user-related operations
//

import Foundation
import Combine

// MARK: - User Service Error

enum UserServiceError: Error, LocalizedError {
    case notLoggedIn
    case profileNotFound
    case updateFailed(underlying: Error)
    case fetchFailed(underlying: Error)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .notLoggedIn:
            return "User is not logged in"
        case .profileNotFound:
            return "User profile not found"
        case .updateFailed(let error):
            return "Failed to update profile: \(error.localizedDescription)"
        case .fetchFailed(let error):
            return "Failed to fetch user: \(error.localizedDescription)"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown error"
        }
    }
}

// MARK: - User Service Protocol

protocol UserServiceProtocol {
    var currentUser: User? { get }
    var isLoading: Bool { get }

    func fetchProfile() async throws -> User
    func updateProfile(_ update: ProfileUpdate) async throws -> User
    func fetchStats() async throws -> UserStats
}

// MARK: - User Service

@MainActor
final class UserService: ObservableObject, UserServiceProtocol {

    static let shared = UserService()

    // MARK: - Published Properties

    @Published private(set) var currentUser: User?
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: UserServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClient

    // MARK: - Initialization

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Public Methods

    /// Fetch current user's profile
    func fetchProfile() async throws -> User {
        isLoading = true
        lastError = nil

        do {
            let user = try await apiClient.getCurrentUser()
            self.currentUser = user
            isLoading = false
            return user
        } catch {
            let serviceError = UserServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Update user's profile
    /// - Parameter update: Profile update data
    /// - Returns: Updated user
    func updateProfile(_ update: ProfileUpdate) async throws -> User {
        isLoading = true
        lastError = nil

        do {
            let user = try await apiClient.updateUserProfile(update)
            self.currentUser = user
            isLoading = false
            return user
        } catch {
            let serviceError = UserServiceError.updateFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Fetch user's statistics
    func fetchStats() async throws -> UserStats {
        isLoading = true
        lastError = nil

        do {
            let stats = try await apiClient.getUserStats()
            isLoading = false
            return stats
        } catch {
            let serviceError = UserServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Update cached user
    func updateUser(_ user: User?) {
        self.currentUser = user
    }
}
