//
//  StudyRoomViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for StudyRoomViewModel - tests real-time multi-person study room
//  state sync via ClawbotChannelService bindings.
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock ClawbotChannelServiceProtocol

/// Mock implementation of ClawbotChannelServiceProtocol for ViewModel testing
final class MockClawbotChannelService: ClawbotChannelServiceProtocol {

    // MARK: - Published Properties (match real service)

    @Published private(set) var connectionState: ClawbotConnectionState = .disconnected
    @Published private(set) var isPaired: Bool = false
    @Published private(set) var lastMessage: ClawbotMessage?
    @Published private(set) var botBehaviorState: BotBehaviorState = .idle
    @Published private(set) var botConnectionState: BotConnectionState = .unknown
    @Published private(set) var isBotOnline: Bool = false
    @Published private(set) var currentStudyRoomState: StudyRoomState?

    // MARK: - Mock Configuration

    var mockConnectionResult: Result<Void, Error> = .success(())
    var mockPairingResult: Result<Bool, Error> = .success(true)
    var mockStudyRoomResult: Result<StudyRoomState, Error> = .failure(
        ClawbotError.messageFailed("Not configured")
    )
    var mockHostActionResult: Result<StudyRoomState, Error> = .failure(
        ClawbotError.messageFailed("Not configured")
    )
    var mockLeaveResult: Result<Void, Error> = .success(())

    // Call tracking
    private(set) var connectCallCount = 0
    private(set) var disconnectCallCount = 0
    private(set) var pairCallCount = 0
    private(set) var createRoomCallCount = 0
    private(set) var joinRoomCallCount = 0
    private(set) var leaveRoomCallCount = 0
    private(set) var hostActionCallCount = 0

    // MARK: - ClawbotChannelServiceProtocol

    var ttsEnabled: Bool = true
    var ttsLanguage: TTSLanguage = .chinese

    func connect() async throws {
        connectCallCount += 1
        switch mockConnectionResult {
        case .success:
            connectionState = .connected
        case .failure(let error):
            connectionState = .error(error.localizedDescription)
            throw error
        }
    }

    func disconnect() {
        disconnectCallCount += 1
        connectionState = .disconnected
    }

    func checkPairingStatus() async throws -> ClawbotPairingStatus {
        ClawbotPairingStatus(
            paired: isPaired,
            deviceId: nil,
            deviceName: nil,
            botOnline: isBotOnline,
            pairedAt: nil
        )
    }

    func pairWithCode(_ code: String) async throws -> Bool {
        pairCallCount += 1
        switch mockPairingResult {
        case .success(let result):
            isPaired = result
            return result
        case .failure(let error):
            throw error
        }
    }

    func pairWithQR(_ qrData: String) async throws -> Bool {
        try await pairWithCode(qrData)
    }

    func unpair() {
        isPaired = false
    }

    func sendMessage(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?) async throws {
        // Not used in ViewModel tests
    }

    func sendMessageWithCallback(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, completion: @escaping (Result<String, Error>) -> Void) async throws {
        // Not used in ViewModel tests
    }

