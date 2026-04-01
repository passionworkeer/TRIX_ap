//
//  StudyService.swift
//  TRIX3DCompanion
//
//  Study service for managing study sessions, rooms, and real-time collaboration
//

import Foundation
import Combine

// MARK: - API Endpoints Access
// Note: APIEndpoints is accessed through the APIClient

// MARK: - Study Error

/// Study service error types
enum StudyError: Error, LocalizedError, Equatable {
    case notAuthenticated
    case roomNotFound
    case roomFull
    case notRoomHost
    case noActiveSession
    case sessionAlreadyActive
    case networkError(underlying: Error)
    case webSocketNotConnected
    case invalidRoomCode
    case syncFailed
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to access study features"
        case .roomNotFound:
            return "Study room not found"
        case .roomFull:
            return "This study room is full"
        case .notRoomHost:
            return "Only the room host can perform this action"
        case .noActiveSession:
            return "No active study session"
        case .sessionAlreadyActive:
            return "A study session is already in progress"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .webSocketNotConnected:
            return "WebSocket connection not established"
        case .invalidRoomCode:
            return "Invalid room code"
        case .syncFailed:
            return "Failed to sync offline sessions"
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }

    // Custom Equatable implementation
    static func == (lhs: StudyError, rhs: StudyError) -> Bool {
        switch (lhs, rhs) {
        case (.notAuthenticated, .notAuthenticated),
             (.roomNotFound, .roomNotFound),
             (.roomFull, .roomFull),
             (.notRoomHost, .notRoomHost),
             (.noActiveSession, .noActiveSession),
             (.sessionAlreadyActive, .sessionAlreadyActive),
             (.webSocketNotConnected, .webSocketNotConnected),
             (.invalidRoomCode, .invalidRoomCode),
             (.syncFailed, .syncFailed):
            return true
        case (.networkError(let lhsError), .networkError(let rhsError)):
            return lhsError.localizedDescription == rhsError.localizedDescription
        case (.unknown(let lhsError), .unknown(let rhsError)):
            return lhsError?.localizedDescription == rhsError?.localizedDescription
        default:
            return false
        }
    }
}

// MARK: - Study Supabase Protocol

/// Protocol for Supabase study session operations — enables test mocking
protocol StudySupabaseProtocol: AnyObject {
    func createStudySession(subject: String) async throws -> String
    func updateStudySession(sessionId: String, duration: Int) async throws
}

// MARK: - Study Result

/// Result type for study operations
typealias StudyResult<T> = Result<T, StudyError>

// MARK: - Study Service Protocol

/// Protocol defining study service interface
@MainActor
protocol StudyServiceProtocol {
    var studyRooms: [StudyRoom] { get }
    var currentSession: StudySession? { get }
    var isActiveSession: Bool { get }
    var currentFocusTime: TimeInterval { get }
    var sessionState: TimerState { get }
    var isWebSocketConnected: Bool { get }
    var currentRoomState: StudyRoomState? { get }

    func fetchStudyRooms() async -> StudyResult<[StudyRoom]>
    func createStudyRoom(name: String, maxMembers: Int) async -> StudyResult<StudyRoom>
    func joinStudyRoom(roomCode: String) async -> StudyResult<StudyRoomState>
    func leaveStudyRoom() async -> StudyResult<Void>
    func joinRoom(_ roomCode: String) async -> StudyResult<StudyRoomState>
    func leaveRoom(_ roomCode: String) async -> StudyResult<Void>
    func startStudySession(roomCode: String) async -> StudyResult<StudySession>
    func startFocusSession(roomCode: String) async -> StudyResult<StudySession>
    func endStudySession() async -> StudyResult<StudySession>
    func endSession(roomCode: String) async -> StudyResult<StudySession>
    func pauseSession(roomCode: String) async throws
    func resumeSession(roomCode: String) async throws
    func fetchStudyStats() async -> StudyResult<StudyStats>
    func getStudyStats() async -> StudyResult<StudyStats>
    func getWeeklyStudyData() async -> StudyResult<[DailyStudyData]>
    func syncOfflineSessions() async -> StudyResult<Int>
}

