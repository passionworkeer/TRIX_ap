//
//  StudyServiceTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for StudyService
//
//  Test Coverage:
//  - fetchStudyRooms() success and error handling
//  - createStudyRoom() validation and study room creation
//  - joinStudyRoom() room code validation
//  - leaveStudyRoom() cleanup logic
//  - startStudySession() state management
//  - endStudySession() timer and API sync
//  - fetchStudyStats() data retrieval
//  - syncOfflineSessions() offline storage handling
//  - Timer control (pause/resume)
//  - Convenience computed properties
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock Study Service Dependencies

/// Mock ClawbotChannelService for StudyService tests - standalone implementation
@MainActor
final class MockClawbotChannelServiceForStudy: ObservableObject, ClawbotChannelServiceProtocol {

    // MARK: - Published Properties (all required by protocol)

    @Published private(set) var connectionState: ClawbotConnectionState = .disconnected
    @Published private(set) var isPaired: Bool = false
    @Published private(set) var messages: [ClawbotMessage] = []
    @Published private(set) var isBotOnline: Bool = false
    @Published private(set) var botConnectionState: BotConnectionState = .unknown
    @Published private(set) var botBehaviorState: BotBehaviorState = .idle
    @Published private(set) var botState: BotBehaviorState = .idle
    @Published private(set) var lastMessage: ClawbotMessage?
    @Published private(set) var deviceId: String?

    var connectionStatePublisher: AnyPublisher<ClawbotConnectionState, Never> { $connectionState.eraseToAnyPublisher() }
    var lastMessagePublisher: AnyPublisher<ClawbotMessage?, Never> { $lastMessage.eraseToAnyPublisher() }
    var botStatePublisher: AnyPublisher<BotBehaviorState, Never> { $botState.eraseToAnyPublisher() }

    var ttsEnabled: Bool = true
    var ttsLanguage: TTSLanguage = .chinese

    // MARK: - Study room mock control

    var shouldCreateRoomFail = false
    var shouldJoinRoomFail = false
    var shouldLeaveRoomFail = false
    var shouldHostActionFail = false
    var mockStudyRoomState: StudyRoomState?
    var mockError: Error = NSError(domain: "MockStudy", code: -1, userInfo: nil)

    var isConnected: Bool { connectionState == .connected }

    // MARK: - Connection

    func connect() async throws {}
    func disconnect() { connectionState = .disconnected }

    // MARK: - Pairing

    func checkPairingStatus() async throws -> ClawbotPairingStatus {
        ClawbotPairingStatus(paired: false, deviceId: nil, deviceName: nil, botOnline: nil, pairedAt: nil)
    }

    func pairWithCode(_ code: String) async throws -> Bool { false }
    func pairWithQR(_ qrData: String) async throws -> Bool { false }
    func unpair() {}

    // MARK: - Messages

    func sendMessage(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?) async throws {}
    func sendMessageWithCallback(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?, completion: @escaping (Result<String, Error>) -> Void) async throws {
        completion(.success(content))
    }

    // MARK: - Study Room

    func createStudyRoom(displayName: String, avatarUrl: String?, maxMembers: Int?) async throws -> StudyRoomState {
        if shouldCreateRoomFail { throw mockError }
        return mockStudyRoomState ?? Self.makeMockRoomState(roomCode: "ABC123", hostUserId: "user_123")
    }

    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String?) async throws -> StudyRoomState {
        if shouldJoinRoomFail { throw mockError }
        return mockStudyRoomState ?? Self.makeMockRoomState(roomCode: roomCode, hostUserId: "other_user")
    }

    func leaveStudyRoom(roomCode: String?) async throws {
        if shouldLeaveRoomFail { throw mockError }
    }

    func hostActionStudyRoom(roomCode: String, action: StudyRoomHostAction) async throws -> StudyRoomState {
        if shouldHostActionFail { throw mockError }
        return mockStudyRoomState ?? Self.makeMockRoomState(roomCode: roomCode, hostUserId: "user_123")
    }

    static func makeMockRoomState(roomCode: String, hostUserId: String) -> StudyRoomState {
        StudyRoomState(
            roomCode: roomCode,
            hostUserId: hostUserId,
            sessionState: .idle,
            members: [],
            maxMembers: 4,
            version: 1,
            createdAt: Date(),
            updatedAt: Date(),
            timer: nil
        )
    }

    func resetStudyRoomState() {
        shouldCreateRoomFail = false
        shouldJoinRoomFail = false
        shouldLeaveRoomFail = false
        shouldHostActionFail = false
        mockStudyRoomState = nil
        mockError = NSError(domain: "MockStudy", code: -1, userInfo: nil)
    }
}

