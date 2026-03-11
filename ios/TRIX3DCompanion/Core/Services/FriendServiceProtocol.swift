//
//  FriendServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for FriendService
//

import Foundation

/// Protocol defining friend service interface
@MainActor
protocol FriendServiceProtocol {
    /// Current friends list
    var friends: [Friend] { get }

    /// Pending friend requests
    var friendRequests: [FriendRequest] { get }

    /// Whether an operation is in progress
    var isLoading: Bool { get }

    /// Fetch all friends
    func fetchFriends() async throws -> [Friend]

    /// Fetch pending friend requests
    func fetchFriendRequests() async throws -> [FriendRequest]

    /// Send friend request
    func addFriend(friendId: String) async throws

    /// Remove a friend
    func removeFriend(friendId: String) async throws

    /// Accept friend request
    func acceptFriendRequest(requestId: String) async throws

    /// Decline friend request
    func declineFriendRequest(requestId: String) async throws
}
