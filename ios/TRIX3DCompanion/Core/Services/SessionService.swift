//
//  SessionService.swift
//  TRIX3DCompanion
//
//  Per-platform single-session management.
//  Web and iOS are independent platforms; each allows only one active session per user.
//

import Foundation
import PostgREST

// MARK: - Types

/// Represents a row in the user_sessions table
struct UserSessionRow: Codable, Sendable {
    let id: UUID
    let userId: UUID
    let platform: String
    let deviceId: String
    let deviceName: String
    let isActive: Bool
    let createdAt: String
    let lastActiveAt: String
    let expiresAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case platform
        case deviceId = "device_id"
        case deviceName = "device_name"
        case isActive = "is_active"
        case createdAt = "created_at"
        case lastActiveAt = "last_active_at"
        case expiresAt = "expires_at"
    }
}

/// Result of session validity check
enum SessionValidity: Sendable {
    case valid
    case mismatch          // session ID does not match DB
    case expired           // session has expired
    case revoked           // marked inactive
    case notFound          // no local session
    case networkError      // network failure — skip check
}

// MARK: - Update Payloads

/// Payload for updating user_sessions.is_active
private struct SessionActiveUpdate: Encodable {
    let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case isActive = "is_active"
    }
}

/// Payload for updating user_sessions.last_active_at
private struct SessionTouchUpdate: Encodable {
    let lastActiveAt: String

    enum CodingKeys: String, CodingKey {
        case lastActiveAt = "last_active_at"
    }
}

/// Payload for updating profiles.active_session_id (nullable UUID)
private struct ProfileSessionUpdate: Encodable {
    let activeSessionId: UUID?

    enum CodingKeys: String, CodingKey {
        case activeSessionId = "active_session_id"
    }
}

/// Payload for inserting a new user session
private struct SessionInsertPayload: Encodable {
    let userId: String
    let platform: String
    let deviceId: String
    let deviceName: String
    let isActive: Bool
    let expiresAt: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case platform
        case deviceId = "device_id"
        case deviceName = "device_name"
        case isActive = "is_active"
        case expiresAt = "expires_at"
    }
}

/// Minimal profile row for active_session_id reads
private struct ProfileRow: Decodable {
    let activeSessionId: UUID?

    enum CodingKeys: String, CodingKey {
        case activeSessionId = "active_session_id"
    }
}

// MARK: - Session Service