/// Mock Supabase service for StudyService tests
@MainActor
final class MockStudySupabaseService: StudySupabaseProtocol {
    nonisolated(unsafe) var shouldFail = false
    nonisolated(unsafe) var mockError: NetworkError = .unauthorized
    nonisolated(unsafe) var mockSessionId: String = "session_123"

    nonisolated func createStudySession(subject: String) async throws -> String {
        if shouldFail { throw mockError }
        return mockSessionId
    }

    nonisolated func updateStudySession(sessionId: String, duration: Int) async throws {
        if shouldFail { throw mockError }
    }
}

/// Mock API client for StudyService tests
@MainActor
final class MockAPIClientForStudy: APIClientProtocol {
    nonisolated(unsafe) var shouldFailRequests = false
    nonisolated(unsafe) var mockError: NetworkError = .unauthorized
    nonisolated(unsafe) var mockStudyRooms: [StudyRoom] = []
    nonisolated(unsafe) var mockStudySession: StudySession?
    nonisolated(unsafe) var mockStudyStats: StudyStats?

    nonisolated func get<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests { throw mockError }
        if T.self == [StudyRoom].self { return mockStudyRooms as! T }
        if T.self == StudyStats.self { return mockStudyStats as! T }
        if T.self == WeeklyStudyDataResponse.self { return WeeklyStudyDataResponse(success: true, data: []) as! T }
        if T.self == [DailyStudyData].self { return [] as! T }
        throw NetworkError.custom(message: "No mock data for \(T.self)")
    }

    nonisolated func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError
        }
        if T.self == StudySession.self {
            let session: StudySession = mockStudySession ?? Self.createMockSession()
            return session as! T
        }
        if T.self == EmptyResponse.self { return EmptyResponse() as! T }
        throw NetworkError.custom(message: "No mock data for \(T.self)")
    }

    nonisolated func put<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests { throw mockError }
        if T.self == StudySession.self {
            let session: StudySession = mockStudySession ?? Self.createMockSession()
            return session as! T
        }
        throw NetworkError.custom(message: "No mock data for \(T.self)")
    }

    nonisolated func delete<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        throw NetworkError.custom(message: "Not implemented")
    }

    nonisolated func upload<T>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T where T: Decodable {
        throw NetworkError.custom(message: "Not implemented")
    }

    nonisolated func download(from url: String) async throws -> Data {
        throw NetworkError.custom(message: "Not implemented")
    }

    private static nonisolated func createMockSession() -> StudySession {
        StudySession(
            id: "session_123",
            userId: "user_123",
            duration: 0,
            startedAt: Date(),
            endedAt: nil,
            earnedPoints: nil,
            isCompleted: false,
            subject: nil,
            notes: nil,
            createdAt: nil
        )
    }

    func reset() {
        shouldFailRequests = false
        mockError = .unauthorized
        mockStudyRooms = []
        mockStudySession = nil
        mockStudyStats = nil
    }
}

/// Mock Auth service for StudyService tests
@MainActor
final class MockAuthServiceForStudy: AuthServiceProtocol {
    var isLoggedInValue = false
    var mockUser: User?
    var isLoadingValue = false

    var isLoggedIn: Bool { isLoggedInValue }

    var currentUser: User? { mockUser }

    var isLoading: Bool { isLoadingValue }