    func createStudyRoom(displayName: String, avatarUrl: String?, maxMembers: Int?) async throws -> StudyRoomState {
        createRoomCallCount += 1
        switch mockStudyRoomResult {
        case .success(let room):
            currentStudyRoomState = room
            return room
        case .failure(let error):
            throw error
        }
    }

    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String?) async throws -> StudyRoomState {
        joinRoomCallCount += 1
        switch mockStudyRoomResult {
        case .success(let room):
            currentStudyRoomState = room
            return room
        case .failure(let error):
            throw error
        }
    }

    func leaveStudyRoom(roomCode: String?) async throws {
        leaveRoomCallCount += 1
        switch mockLeaveResult {
        case .success:
            currentStudyRoomState = nil
        case .failure(let error):
            throw error
        }
    }

    func hostActionStudyRoom(roomCode: String, action: StudyRoomHostAction) async throws -> StudyRoomState {
        hostActionCallCount += 1
        switch mockHostActionResult {
        case .success(let room):
            currentStudyRoomState = room
            return room
        case .failure(let error):
            throw error
        }
    }

    // MARK: - Helpers

    func reset() {
        connectCallCount = 0
        disconnectCallCount = 0
        pairCallCount = 0
        createRoomCallCount = 0
        joinRoomCallCount = 0
        leaveRoomCallCount = 0
        hostActionCallCount = 0
        mockStudyRoomResult = .failure(ClawbotError.messageFailed("Not configured"))
        mockHostActionResult = .failure(ClawbotError.messageFailed("Not configured"))
        mockLeaveResult = .success(())
    }

    func simulateRoomStateUpdate(_ state: StudyRoomState?) {
        currentStudyRoomState = state
    }

    func simulateConnection(state: ClawbotConnectionState) {
        connectionState = state
    }
}

// MARK: - Mock AuthServiceProtocol

final class MockAuthServiceForViewModel: AuthServiceProtocol {

    @Published private(set) var isLoggedIn: Bool = false
    @Published private(set) var currentUser: AuthUser?

    var mockIsLoggedIn: Bool = false
    var mockCurrentUser: AuthUser?

    var isAuthenticated: Bool { mockIsLoggedIn }

    func signIn(email: String, password: String) async throws {
        // Not used in ViewModel tests
    }

    func signUp(email: String, password: String, username: String) async throws {
        // Not used in ViewModel tests
    }

    func signOut() async throws {
        mockIsLoggedIn = false
        mockCurrentUser = nil
    }

    func getIdToken() async -> String? { nil }

    func refreshTokenIfNeeded() async throws {}

    var displayName: String? { mockCurrentUser?.displayName ?? mockCurrentUser?.username }
    var avatarUrl: String? { mockCurrentUser?.avatarUrl }
}

// MARK: - Mock StudyServiceProtocol

final class MockStudyServiceForViewModel: StudyServiceProtocol {

    @Published private(set) var studyRooms: [StudyRoom] = []
    @Published private(set) var currentSession: StudySession?
    @Published private(set) var isActiveSession: Bool = false
    @Published private(set) var currentFocusTime: TimeInterval = 0
    @Published private(set) var sessionState: TimerState = .idle
    @Published private(set) var isWebSocketConnected: Bool = false
    @Published private(set) var currentRoomState: StudyRoomState?

    var mockStudyRooms: [StudyRoom] = []
    var mockCurrentRoomState: StudyRoomState?
    var mockSession: StudySession?
    var mockActiveSession: Bool = false
    var mockSessionState: TimerState = .idle

    var createRoomResult: StudyResult<StudyRoom> = .failure(.notAuthenticated)
    var joinRoomResult: StudyResult<StudyRoomState> = .failure(.notAuthenticated)
    var leaveRoomResult: StudyResult<Void> = .failure(.notAuthenticated)
    var startSessionResult: StudyResult<StudySession> = .failure(.noActiveSession)
    var endSessionResult: StudyResult<StudySession> = .failure(.noActiveSession)
    var fetchStatsResult: StudyResult<StudyStats> = .failure(.notAuthenticated)
    var lastError: StudyError?

    private(set) var createCallCount = 0
    private(set) var joinCallCount = 0
    private(set) var leaveCallCount = 0

    init() {}

    func fetchStudyRooms() async -> StudyResult<[StudyRoom]> { .success([]) }

    func createStudyRoom(name: String, maxMembers: Int) async -> StudyResult<StudyRoom> {
        createCallCount += 1
        studyRooms = mockStudyRooms
        switch createRoomResult {
        case .success(let room):
            currentRoomState = StudyRoomState(
                roomCode: room.roomCode,
                hostUserId: room.hostUserId,
                sessionState: .idle,
                members: room.members,
                maxMembers: room.maxMembers,
                version: 1,
                createdAt: Date(),
                updatedAt: Date(),
                timer: nil
            )
            return .success(room)
        case .failure(let error):
            lastError = error
            return .failure(error)
        }
    }