/// Service for managing per-platform single sessions.
/// Each platform (web/ios) allows only one active session per user.
/// New login atomically replaces the old session via upsert.
actor SessionService {

    // MARK: - Singleton

    static let shared = SessionService()

    // MARK: - Constants

    private static let platform = "ios"
    private static let sessionExpiryHours = 24 * 7   // iOS: 7 days

    // MARK: - Dependencies

    private let keychain: KeychainManager
    private let postgrest: PostgrestClient

    // MARK: - Initialization

    private init(keychain: KeychainManager = .shared) {
        self.keychain = keychain

        guard let url = URL(string: "\(SupabaseConfig.url)/rest/v1") else {
            fatalError("Invalid Supabase REST URL")
        }

        self.postgrest = PostgrestClient(
            url: url,
            headers: [
                "apikey": SupabaseConfig.anonKey
            ]
        )
    }

    // MARK: - Local Storage

    /// Store the session ID (user_sessions primary key) in Keychain (encrypted)
    private func storeLocalSessionId(_ id: UUID) {
        try? keychain.saveSessionId(id.uuidString)
    }

    /// Read the locally stored session ID
    private func getLocalSessionId() -> UUID? {
        guard let sessionIdString = keychain.getSessionId() else {
            return nil
        }
        return UUID(uuidString: sessionIdString)
    }

    /// Clear the locally stored session ID
    private func clearLocalSessionId() {
        try? keychain.deleteSessionId()
    }

    /// Authenticated request helper — sets auth token on the client for this request
    private func authenticatedRequest<T: Sendable>(_ block: (PostgrestClient) async throws -> T) async throws -> T {
        guard let token = keychain.getAccessToken() else {
            throw SessionServiceError.notAuthenticated
        }
        // Set auth on the client
        postgrest.setAuth(token)
        return try await block(postgrest)
    }

    // MARK: - Public API

    /// Upsert a new session for the current user. Marks any existing session for this platform as inactive.
    /// - Parameter userId: The authenticated user's ID
    /// - Returns: The newly created session row
    @discardableResult
    func upsertSession(userId: String) async throws -> UserSessionRow {
        let deviceId = keychain.getOrCreateDeviceId()
        let deviceName = getDeviceName()
        let expiresAt = ISO8601DateFormatter().string(
            from: Date().addingTimeInterval(TimeInterval(Self.sessionExpiryHours * 3600))
        )

        // 1. Mark old sessions as inactive
        let inactiveUpdate = SessionActiveUpdate(isActive: false)
        let _: [UserSessionRow]? = try? await authenticatedRequest { client in
            try await client.from("user_sessions")
                .update(inactiveUpdate, returning: .representation)
                .eq("user_id", value: userId)
                .eq("platform", value: Self.platform)
                .eq("is_active", value: true)
                .execute()
                .value
        }

        // 2. Insert new session
        let insertPayload = SessionInsertPayload(
            userId: userId,
            platform: Self.platform,
            deviceId: deviceId,
            deviceName: deviceName,
            expiresAt: expiresAt
        )
        let newSession: UserSessionRow = try await authenticatedRequest { client in
            try await client.from("user_sessions")
                .insert(insertPayload, returning: .representation)
                .select()
                .single()
                .execute()
                .value
        }

        // 3. Update profiles.active_session_id
        let profileUpdate = ProfileSessionUpdate(activeSessionId: newSession.id)
        let _: [ProfileRow]? = try? await authenticatedRequest { client in
            try await client.from("profiles")
                .update(profileUpdate, returning: .representation)
                .eq("id", value: userId)
                .execute()
                .value
        }

        // 4. Persist locally
        storeLocalSessionId(newSession.id)

        SecureLogger.shared.info("[SessionService] Session upserted: \(newSession.id)")
        return newSession
    }

    /// Revoke the current session on logout.
    func revokeSession() async {
        guard let sessionId = getLocalSessionId() else { return }

        do {
            let userId = try getCurrentUserId()
            let inactiveUpdate = SessionActiveUpdate(isActive: false)
            let _: [UserSessionRow]? = try? await authenticatedRequest { client in
                try await client.from("user_sessions")
                    .update(inactiveUpdate, returning: .representation)
                    .eq("id", value: sessionId.uuidString)
                    .execute()
                    .value
            }
            let clearUpdate = ProfileSessionUpdate(activeSessionId: nil)
            let _: [ProfileRow]? = try? await authenticatedRequest { client in
                try await client.from("profiles")
                    .update(clearUpdate, returning: .representation)
                    .eq("id", value: userId)
                    .execute()
                    .value
            }
            clearLocalSessionId()
            SecureLogger.shared.info("[SessionService] Session revoked: \(sessionId)")
        } catch {
            SecureLogger.shared.warning("[SessionService] Failed to revoke session: \(error.localizedDescription)")
        }
    }

    /// Touch the current session to update last_active_at.
    func touchSession() async {
        guard let sessionId = getLocalSessionId() else { return }

        let touchUpdate = SessionTouchUpdate(
            lastActiveAt: ISO8601DateFormatter().string(from: Date())
        )
        let _: [UserSessionRow]? = try? await authenticatedRequest { client in
            try await client.from("user_sessions")
                .update(touchUpdate, returning: .representation)
                .eq("id", value: sessionId.uuidString)
                .eq("is_active", value: true)
                .execute()
                .value
        }
    }

    /// Check if the local session is still valid by comparing against the DB.
    /// - Returns: SessionValidity indicating the result
    func checkSessionValidity() async -> SessionValidity {
        guard let localId = getLocalSessionId() else {
            return .notFound
        }

        do {
            // 1. Check if the session row still exists and is active
            let sessions: [UserSessionRow] = try await authenticatedRequest { req in
                req.from("user_sessions")
                    .select()
                    .eq("id", value: localId.uuidString)
                    .limit(1)
            }

            guard let session = sessions.first else {
                return .notFound
            }

            if !session.isActive {
                return .revoked
            }

            let expiryDate = ISO8601DateFormatter().date(from: session.expiresAt) ?? Date.distantPast
            if expiryDate < Date() {
                return .expired
            }

            // 2. Compare with profiles.active_session_id
            let userId = try getCurrentUserId()
            let profiles: [ProfileRow] = try await authenticatedRequest { client in
                try await client.from("profiles")
                    .select("active_session_id")
                    .eq("id", value: userId)
                    .limit(1)
                    .execute()
                    .value
            }

            guard let profile = profiles.first,
                  let dbSessionId = profile.activeSessionId else {
                return .notFound
            }

            if dbSessionId != localId {
                SecureLogger.shared.warning("[SessionService] Session mismatch: local=\(localId), db=\(dbSessionId)")
                return .mismatch
            }

            return .valid

        } catch {
            SecureLogger.shared.warning("[SessionService] checkSessionValidity network error: \(error.localizedDescription)")
            return .networkError
        }
    }

    /// Clear local session ID without DB call (for emergency logout)
    func clearLocalOnly() {
        clearLocalSessionId()
    }

    // MARK: - Private Helpers

    private func getCurrentUserId() throws -> String {
        guard let userId = keychain.getUserId() else {
            throw SessionServiceError.notAuthenticated
        }
        return userId
    }

    private func getDeviceName() -> String {
        let device = UIDevice.current
        let raw = "\(device.model) (\(device.systemName) \(device.systemVersion))"
        // 去除控制字符，限制最大 200 字符（防御 XSS 和恶意输入）
        let sanitized = raw.unicodeScalars
            .filter { !$0.isControl }
            .map { String($0) }
            .joined()
        return String(sanitized.prefix(200))
    }
}

// MARK: - Errors

enum SessionServiceError: Error, LocalizedError {
    case notAuthenticated
    case networkError

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "User is not authenticated"
        case .networkError:
            return "Network error during session operation"
        }
    }
}