    func login(email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func logout() async -> AuthResult<Void> {
        isLoggedInValue = false
        return .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        return .success(())
    }

    func fetchCurrentUser() async -> AuthResult<User> {
        if let user = mockUser {
            return .success(user)
        }
        return .failure(.invalidCredentials)
    }

    func setLoggedIn(_ loggedIn: Bool) {
        isLoggedInValue = loggedIn
        mockUser = loggedIn ? Self.createMockUser() : nil
    }

    private static func createMockUser() -> User {
        User(
            id: "test_user_id",
            username: "test_user",
            email: "test@example.com",
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: "Test User",
            displayName: "Test User",
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
    }

    func clearError() {}

    func updateProfile(_ updates: User) async -> AuthResult<User> {
        return .success(updates)
    }

    func deleteAccount() async -> AuthResult<Void> {
        return .success(())
    }

    func updateCurrentUser(_ user: User?) {}

    func updateLoginStatus(_ loggedIn: Bool) {}

}

// MARK: - Study Service Tests

@MainActor
final class StudyServiceTests: XCTestCase {

    private let offlineSessionsKey = "study_offline_sessions"

    var sut: StudyService!
    var mockAPIClient: MockAPIClientForStudy!
    var mockClawbotChannel: MockClawbotChannelServiceForStudy!
    var mockAuthService: MockAuthServiceForStudy!
    var mockSupabase: MockStudySupabaseService!

    override func setUp() async throws {
        try await super.setUp()
        UserDefaults.standard.removeObject(forKey: offlineSessionsKey)

        mockSupabase = MockStudySupabaseService()
        mockAPIClient = MockAPIClientForStudy()
        mockAPIClient.reset()
        mockClawbotChannel = MockClawbotChannelServiceForStudy()
        mockClawbotChannel.resetStudyRoomState()
        mockAuthService = MockAuthServiceForStudy()
        mockAuthService.setLoggedIn(false)

        sut = StudyService(
            apiClient: mockAPIClient,
            clawbotChannelService: mockClawbotChannel,
            authService: mockAuthService,
            studySupabase: mockSupabase
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockSupabase = nil
        mockAPIClient = nil
        mockClawbotChannel = nil
        mockAuthService = nil
        UserDefaults.standard.removeObject(forKey: offlineSessionsKey)
        try await super.tearDown()
    }
}

// MARK: - fetchStudyRooms Tests

extension StudyServiceTests {

    func testFetchStudyRoomsSuccess() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockAPIClient.mockStudyRooms = [
            makeMockStudyRoom(id: "room1", name: "Math Study"),
            makeMockStudyRoom(id: "room2", name: "Physics Study")
        ]

        // When
        let result = await sut.fetchStudyRooms()

        // Then
        switch result {
        case .success(let rooms):
            XCTAssertEqual(rooms.count, 2, "Should return 2 rooms")
            XCTAssertFalse(sut.isLoadingRooms, "Should not be loading")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testFetchStudyRoomsFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.setLoggedIn(false)

        // When
        let result = await sut.fetchStudyRooms()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated, "Should return not authenticated error")
        case .success:
            XCTFail("Should fail when not authenticated")
        }
    }

    func testFetchStudyRoomsHandlesNetworkError() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When
        let result = await sut.fetchStudyRooms()

        // Then
        switch result {
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true, "Should map to network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        case .success:
            XCTFail("Should fail with network error")
        }
    }
}

// MARK: - createStudyRoom Tests

extension StudyServiceTests {

    func testCreateStudyRoomFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.setLoggedIn(false)

        // When
        let result = await sut.createStudyRoom(name: "Test Room", maxMembers: 4)

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated, "Should return not authenticated error")
        case .success:
            XCTFail("Should fail when not authenticated")
        }
    }

    func testCreateStudyRoomSuccess() async {
        // Given
        mockAuthService.setLoggedIn(true)
        let roomState = MockClawbotChannelServiceForStudy.makeMockRoomState(roomCode: "ABC123", hostUserId: "test_user_id")
        mockClawbotChannel.mockStudyRoomState = roomState

        // When
        let result = await sut.createStudyRoom(name: "Test Room", maxMembers: 4)

        // Then
        switch result {
        case .success(let room):
            XCTAssertEqual(room.maxMembers, 4, "Should have correct max members")
            XCTAssertNotNil(sut.currentRoomState, "Should set current room state")
            XCTAssertEqual(sut.currentRoomState?.roomCode, "ABC123")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testCreateStudyRoomClawbotFailure() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockClawbotChannel.shouldCreateRoomFail = true

        // When
        let result = await sut.createStudyRoom(name: "Test Room", maxMembers: 4)

        // Then
        switch result {
        case .failure:
            XCTAssertTrue(true, "Should fail when Clawbot fails")
        case .success:
            XCTFail("Should fail when Clawbot fails")
        }
    }
}

// MARK: - joinStudyRoom Tests

extension StudyServiceTests {

