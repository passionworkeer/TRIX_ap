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

// MARK: - Study Result

/// Result type for study operations
typealias StudyResult<T> = Result<T, StudyError>

// MARK: - Study Service Protocol

/// Protocol defining study service interface
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

    private let apiClient: APIClientProtocol
    private let webSocketManager: WebSocketManagerProtocol
    private let authService: AuthServiceProtocol

    // MARK: - Private Properties

    /// Timer for tracking study session duration
    private var sessionTimer: Timer?

    /// Timer start date for accurate time tracking
    private var sessionStartDate: Date?

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
    ///   - webSocketManager: WebSocket manager instance (defaults to shared)
    ///   - authService: Auth service instance (defaults to shared)
    init(
        apiClient: APIClientProtocol? = nil,
        webSocketManager: WebSocketManagerProtocol? = nil,
        authService: AuthServiceProtocol? = nil
    ) {
        self.apiClient = apiClient ?? APIClient.shared
        self.webSocketManager = webSocketManager ?? WebSocketManager.shared
        self.authService = authService ?? AuthService.shared

        setupWebSocketListeners()
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

        // Use WebSocket to create room
        return await withCheckedContinuation { continuation in
            webSocketManager.createStudyRoom(
                displayName: user.displayName ?? user.username,
                avatarUrl: user.avatarUrl,
                maxMembers: maxMembers
            ) { result in
                switch result {
                case .success(let payload):
                    if let roomState = payload.room {
                        Task { @MainActor in
                            // Convert StudyRoomState to StudyRoom
                            let room = self.convertRoomStateToRoom(roomState)
                            self.currentRoomState = roomState
                            self.currentRoomCode = roomState.roomCode

                            continuation.resume(returning: .success(room))
                        }
                    } else if let code = payload.roomCode {
                        // Room created successfully, fetch state
                        Task {
                            let stateResult = await self.fetchRoomState(roomCode: code)
                            switch stateResult {
                            case .success(let state):
                                let room = self.convertRoomStateToRoom(state)
                                self.currentRoomState = state
                                self.currentRoomCode = state.roomCode
                                continuation.resume(returning: .success(room))
                            case .failure(let error):
                                continuation.resume(returning: .failure(error))
                            }
                        }
                    } else {
                        Task { @MainActor in
                            let error = StudyError.unknown(underlying: nil)
                            self.lastError = error
                            continuation.resume(returning: .failure(error))
                        }
                    }

                case .failure(let error):
                    Task { @MainActor in
                        let studyError = self.mapWebSocketError(error)
                        self.lastError = studyError
                        continuation.resume(returning: .failure(studyError))
                    }
                }
            }
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

        // Use WebSocket to join room
        return await withCheckedContinuation { continuation in
            webSocketManager.joinStudyRoom(
                roomCode: trimmedCode,
                displayName: user.displayName ?? user.username,
                avatarUrl: user.avatarUrl
            ) { result in
                switch result {
                case .success(let payload):
                    if let roomState = payload.room {
                        Task { @MainActor in
                            self.currentRoomState = roomState
                            self.currentRoomCode = roomState.roomCode
                            continuation.resume(returning: .success(roomState))
                        }
                    } else {
                        Task { @MainActor in
                            let error = StudyError.roomNotFound
                            self.lastError = error
                            continuation.resume(returning: .failure(error))
                        }
                    }

                case .failure(let error):
                    Task { @MainActor in
                        let studyError = self.mapWebSocketError(error)
                        self.lastError = studyError
                        continuation.resume(returning: .failure(studyError))
                    }
                }
            }
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

        // Use WebSocket to leave room
        return await withCheckedContinuation { continuation in
            webSocketManager.leaveStudyRoom(roomCode: currentRoomCode) { result in
                Task { @MainActor in
                    switch result {
                    case .success:
                        self.currentRoomState = nil
                        self.currentRoomCode = nil
                        continuation.resume(returning: .success(()))

                    case .failure(let error):
                        let studyError = self.mapWebSocketError(error)
                        self.lastError = studyError

                        // Even if API call fails, clear local state
                        self.currentRoomState = nil
                        self.currentRoomCode = nil

                        continuation.resume(returning: .failure(studyError))
                    }
                }
            }
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

        let targetRoomCode = roomCode ?? currentRoomCode
        guard targetRoomCode != nil else {
            let error = StudyError.roomNotFound
            lastError = error
            return .failure(error)
        }

        lastError = nil

        do {
            // Create session via API
            let request = CreateStudySessionRequest(durationMinutes: 0) // 0 means ongoing
            let session: StudySession = try await apiClient.post(
                .studySessions,
                body: request
            )

            // Start timer
            startSessionTimer()

            // Update state
            currentSession = session
            isActiveSession = true
            sessionState = .focusing
            sessionStartDate = Date()

            // Notify room members if host
            if let roomCode = targetRoomCode,
               let roomState = currentRoomState,
               roomState.hostUserId == user.id {
                webSocketManager.hostActionStudyRoom(
                    roomCode: roomCode,
                    action: StudyRoomHostAction.startFocus.rawValue
                ) { _ in }
            }

            return .success(session)

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

        guard var session = currentSession else {
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
            // Update session via API
            let updateRequest = CreateStudySessionRequest(durationMinutes: duration)
            let updatedSession: StudySession = try await apiClient.put(
                .updateStudySession(id: session.id),
                body: updateRequest
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
                webSocketManager.hostActionStudyRoom(
                    roomCode: roomCode,
                    action: StudyRoomHostAction.end.rawValue
                ) { _ in }
            }

            return .success(updatedSession)

        } catch let error as NetworkError {
            let studyError = mapNetworkError(error)

            // Even if API fails, save session locally for later sync
            saveOfflineSession(session: session, duration: duration)

            // Clear local state
            currentSession = nil
            isActiveSession = false
            sessionState = .idle
            currentFocusTime = 0
            sessionStartDate = nil

            lastError = studyError
            return .failure(studyError)
        } catch {
            let studyError = StudyError.unknown(underlying: error)

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
                guard let sessionId = sessionData["id"] as? String,
                      let duration = sessionData["duration"] as? Int,
                      let startedAt = sessionData["startedAt"] as? Date else {
                    failedSessions.append(sessionData)
                    continue
                }

                // Create sync request
                let request = CreateStudySessionRequest(durationMinutes: duration)

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
            webSocketManager.hostActionStudyRoom(
                roomCode: roomCode,
                action: StudyRoomHostAction.pause.rawValue
            ) { _ in }
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
            webSocketManager.hostActionStudyRoom(
                roomCode: roomCode,
                action: StudyRoomHostAction.startFocus.rawValue
            ) { _ in }
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

    // MARK: - Private Methods - WebSocket

    /// Set up WebSocket event listeners
    private func setupWebSocketListeners() {
        // Listen for connection events
        webSocketManager.on("connected") { [weak self] _ in
            Task { @MainActor in
                self?.isWebSocketConnected = true

                // Re-fetch room state if was in a room
                if let roomCode = self?.currentRoomCode {
                    _ = await self?.fetchRoomState(roomCode: roomCode)
                }
            }
        }

        webSocketManager.on("disconnected") { [weak self] _ in
            Task { @MainActor in
                self?.isWebSocketConnected = false
            }
        }

        // Listen for study room state updates
        webSocketManager.on("study_room_state") { [weak self] result in
            Task { @MainActor in
                self?.handleStudyRoomStateEvent(result)
            }
        }
    }

    /// Handle study room state event from WebSocket
    private func handleStudyRoomStateEvent(_ result: Any) {
        guard let event = result as? StudyRoomStateEvent else { return }

        // Update room state
        if let roomState = event.room {
            currentRoomState = roomState

            // Update session state based on room state
            switch roomState.sessionState {
            case .focusing:
                if isActiveSession {
                    sessionState = .focusing
                }
            case .resting:
                if isActiveSession {
                    sessionState = .resting
                }
            case .active, .idle:
                break
            }
        }
    }

    /// Fetch room state via WebSocket
    private func fetchRoomState(roomCode: String) async -> StudyResult<StudyRoomState> {
        return await withCheckedContinuation { continuation in
            webSocketManager.getStudyRoomState(roomCode: roomCode) { result in
                switch result {
                case .success(let payload):
                    if let roomState = payload.room {
                        continuation.resume(returning: .success(roomState))
                    } else {
                        Task { @MainActor in
                            let error = StudyError.roomNotFound
                            self.lastError = error
                            continuation.resume(returning: .failure(error))
                        }
                    }

                case .failure(let error):
                    Task { @MainActor in
                        let studyError = self.mapWebSocketError(error)
                        self.lastError = studyError
                        continuation.resume(returning: .failure(studyError))
                    }
                }
            }
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

        // Use JSONSerialization instead of JSONDecoder for [String: Any]
        guard let sessions = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        // Convert to proper format
        return sessions.compactMap { dict -> [String: Any]? in
            var result: [String: Any] = [:]

            if let id = dict["id"] as? String {
                result["id"] = id
            }
            if let duration = dict["duration"] as? Int {
                result["duration"] = duration
            }
            if let startedAtString = dict["startedAt"] as? String,
               let startedAt = ISO8601DateFormatter().date(from: startedAtString) {
                result["startedAt"] = startedAt
            }

            return result.isEmpty ? nil : result
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

        let sessionData: [String: Any] = [
            "id": session.id,
            "duration": duration,
            "startedAt": session.startedAt
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

    /// Map WebSocket errors to study errors
    private func mapWebSocketError(_ error: any Error) -> StudyError {
        // If it's already a WebSocketError, extract message
        if let wsError = error as? WebSocketError {
            if wsError.message.contains("Not connected") {
                return .webSocketNotConnected
            } else if wsError.message.contains("not found") {
                return .roomNotFound
            } else if wsError.message.contains("full") {
                return .roomFull
            } else {
                return .unknown(underlying: error)
            }
        }
        // For other errors, wrap in networkError
        return .networkError(underlying: error)
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

    /// Get formatted time string (HH:MM:SS)
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

        return await fetchRoomState(roomCode: roomCode)
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
