//
//  MockAuthServices.swift
//  TRIX3DCompanionTests
//
//  Mock services for Auth module testing
//

import Foundation
import UIKit
import AuthenticationServices
@testable import TRIX3DCompanion

// MARK: - Mock Auth Service for Testing

@MainActor
final class MockAuthService: AuthServiceProtocol {
    // MARK: - State

    var isLoggedInValue: Bool = false
    var isLoadingValue: Bool = false
    var currentUserValue: User?
    var shouldFailLogin: Bool = false
    var shouldFailRegister: Bool = false
    var shouldFailLogout: Bool = false
    var shouldFailRefresh: Bool = false
    var simulatedDelayNanoseconds: UInt64 = 0

    // MARK: - Call Tracking

    var lastLoginEmail: String?
    var lastLoginPassword: String?
    var lastRegisterUsername: String?
    var lastRegisterEmail: String?
    var lastRegisterPassword: String?
    var loginCallCount: Int = 0
    var registerCallCount: Int = 0
    var logoutCallCount: Int = 0
    var refreshTokenCallCount: Int = 0
    var fetchCurrentUserCallCount: Int = 0

    // MARK: - AuthServiceProtocol

    var isLoggedIn: Bool {
        return isLoggedInValue
    }

    var currentUser: User? {
        return currentUserValue
    }

    var isLoading: Bool {
        return isLoadingValue
    }

    func login(email: String, password: String) async -> AuthResult<User> {
        lastLoginEmail = email
        lastLoginPassword = password
        loginCallCount += 1
        isLoadingValue = true

        if simulatedDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: simulatedDelayNanoseconds)
        }

        if shouldFailLogin {
            isLoadingValue = false
            return .failure(.invalidCredentials)
        }

        let user = User(
            id: UUID().uuidString,
            username: email.components(separatedBy: "@").first ?? "user",
            email: email,
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: email.components(separatedBy: "@").first,
            bio: nil,
            website: nil,
            points: 100,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            lastActiveAt: Date(),
            currentStreak: 0,
            daysActive: 1,
            interactionCount: 0,
            showOnlineStatus: true,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        currentUserValue = user
        isLoggedInValue = true
        isLoadingValue = false
        return .success(user)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<User> {
        lastRegisterUsername = username
        lastRegisterEmail = email
        lastRegisterPassword = password
        registerCallCount += 1
        isLoadingValue = true

        if simulatedDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: simulatedDelayNanoseconds)
        }

        if shouldFailRegister {
            isLoadingValue = false
            return .failure(.emailAlreadyExists)
        }

        let user = User(
            id: UUID().uuidString,
            username: username,
            email: email,
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: username,
            bio: nil,
            website: nil,
            points: 0,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            lastActiveAt: Date(),
            currentStreak: 0,
            daysActive: 1,
            interactionCount: 0,
            showOnlineStatus: true,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        currentUserValue = user
        isLoggedInValue = true
        isLoadingValue = false
        return .success(user)
    }

    func logout() async -> AuthResult<Void> {
        logoutCallCount += 1
        isLoadingValue = true

        if simulatedDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: simulatedDelayNanoseconds)
        }

        if shouldFailLogout {
            isLoadingValue = false
            return .failure(.unknown(underlying: nil))
        }

        currentUserValue = nil
        isLoggedInValue = false
        isLoadingValue = false
        return .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        refreshTokenCallCount += 1
        isLoadingValue = true

        if simulatedDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: simulatedDelayNanoseconds)
        }

        if shouldFailRefresh {
            isLoadingValue = false
            return .failure(.tokenExpired)
        }

        isLoadingValue = false
        return .success(())
    }

    func fetchCurrentUser() async -> AuthResult<User> {
        fetchCurrentUserCallCount += 1

        if simulatedDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: simulatedDelayNanoseconds)
        }

        if let user = currentUserValue {
            return .success(user)
        }
        return .failure(.invalidCredentials)
    }

    func updateProfile(_ updates: User) async -> AuthResult<User> {
        return .success(updates)
    }

    func deleteAccount() async -> AuthResult<Void> {
        return .success(())
    }

    func updateCurrentUser(_ user: User?) {
        currentUserValue = user
    }

    func updateLoginStatus(_ loggedIn: Bool) {
        isLoggedInValue = loggedIn
    }

    func clearError() {}

    func reset() {
        isLoggedInValue = false
        isLoadingValue = false
        currentUserValue = nil
        shouldFailLogin = false
        shouldFailRegister = false
        shouldFailLogout = false
        shouldFailRefresh = false
        simulatedDelayNanoseconds = 0
        lastLoginEmail = nil
        lastLoginPassword = nil
        lastRegisterUsername = nil
        lastRegisterEmail = nil
        lastRegisterPassword = nil
        loginCallCount = 0
        registerCallCount = 0
        logoutCallCount = 0
        refreshTokenCallCount = 0
        fetchCurrentUserCallCount = 0
    }
}

