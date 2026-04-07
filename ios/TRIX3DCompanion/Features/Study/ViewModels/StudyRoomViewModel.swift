//
//  StudyRoomViewModel.swift
//  TRIX3DCompanion
//
//  Minimal Study Room ViewModel used by the current SwiftUI study screens.
//  It stays aligned with the live StudyService / ClawbotChannelService APIs
//  and avoids depending on stale protocol shapes that no longer exist.
//

import Foundation
import Combine
import SwiftUI

@MainActor
final class StudyRoomViewModel: ObservableObject {

    @Published private(set) var roomState: StudyRoomState?
    @Published private(set) var isMemberOfRoom = false
    @Published private(set) var isConnected = false
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedDuration = 25
    @Published private(set) var friendCandidates: [FriendStudyCandidate] = []
    @Published private(set) var isLoadingFriends = false
    @Published var entryMode: EntryMode = .selfStudy
    @Published var roomCodeInput = ""

    enum EntryMode: String, CaseIterable, Identifiable {
        case selfStudy = "self"
        case friend = "friend"
        case code = "room"

        var id: String { rawValue }

        var label: String {
            switch self {
            case .selfStudy: return "study.room.entry.self".localized
            case .friend: return "study.room.entry.friend".localized
            case .code: return "study.room.entry.code".localized
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

    var isHost: Bool {
        guard let userId = currentUserId, let room = roomState else { return false }
        return room.hostUserId == userId
    }

    var remainingSeconds: Int? {
        guard let timer = roomState?.timer, roomState?.sessionState != .idle else { return nil }
        if roomState?.sessionState == .resting {
            return timer.remainingSeconds
        }
        return max(0, Int(timer.endsAt.timeIntervalSinceNow))
    }

    var seats: [SeatItem] {
        guard let room = roomState else { return [] }
        var items = room.members.map(SeatItem.member)
        while items.count < room.maxMembers {
            items.append(.empty)
        }
        return Array(items.prefix(room.maxMembers))
    }

    private let clawbotChannelService: ClawbotChannelService
    private let authService: AuthServiceProtocol
    private let studyService: StudyService
    private var cancellables = Set<AnyCancellable>()
    private var reconnectTask: Task<Void, Never>?

    private var currentUserId: String? {
        authService.currentUser?.id
    }

    init(
        clawbotChannelService: ClawbotChannelService? = nil,
        authService: AuthServiceProtocol? = nil,
        studyService: StudyService? = nil
    ) {
        self.clawbotChannelService = clawbotChannelService ?? ClawbotChannelService.shared
        self.authService = authService ?? AuthService.shared
        self.studyService = studyService ?? StudyService.shared
        setupBindings()
    }

    deinit {
        reconnectTask?.cancel()
    }

    func onAppear(initialRoomState: StudyRoomState? = nil) {
        if let initialRoomState {
            roomState = initialRoomState
            roomCodeInput = initialRoomState.roomCode
            updateMemberStatus()
        }

        if let serviceRoomState = studyService.currentRoomState {
            roomState = serviceRoomState
            roomCodeInput = serviceRoomState.roomCode
            updateMemberStatus()
        }

        Task {
            try? await clawbotChannelService.connect()
        }
    }

    func onDisappear() {
        // Keep service connection alive.
    }

    func createRoom() async {
        guard authService.currentUser != nil else {
            errorMessage = "study.room.error.login.required".localized
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let result = await studyService.createStudyRoom(name: "study.room.default.name".localized, maxMembers: 4)
        switch result {
        case .success:
            if let state = studyService.currentRoomState {
                roomState = state
                roomCodeInput = state.roomCode
                updateMemberStatus()
            } else {
                errorMessage = "study.room.error.state.sync".localized
            }
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
    }

    func joinRoomByCode() async {
        let code = roomCodeInput.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard code.count == 6, code.allSatisfy({ $0.isLetter || $0.isNumber }) else {
            errorMessage = "study.room.error.invalid.code".localized
            return
        }

        guard authService.isLoggedIn else {
            errorMessage = "study.room.error.login.required".localized
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let result = await studyService.joinRoom(code)
        switch result {
        case .success(let state):
            roomState = state
            roomCodeInput = state.roomCode
            updateMemberStatus()
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
    }

    func joinFriendRoom(_ friend: FriendStudyCandidate) async {
        guard let roomCode = friend.roomCode else {
            errorMessage = "study.room.error.friend.room.unavailable".localized
            return
        }

        roomCodeInput = roomCode
        await joinRoomByCode()
    }

    func leaveRoom() async {
        guard let roomCode = roomState?.roomCode else { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let result = await studyService.leaveRoom(roomCode)
        switch result {
        case .success:
            roomState = nil
            roomCodeInput = ""
            isMemberOfRoom = false
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
    }

    func performHostAction(_ action: StudyRoomHostAction) async {
        guard let roomCode = roomState?.roomCode else { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        switch action {
        case .startFocus:
            let result = await studyService.startFocusSession(roomCode: roomCode)
            if case .failure(let error) = result {
                errorMessage = error.localizedDescription
            }
        case .pause:
            do {
                try await studyService.pauseSession(roomCode: roomCode)
            } catch {
                errorMessage = error.localizedDescription
            }
        case .end:
            let result = await studyService.endSession(roomCode: roomCode)
            if case .failure(let error) = result {
                errorMessage = error.localizedDescription
            }
        }

        if let state = studyService.currentRoomState {
            roomState = state
            updateMemberStatus()
        }
    }

    func refreshRoomState() async {
        if let serviceRoomState = studyService.currentRoomState {
            roomState = serviceRoomState
            updateMemberStatus()
            return
        }

        guard let roomCode = roomState?.roomCode, !roomCode.isEmpty else { return }

        let result = await studyService.joinRoom(roomCode)
        if case .success(let state) = result {
            roomState = state
            updateMemberStatus()
        }
    }

    func loadFriendCandidates() async {
        isLoadingFriends = true
        friendCandidates = []
        isLoadingFriends = false
    }

    func clearError() {
        errorMessage = nil
    }

    private func setupBindings() {
        clawbotChannelService.$currentStudyRoomState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleRoomStateUpdate(state)
            }
            .store(in: &cancellables)

        clawbotChannelService.$connectionState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleConnectionStateUpdate(state)
            }
            .store(in: &cancellables)

        studyService.$currentRoomState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                guard let self, let state else { return }
                self.roomState = state
                self.roomCodeInput = state.roomCode
                self.updateMemberStatus()
            }
            .store(in: &cancellables)
    }

    private func handleRoomStateUpdate(_ state: StudyRoomState?) {
        roomState = state
        if let state {
            roomCodeInput = state.roomCode
        }
        updateMemberStatus()
    }

    private func handleConnectionStateUpdate(_ state: ClawbotConnectionState) {
        let wasConnected = isConnected
        isConnected = state == .connected

        if !wasConnected && isConnected {
            reconnectTask?.cancel()
            reconnectTask = Task {
                try? await Task.sleep(nanoseconds: 500_000_000)
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
}

struct FriendStudyCandidate: Identifiable {
    let id: String
    let username: String
    let avatarUrl: String?
    let isStudying: Bool
    let inRoom: Bool
    let roomCode: String?
    let memberCount: Int?
}

enum SeatItem: Identifiable {
    case member(StudyRoomMember)
    case empty

    var id: String {
        switch self {
        case .member(let member):
            return member.userId
        case .empty:
            return "empty-\(UUID().uuidString)"
        }
    }
}