// MARK: - Study Service

/// Main study service handling study sessions, rooms, and real-time collaboration
@MainActor
final class StudyService: ObservableObject, StudyServiceProtocol {

    // MARK: - Singleton

    static let shared = StudyService()

    // MARK: - Published Properties

    /// List of available study rooms
    @Published private(set) var studyRooms: [StudyRoom] = []

    /// Currently active study session
    @Published private(set) var currentSession: StudySession?

    /// Whether a session is currently active
    @Published private(set) var isActiveSession: Bool = false

    /// Current focus time in seconds
    @Published private(set) var currentFocusTime: TimeInterval = 0

    /// Current timer state
    @Published private(set) var sessionState: TimerState = .idle

    /// WebSocket connection status for study features
    @Published private(set) var isWebSocketConnected: Bool = false

    /// Current study room state (if in a room)
    @Published private(set) var currentRoomState: StudyRoomState?

    /// Last study error if any
    @Published private(set) var lastError: StudyError?

    /// Whether currently loading rooms
    @Published private(set) var isLoadingRooms: Bool = false

    /// Whether currently syncing offline sessions
    @Published private(set) var isSyncing: Bool = false

    /// Number of pending offline sessions
    @Published private(set) var pendingOfflineSessions: Int = 0

    // MARK: - Dependencies

    private let apiClient: any APIClientProtocol
    private let clawbotChannelService: any ClawbotChannelServiceProtocol
    private let authService: any AuthServiceProtocol
    private let studySupabase: StudySupabaseProtocol

    // MARK: - Private Properties

    /// Timer for tracking study session duration
    private var sessionTimer: Timer?

    /// Timer start date for accurate time tracking
    private var sessionStartDate: Date?

    /// Current session ID (for Supabase updates)
    private var currentSessionId: String?

    /// Current room code if in a room
    private var currentRoomCode: String?

    /// Offline session storage key
    private let offlineSessionsKey = "study_offline_sessions"

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    /// UserDefaults for offline storage
    private let defaults = UserDefaults.standard

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - apiClient: API client instance (defaults to shared)
    ///   - clawbotChannelService: Clawbot Channel service (uses Socket.IO)
    ///   - authService: Auth service instance (defaults to shared)
    ///   - studySupabase: Supabase study operations (defaults to shared)
    init(
        apiClient: (any APIClientProtocol)? = nil,
        clawbotChannelService: (any ClawbotChannelServiceProtocol)? = nil,
        authService: (any AuthServiceProtocol)? = nil,
        studySupabase: StudySupabaseProtocol? = nil
    ) {
        self.apiClient = apiClient ?? APIClient.shared
        self.clawbotChannelService = clawbotChannelService ?? ClawbotChannelService.shared
        self.authService = authService ?? AuthService.shared
        self.studySupabase = studySupabase ?? SupabaseService.shared

        loadPendingOfflineSessions()
    }

    deinit {
        sessionTimer?.invalidate()
        sessionTimer = nil
    }

    // MARK: - Public Methods - Study Rooms

    /// Fetch all available study rooms
    /// - Returns: StudyResult containing the list of study rooms
    func fetchStudyRooms() async -> StudyResult<[StudyRoom]> {
        guard authService.isLoggedIn else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        isLoadingRooms = true
        lastError = nil

        do {
            // Fetch rooms from API
            let rooms: [StudyRoom] = try await apiClient.get(.studySessions)

            studyRooms = rooms
            isLoadingRooms = false

            return .success(rooms)

        } catch let error as NetworkError {
            isLoadingRooms = false
            let studyError = mapNetworkError(error)
            lastError = studyError
            return .failure(studyError)
        } catch {
            isLoadingRooms = false
            let studyError = StudyError.unknown(underlying: error)
            lastError = studyError
            return .failure(studyError)
        }
    }