    func testJoinStudyRoomFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.setLoggedIn(false)

        // When
        let result = await sut.joinStudyRoom(roomCode: "ABC123")

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated, "Should return not authenticated error")
        case .success:
            XCTFail("Should fail when not authenticated")
        }
    }

    func testJoinStudyRoomValidatesRoomCode() async {
        // Given
        mockAuthService.setLoggedIn(true)

        // When - invalid room code (too short)
        let result = await sut.joinStudyRoom(roomCode: "ABC")

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .invalidRoomCode, "Should return invalid room code error")
        case .success:
            XCTFail("Should fail with invalid room code")
        }
    }

    func testJoinStudyRoomSuccess() async {
        // Given
        mockAuthService.setLoggedIn(true)
        let roomState = MockClawbotChannelServiceForStudy.makeMockRoomState(roomCode: "XYZ789", hostUserId: "other")
        mockClawbotChannel.mockStudyRoomState = roomState

        // When
        let result = await sut.joinStudyRoom(roomCode: "XYZ789")

        // Then
        switch result {
        case .success(let room):
            XCTAssertEqual(room.roomCode, "XYZ789")
            XCTAssertNotNil(sut.currentRoomState, "Should set current room state")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testJoinStudyRoomTrimsWhitespace() async {
        // Given
        mockAuthService.setLoggedIn(true)
        let roomState = MockClawbotChannelServiceForStudy.makeMockRoomState(roomCode: "ABC123", hostUserId: "other")
        mockClawbotChannel.mockStudyRoomState = roomState

        // When - room code with whitespace
        let result = await sut.joinStudyRoom(roomCode: "  abc123  ")

        // Then
        switch result {
        case .success(let room):
            XCTAssertEqual(room.roomCode, "ABC123", "Should uppercase and trim")
        case .failure:
            XCTFail("Should succeed with trimmed code")
        }
    }
}

// MARK: - leaveStudyRoom Tests

extension StudyServiceTests {

    func testLeaveStudyRoomFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.setLoggedIn(false)

        // When
        let result = await sut.leaveStudyRoom()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated, "Should return not authenticated error")
        case .success:
            XCTFail("Should fail when not authenticated")
        }
    }

    func testLeaveStudyRoomClearsState() async {
        // Given
        mockAuthService.setLoggedIn(true)
        // First join a room
        let roomState = MockClawbotChannelServiceForStudy.makeMockRoomState(roomCode: "ABC123", hostUserId: "test_user_id")
        mockClawbotChannel.mockStudyRoomState = roomState
        _ = await sut.joinStudyRoom(roomCode: "ABC123")
        XCTAssertNotNil(sut.currentRoomState, "Should have room state before leaving")

        // When
        let result = await sut.leaveStudyRoom()

        // Then
        switch result {
        case .success:
            XCTAssertNil(sut.currentRoomState, "Should clear room state")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }
}

// MARK: - startStudySession Tests

extension StudyServiceTests {

    func testStartStudySessionFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.setLoggedIn(false)

        // When
        let result = await sut.startStudySession(roomCode: "ABC123")

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated, "Should return not authenticated error")
        case .success:
            XCTFail("Should fail when not authenticated")
        }
    }

    func testStartStudySessionFailsWhenSessionAlreadyActive() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockAPIClient.mockStudySession = makeMockSession()

        // Start a session first
        _ = await sut.startStudySession(roomCode: "ABC123")

        // When - try to start again
        let result = await sut.startStudySession(roomCode: "ABC123")

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .sessionAlreadyActive, "Should return session already active error")
        case .success:
            XCTFail("Should fail when session already active")
        }
    }

    func testStartStudySessionSuccess() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockAPIClient.mockStudySession = makeMockSession()

        // When
        let result = await sut.startStudySession(roomCode: "ABC123")

        // Then
        switch result {
        case .success(let session):
            XCTAssertTrue(sut.isActiveSession, "Should set active session flag")
            XCTAssertEqual(sut.sessionState, .focusing, "Should set session state to focusing")
            XCTAssertNotNil(sut.currentSession, "Should have current session")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testStartStudySessionNetworkError() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockSupabase.shouldFail = true
        mockSupabase.mockError = .timeout

        // When
        let result = await sut.startStudySession(roomCode: "ABC123")

        // Then
        switch result {
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true, "Should return network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        case .success:
            XCTFail("Should fail with network error")
        }
    }
}

