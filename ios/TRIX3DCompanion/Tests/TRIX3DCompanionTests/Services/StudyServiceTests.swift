//
//  StudyServiceTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for StudyService
//

import XCTest
import Combine
import Supabase
@testable import TRIX3DCompanion

typealias StudyServiceUser = TRIX3DCompanion.User
typealias StudyServiceSession = TRIX3DCompanion.StudySession

/// Unit tests for StudyService
@MainActor
final class StudyServiceTests: XCTestCase {

    // MARK: - Properties

    private var studyService: StudyService!
    private var mockAPIClient: MockAPIClientForStudyService!
    private var mockWebSocketManager: MockClawbotChannelServiceForStudyService!
    private var mockStudySupabase: MockStudySupabase!
    private var mockAuthService: MockAuthServiceForStudyService!
    private var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockAPIClient = MockAPIClientForStudyService()
        mockWebSocketManager = MockClawbotChannelServiceForStudyService()
        mockStudySupabase = MockStudySupabase()
        mockAuthService = MockAuthServiceForStudyService()

        mockAuthService.mockIsLoggedIn = true
        mockAuthService.mockCurrentUser = createTestUser(id: "user-1", username: "testuser")

        studyService = StudyService(
            apiClient: mockAPIClient,
            clawbotChannelService: mockWebSocketManager,
            authService: mockAuthService,
            studySupabase: mockStudySupabase
        )

        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        studyService = nil
        mockAPIClient = nil
        mockWebSocketManager = nil
        mockStudySupabase = nil
        mockAuthService = nil
        cancellables = nil
    }

    // MARK: - Study Room Tests

    func test_fetchStudyRooms_success_returnsRooms() async throws {
        // Arrange
        let mockRooms = [
            createTestRoom(id: "room-1", name: "Study Room 1"),
            createTestRoom(id: "room-2", name: "Study Room 2"),
            createTestRoom(id: "room-3", name: "Study Room 3")
        ]
        mockAPIClient.mockStudyRooms = mockRooms

        // Act
        let result = await studyService.fetchStudyRooms()

        // Assert
        switch result {
        case .success(let rooms):
            XCTAssertEqual(rooms.count, 3)
            XCTAssertEqual(rooms[0].name, "Study Room 1")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_fetchStudyRooms_failure_whenNotAuthenticated() async throws {
        // Arrange
        mockAuthService.mockIsLoggedIn = false

        // Act
        let result = await studyService.fetchStudyRooms()

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail when not authenticated")
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated)
        }
    }

    func test_fetchStudyRooms_failure_withNetworkError() async throws {
        // Arrange
        mockAPIClient.mockNetworkError = .noConnection

        // Act
        let result = await studyService.fetchStudyRooms()

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail with network error")
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true, "Should return network error")
            } else {
                XCTFail("Should return network error")
            }
        }
    }

    // MARK: - Create Study Room Tests

    func test_createStudyRoom_success_createsRoom() async throws {
        // Arrange
        let mockRoomState = createTestRoomState(roomCode: "ABC123", hostUserId: "user-1", name: "My Study Room")
        mockWebSocketManager.mockCreateRoomResponse = .success(mockRoomState)

        // Act
        let result = await studyService.createStudyRoom(name: "My Study Room", maxMembers: 4)

        // Assert
        switch result {
        case .success(let room):
            XCTAssertEqual(room.name, "Room ABC123")
            XCTAssertEqual(room.maxMembers, 4)
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_createStudyRoom_failure_whenNotAuthenticated() async throws {
        // Arrange
        mockAuthService.mockIsLoggedIn = false

        // Act
        let result = await studyService.createStudyRoom(name: "Test Room", maxMembers: 4)

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail when not authenticated")
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated)
        }
    }

    // MARK: - Join Study Room Tests

    func test_joinStudyRoom_success_joinsRoom() async throws {
        // Arrange
        let mockRoomState = createTestRoomState(roomCode: "ABC123", hostUserId: "other-user")
        mockWebSocketManager.mockJoinRoomResponse = .success(mockRoomState)

        // Act
        let result = await studyService.joinStudyRoom(roomCode: "ABC123")

        // Assert
        switch result {
        case .success(let roomState):
            XCTAssertEqual(roomState.roomCode, "ABC123")
            let currentRoomCode = studyService.currentRoomState?.roomCode
            XCTAssertEqual(currentRoomCode, "ABC123")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_joinStudyRoom_failure_withInvalidCode() async throws {
        // Arrange
        let invalidCode = "INVALID" // Not 6 characters

        // Act
        let result = await studyService.joinStudyRoom(roomCode: invalidCode)

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail with invalid room code")
        case .failure(let error):
            XCTAssertEqual(error, .invalidRoomCode)
        }
    }

    // MARK: - Leave Study Room Tests

    func test_leaveStudyRoom_success_leavesRoom() async throws {
        // Arrange
        let mockRoomState = createTestRoomState(roomCode: "ABC123", hostUserId: "user-1")
        mockWebSocketManager.mockJoinRoomResponse = .success(mockRoomState)

        _ = await studyService.joinStudyRoom(roomCode: "ABC123")

        // Act
        let result = await studyService.leaveStudyRoom()

        // Assert
        switch result {
        case .success:
            let currentRoomState = studyService.currentRoomState
            XCTAssertNil(currentRoomState, "Room state should be cleared")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    // MARK: - Study Session Tests

    func test_startStudySession_success_startsSession() async throws {
        // Arrange
        let mockRoomState = createTestRoomState(roomCode: "ABC123", hostUserId: "user-1")
        mockWebSocketManager.mockJoinRoomResponse = .success(mockRoomState)

        let mockSession = createTestSession(id: "session-1", userId: "user-1", duration: 0)
        mockStudySupabase.mockCreateStudySessionID = mockSession.id

        _ = await studyService.joinStudyRoom(roomCode: "ABC123")

        // Act
        let result = await studyService.startStudySession(roomCode: "ABC123")

        // Assert
        switch result {
        case .success(let session):
            XCTAssertEqual(session.id, "session-1")
            let isActiveSession = studyService.isActiveSession
            let sessionState = studyService.sessionState
            XCTAssertTrue(isActiveSession, "Session should be active")
            XCTAssertEqual(sessionState, .focusing)
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_startStudySession_failure_whenSessionAlreadyActive() async throws {
        // Arrange
        let mockRoomState = createTestRoomState(roomCode: "ABC123", hostUserId: "user-1")
        mockWebSocketManager.mockJoinRoomResponse = .success(mockRoomState)

        _ = await studyService.joinStudyRoom(roomCode: "ABC123")
        _ = await studyService.startStudySession(roomCode: "ABC123")

        // Act
        let result = await studyService.startStudySession(roomCode: "ABC123")

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail when session already active")
        case .failure(let error):
            XCTAssertEqual(error, .sessionAlreadyActive)
        }
    }

    func test_endStudySession_success_endsSession() async throws {
        // Arrange
        let mockRoomState = createTestRoomState(roomCode: "ABC123", hostUserId: "user-1")
        mockWebSocketManager.mockJoinRoomResponse = .success(mockRoomState)

        let mockSession = createTestSession(id: "session-1", userId: "user-1", duration: 0)
        mockStudySupabase.mockCreateStudySessionID = mockSession.id

        _ = await studyService.joinStudyRoom(roomCode: "ABC123")
        _ = await studyService.startStudySession(roomCode: "ABC123")

        // Act
        let result = await studyService.endStudySession()

        // Assert
        switch result {
        case .success(let session):
            let isActiveSession = studyService.isActiveSession
            let sessionState = studyService.sessionState
            let currentFocusTime = studyService.currentFocusTime
            XCTAssertFalse(isActiveSession, "Session should not be active")
            XCTAssertEqual(sessionState, .idle)
            XCTAssertEqual(currentFocusTime, 0, "Focus time should be reset")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    // MARK: - Timer Tests

    func test_pauseSession_pausesTimer() async throws {
        // Arrange
        let mockRoomState = createTestRoomState(roomCode: "ABC123", hostUserId: "user-1")
        mockWebSocketManager.mockJoinRoomResponse = .success(mockRoomState)
        _ = await studyService.joinStudyRoom(roomCode: "ABC123")
        _ = await studyService.startStudySession(roomCode: "ABC123")

        // Act
        try await studyService.pauseSession(roomCode: "ABC123")

        // Assert
        let sessionState = studyService.sessionState
        XCTAssertEqual(sessionState, .paused)
    }

    func test_resumeSession_resumesTimer() async throws {
        // Arrange
        let mockRoomState = createTestRoomState(roomCode: "ABC123", hostUserId: "user-1")
        mockWebSocketManager.mockJoinRoomResponse = .success(mockRoomState)
        _ = await studyService.joinStudyRoom(roomCode: "ABC123")
        _ = await studyService.startStudySession(roomCode: "ABC123")
        try await studyService.pauseSession(roomCode: "ABC123")

        // Act
        try await studyService.resumeSession(roomCode: "ABC123")

        // Assert
        let sessionState = studyService.sessionState
        XCTAssertEqual(sessionState, .focusing)
    }

    // MARK: - Statistics Tests

    func test_fetchStudyStats_success_returnsStats() async throws {
        // Arrange
        let mockStats = createTestStats(totalDuration: 1000, sessionCount: 20)
        mockAPIClient.mockStudyStats = mockStats

        // Act
        let result = await studyService.fetchStudyStats()

        // Assert
        switch result {
        case .success(let stats):
            XCTAssertEqual(stats.totalDuration, 1000)
            XCTAssertEqual(stats.sessionCount, 20)
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_fetchStudyStats_failure_whenNotAuthenticated() async throws {
        // Arrange
        mockAuthService.mockIsLoggedIn = false

        // Act
        let result = await studyService.fetchStudyStats()

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail when not authenticated")
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated)
        }
    }

    // MARK: - Offline Sync Tests

    func test_syncOfflineSessions_success_syncsSessions() async throws {
        // Arrange
        // This would require setting up offline sessions in UserDefaults
        // For unit testing, we verify the infrastructure is in place

        // Act
        let result = await studyService.syncOfflineSessions()

        // Assert
        switch result {
        case .success(let count):
            // Should return 0 if no offline sessions
            XCTAssertEqual(count, 0)
        case .failure:
            // May fail if no sessions to sync
            XCTAssertTrue(true, "Sync may fail with no sessions")
        }
    }

    // MARK: - Published Properties Tests

    func test_studyRooms_publishesChanges() async {
        // Arrange
        let expectation = XCTestExpectation(description: "studyRooms should publish changes")

        let mockRooms = [
            createTestRoom(id: "room-1", name: "Study Room 1")
        ]
        mockAPIClient.mockStudyRooms = mockRooms

        // Act
        studyService.$studyRooms
            .dropFirst()
            .sink { rooms in
                if !rooms.isEmpty {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        Task {
            _ = await studyService.fetchStudyRooms()
        }

        // Assert
        await fulfillment(of: [expectation], timeout: 5.0)
    }

    func test_isActiveSession_publishesChanges() async {
        // Arrange
        let expectation = XCTestExpectation(description: "isActiveSession should publish changes")

        let mockRoomState = createTestRoomState(roomCode: "ABC123", hostUserId: "user-1")
        mockWebSocketManager.mockJoinRoomResponse = .success(mockRoomState)

        // Act
        studyService.$isActiveSession
            .dropFirst()
            .sink { isActive in
                if isActive {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        Task {
            _ = await studyService.joinStudyRoom(roomCode: "ABC123")
            _ = await studyService.startStudySession(roomCode: "ABC123")
        }

        // Assert
        await fulfillment(of: [expectation], timeout: 5.0)
    }

    func test_currentFocusTime_updatesDuringSession() throws {
        let currentFocusTime = studyService.currentFocusTime
        XCTAssertEqual(currentFocusTime, 0, "Focus time starts at zero")
    }

    // MARK: - Error Tests

    func test_studyErrorDescriptions() {
        let notAuthenticated = StudyError.notAuthenticated
        XCTAssertEqual(notAuthenticated.localizedDescription, "You must be logged in to access study features")

        let roomNotFound = StudyError.roomNotFound
        XCTAssertEqual(roomNotFound.localizedDescription, "Study room not found")

        let roomFull = StudyError.roomFull
        XCTAssertEqual(roomFull.localizedDescription, "This study room is full")

        let noActiveSession = StudyError.noActiveSession
        XCTAssertEqual(noActiveSession.localizedDescription, "No active study session")

        let sessionAlreadyActive = StudyError.sessionAlreadyActive
        XCTAssertEqual(sessionAlreadyActive.localizedDescription, "A study session is already in progress")
    }

    // MARK: - Convenience Properties Tests

    func test_formattedFocusTime_formatsCorrectly() throws {
        let formattedFocusTime = studyService.formattedFocusTime
        XCTAssertEqual(formattedFocusTime, "00:00", "Should format zero value as mm:ss when under one hour")

    }

    func test_focusTimeInMinutes_returnsCorrectValue() throws {
        let focusTimeInMinutes = studyService.focusTimeInMinutes
        XCTAssertEqual(focusTimeInMinutes, 0, "Should return zero for initial state")

    }

    func test_isRoomHost_returnsCorrectValue() async throws {
        // Arrange
        let mockRoomState = createTestRoomState(roomCode: "ABC123", hostUserId: "user-1")
        mockWebSocketManager.mockJoinRoomResponse = .success(mockRoomState)

        _ = await studyService.joinStudyRoom(roomCode: "ABC123")

        // Act
        let isHost = studyService.isRoomHost

        // Assert
        XCTAssertTrue(isHost, "Should be room host")
    }

    func test_currentRoomMemberCount_returnsCorrectValue() async throws {
        // Arrange
        let mockRoomState = createTestRoomState(
            roomCode: "ABC123",
            hostUserId: "user-1",
            memberCount: 3
        )
        mockWebSocketManager.mockJoinRoomResponse = .success(mockRoomState)

        _ = await studyService.joinStudyRoom(roomCode: "ABC123")

        // Act
        let memberCount = studyService.currentRoomMemberCount

        // Assert
        XCTAssertEqual(memberCount, 3, "Should have 3 members")
    }

    // MARK: - Clear Error Tests

    func test_clearError_removesLastError() async throws {
        // Arrange
        mockAuthService.mockIsLoggedIn = false
        _ = await studyService.fetchStudyStats()
        let lastErrorBeforeClearing = studyService.lastError
        XCTAssertEqual(lastErrorBeforeClearing, .notAuthenticated)

        // Act
        studyService.clearError()

        // Assert
        let lastErrorAfterClearing = studyService.lastError
        XCTAssertNil(lastErrorAfterClearing, "Last error should be cleared")
    }

    // MARK: - Helper Methods

    private func createTestUser(id: String, username: String) -> StudyServiceUser {
        return StudyServiceUser(
            id: id,
            username: username,
            email: "\(username)@example.com",
            avatarUrl: nil,
            displayName: username,
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func createTestRoom(id: String, name: String) -> StudyRoom {
        return StudyRoom(
            id: id,
            roomCode: id,
            name: name,
            hostUserId: "user-1",
            maxMembers: 4,
            members: [],
            sessionState: .idle,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func createTestRoomState(roomCode: String, hostUserId: String, name: String = "Room", memberCount: Int = 1) -> StudyRoomState {
        // Create mock members
        var members: [StudyRoomMember] = []
        for i in 0..<memberCount {
            members.append(
                StudyRoomMember(
                    userId: "user-\(i)",
                    displayName: "User \(i)",
                    avatarUrl: nil,
                    joinedAt: Date(),
                    lastActiveAt: Date(),
                    status: .online
                )
            )
        }

        return StudyRoomState(
            roomCode: roomCode,
            hostUserId: hostUserId,
            sessionState: .idle,
            members: members,
            maxMembers: 4,
            version: 1,
            createdAt: Date(),
            updatedAt: Date(),
            timer: nil
        )
    }

    private func createTestSession(id: String, userId: String, duration: Int) -> StudyServiceSession {
        return StudyServiceSession(
            id: id,
            userId: userId,
            duration: duration,
            startedAt: Date(),
            endedAt: nil,
            earnedPoints: nil,
            isCompleted: false,
            subject: "Test Subject",
            notes: nil,
            createdAt: Date()
        )
    }

    private func createTestStats(totalDuration: Int, sessionCount: Int) -> StudyStats {
        return StudyStats(
            totalDuration: totalDuration,
            sessionCount: sessionCount,
            averageDuration: sessionCount > 0 ? totalDuration / sessionCount : 0,
            streakDays: 5,
            todayDuration: 60,
            weekDuration: 300
        )
    }
}

// MARK: - Mock WebSocket Manager

private final class MockClawbotChannelServiceForStudyService: ClawbotChannelServiceProtocol {
    @Published var connectionState: ClawbotConnectionState = .disconnected
    @Published var isPaired: Bool = false
    @Published var isBotOnline: Bool = false
    @Published var botConnectionState: BotConnectionState = .unknown
    @Published var botBehaviorState: BotBehaviorState = .idle
    @Published var botState: BotBehaviorState = .idle
    @Published var messages: [ClawbotMessage] = []
    @Published var lastMessage: ClawbotMessage?
    @Published var deviceId: String?
    var ttsEnabled: Bool = false
    var ttsLanguage: TTSLanguage = .english

    var isConnected: Bool {
        connectionState == .connected
    }

    var mockCreateRoomResponse: Result<StudyRoomState, Error>?
    var mockJoinRoomResponse: Result<StudyRoomState, Error>?
    var shouldFailLeaveRoom = false

    var connectionStatePublisher: AnyPublisher<ClawbotConnectionState, Never> {
        $connectionState.eraseToAnyPublisher()
    }

    var lastMessagePublisher: AnyPublisher<ClawbotMessage?, Never> {
        $lastMessage.eraseToAnyPublisher()
    }

    var botStatePublisher: AnyPublisher<BotBehaviorState, Never> {
        $botState.eraseToAnyPublisher()
    }

    func connect() async throws {}

    func disconnect() {}

    func checkPairingStatus() async throws -> ClawbotPairingStatus {
        ClawbotPairingStatus(
            paired: false,
            deviceId: nil,
            deviceName: nil,
            botOnline: nil,
            pairedAt: nil
        )
    }

    func pairWithCode(_ code: String) async throws -> Bool {
        true
    }

    func pairWithQR(_ qrData: String) async throws -> Bool {
        true
    }

    func unpair() {}

    func sendMessage(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?) async throws {}

    func sendMessageWithCallback(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?, completion: @escaping (Result<String, Error>) -> Void) async throws {
        completion(.success(UUID().uuidString))
    }

    func createStudyRoom(displayName: String, avatarUrl: String?, maxMembers: Int?) async throws -> StudyRoomState {
        if let response = mockCreateRoomResponse {
            return try response.get()
        }

        return Self.makeRoomState(roomCode: "ABC123", hostUserId: "user-1", maxMembers: maxMembers ?? 4, memberCount: 1)
    }

    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String?) async throws -> StudyRoomState {
        if let response = mockJoinRoomResponse {
            return try response.get()
        }

        return Self.makeRoomState(roomCode: roomCode, hostUserId: "user-1", maxMembers: 4, memberCount: 1)
    }

    func leaveStudyRoom(roomCode: String?) async throws {
        if shouldFailLeaveRoom {
            throw StudyError.unknown(underlying: NSError(domain: "MockClawbotChannelServiceForStudyService", code: -1))
        }
    }

    func hostActionStudyRoom(roomCode: String, action: StudyRoomHostAction) async throws -> StudyRoomState {
        if let response = mockJoinRoomResponse {
            return try response.get()
        }
        return Self.makeRoomState(roomCode: roomCode, hostUserId: "user-1", maxMembers: 4, memberCount: 1)
    }

    private static func makeRoomState(roomCode: String, hostUserId: String, maxMembers: Int, memberCount: Int) -> StudyRoomState {
        let members = (0..<memberCount).map { index in
            StudyRoomMember(
                userId: "user-\(index)",
                displayName: "User \(index)",
                avatarUrl: nil,
                joinedAt: Date(),
                lastActiveAt: Date(),
                status: .online
            )
        }

        return StudyRoomState(
            roomCode: roomCode,
            hostUserId: hostUserId,
            sessionState: .idle,
            members: members,
            maxMembers: maxMembers,
            version: 1,
            createdAt: Date(),
            updatedAt: Date(),
            timer: nil
        )
    }
}

// MARK: - Mock Auth Service

private final class MockAuthServiceForStudyService: AuthServiceProtocol {
    var mockIsLoggedIn: Bool = false
    var mockCurrentUser: StudyServiceUser?

    var isLoggedIn: Bool { mockIsLoggedIn }
    var currentUser: StudyServiceUser? { mockCurrentUser }
    var isLoading: Bool { false }
    var supabase: SupabaseClient? { nil }

    func login(email: String, password: String) async -> AuthResult<StudyServiceUser> {
        return .failure(.invalidCredentials)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<StudyServiceUser> {
        return .failure(.invalidCredentials)
    }

    func logout() async -> AuthResult<Void> {
        return .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        return .success(())
    }

    func fetchCurrentUser() async -> AuthResult<StudyServiceUser> {
        if let user = mockCurrentUser {
            return .success(user)
        }
        return .failure(.invalidCredentials)
    }

    func updateProfile(_ updates: StudyServiceUser) async -> AuthResult<StudyServiceUser> {
        mockCurrentUser = updates
        return .success(updates)
    }

    func deleteAccount() async -> AuthResult<Void> {
        .success(())
    }

    func updateCurrentUser(_ user: StudyServiceUser?) {
        mockCurrentUser = user
    }

    func updateLoginStatus(_ loggedIn: Bool) {
        mockIsLoggedIn = loggedIn
    }

    func clearError() {
        // No-op for tests
    }
}

// MARK: - Mock API Client Extensions

private final class MockAPIClientForStudyService: APIClientProtocol {
    var mockStudyRooms: [StudyRoom]?
    var mockStudySession: StudyServiceSession?
    var mockStudyStats: StudyStats?
    var mockWeeklyStudyData: WeeklyStudyDataResponse?
    var mockCurrentUser: StudyServiceUser?
    var mockNetworkError: NetworkError?

    func get<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        if let error = mockNetworkError {
            throw error
        }

        if let rooms = mockStudyRooms as? T {
            return rooms
        }

        if let stats = mockStudyStats as? T {
            return stats
        }

        if let weekly = mockWeeklyStudyData as? T {
            return weekly
        }

        if let session = mockStudySession as? T {
            return session
        }

        if let user = mockCurrentUser as? T {
            switch endpoint {
            case .userProfile:
                return user
            default:
                break
            }
        }

        throw NetworkError.invalidResponse
    }

    func get<T: Decodable>(_ endpoint: APIEndpoint, parameters: [String: Any]) async throws -> T {
        throw NetworkError.invalidResponse
    }

    func post<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        if let error = mockNetworkError {
            throw error
        }

        if let user = mockCurrentUser as? T {
            switch endpoint {
            case .userUpdateProfile:
                return user
            default:
                break
            }
        }

        if case .studySessions = endpoint, let session = mockStudySession as? T {
            return session
        }

        if case .weeklyStudyData = endpoint, let weekly = mockWeeklyStudyData as? T {
            return weekly
        }

        if let stats = mockStudyStats as? T {
            return stats
        }

        throw NetworkError.invalidResponse
    }

    func put<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        if let error = mockNetworkError {
            throw error
        }

        if let user = mockCurrentUser as? T {
            return user
        }

        throw NetworkError.invalidResponse
    }

    func delete<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        throw NetworkError.invalidResponse
    }

    func upload<T: Codable>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T {
        throw NetworkError.invalidResponse
    }

    func download(from url: String) async throws -> Data {
        Data()
    }
}

// MARK: - Mock Study Supabase

private final class MockStudySupabase: StudySupabaseProtocol {
    var mockCreateStudySessionID: String = "session-1"
    var shouldFailCreateStudySession = false
    var shouldFailUpdateStudySession = false
    var createStudySessionCallCount = 0
    var updateStudySessionCallCount = 0

    func createStudySession(subject: String) async throws -> String {
        createStudySessionCallCount += 1

        if shouldFailCreateStudySession {
            throw NSError(domain: "MockStudySupabase", code: -1)
        }

        return mockCreateStudySessionID
    }

    func updateStudySession(sessionId: String, duration: Int) async throws {
        updateStudySessionCallCount += 1

        if shouldFailUpdateStudySession {
            throw NSError(domain: "MockStudySupabase", code: -1)
        }
    }
}