    /// Create a new study room
    /// - Parameters:
    ///   - name: Room name
    ///   - maxMembers: Maximum number of members (default: 4)
    /// - Returns: StudyResult containing the created room
    func createStudyRoom(name: String, maxMembers: Int = 4) async -> StudyResult<StudyRoom> {
        guard authService.isLoggedIn else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        guard let user = authService.currentUser else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        lastError = nil

        // Use ClawbotChannelService (HTTP API) to create room - same as Web
        do {
            let roomState = try await clawbotChannelService.createStudyRoom(
                displayName: user.displayName ?? user.username ?? "User",
                avatarUrl: user.avatarUrl,
                maxMembers: maxMembers
            )

            // Convert StudyRoomState to StudyRoom
            let room = convertRoomStateToRoom(roomState)

            await MainActor.run {
                self.currentRoomState = roomState
                self.currentRoomCode = roomState.roomCode
            }

            return .success(room)
        } catch {
            let studyError = mapClawbotError(error)
            await MainActor.run {
                self.lastError = studyError
            }
            return .failure(studyError)
        }
    }

    /// Join a study room
    /// - Parameter roomCode: The room code to join
    /// - Returns: StudyResult containing the room state
    func joinStudyRoom(roomCode: String) async -> StudyResult<StudyRoomState> {
        guard authService.isLoggedIn else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        guard let user = authService.currentUser else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        lastError = nil

        // Validate room code format (6 characters)
        let trimmedCode = roomCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard trimmedCode.count == 6 else {
            let error = StudyError.invalidRoomCode
            lastError = error
            return .failure(error)
        }

        // Use ClawbotChannelService (HTTP API) to join room - same as Web
        do {
            let roomState = try await clawbotChannelService.joinStudyRoom(
                roomCode: trimmedCode,
                displayName: user.displayName ?? user.username ?? "User",
                avatarUrl: user.avatarUrl
            )

            await MainActor.run {
                self.currentRoomState = roomState
                self.currentRoomCode = roomState.roomCode
            }

            return .success(roomState)
        } catch {
            let studyError = mapClawbotError(error)
            await MainActor.run {
                self.lastError = studyError
            }
            return .failure(studyError)
        }
    }

    /// Leave the current study room
    /// - Returns: StudyResult indicating success or failure
    func leaveStudyRoom() async -> StudyResult<Void> {
        guard authService.isLoggedIn else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        lastError = nil

        // End active session if any
        if isActiveSession {
            _ = await endStudySession()
        }

        // Use ClawbotChannelService (Socket.IO) to leave room - same as Web
        do {
            try await clawbotChannelService.leaveStudyRoom(roomCode: currentRoomCode)

            await MainActor.run {
                self.currentRoomState = nil
                self.currentRoomCode = nil
            }

            return .success(())
        } catch {
            let studyError = mapClawbotError(error)
            await MainActor.run {
                self.lastError = studyError
                // Even if API call fails, clear local state
                self.currentRoomState = nil
                self.currentRoomCode = nil
            }
            return .failure(studyError)
        }
    }

    // MARK: - Public Methods - Study Sessions

    /// Start a study session in a room
    /// - Parameter roomCode: The room code (optional if already in a room)
    /// - Returns: StudyResult containing the started session
    func startStudySession(roomCode: String) async -> StudyResult<StudySession> {
        guard authService.isLoggedIn else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        guard let user = authService.currentUser else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        guard !isActiveSession else {
            let error = StudyError.sessionAlreadyActive
            lastError = error
            return .failure(error)
        }

        let targetRoomCode = roomCode

        lastError = nil

        do {
            // Create session via Supabase directly
            let sessionId = try await studySupabase.createStudySession(subject: "自习")
            let startDate = Date()

            // Create local session object
            let session = StudySession(
                id: sessionId,
                userId: user.id,
                duration: 0,
                startedAt: startDate,
                endedAt: nil,
                earnedPoints: nil,
                isCompleted: false,
                subject: "自习",
                notes: nil,
                createdAt: startDate
            )

            // Start timer
            startSessionTimer()

            // Update state
            currentSession = session
            isActiveSession = true
            sessionState = .focusing
            sessionStartDate = startDate

            // Notify room members if host
            if let roomState = currentRoomState,
               roomState.hostUserId == user.id {
                Task {
                    try? await clawbotChannelService.hostActionStudyRoom(
                        roomCode: targetRoomCode,
                        action: .startFocus
                    )
                }
            }

            return .success(session)

        } catch let error as StudyError {
            lastError = error
            return .failure(error)
        } catch {
            let studyError = StudyError.networkError(underlying: error)
            lastError = studyError
            return .failure(studyError)
        }
    }

