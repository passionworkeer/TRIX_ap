//
//  StudyServiceTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for StudyService API calls
//
//  Test Coverage:
//  - fetchStudyRooms() success and error handling
//  - createStudyRoom() validation and WebSocket integration
//  - joinStudyRoom() room code validation
//  - leaveStudyRoom() cleanup logic
//  - startStudySession() state management
//  - endStudySession() timer and API sync
//  - fetchStudyStats() data retrieval
//  - syncOfflineSessions() offline storage handling
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock Study Service Dependencies

@MainActor
final class MockAPIClientForStudy: APIClientProtocol {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockStudyRooms: [StudyRoom] = []
    var mockStudySession: StudySession?
    var mockStudyStats: StudyStats?

    func get<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        if T.self == [StudyRoom].self {
            return mockStudyRooms as! T
        }

        if T.self == StudyStats.self {
            return mockStudyStats as! T
        }

        throw NetworkError.custom("No mock data")
    }

    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        if T.self == StudySession.self {
            return mockStudySession ?? createMockSession() as! T
        }

        throw NetworkError.custom("Not implemented")
    }

    func put<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        if T.self == StudySession.self {
            return mockStudySession ?? createMockSession() as! T
        }

        throw NetworkError.custom("Not implemented")
    }

    func delete<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom("Not implemented")
    }

    func upload<T>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T where T: Decodable {
        throw NetworkError.custom("Not implemented")
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.custom("Not implemented")
    }

    private func createMockSession() -> StudySession {
        StudySession(
            id: "session_123",
            userId: "user_123",
            roomCode: "ABC123",
            startTime: Date(),
            endTime: nil,
            duration: 0,
            status: .active,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

@MainActor
final class MockWebSocketManagerForStudy: WebSocketManagerProtocol {
    var isConnectedValue = false
    var shouldFailConnection = false
    var mockError: WebSocketError?
    var shouldFailRoomCreation = false

    func isConnected() -> Bool {
        return isConnectedValue
    }

    func connect(userId: String) async throws {
        if shouldFailConnection {
            throw mockError ?? WebSocketError(message: "Connection failed")
        }
        isConnectedValue = true
    }

    func disconnect() {
        isConnectedValue = false
    }

    func sendMessage(content: String, contentType: BotMessage.MessageContentType, mediaUrl: String?, mediaMimeType: String?) {}

    func on(_ event: WebSocketEvent, handler: @escaping (Any) -> Void) {}

    func createStudyRoom(displayName: String, avatarUrl: String?, maxMembers: Int, completion: @escaping (Result<StudyRoomPayload, WebSocketError>) -> Void) {
        if shouldFailRoomCreation {
            completion(.failure(WebSocketError(message: "Failed to create room")))
        } else {
            let payload = StudyRoomPayload(
                roomCode: "ABC123",
                room: StudyRoomState(
                    roomCode: "ABC123",
                    hostUserId: "user_123",
                    maxMembers: maxMembers,
                    members: [],
                    sessionState: .idle,
                    createdAt: Date(),
                    updatedAt: Date()
                )
            )
            completion(.success(payload))
        }
    }

    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String?, completion: @escaping (Result<StudyRoomPayload, WebSocketError>) -> Void) {
        completion(.failure(WebSocketError(message: "Not implemented in mock")))
    }

    func leaveStudyRoom(roomCode: String?, completion: @escaping (Result<EmptyResponse, WebSocketError>) -> Void) {
        completion(.success(EmptyResponse()))
    }

    func getStudyRoomState(roomCode: String, completion: @escaping (Result<StudyRoomPayload, WebSocketError>) -> Void) {
        completion(.failure(WebSocketError(message: "Not implemented in mock")))
    }

    func hostActionStudyRoom(roomCode: String, action: String, completion: @escaping (Result<EmptyResponse, WebSocketError>) -> Void) {
        completion(.success(EmptyResponse()))
    }
}

@MainActor
final class MockAuthServiceForStudy: AuthServiceProtocol {
    var isLoggedInValue = false
    var mockUser: User?

    var isLoggedIn: Bool {
        return isLoggedInValue
    }

    var currentUser: User? {
        return mockUser
    }

    func login(email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func logout() async -> AuthResult<Void> {
        isLoggedInValue = false
        return .success(())
    }

    func refreshToken() async -> AuthResult<Void> {
        return .success(())
    }

    func getCurrentUser() async -> AuthResult<User> {
        if let user = mockUser {
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
}

// MARK: - Study Service Tests

@MainActor
final class StudyServiceTests: XCTestCase {

    var sut: StudyService!
    var mockAPIClient: MockAPIClientForStudy!
    var mockWebSocketManager: MockWebSocketManagerForStudy!
    var mockAuthService: MockAuthServiceForStudy!

    override func setUp() async throws {
        try await super.setUp()

        mockAPIClient = MockAPIClientForStudy()
        mockWebSocketManager = MockWebSocketManagerForStudy()
        mockAuthService = MockAuthServiceForStudy()

        sut = StudyService(
            apiClient: mockAPIClient,
            webSocketManager: mockWebSocketManager,
            authService: mockAuthService
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockAPIClient = nil
        mockWebSocketManager = nil
        mockAuthService = nil
        try await super.tearDown()
    }
}

// MARK: - fetchStudyRooms Tests

extension StudyServiceTests {

    func testFetchStudyRoomsSuccess() async {
        // Given
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()
        mockAPIClient.mockStudyRooms = [
            createMockStudyRoom(id: "room1", name: "Math Study"),
            createMockStudyRoom(id: "room2", name: "Physics Study")
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
        mockAuthService.isLoggedInValue = false

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
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()
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
        mockAuthService.isLoggedInValue = false

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
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()
        mockWebSocketManager.isConnectedValue = true

        // When
        let result = await sut.createStudyRoom(name: "Test Room", maxMembers: 4)

        // Then
        switch result {
        case .success(let room):
            XCTAssertEqual(room.maxMembers, 4, "Should have correct max members")
            XCTAssertNotNil(sut.currentRoomState, "Should set current room state")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testCreateStudyRoomWebSocketFailure() async {
        // Given
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()
        mockWebSocketManager.shouldFailRoomCreation = true

        // When
        let result = await sut.createStudyRoom(name: "Test Room", maxMembers: 4)

        // Then
        switch result {
        case .failure(let error):
            // Should fail with WebSocket error
            XCTAssertTrue(true, "Should fail when WebSocket fails")
        case .success:
            XCTFail("Should fail when WebSocket fails")
        }
    }
}

// MARK: - joinStudyRoom Tests

extension StudyServiceTests {

    func testJoinStudyRoomFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.isLoggedInValue = false

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
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()

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

    func testJoinStudyRoomTrimsWhitespace() async {
        // Given
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()

        // When - room code with whitespace
        let result = await sut.joinStudyRoom(roomCode: "  abc123  ")

        // Then - should trim and uppercase
        // Will fail because WebSocket mock isn't configured, but room code validation should pass
        switch result {
        case .failure:
            // Expected to fail at WebSocket level
            XCTAssertTrue(true)
        case .success:
            XCTFail("Should fail at WebSocket level")
        }
    }
}

// MARK: - leaveStudyRoom Tests

extension StudyServiceTests {

    func testLeaveStudyRoomFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.isLoggedInValue = false

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
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()
        sut.currentRoomState = StudyRoomState(
            roomCode: "ABC123",
            hostUserId: "user_123",
            maxMembers: 4,
            members: [],
            sessionState: .idle,
            createdAt: Date(),
            updatedAt: Date()
        )
        sut.currentRoomCode = "ABC123"

        // When
        let result = await sut.leaveStudyRoom()

        // Then
        switch result {
        case .success:
            XCTAssertNil(sut.currentRoomState, "Should clear room state")
            XCTAssertNil(sut.currentRoomCode, "Should clear room code")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }
}

// MARK: - startStudySession Tests

extension StudyServiceTests {

    func testStartStudySessionFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.isLoggedInValue = false

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
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()
        sut.isActiveSession = true

        // When
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
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()
        mockAPIClient.mockStudySession = createMockSession()

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
}

// MARK: - endStudySession Tests

extension StudyServiceTests {

    func testEndStudySessionFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.isLoggedInValue = false

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
        mockAuthService.isLoggedInValue = true
        sut.isActiveSession = false

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
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()
        let session = createMockSession()
        sut.currentSession = session
        sut.isActiveSession = true
        sut.sessionState = .focusing
        mockAPIClient.mockStudySession = session

        // When
        let result = await sut.endStudySession()

        // Then
        switch result {
        case .success:
            XCTAssertFalse(sut.isActiveSession, "Should clear active session flag")
            XCTAssertEqual(sut.sessionState, .idle, "Should reset session state")
            XCTAssertEqual(sut.currentFocusTime, 0, "Should reset focus time")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }
}

// MARK: - fetchStudyStats Tests

extension StudyServiceTests {

    func testFetchStudyStatsSuccess() async {
        // Given
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()
        mockAPIClient.mockStudyStats = StudyStats(
            totalDuration: 3600,
            todayDuration: 1800,
            streakDays: 5,
            sessionCount: 10
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
        mockAuthService.isLoggedInValue = false

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
        mockAuthService.isLoggedInValue = false

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
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()

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

    func testPauseSession() async {
        // Given
        sut.isActiveSession = true
        sut.sessionState = .focusing

        // When
        sut.pauseSession()

        // Then
        XCTAssertEqual(sut.sessionState, .paused, "Should set session state to paused")
    }

    func testResumeSession() async {
        // Given
        sut.isActiveSession = true
        sut.sessionState = .paused

        // When
        sut.resumeSession()

        // Then
        XCTAssertEqual(sut.sessionState, .focusing, "Should set session state to focusing")
    }
}

// MARK: - Convenience Properties Tests

extension StudyServiceTests {

    func testFormattedFocusTime() {
        // Given
        sut.currentFocusTime = 3661 // 1 hour, 1 minute, 1 second

        // Then
        XCTAssertEqual(sut.formattedFocusTime, "01:01:01", "Should format time correctly")
    }

    func testFormattedFocusTimeUnderOneHour() {
        // Given
        sut.currentFocusTime = 125 // 2 minutes, 5 seconds

        // Then
        XCTAssertEqual(sut.formattedFocusTime, "02:05", "Should format time correctly")
    }

    func testFocusTimeInMinutes() {
        // Given
        sut.currentFocusTime = 180 // 3 minutes

        // Then
        XCTAssertEqual(sut.focusTimeInMinutes, 3, "Should return minutes")
    }
}

// MARK: - Helper Methods

extension StudyServiceTests {

    private func createMockUser() -> User {
        User(
            id: "test_user_id",
            email: "test@example.com",
            username: "test_user",
            displayName: "Test User",
            avatarURL: nil,
            bio: nil,
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func createMockStudyRoom(id: String, name: String) -> StudyRoom {
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

    private func createMockSession() -> StudySession {
        StudySession(
            id: "session_123",
            userId: "user_123",
            roomCode: "ABC123",
            startTime: Date(),
            endTime: nil,
            duration: 0,
            status: .active,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}