    func joinStudyRoom(roomCode: String) async -> StudyResult<StudyRoomState> {
        joinCallCount += 1
        switch joinRoomResult {
        case .success(let state):
            currentRoomState = state
            return .success(state)
        case .failure(let error):
            lastError = error
            return .failure(error)
        }
    }

    func leaveStudyRoom() async -> StudyResult<Void> {
        leaveCallCount += 1
        switch leaveRoomResult {
        case .success:
            currentRoomState = nil
            return .success(())
        case .failure(let error):
            lastError = error
            return .failure(error)
        }
    }

    func joinRoom(_ roomCode: String) async -> StudyResult<StudyRoomState> {
        joinStudyRoom(roomCode: roomCode)
    }

    func leaveRoom(_ roomCode: String) async -> StudyResult<Void> {
        leaveStudyRoom()
    }

    func startStudySession(roomCode: String) async -> StudyResult<StudySession> {
        isActiveSession = true
        sessionState = .focusing
        switch startSessionResult {
        case .success(let session):
            currentSession = session
            return .success(session)
        case .failure(let error):
            lastError = error
            return .failure(error)
        }
    }

    func startFocusSession(roomCode: String) async -> StudyResult<StudySession> {
        startStudySession(roomCode: roomCode)
    }

    func endStudySession() async -> StudyResult<StudySession> {
        isActiveSession = false
        sessionState = .idle
        switch endSessionResult {
        case .success(let session):
            return .success(session)
        case .failure(let error):
            lastError = error
            return .failure(error)
        }
    }

    func endSession(roomCode: String) async -> StudyResult<StudySession> {
        endStudySession()
    }

    func pauseSession(roomCode: String) async throws {
        sessionState = .paused
        isActiveSession = false
    }

    func resumeSession(roomCode: String) async throws {
        sessionState = .focusing
        isActiveSession = true
    }

    func fetchStudyStats() async -> StudyResult<StudyStats> { fetchStatsResult }

    func getStudyStats() async -> StudyResult<StudyStats> { fetchStatsResult }

    func getWeeklyStudyData() async -> StudyResult<[DailyStudyData]> { .success([]) }

    func syncOfflineSessions() async -> StudyResult<Int> { .success(0) }

    func reset() {
        createCallCount = 0
        joinCallCount = 0
        leaveCallCount = 0
        currentRoomState = nil
        currentSession = nil
        isActiveSession = false
        sessionState = .idle
        lastError = nil
    }
}

// MARK: - Test Helpers

private func makeRoomState(
    roomCode: String = "ABC123",
    hostUserId: String = "user-1",
    sessionState: StudyRoomSessionState = .idle,
    members: [StudyRoomMember] = [],
    maxMembers: Int = 4
) -> StudyRoomState {
    StudyRoomState(
        roomCode: roomCode,
        hostUserId: hostUserId,
        sessionState: sessionState,
        members: members,
        maxMembers: maxMembers,
        version: 1,
        createdAt: Date(),
        updatedAt: Date(),
        timer: nil
    )
}

private func makeRoomMember(
    userId: String = "user-1",
    displayName: String = "Tester",
    status: StudyRoomMemberStatus = .online
) -> StudyRoomMember {
    StudyRoomMember(
        userId: userId,
        displayName: displayName,
        avatarUrl: nil,
        joinedAt: Date(),
        lastActiveAt: Date(),
        status: status
    )
}

private func makeAuthUser(id: String = "user-1", username: String = "tester") -> AuthUser {
    AuthUser(
        id: id,
        email: "test@example.com",
        username: username,
        displayName: username,
        avatarUrl: nil,
        createdAt: Date()
    )
}

// MARK: - Test Cases

@MainActor
final class StudyRoomViewModelTests: XCTestCase {

    // MARK: - Properties