    /// End the current study session
    /// - Returns: StudyResult containing the completed session
    func endStudySession() async -> StudyResult<StudySession> {
        guard authService.isLoggedIn else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        guard isActiveSession else {
            let error = StudyError.noActiveSession
            lastError = error
            return .failure(error)
        }

        guard let session = currentSession else {
            let error = StudyError.noActiveSession
            lastError = error
            return .failure(error)
        }

        lastError = nil

        // Stop timer
        stopSessionTimer()

        // Calculate final duration
        let duration = Int(currentFocusTime / 60) // Convert to minutes

        do {
            // Update session via Supabase directly
            if let sessionId = currentSession?.id {
                try await studySupabase.updateStudySession(
                    sessionId: sessionId,
                    duration: duration
                )
            }

            let endDate = Date()

            // Create updated session object
            let updatedSession = StudySession(
                id: session.id,
                userId: session.userId,
                duration: duration,
                startedAt: session.startedAt,
                endedAt: endDate,
                earnedPoints: nil,
                isCompleted: true,
                subject: session.subject,
                notes: session.notes,
                createdAt: session.createdAt
            )

            // Update state
            currentSession = updatedSession
            isActiveSession = false
            sessionState = .idle
            currentFocusTime = 0
            sessionStartDate = nil

            // Notify room members if host
            if let user = authService.currentUser,
               let roomCode = currentRoomCode,
               let roomState = currentRoomState,
               roomState.hostUserId == user.id {
                Task {
                    try? await clawbotChannelService.hostActionStudyRoom(
                        roomCode: roomCode,
                        action: .end
                    )
                }
            }

            return .success(updatedSession)

        } catch let error as StudyError {
            // Even if API fails, save session locally for later sync
            saveOfflineSession(session: session, duration: duration)

            // Clear local state
            currentSession = nil
            isActiveSession = false
            sessionState = .idle
            currentFocusTime = 0
            sessionStartDate = nil

            lastError = error
            return .failure(error)
        } catch {
            let studyError = StudyError.networkError(underlying: error)

            // Save session locally for later sync
            saveOfflineSession(session: session, duration: duration)

            // Clear local state
            currentSession = nil
            isActiveSession = false
            sessionState = .idle
            currentFocusTime = 0
            sessionStartDate = nil

            lastError = studyError
            return .failure(studyError)
        }
    }

    // MARK: - Public Methods - Statistics

    /// Fetch study statistics
    /// - Returns: StudyResult containing study statistics
    func fetchStudyStats() async -> StudyResult<StudyStats> {
        guard authService.isLoggedIn else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        lastError = nil

        do {
            let stats: StudyStats = try await apiClient.get(.studyStats)
            return .success(stats)

        } catch let error as NetworkError {
            let studyError = mapNetworkError(error)
            lastError = studyError
            return .failure(studyError)
        } catch {
            let studyError = StudyError.unknown(underlying: error)
            lastError = studyError
            return .failure(studyError)
        }
    }

