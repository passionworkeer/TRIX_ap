//
//  UserServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for UserService
//

import Foundation

/// Protocol defining user service interface
protocol UserServiceProtocol {
    /// Current user if logged in
    var currentUser: User? { get }

    /// Whether a user operation is in progress
    var isLoading: Bool { get }

    /// Fetch current user's profile
    func fetchProfile() async throws -> User

    /// Update user's profile
    func updateProfile(_ update: ProfileUpdate) async throws -> User

    /// Fetch user's statistics
    func fetchStats() async throws -> UserStats
}