// MARK: - Mock OAuth Manager for Testing

@MainActor
final class MockOAuthManager: OAuthManagerProtocol {
    // MARK: - State

    var availableProvidersValue: [OAuthProvider] = [.apple, .wechat]
    var linkedAccountsValue: [OAuthAccount] = []
    var hasLinkedAccountsValue: Bool = false
    var shouldFailSignIn: Bool = false
    var shouldFailLinkAccount: Bool = false
    var shouldFailUnlinkAccount: Bool = false
    var simulatedDelayNanoseconds: UInt64 = 0

    // MARK: - Call Tracking

    var lastSignInProvider: OAuthProvider?
    var lastLinkProvider: OAuthProvider?
    var lastUnlinkAccountId: String?
    var signInCallCount: Int = 0
    var linkAccountCallCount: Int = 0
    var unlinkAccountCallCount: Int = 0
    var fetchLinkedAccountsCallCount: Int = 0

    // MARK: - OAuthManagerProtocol

    var availableProviders: [OAuthProvider] {
        return availableProvidersValue
    }

    var linkedAccounts: [OAuthAccount] {
        return linkedAccountsValue
    }

    var hasLinkedAccounts: Bool {
        return hasLinkedAccountsValue
    }

    func signIn(with provider: OAuthProvider, presentationAnchor: ASPresentationAnchor?) async -> AuthResult<User> {
        lastSignInProvider = provider
        signInCallCount += 1

        if simulatedDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: simulatedDelayNanoseconds)
        }

        if shouldFailSignIn {
            return .failure(.unknown(underlying: nil))
        }

        let user = User(
            id: UUID().uuidString,
            username: provider.rawValue + "_user",
            email: "oauth_\(provider.rawValue)@example.com",
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: provider.displayName + " User",
            bio: nil,
            website: nil,
            points: 50,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            lastActiveAt: Date(),
            currentStreak: 0,
            daysActive: 1,
            interactionCount: 0,
            showOnlineStatus: true,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        return .success(user)
    }

    func linkAccount(provider: OAuthProvider, presentationAnchor: ASPresentationAnchor?) async -> AuthResult<Void> {
        lastLinkProvider = provider
        linkAccountCallCount += 1

        if shouldFailLinkAccount {
            return .failure(.unknown(underlying: nil))
        }

        let account = OAuthAccount(
            id: UUID().uuidString,
            provider: provider,
            providerUserID: "oauth_\(provider.rawValue)_id",
            email: "\(provider.rawValue)_linked@example.com",
            displayName: provider.displayName,
            avatarURL: nil,
            isPrimary: false,
            linkedAt: Date(),
            lastUsedAt: Date()
        )

        linkedAccountsValue.append(account)
        hasLinkedAccountsValue = true
        return .success(())
    }

    func unlinkAccount(accountID: String) async -> AuthResult<Void> {
        lastUnlinkAccountId = accountID
        unlinkAccountCallCount += 1

        if shouldFailUnlinkAccount {
            return .failure(.unknown(underlying: nil))
        }

        linkedAccountsValue.removeAll { $0.id == accountID }
        hasLinkedAccountsValue = !linkedAccountsValue.isEmpty
        return .success(())
    }

    func refreshToken(for provider: OAuthProvider) async -> AuthResult<Void> {
        return .success(())
    }

    func fetchLinkedAccounts() async -> AuthResult<[OAuthAccount]> {
        fetchLinkedAccountsCallCount += 1
        return .success(linkedAccountsValue)
    }

    func isProviderAvailable(_ provider: OAuthProvider) -> Bool {
        return availableProvidersValue.contains(provider)
    }

    func handleOpenURL(_ url: URL) -> Bool {
        return true
    }

    func reset() {
        shouldFailSignIn = false
        shouldFailLinkAccount = false
        shouldFailUnlinkAccount = false
        linkedAccountsValue = []
        hasLinkedAccountsValue = false
        lastSignInProvider = nil
        lastLinkProvider = nil
        lastUnlinkAccountId = nil
        signInCallCount = 0
        linkAccountCallCount = 0
        unlinkAccountCallCount = 0
        fetchLinkedAccountsCallCount = 0
    }
}

// MARK: - Helper Extensions for Auth Tests

extension MockAuthService {
    static func createMockUser(
        id: String = "test_user_id",
        email: String = "test@example.com",
        username: String = "test_user",
        displayName: String = "Test User"
    ) -> User {
        User(
            id: id,
            username: username,
            email: email,
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: displayName,
            bio: nil,
            website: nil,
            points: 100,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 3600,
            lastActiveAt: Date(),
            currentStreak: 5,
            daysActive: 30,
            interactionCount: 100,
            showOnlineStatus: true,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}