    /// Sync offline study sessions to server
    /// - Returns: StudyResult containing the number of synced sessions
    func syncOfflineSessions() async -> StudyResult<Int> {
        guard authService.isLoggedIn else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        let offlineSessions = getOfflineSessions()
        guard !offlineSessions.isEmpty else {
            return .success(0)
        }

        isSyncing = true
        lastError = nil

        var syncedCount = 0
        var failedSessions: [[String: Any]] = []

        for sessionData in offlineSessions {
            do {
                // Extract session data
                guard let duration = sessionData["duration"] as? Int else {
                    failedSessions.append(sessionData)
                    continue
                }

                // Create sync request
                let request = CreateStudySessionRequest(duration: duration)

                // Send to API
                let _: EmptyResponse = try await apiClient.post(
                    .studySessions,
                    body: request
                )

                syncedCount += 1

            } catch {
                // Keep failed sessions for retry
                failedSessions.append(sessionData)
            }
        }

        // Update offline storage with only failed sessions
        saveOfflineSessions(failedSessions)
        pendingOfflineSessions = failedSessions.count

        isSyncing = false

        if syncedCount > 0 {
            return .success(syncedCount)
        } else {
            let error = StudyError.syncFailed
            lastError = error
            return .failure(error)
        }
    }

    // MARK: - Public Methods - Timer Control

    /// Pause the current study session
    func pauseSession() {
        guard isActiveSession else { return }

        stopSessionTimer()
        sessionState = .paused

        // Notify room members if host
        if let user = authService.currentUser,
           let roomCode = currentRoomCode,
           let roomState = currentRoomState,
           roomState.hostUserId == user.id {
            Task {
                try? await clawbotChannelService.hostActionStudyRoom(
                    roomCode: roomCode,
                    action: .pause
                )
            }
        }
    }

    /// Resume the paused study session
    func resumeSession() {
        guard isActiveSession else { return }

        startSessionTimer()
        sessionState = .focusing

        // Notify room members if host
        if let user = authService.currentUser,
           let roomCode = currentRoomCode,
           let roomState = currentRoomState,
           roomState.hostUserId == user.id {
            Task {
                try? await clawbotChannelService.hostActionStudyRoom(
                    roomCode: roomCode,
                    action: .startFocus
                )
            }
        }
    }

    // MARK: - Protocol Conformance Methods

    /// Join a study room (alias for joinStudyRoom)
    func joinRoom(_ roomCode: String) async -> StudyResult<StudyRoomState> {
        return await joinStudyRoom(roomCode: roomCode)
    }

    /// Leave a study room (alias for leaveStudyRoom)
    func leaveRoom(_ roomCode: String) async -> StudyResult<Void> {
        return await leaveStudyRoom()
    }

    /// Start a focus session (alias for startStudySession)
    func startFocusSession(roomCode: String) async -> StudyResult<StudySession> {
        return await startStudySession(roomCode: roomCode)
    }

    /// End a session with room code (alias for endStudySession)
    func endSession(roomCode: String) async -> StudyResult<StudySession> {
        return await endStudySession()
    }

    /// Pause session with room code
    func pauseSession(roomCode: String) async throws {
        pauseSession()
    }

    /// Resume session with room code
    func resumeSession(roomCode: String) async throws {
        resumeSession()
    }

    /// Get study stats (alias for fetchStudyStats)
    func getStudyStats() async -> StudyResult<StudyStats> {
        return await fetchStudyStats()
    }