    private var viewModel: StudyRoomViewModel!
    private var mockChannelService: MockClawbotChannelService!
    private var mockAuthService: MockAuthServiceForViewModel!
    private var mockStudyService: MockStudyServiceForViewModel!
    private var cancellables: Set<AnyCancellable>!

    // MARK: - Lifecycle

    override func setUp() async throws {
        mockChannelService = MockClawbotChannelService()
        mockAuthService = MockAuthServiceForViewModel()
        mockStudyService = MockStudyServiceForViewModel()

        // Set up logged-in user
        mockAuthService.mockIsLoggedIn = true
        mockAuthService.mockCurrentUser = makeAuthUser()

        viewModel = StudyRoomViewModel(
            clawbotChannelService: mockChannelService,
            authService: mockAuthService,
            studyService: mockStudyService
        )

        cancellables = []
    }

    override func tearDown() async throws {
        mockChannelService.reset()
        mockStudyService.reset()
        viewModel = nil
        mockChannelService = nil
        mockAuthService = nil
        mockStudyService = nil
        cancellables = nil
    }

    // MARK: - Initial State

    func test_initialState_hasNoRoomState() {
        XCTAssertNil(viewModel.roomState)
        XCTAssertFalse(viewModel.isMemberOfRoom)
        XCTAssertFalse(viewModel.isConnected)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertEqual(viewModel.entryMode, .selfStudy)
    }

    func test_entryModeDefaults_toSelfStudy() {
        XCTAssertEqual(viewModel.entryMode, .selfStudy)
        XCTAssertEqual(viewModel.entryMode.label, "自己自习")
        XCTAssertEqual(viewModel.entryMode.icon, "person.fill")
    }

    // MARK: - onAppear

    func test_onAppear_syncsFromStudyService() async {
        // Pre-populate StudyService with a room
        let room = makeRoomState(
            members: [makeRoomMember(userId: "user-1")]
        )
        mockStudyService.mockCurrentRoomState = room
        mockStudyService.currentRoomState = room

        // Simulate service returning the room
        let studyServiceWithRoom = MockStudyServiceForViewModel()
        studyServiceWithRoom.mockCurrentRoomState = room
        studyServiceWithRoom.currentRoomState = room
        studyServiceWithRoom.mockIsLoggedIn = true
        studyServiceWithRoom.mockCurrentUser = makeAuthUser()

        let vm = StudyRoomViewModel(
            clawbotChannelService: mockChannelService,
            authService: mockAuthService,
            studyService: studyServiceWithRoom
        )

        vm.onAppear()

        // Wait for async bindings
        try? await Task.sleep(nanoseconds: 100_000_000)

        XCTAssertNotNil(vm.roomState)
        XCTAssertEqual(vm.roomState?.roomCode, "ABC123")
    }

    // MARK: - WebSocket Connection State

    func test_isConnected_reflectsClawbotChannelService() async throws {
        // Initially disconnected
        XCTAssertFalse(viewModel.isConnected)

        // Simulate connected
        mockChannelService.simulateConnection(state: .connected)

        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertTrue(viewModel.isConnected)
    }

    func test_isConnected_false_whenDisconnected() async throws {
        mockChannelService.simulateConnection(state: .connected)
        try await Task.sleep(nanoseconds: 50_000_000)
        XCTAssertTrue(viewModel.isConnected)

        mockChannelService.simulateConnection(state: .disconnected)
        try await Task.sleep(nanoseconds: 50_000_000)
        XCTAssertFalse(viewModel.isConnected)
    }

    // MARK: - Real-time Room State Updates

    func test_roomState_updatesFromClawbotChannelService() async throws {
        let room = makeRoomState(
            roomCode: "XYZ789",
            members: [
                makeRoomMember(userId: "user-1"),
                makeRoomMember(userId: "user-2", displayName: "Alice")
            ]
        )

        mockChannelService.simulateRoomStateUpdate(room)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertEqual(viewModel.roomState?.roomCode, "XYZ789")
        XCTAssertEqual(viewModel.roomState?.members.count, 2)
    }