// MARK: - endStudySession Tests

extension StudyServiceTests {

    func testEndStudySessionFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.setLoggedIn(false)

        // When
        let result = await sut.endStudySession()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated, "Should return not authenticated error")
        case .success:
            XCTFail("Should fail when not authenticated")
        }
    }

    func testEndStudySessionFailsWhenNoActiveSession() async {
        // Given
        mockAuthService.setLoggedIn(true)

        // When
        let result = await sut.endStudySession()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .noActiveSession, "Should return no active session error")
        case .success:
            XCTFail("Should fail when no active session")
        }
    }

    func testEndStudySessionSuccess() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockAPIClient.mockStudySession = makeMockSession()

        // Start a session first
        _ = await sut.startStudySession(roomCode: "ABC123")
        XCTAssertTrue(sut.isActiveSession, "Should have active session")

        // When
        let result = await sut.endStudySession()

        // Then
        switch result {
        case .success:
            XCTAssertFalse(sut.isActiveSession, "Should clear active session flag")
            XCTAssertEqual(sut.sessionState, .idle, "Should reset session state")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testEndStudySessionNetworkErrorSavesOffline() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockSupabase.mockSessionId = "session_123"

        // Start a session first
        _ = await sut.startStudySession(roomCode: "ABC123")

        // Make Supabase fail on end
        mockSupabase.shouldFail = true
        mockSupabase.mockError = .timeout

        // When
        let result = await sut.endStudySession()

        // Then
        switch result {
        case .failure(let error):
            // Should fail but still clear local state
            XCTAssertFalse(sut.isActiveSession, "Should clear active session even on API error")
            XCTAssertEqual(sut.pendingOfflineSessions, 1, "Should persist the failed session for later sync")
            XCTAssertEqual(error, .networkError(underlying: mockSupabase.mockError))
        case .success:
            XCTFail("Should fail when network error occurs")
        }
    }
}

// MARK: - fetchStudyStats Tests

extension StudyServiceTests {

    func testFetchStudyStatsSuccess() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockAPIClient.mockStudyStats = StudyStats(
            totalDuration: 3600,
            sessionCount: 10,
            averageDuration: 360,
            streakDays: 5,
            todayDuration: 1800,
            weekDuration: 7200
        )

        // When
        let result = await sut.fetchStudyStats()

        // Then
        switch result {
        case .success(let stats):
            XCTAssertEqual(stats.totalDuration, 3600, "Should return correct total duration")
            XCTAssertEqual(stats.streakDays, 5, "Should return correct streak days")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testFetchStudyStatsFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.setLoggedIn(false)

        // When
        let result = await sut.fetchStudyStats()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated, "Should return not authenticated error")
        case .success:
            XCTFail("Should fail when not authenticated")
        }
    }
}

// MARK: - syncOfflineSessions Tests

extension StudyServiceTests {

    func testSyncOfflineSessionsFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.setLoggedIn(false)

        // When
        let result = await sut.syncOfflineSessions()

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated, "Should return not authenticated error")
        case .success:
            XCTFail("Should fail when not authenticated")
        }
    }

    func testSyncOfflineSessionsReturnsZeroWhenNoPending() async {
        // Given
        mockAuthService.setLoggedIn(true)

        // When
        let result = await sut.syncOfflineSessions()

        // Then
        switch result {
        case .success(let count):
            XCTAssertEqual(count, 0, "Should return 0 when no pending sessions")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }
}

// MARK: - Timer Control Tests

extension StudyServiceTests {

    func testPauseSessionNoActiveSession() async {
        // Given - no active session
        mockAuthService.setLoggedIn(true)

        // When
        sut.pauseSession()

        // Then - should be no-op
        XCTAssertEqual(sut.sessionState, .idle, "Should remain idle")
    }

    func testPauseSessionActive() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockAPIClient.mockStudySession = makeMockSession()
        _ = await sut.startStudySession(roomCode: "ABC123")

        // When
        sut.pauseSession()