    /// Get weekly study data
    func getWeeklyStudyData() async -> StudyResult<[DailyStudyData]> {
        guard authService.isLoggedIn else {
            let error = StudyError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        lastError = nil
        do {
            let response: WeeklyStudyDataResponse = try await apiClient.get(.weeklyStudyData)
            return .success(response.data)
        } catch let error as NetworkError {
            let studyError = mapNetworkError(error)
            lastError = studyError
            return .failure(studyError)
        } catch {
            let studyError = StudyError.unknown(underlying: error)
            lastError = studyError
            return .failure(studyError)
        }
    }

    // MARK: - Private Methods - Timer Management

    /// Start the session timer
    private func startSessionTimer() {
        guard sessionTimer == nil else { return }

        sessionStartDate = sessionStartDate ?? Date()

        sessionTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateSessionTime()
            }
        }
    }

    /// Stop the session timer
    private func stopSessionTimer() {
        sessionTimer?.invalidate()
        sessionTimer = nil
    }

    /// Update the session time
    private func updateSessionTime() {
        guard let startDate = sessionStartDate else { return }

        let elapsed = Date().timeIntervalSince(startDate)
        currentFocusTime = elapsed
    }

    // MARK: - Private Methods - Offline Storage

    /// Load pending offline sessions from storage
    private func loadPendingOfflineSessions() {
        let sessions = getOfflineSessions()
        pendingOfflineSessions = sessions.count
    }

    /// Get all offline sessions from storage
    private func getOfflineSessions() -> [[String: Any]] {
        guard let data = defaults.data(forKey: offlineSessionsKey) else {
            return []
        }

        guard let sessions = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        return sessions.compactMap { dict -> [String: Any]? in
            guard let id = dict["id"] as? String,
                  let duration = dict["duration"] as? Int else {
                return nil
            }

            var result: [String: Any] = [
                "id": id,
                "duration": duration
            ]

            if let startedAt = dict["startedAt"] as? String {
                result["startedAt"] = startedAt
            }

            return result
        }
    }

    /// Save offline sessions to storage
    private func saveOfflineSessions(_ sessions: [[String: Any]]) {
        if let data = try? JSONSerialization.data(withJSONObject: sessions) {
            defaults.set(data, forKey: offlineSessionsKey)
            pendingOfflineSessions = sessions.count
        } else {
            defaults.removeObject(forKey: offlineSessionsKey)
            pendingOfflineSessions = 0
        }
    }

    /// Save a session offline for later sync
    private func saveOfflineSession(session: StudySession, duration: Int) {
        var sessions = getOfflineSessions()
        let formatter = ISO8601DateFormatter()

        let sessionData: [String: Any] = [
            "id": session.id,
            "duration": duration,
            "startedAt": formatter.string(from: session.startedAt)
        ]

        sessions.append(sessionData)
        saveOfflineSessions(sessions)
    }

    // MARK: - Private Methods - Error Mapping

    /// Map network errors to study errors
    private func mapNetworkError(_ error: NetworkError) -> StudyError {
        switch error {
        case .noConnection, .timeout:
            return .networkError(underlying: error)
        case .unauthorized:
            return .notAuthenticated
        case .notFound:
            return .roomNotFound
        case .custom(let message):
            if message.contains("full") {
                return .roomFull
            } else if message.contains("host") {
                return .notRoomHost
            } else {
                let nsError = NSError(domain: "NetworkError", code: -1, userInfo: [NSLocalizedDescriptionKey: message])
                return .unknown(underlying: nsError)
            }
        default:
            return .unknown(underlying: error)
        }
    }

    /// Map Clawbot errors to study errors
    private func mapClawbotError(_ error: any Error) -> StudyError {
        // If it's a ClawbotError, extract message
        if let clawError = error as? ClawbotError {
            switch clawError {
            case .notConnected:
                return .webSocketNotConnected
            case .notPaired:
                return .notAuthenticated
            case .messageFailed(let message):
                if message.contains("not found") {
                    return .roomNotFound
                } else if message.contains("full") {
                    return .roomFull
                }
                return .unknown(underlying: error)
            case .invalidResponse:
                return .unknown(underlying: error)
            default:
                return .unknown(underlying: error)
            }
        }
        // For other errors, wrap in networkError
        return .networkError(underlying: error)
    }

    /// Convert ClawbotStudyRoomState to StudyRoom
    private func convertClawbotRoomStateToRoom(_ state: ClawbotStudyRoomState) -> StudyRoom {
        let members = state.participants.map { participant in
            StudyRoomMember(
                userId: participant.userId,
                displayName: participant.displayName,
                avatarUrl: participant.avatarUrl,
                joinedAt: participant.joinedAt ?? Date(),
                lastActiveAt: participant.joinedAt ?? Date(),
                status: .online
            )
        }

        return StudyRoom(
            id: state.roomCode,
            roomCode: state.roomCode,
            name: state.roomName,
            hostUserId: state.hostId,
            maxMembers: 4, // Default max members
            members: members,
            sessionState: StudyRoomSessionState(rawValue: state.status) ?? .idle,
            createdAt: state.createdAt ?? Date(),
            updatedAt: state.createdAt ?? Date()
        )
    }

    /// Convert ClawbotStudyRoomState to StudyRoomState
    private func convertClawbotRoomStateToStudyRoomState(_ state: ClawbotStudyRoomState) -> StudyRoomState {
        let members = state.participants.map { participant in
            StudyRoomMember(
                userId: participant.userId,
                displayName: participant.displayName,
                avatarUrl: participant.avatarUrl,
                joinedAt: participant.joinedAt ?? Date(),
                lastActiveAt: participant.joinedAt ?? Date(),
                status: .online
            )
        }

        return StudyRoomState(
            roomCode: state.roomCode,
            hostUserId: state.hostId,
            sessionState: StudyRoomSessionState(rawValue: state.status) ?? .idle,
            members: members,
            maxMembers: 4,
            version: 1,
            createdAt: state.createdAt ?? Date(),
            updatedAt: state.createdAt ?? Date(),
            timer: nil
        )
    }

    /// Convert StudyRoomState to StudyRoom
    private func convertRoomStateToRoom(_ state: StudyRoomState) -> StudyRoom {
        return StudyRoom(
            id: state.roomCode,
            roomCode: state.roomCode,
            name: "Room \(state.roomCode)", // Generate name from code
            hostUserId: state.hostUserId,
            maxMembers: state.maxMembers,
            members: state.members,
            sessionState: state.sessionState,
            createdAt: state.createdAt,
            updatedAt: state.updatedAt
        )
    }
}