    func test_roomState_updatesWithMultipleMembers() async throws {
        let room = makeRoomState(
            sessionState: .focusing,
            members: [
                makeRoomMember(userId: "user-1", displayName: "Alice", status: .focusing),
                makeRoomMember(userId: "user-2", displayName: "Bob", status: .focusing),
                makeRoomMember(userId: "user-3", displayName: "Charlie", status: .online)
            ]
        )

        mockChannelService.simulateRoomStateUpdate(room)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertEqual(viewModel.roomState?.sessionState, .focusing)
        XCTAssertEqual(viewModel.roomState?.members.count, 3)
        XCTAssertEqual(viewModel.seats.count, 4) // 3 members + 1 empty slot
    }

    // MARK: - Member Status

    func test_isMemberOfRoom_true_whenUserIsMember() async throws {
        let room = makeRoomState(
            members: [makeRoomMember(userId: "user-1")]
        )

        mockChannelService.simulateRoomStateUpdate(room)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertTrue(viewModel.isMemberOfRoom)
    }

    func test_isMemberOfRoom_false_whenUserIsNotMember() async throws {
        let room = makeRoomState(
            members: [makeRoomMember(userId: "other-user")]
        )

        mockChannelService.simulateRoomStateUpdate(room)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertFalse(viewModel.isMemberOfRoom)
    }

    // MARK: - Host Detection

    func test_isHost_true_whenCurrentUserIsHost() async throws {
        let room = makeRoomState(
            hostUserId: "user-1",
            members: [makeRoomMember(userId: "user-1")]
        )

        mockChannelService.simulateRoomStateUpdate(room)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertTrue(viewModel.isHost)
    }

    func test_isHost_false_whenCurrentUserIsNotHost() async throws {
        let room = makeRoomState(
            hostUserId: "other-user",
            members: [
                makeRoomMember(userId: "other-user"),
                makeRoomMember(userId: "user-1")
            ]
        )

        mockChannelService.simulateRoomStateUpdate(room)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertFalse(viewModel.isHost)
    }

    // MARK: - Seats Computation

    func test_seats_computesCorrectNumberOfSlots() async throws {
        let room = makeRoomState(
            maxMembers: 6,
            members: [
                makeRoomMember(userId: "user-1"),
                makeRoomMember(userId: "user-2")
            ]
        )

        mockChannelService.simulateRoomStateUpdate(room)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertEqual(viewModel.seats.count, 6) // 2 members + 4 empty
    }

    func test_seats_includesMemberSeats() async throws {
        let room = makeRoomState(
            members: [
                makeRoomMember(userId: "user-1", displayName: "Alice"),
                makeRoomMember(userId: "user-2", displayName: "Bob")
            ]
        )

        mockChannelService.simulateRoomStateUpdate(room)
        try await Task.sleep(nanoseconds: 50_000_000)

        let memberSeats = viewModel.seats.compactMap { seat -> StudyRoomMember? in
            if case .member(let m) = seat { return m }
            return nil
        }
        XCTAssertEqual(memberSeats.count, 2)
        XCTAssertEqual(memberSeats[0].displayName, "Alice")
        XCTAssertEqual(memberSeats[1].displayName, "Bob")
    }

    // MARK: - Room Creation

    func test_createRoom_callsStudyService() async {
        let room = makeRoomState(roomCode: "NEWROOM", members: [makeRoomMember()])
        mockStudyService.createRoomResult = .success(StudyRoom(
            id: "new-id",
            roomCode: "NEWROOM",
            name: "New Room",
            hostUserId: "user-1",
            maxMembers: 4,
            members: room.members,
            sessionState: .idle,
            createdAt: Date(),
            updatedAt: Date()
        ))

        await viewModel.createRoom()

        XCTAssertEqual(mockStudyService.createCallCount, 1)
        XCTAssertEqual(viewModel.roomState?.roomCode, "NEWROOM")
        XCTAssertEqual(viewModel.roomCodeInput, "NEWROOM")
    }

