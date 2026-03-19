//
//  StudyRoomViewModel.swift
//  TRIX3DCompanion
//
//  Study Room ViewModel - bridges ClawbotChannelService real-time state
//  with SwiftUI view, enabling multi-person study room real-time sync.
//

import Foundation
import Combine
import SwiftUI

// MARK: - View Model

/// ViewModel for StudyRoom - observes ClawbotChannelService for real-time updates
/// and bridges with StudyService for HTTP-based room operations.
@MainActor
final class StudyRoomViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Current study room state (from WebSocket real-time events)
    @Published private(set) var roomState: StudyRoomState?

    /// Whether user is currently a member of a room
    @Published private(set) var isMemberOfRoom: Bool = false

    /// Connection status to TRIX Native Channel
    @Published private(set) var isConnected: Bool = false

    /// Loading state for async operations
    @Published private(set) var isLoading: Bool = false

    /// Error message to display
    @Published var errorMessage: String?

    /// Duration presets for focus sessions
    @Published var selectedDuration: Int = 25

    /// Friend candidates for "join friend" entry mode
    @Published private(set) var friendCandidates: [FriendStudyCandidate] = []

    /// Loading state for friend lookup
    @Published private(set) var isLoadingFriends: Bool = false

    // MARK: - Entry Mode

    enum EntryMode: String, CaseIterable, Identifiable {
        case selfStudy = "self"
        case friend = "friend"
        case code = "room"

        var id: String { rawValue }

        var label: String {
            switch self {
            case .selfStudy: return "自己自习"
            case .friend: return "加入好友"
            case .code: return "房间号加入"
            }
        }

        var icon: String {
            switch self {
            case .selfStudy: return "person.fill"
            case .friend: return "person.2.fill"
            case .code: return "number"
            }
        }
    }

    @Published var entryMode: EntryMode = .selfStudy

    // MARK: - Computed Properties

    /// Room code input from user
    @Published var roomCodeInput: String = ""

    /// Current user ID from auth service
    private var currentUserId: String? {
        AuthService.shared.currentUser?.id
    }

    /// Whether current user is the room host
    var isHost: Bool {
        guard let userId = currentUserId, let room = roomState else { return false }
        return room.hostUserId == userId
    }

    /// Remaining seconds for active session
    var remainingSeconds: Int? {
        guard let timer = roomState?.timer, roomState?.sessionState != .idle else { return nil }
        if roomState?.sessionState == .resting { return timer.remainingSeconds }
        return max(0, Int(timer.endsAt.timeIntervalSinceNow))
    }

    /// Seat slots for rendering (filled + empty)
    var seats: [SeatItem] {
        guard let room = roomState else { return [] }
        let members = room.members
        var items: [SeatItem] = members.map { SeatItem.member($0) }
        while items.count < room.maxMembers {
            items.append(.empty)
        }
        return Array(items.prefix(room.maxMembers))
    }

    // MARK: - Dependencies

    private let clawbotChannelService: ClawbotChannelServiceProtocol
    private let authService: AuthServiceProtocol
    private let studyService: StudyServiceProtocol

    // MARK: - Private

    private var cancellables = Set<AnyCancellable>()
    private var reconnectTask: Task<Void, Never>?

    // MARK: - Initialization

    init(
        clawbotChannelService: ClawbotChannelServiceProtocol = ClawbotChannelService.shared,
        authService: AuthServiceProtocol = AuthService.shared,
        studyService: StudyServiceProtocol = StudyService.shared
    ) {
        self.clawbotChannelService = clawbotChannelService
        self.authService = authService
        self.studyService = studyService

        setupBindings()
    }

    deinit {
        reconnectTask?.cancel()
    }

    // MARK: - Setup

    private func setupBindings() {
        // Observe room state from WebSocket real-time events
        clawbotChannelService.$currentStudyRoomState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleRoomStateUpdate(state)
            }
            .store(in: &cancellables)

        // Observe WebSocket connection state for reconnection handling
        clawbotChannelService.$connectionState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleConnectionStateUpdate(state)
            }
            .store(in: &cancellables)

        // Observe room state from StudyService (HTTP-based state)
        studyService.$currentRoomState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                guard let self = self, self.roomState == nil, let state = state else { return }
                self.roomState = state
                self.updateMemberStatus()
            }
            .store(in: &cancellables)
    }

    // MARK: - Lifecycle

    func onAppear() {
        // Sync initial state from service
        if let serviceRoomState = studyService.currentRoomState {
            self.roomState = serviceRoomState
            updateMemberStatus()
        }

        // Attempt to connect to TRIX Native Channel if not connected
        Task {
            try? await clawbotChannelService.connect()
        }
    }

    func onDisappear() {
        // No-op: keep connection alive for background operation
    }

    // MARK: - Room State Handling

    private func handleRoomStateUpdate(_ state: StudyRoomState?) {
        self.roomState = state
        updateMemberStatus()
    }

    private func handleConnectionStateUpdate(_ state: ClawbotConnectionState) {
        let wasConnected = isConnected
        isConnected = state == .connected

        // On reconnect, refresh room state to sync any missed updates
        if !wasConnected && isConnected {
            reconnectTask?.cancel()
            reconnectTask = Task {
                try? await Task.sleep(nanoseconds: 500_000_000) // 500ms debounce
                guard !Task.isCancelled else { return }
                await refreshRoomState()
            }
        }
    }

    private func updateMemberStatus() {
        guard let room = roomState, let userId = currentUserId else {
            isMemberOfRoom = false
            return
        }
        isMemberOfRoom = room.members.contains { $0.userId == userId }
    }

    // MARK: - Actions

    /// Create a new study room
    func createRoom() async {
        guard let user = authService.currentUser else {
            errorMessage = "请先登录"
            return
        }

        isLoading = true
        errorMessage = nil

        let result = await studyService.createStudyRoom(
            name: "Room",
            maxMembers: 4
        )

        switch result {
        case .success(let room):
            roomState = room
            roomCodeInput = room.roomCode
            updateMemberStatus()
        case .failure(let error):
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Join a room by room code
    func joinRoomByCode() async {
        let code = roomCodeInput.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard code.count >= 4, code.count <= 8, code.allSatisfy({ $0.isLetter || $0.isNumber }) else {
            errorMessage = "请输入 4-8 位房间号"
            return
        }

        guard authService.isLoggedIn else {
            errorMessage = "请先登录"
            return
        }

        isLoading = true
        errorMessage = nil

        let result = await studyService.joinRoom(code)

        switch result {
        case .success(let state):
            roomState = state
            roomCodeInput = state.roomCode
            updateMemberStatus()
        case .failure(let error):
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Join a friend's room directly
    func joinFriendRoom(_ friend: FriendStudyCandidate) async {
        guard let roomCode = friend.roomCode else {
            errorMessage = "该好友当前没有可加入的房间"
            return
        }

        guard authService.isLoggedIn else {
            errorMessage = "请先登录"
            return
        }

        isLoading = true
        errorMessage = nil

        let result = await studyService.joinRoom(roomCode)

        switch result {
        case .success(let state):
            roomState = state
            roomCodeInput = state.roomCode
            updateMemberStatus()
        case .failure(let error):
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Leave the current room
    func leaveRoom() async {
        guard let roomCode = roomState?.roomCode else { return }

        isLoading = true
        errorMessage = nil

        let result = await studyService.leaveRoom(roomCode)

        switch result {
        case .success:
            roomState = nil
            roomCodeInput = ""
            isMemberOfRoom = false
        case .failure(let error):
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Perform a host action (start_focus, pause, end)
    func performHostAction(_ action: StudyRoomHostAction) async {
        guard let roomCode = roomState?.roomCode else { return }

        isLoading = true
        errorMessage = nil

        let result: StudyResult<StudySession>
        switch action {
        case .startFocus:
            result = await studyService.startFocusSession(roomCode: roomCode)
        case .pause:
            var studyError: StudyError?
            await studyService.pauseSession(roomCode: roomCode)
            if let err = studyService.lastError {
                studyError = err
            }
            result = studyError.map { .failure($0) } ?? .success(StudySession(id: "", startedAt: Date(), duration: 0))
        case .end:
            result = await studyService.endSession(roomCode: roomCode)
        }

        // Room state is updated via WebSocket subscription
        isLoading = false
    }

    /// Refresh room state from server (pull)
    func refreshRoomState() async {
        guard let roomCode = roomState?.roomCode else { return }

        let result = await studyService.joinRoom(roomCode)
        if case .success(let state) = result {
            roomState = state
            updateMemberStatus()
        }
    }

    /// Load friend candidates for "join friend" mode
    func loadFriendCandidates() async {
        guard authService.isLoggedIn else { return }

        isLoadingFriends = true

        do {
            let friends: [FriendStudyCandidate] = try await loadFriendsWithStudyStatus()
            friendCandidates = friends
        } catch {
            // Silently fail: friends are optional
            friendCandidates = []
        }

        isLoadingFriends = false
    }

    /// Clear error message
    func clearError() {
        errorMessage = nil
    }
}

// MARK: - Supporting Types

/// Friend candidate with study room info
struct FriendStudyCandidate: Identifiable {
    let id: String
    let username: String
    let avatarUrl: String?
    let isStudying: Bool
    let inRoom: Bool
    let roomCode: String?
    let memberCount: Int?
}

/// Seat item for rendering
enum SeatItem: Identifiable {
    case member(StudyRoomMember)
    case empty

    var id: String {
        switch self {
        case .member(let m): return m.userId
        case .empty: return "empty-\(UUID().uuidString)"
        }
    }
}

// MARK: - Private Helpers

private extension StudyRoomViewModel {

    func loadFriendsWithStudyStatus() async throws -> [FriendStudyCandidate] {
        guard let userId = currentUserId else { return [] }

        // Get accepted friends from Supabase
        let friends: [(friendId: String)] = try await withCheckedThrowingContinuation { continuation in
            SupabaseService.shared.client
                .from("friends")
                .select("friend_id")
                .eq("user_id", value: userId)
                .eq("status", value: "accepted")
                .execute { result in
                    switch result {
                    case .success(let response):
                        let items = response.value as? [[String: Any]] ?? []
                        let friendIds = items.compactMap { $0["friend_id"] as? String }
                            .map { (friendId: $0) }
                        continuation.resume(returning: friendIds)
                    case .failure(let error):
                        continuation.resume(throwing: error)
                    }
                }
        }

        guard !friends.isEmpty else { return [] }

        // Get friend profiles
        let profiles: [FriendStudyCandidate] = try await withCheckedThrowingContinuation { continuation in
            let friendIds = friends.map { $0.friendId }
            SupabaseService.shared.client
                .from("profiles")
                .select("id, username, avatar_url, is_studying")
                .in("id", value: friendIds)
                .execute { result in
                    switch result {
                    case .success(let response):
                        let items = response.value as? [[String: Any]] ?? []
                        let candidates = items.map { item -> FriendStudyCandidate in
                            FriendStudyCandidate(
                                id: item["id"] as? String ?? "",
                                username: item["username"] as? String ?? "Unknown",
                                avatarUrl: item["avatar_url"] as? String,
                                isStudying: item["is_studying"] as? Bool ?? false,
                                inRoom: false, // Will be populated by lookup
                                roomCode: nil,
                                memberCount: nil
                            )
                        }
                        continuation.resume(returning: candidates)
                    case .failure(let error):
                        continuation.resume(throwing: error)
                    }
                }
        }

        return profiles
    }
}
