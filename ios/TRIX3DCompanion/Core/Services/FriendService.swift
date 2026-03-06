//
//  FriendService.swift
//  TRIX3DCompanion
//
//  Friend service for managing friends and friend requests
//

import Foundation
import Combine

// MARK: - Friend Service Error

enum FriendServiceError: Error, LocalizedError {
    case notLoggedIn
    case friendNotFound
    case alreadyFriends
    case fetchFailed(underlying: Error)
    case addFailed(underlying: Error)
    case removeFailed(underlying: Error)
    case acceptFailed(underlying: Error)
    case declineFailed(underlying: Error)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .notLoggedIn:
            return "User is not logged in"
        case .friendNotFound:
            return "Friend not found"
        case .alreadyFriends:
            return "Already friends with this user"
        case .fetchFailed(let error):
            return "Failed to fetch friends: \(error.localizedDescription)"
        case .addFailed(let error):
            return "Failed to add friend: \(error.localizedDescription)"
        case .removeFailed(let error):
            return "Failed to remove friend: \(error.localizedDescription)"
        case .acceptFailed(let error):
            return "Failed to accept friend request: \(error.localizedDescription)"
        case .declineFailed(let error):
            return "Failed to decline friend request: \(error.localizedDescription)"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown error"
        }
    }
}

// MARK: - Friend Service

@MainActor
final class FriendService: ObservableObject, FriendServiceProtocol {

    static let shared = FriendService()

    // MARK: - Published Properties

    @Published private(set) var friends: [Friend] = []
    @Published private(set) var friendRequests: [FriendRequest] = []
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: FriendServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClient

    // MARK: - Initialization

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Public Methods

    /// Fetch all friends
    func fetchFriends() async throws -> [Friend] {
        isLoading = true
        lastError = nil

        do {
            let response: [Friend] = try await apiClient.get(.friendList)
            self.friends = response
            isLoading = false
            return response
        } catch {
            let serviceError = FriendServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Fetch pending friend requests
    func fetchFriendRequests() async throws -> [FriendRequest] {
        isLoading = true
        lastError = nil

        do {
            let response: [FriendRequest] = try await apiClient.get(.friendRequests)
            self.friendRequests = response
            isLoading = false
            return response
        } catch {
            let serviceError = FriendServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Send friend request
    func addFriend(friendId: String) async throws {
        isLoading = true
        lastError = nil

        do {
            let request = AddFriendRequest(friendId: friendId)
            let _: EmptyResponse = try await apiClient.post(.friendAdd, body: request)
            isLoading = false
        } catch {
            let serviceError = FriendServiceError.addFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Remove a friend
    func removeFriend(friendId: String) async throws {
        isLoading = true
        lastError = nil

        do {
            let _: EmptyResponse = try await apiClient.delete(.friendRemove(friendId: friendId))
            // Remove from local list
            self.friends.removeAll { $0.friendId == friendId }
            isLoading = false
        } catch {
            let serviceError = FriendServiceError.removeFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Accept friend request
    func acceptFriendRequest(requestId: String) async throws {
        isLoading = true
        lastError = nil

        do {
            let _: EmptyResponse = try await apiClient.post(.friendAccept(requestId: requestId))
            // Remove from pending requests
            self.friendRequests.removeAll { $0.id == requestId }
            isLoading = false
        } catch {
            let serviceError = FriendServiceError.acceptFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Decline friend request
    func declineFriendRequest(requestId: String) async throws {
        isLoading = true
        lastError = nil

        do {
            let _: EmptyResponse = try await apiClient.post(.friendDecline(requestId: requestId))
            // Remove from pending requests
            self.friendRequests.removeAll { $0.id == requestId }
            isLoading = false
        } catch {
            let serviceError = FriendServiceError.declineFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    // MARK: - Helper Methods

    /// Get friend by ID
    func friend(byId friendId: String) -> Friend? {
        return friends.first { $0.friendId == friendId }
    }

    /// Get online friends
    func onlineFriends() -> [Friend] {
        return friends.filter { $0.status == .online }
    }

    /// Get friends who are currently studying
    func studyingFriends() -> [Friend] {
        return friends.filter { $0.isStudying }
    }

    /// Get pending requests count
    var pendingRequestsCount: Int {
        return friendRequests.count
    }
}