    func test_createRoom_setsError_whenNotAuthenticated() async {
        mockAuthService.mockIsLoggedIn = false

        await viewModel.createRoom()

        XCTAssertNotNil(viewModel.errorMessage)
        XCTAssertEqual(viewModel.errorMessage, "请先登录")
    }

    // MARK: - Room Joining

    func test_joinRoomByCode_normalizesToUppercase() async {
        viewModel.roomCodeInput = "abc123"
        let room = makeRoomState(roomCode: "ABC123")
        mockStudyService.joinRoomResult = .success(room)

        await viewModel.joinRoomByCode()

        XCTAssertEqual(mockStudyService.joinCallCount, 1)
        XCTAssertEqual(viewModel.roomCodeInput, "ABC123")
    }

    func test_joinRoomByCode_rejectsShortCode() async {
        viewModel.roomCodeInput = "AB"

        await viewModel.joinRoomByCode()

        XCTAssertNotNil(viewModel.errorMessage)
        XCTAssertEqual(viewModel.errorMessage, "请输入 4-8 位房间号")
        XCTAssertEqual(mockStudyService.joinCallCount, 0)
    }

    func test_joinRoomByCode_rejectsNonAlphanumericCode() async {
        viewModel.roomCodeInput = "AB!@#1"

        await viewModel.joinRoomByCode()

        XCTAssertNotNil(viewModel.errorMessage)
        XCTAssertEqual(mockStudyService.joinCallCount, 0)
    }

    // MARK: - Room Leaving

    func test_leaveRoom_clearsRoomState() async throws {
        let room = makeRoomState()
        mockChannelService.simulateRoomStateUpdate(room)
        try await Task.sleep(nanoseconds: 50_000_000)

        await viewModel.leaveRoom()

        XCTAssertNil(viewModel.roomState)
        XCTAssertEqual(viewModel.roomCodeInput, "")
        XCTAssertFalse(viewModel.isMemberOfRoom)
    }

    // MARK: - Host Actions

    func test_performHostAction_callsHostAction() async {
        let idleRoom = makeRoomState(hostUserId: "user-1")
        let focusingRoom = makeRoomState(hostUserId: "user-1", sessionState: .focusing)

        // First set room
        mockStudyService.joinRoomResult = .success(idleRoom)
        await viewModel.joinRoomByCode()

        mockChannelService.simulateRoomStateUpdate(focusingRoom)
        mockStudyService.startSessionResult = .success(StudySession(
            id: "session-1",
            startedAt: Date(),
            duration: 25
        ))

        await viewModel.performHostAction(.startFocus)

        XCTAssertFalse(viewModel.isLoading)
        // Room state updated via WebSocket binding
    }

    // MARK: - Error Handling

    func test_clearError_clearsErrorMessage() async {
        viewModel.errorMessage = "Some error"

        viewModel.clearError()

        XCTAssertNil(viewModel.errorMessage)
    }

    func test_joinRoomByCode_setsError_onServiceFailure() async {
        viewModel.roomCodeInput = "ABC123"
        mockStudyService.joinRoomResult = .failure(.roomNotFound)

        await viewModel.joinRoomByCode()

        XCTAssertNotNil(viewModel.errorMessage)
    }

    // MARK: - Entry Mode

    func test_entryMode_switchesBetweenModes() async throws {
        XCTAssertEqual(viewModel.entryMode, .selfStudy)

        viewModel.entryMode = .friend
        XCTAssertEqual(viewModel.entryMode, .friend)
        XCTAssertEqual(viewModel.entryMode.label, "加入好友")

        viewModel.entryMode = .code
        XCTAssertEqual(viewModel.entryMode, .code)
        XCTAssertEqual(viewModel.entryMode.label, "房间号加入")
    }

    // MARK: - Duration Selection