// MARK: - Convenience Extensions

extension StudyService {

    /// Get formatted time string as MM:SS or HH:MM:SS when the session exceeds one hour
    var formattedFocusTime: String {
        let hours = Int(currentFocusTime) / 3600
        let minutes = Int(currentFocusTime) / 60 % 60
        let seconds = Int(currentFocusTime) % 60

        if hours > 0 {
            return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%02d:%02d", minutes, seconds)
        }
    }

    /// Get focus time in minutes
    var focusTimeInMinutes: Int {
        Int(currentFocusTime / 60)
    }

    /// Check if user is room host
    var isRoomHost: Bool {
        guard let user = authService.currentUser,
              let roomState = currentRoomState else {
            return false
        }
        return roomState.hostUserId == user.id
    }

    /// Get current room member count
    var currentRoomMemberCount: Int {
        currentRoomState?.members.count ?? 0
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    /// Refresh current room state
    func refreshRoomState() async -> StudyResult<StudyRoomState> {
        guard let roomCode = currentRoomCode else {
            return .failure(.roomNotFound)
        }

        return await joinStudyRoom(roomCode: roomCode)
    }
}

// MARK: - AsyncStream Support (iOS 16+)

#if swift(>=5.9)
extension StudyService {

    /// Observe session state changes as AsyncStream
    var sessionStateStream: AsyncStream<TimerState> {
        AsyncStream { continuation in
            // Emit initial state
            continuation.yield(sessionState)

            // Observe changes
            $sessionState
                .dropFirst()
                .sink { state in
                    continuation.yield(state)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // Cleanup handled by cancellables
            }
        }
    }

    /// Observe focus time updates as AsyncStream
    var focusTimeStream: AsyncStream<TimeInterval> {
        AsyncStream { continuation in
            // Emit initial time
            continuation.yield(currentFocusTime)

            // Observe changes
            $currentFocusTime
                .dropFirst()
                .sink { time in
                    continuation.yield(time)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // Cleanup handled by cancellables
            }
        }
    }

    /// Observe room state updates as AsyncStream
    var roomStateStream: AsyncStream<StudyRoomState?> {
        AsyncStream { continuation in
            // Emit initial state
            continuation.yield(currentRoomState)

            // Observe changes
            $currentRoomState
                .dropFirst()
                .sink { state in
                    continuation.yield(state)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // Cleanup handled by cancellables
            }
        }
    }
}
#endif