        // Then
        XCTAssertEqual(sut.sessionState, .paused, "Should set session state to paused")
    }

    func testResumeSessionActive() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockAPIClient.mockStudySession = makeMockSession()
        _ = await sut.startStudySession(roomCode: "ABC123")
        sut.pauseSession()

        // When
        sut.resumeSession()

        // Then
        XCTAssertEqual(sut.sessionState, .focusing, "Should set session state to focusing")
    }

    func testResumeSessionNoActiveSession() async {
        // Given - no active session
        mockAuthService.setLoggedIn(true)

        // When
        sut.resumeSession()

        // Then - should be no-op
        XCTAssertEqual(sut.sessionState, .idle, "Should remain idle")
    }
}

// MARK: - Convenience Properties Tests

extension StudyServiceTests {

    func testFormattedFocusTimeUnderOneHour() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockAPIClient.mockStudySession = makeMockSession()
        _ = await sut.startStudySession(roomCode: "ABC123")

        // Then
        XCTAssertFalse(sut.formattedFocusTime.isEmpty, "Should have formatted time")
    }

    func testFocusTimeInMinutes() async {
        // Given
        mockAuthService.setLoggedIn(true)
        mockAPIClient.mockStudySession = makeMockSession()
        _ = await sut.startStudySession(roomCode: "ABC123")

        // Then
        XCTAssertTrue(sut.focusTimeInMinutes >= 0, "Should return focus time in minutes")
    }

    func testClearError() async {
        // Given
        mockAuthService.setLoggedIn(false)
        _ = await sut.fetchStudyRooms() // This sets lastError

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.lastError, "Should clear error")
    }
}

// MARK: - Convenience Extensions Tests

extension StudyServiceTests {

    func testIsRoomHostTrue() async {
        // Given
        mockAuthService.setLoggedIn(true)
        let roomState = MockClawbotChannelServiceForStudy.makeMockRoomState(roomCode: "ABC123", hostUserId: "test_user_id")
        mockClawbotChannel.mockStudyRoomState = roomState
        _ = await sut.joinStudyRoom(roomCode: "ABC123")

        // Then
        XCTAssertTrue(sut.isRoomHost, "Should be room host when user is host")
    }

    func testIsRoomHostFalse() async {
        // Given
        mockAuthService.setLoggedIn(true)
        let roomState = MockClawbotChannelServiceForStudy.makeMockRoomState(roomCode: "ABC123", hostUserId: "other_user")
        mockClawbotChannel.mockStudyRoomState = roomState
        _ = await sut.joinStudyRoom(roomCode: "ABC123")

        // Then
        XCTAssertFalse(sut.isRoomHost, "Should not be room host when user is not host")
    }

    func testCurrentRoomMemberCount() async {
        // Given
        mockAuthService.setLoggedIn(true)
        let roomState = MockClawbotChannelServiceForStudy.makeMockRoomState(roomCode: "ABC123", hostUserId: "test_user_id")
        mockClawbotChannel.mockStudyRoomState = roomState
        _ = await sut.joinStudyRoom(roomCode: "ABC123")

        // Then
        XCTAssertEqual(sut.currentRoomMemberCount, 0, "Should return member count")
    }

    func testRefreshRoomState() async {
        // Given
        mockAuthService.setLoggedIn(true)
        let roomState = MockClawbotChannelServiceForStudy.makeMockRoomState(roomCode: "ABC123", hostUserId: "test_user_id")
        mockClawbotChannel.mockStudyRoomState = roomState
        _ = await sut.joinStudyRoom(roomCode: "ABC123")

        // When
        let result = await sut.refreshRoomState()

        // Then
        switch result {
        case .success:
            XCTAssertNotNil(sut.currentRoomState, "Should refresh room state")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }
}

// MARK: - Helper Methods

private extension StudyServiceTests {

    func makeMockUser() -> User {
        User(
            id: "test_user_id",
            username: "test_user",
            email: "test@example.com",
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: "Test User",
            displayName: "Test User",
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
    }

    func makeMockStudyRoom(id: String, name: String) -> StudyRoom {
        StudyRoom(
            id: id,
            roomCode: "ABC123",
            name: name,
            hostUserId: "user_123",
            maxMembers: 4,
            members: [],
            sessionState: .idle,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    func makeMockSession() -> StudySession {
        StudySession(
            id: "session_123",
            userId: "user_123",
            duration: 0,
            startedAt: Date(),
            endedAt: nil,
            earnedPoints: nil,
            isCompleted: false,
            subject: nil,
            notes: nil,
            createdAt: nil
        )
    }
}