    func test_selectedDuration_defaultsTo25() {
        XCTAssertEqual(viewModel.selectedDuration, 25)
    }

    func test_selectedDuration_updatesToOtherPreset() async throws {
        viewModel.selectedDuration = 45
        XCTAssertEqual(viewModel.selectedDuration, 45)

        viewModel.selectedDuration = 60
        XCTAssertEqual(viewModel.selectedDuration, 60)
    }

    // MARK: - Room Code Input

    func test_roomCodeInput_uppercasesAutomatically() async throws {
        viewModel.roomCodeInput = "abc"

        XCTAssertEqual(viewModel.roomCodeInput, "abc")
    }

    // MARK: - Timer State

    func test_remainingSeconds_isNil_whenNoTimer() async throws {
        let room = makeRoomState(sessionState: .idle)
        mockChannelService.simulateRoomStateUpdate(room)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertNil(viewModel.remainingSeconds)
    }

    // MARK: - Reconnection

    func test_refreshRoomState_callsJoinRoom() async throws {
        let room = makeRoomState()
        mockChannelService.simulateRoomStateUpdate(room)
        try await Task.sleep(nanoseconds: 50_000_000)

        mockStudyService.joinRoomResult = .success(room)

        await viewModel.refreshRoomState()

        XCTAssertEqual(mockStudyService.joinCallCount, 1)
    }

    // MARK: - Multi-Person Scenario Tests

    func test_multiPerson_roomState_updatesMemberStatuses() async throws {
        // Initial: user joins room
        let initialRoom = makeRoomState(
            roomCode: "ROOM01",
            members: [
                makeRoomMember(userId: "user-1", displayName: "Alice", status: .online),
                makeRoomMember(userId: "user-2", displayName: "Bob", status: .online)
            ]
        )

        mockChannelService.simulateRoomStateUpdate(initialRoom)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertEqual(viewModel.roomState?.members.count, 2)
        XCTAssertTrue(viewModel.isMemberOfRoom)

        // Host starts focus session
        let focusingRoom = makeRoomState(
            roomCode: "ROOM01",
            sessionState: .focusing,
            members: [
                makeRoomMember(userId: "user-1", displayName: "Alice", status: .focusing),
                makeRoomMember(userId: "user-2", displayName: "Bob", status: .focusing)
            ],
            timer: StudyRoomTimerState(
                durationSeconds: 1500,
                startedAt: Date(),
                endsAt: Date().addingTimeInterval(1500),
                remainingSeconds: 1500
            )
        )

        mockChannelService.simulateRoomStateUpdate(focusingRoom)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertEqual(viewModel.roomState?.sessionState, .focusing)
        XCTAssertNotNil(viewModel.remainingSeconds)
    }

    func test_multiPerson_memberJoins_updatesRoom() async throws {
        let initialRoom = makeRoomState(
            members: [makeRoomMember(userId: "user-1")]
        )
        mockChannelService.simulateRoomStateUpdate(initialRoom)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertEqual(viewModel.roomState?.members.count, 1)

        let updatedRoom = makeRoomState(
            members: [
                makeRoomMember(userId: "user-1"),
                makeRoomMember(userId: "user-2", displayName: "Bob")
            ]
        )
        mockChannelService.simulateRoomStateUpdate(updatedRoom)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertEqual(viewModel.roomState?.members.count, 2)
    }

    func test_multiPerson_memberLeaves_updatesRoom() async throws {
        let roomWithMembers = makeRoomState(
            members: [
                makeRoomMember(userId: "user-1"),
                makeRoomMember(userId: "user-2")
            ]
        )
        mockChannelService.simulateRoomStateUpdate(roomWithMembers)
        try await Task.sleep(nanoseconds: 50_000_000)

        let roomAfterLeave = makeRoomState(
            members: [makeRoomMember(userId: "user-1")]
        )
        mockChannelService.simulateRoomStateUpdate(roomAfterLeave)
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertEqual(viewModel.roomState?.members.count, 1)
    }
}
