//
//  StudyRoomView.swift
//  TRIX3DCompanion
//
//  Study room view - real-time multi-person study room UI.
//  Observes StudyRoomViewModel which bridges ClawbotChannelService
//  WebSocket events with SwiftUI reactive state.
//

import SwiftUI

// MARK: - Localization Helper

private func L(_ key: String) -> String {
    key.localized
}

private func LF(_ key: String, _ arguments: CVarArg...) -> String {
    String(format: key.localized, arguments: arguments)
}

// MARK: - Duration Presets

private let DURATION_PRESETS = [25, 45, 60]

private func studyRoomSessionStateText(_ state: StudyRoomSessionState) -> String {
    switch state {
    case .idle: return L("study.room.state.idle")
    case .focusing: return L("study.room.state.focusing")
    case .resting: return L("study.room.state.resting")
    }
}

private func studyRoomMemberStatusText(_ status: StudyRoomMemberStatus) -> String {
    switch status {
    case .online: return L("study.room.member.status.online")
    case .focusing: return L("study.room.member.status.focusing")
    case .resting: return L("study.room.member.status.resting")
    }
}

// MARK: - Study Room View

/// Study room detail view
struct StudyRoomView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    private let initialRoomState: StudyRoomState?

    // MARK: - State

    @StateObject private var viewModel = StudyRoomViewModel()
    @State private var isShowingSettings = false
    @State private var isShowingTimer = false

    init(roomState: StudyRoomState? = nil) {
        self.initialRoomState = roomState
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                backgroundGradient
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        if viewModel.roomState != nil {
                            // In-room view
                            roomInfoCard
                            participantsSection
                            studyProgressSection
                            sessionControlsSection
                        } else {
                            // Entry mode selector
                            entryModeSelector
                            entryModeContent
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle(viewModel.roomState?.roomCode ?? L("study.room.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L("action.close")) {
                        dismiss()
                    }
                }

                if viewModel.roomState != nil {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(action: { isShowingSettings = true }) {
                            Image(systemName: "ellipsis.circle")
                                .foregroundColor(.primary)
                        }
                    }
                }
            }
            .sheet(isPresented: $isShowingSettings) {
                if let room = viewModel.roomState {
                    StudyRoomSettingsSheet(roomState: room)
                }
            }
            .fullScreenCover(isPresented: $isShowingTimer) {
                if let room = viewModel.roomState {
                    StudyTimerView(roomState: Binding(
                        get: { room },
                        set: { _ in }
                    ))
                }
            }
            .alert(L("study.room.error.title"), isPresented: Binding(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.clearError() } }
            )) {
                Button(L("action.confirm")) { viewModel.clearError() }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
            .onAppear { viewModel.onAppear(initialRoomState: initialRoomState) }
            .onDisappear { viewModel.onDisappear() }
        }
    }

    // MARK: - View Components

    /// Entry mode selector
    private var entryModeSelector: some View {
        VStack(spacing: 16) {
            // Connection status indicator
            if !viewModel.isConnected {
                HStack(spacing: 6) {
                    Image(systemName: "wifi.slash")
                        .font(.caption)
                    Text(L("study.room.connecting"))
                        .font(.caption)
                }
                .foregroundColor(.orange)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.orange.opacity(0.15))
                .clipShape(Capsule())
            }

            // Mode tabs
            HStack(spacing: 0) {
                ForEach(StudyRoomViewModel.EntryMode.allCases) { mode in
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            viewModel.entryMode = mode
                        }
                        if mode == .friend {
                            Task { await viewModel.loadFriendCandidates() }
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: mode.icon)
                                .font(.system(size: 13))
                            Text(mode.label)
                                .font(.system(size: 13, weight: .medium))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            viewModel.entryMode == mode
                                ? Color.white.opacity(0.12)
                                : Color.clear
                        )
                        .foregroundColor(
                            viewModel.entryMode == mode ? .white : .white.opacity(0.5)
                        )
                    }
                }
            }
            .padding(4)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .padding(.horizontal, 4)
    }

    /// Entry mode content
    @ViewBuilder
    private var entryModeContent: some View {
        switch viewModel.entryMode {
        case .selfStudy:
            selfStudyContent
        case .friend:
            friendListContent
        case .code:
            codeEntryContent
        }
    }

    /// Solo study mode
    private var selfStudyContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(L("study.room.focus.duration"))
                .font(.caption)
                .foregroundColor(.white.opacity(0.5))
                .tracking(0.12)

            HStack(spacing: 10) {
                ForEach(DURATION_PRESETS, id: \.self) { minute in
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            viewModel.selectedDuration = minute
                        }
                    }) {
                        Text(LF("study.room.duration.minutes", minute))
                            .font(.system(size: 14))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(
                                viewModel.selectedDuration == minute
                                    ? Color.white.opacity(0.15)
                                    : Color.white.opacity(0.05)
                            )
                            .foregroundColor(
                                viewModel.selectedDuration == minute ? .white : .white.opacity(0.6)
                            )
                            .clipShape(Capsule())
                    }
                }
            }

            Button(action: {
                // Navigate to solo timer with selected duration
                dismiss()
                NotificationCenter.default.post(
                    name: .startSelfStudy,
                    object: nil,
                    userInfo: ["duration": viewModel.selectedDuration]
                )
            }) {
                HStack {
                    Image(systemName: "play.fill")
                        .font(.system(size: 13))
                    Text(L("study.room.start.self"))
                        .font(.system(size: 15, weight: .semibold))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    LinearGradient(
                        colors: [Color.brandPurple, Color.brandPink],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding(20)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    /// Join by room code mode
    private var codeEntryContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(L("study.room.join.by.code.description"))
                .font(.caption)
                .foregroundColor(.white.opacity(0.5))
                .tracking(0.12)

            HStack(spacing: 10) {
                TextField(L("study.room.code.placeholder"), text: $viewModel.roomCodeInput)
                    .font(.system(size: 15, design: .monospaced))
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Color.black.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .onChange(of: viewModel.roomCodeInput) { _, newValue in
                        viewModel.roomCodeInput = newValue.uppercased()
                    }

                Button(action: {
                    Task { await viewModel.createRoom() }
                }) {
                    Text(L("study.room.create"))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.cyan.opacity(0.7))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(viewModel.isLoading)

                Button(action: {
                    Task { await viewModel.joinRoomByCode() }
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.right.circle.fill")
                            .font(.system(size: 13))
                        Text(L("study.room.join"))
                            .font(.system(size: 14, weight: .medium))
                    }
                    .foregroundColor(.black)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(viewModel.isLoading || viewModel.roomCodeInput.isEmpty)
            }
        }
        .padding(20)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    /// Friend's room list
    private var friendListContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text(L("study.room.friend.rooms"))
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
                    .tracking(0.12)

                Spacer()

                Button(action: {
                    Task { await viewModel.loadFriendCandidates() }
                }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13))
                        .foregroundColor(.white.opacity(0.6))
                }
            }

            if viewModel.isLoadingFriends {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            } else if viewModel.friendCandidates.isEmpty {
                Text(L("study.room.no.available.friends"))
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.4))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            } else {
                VStack(spacing: 10) {
                    ForEach(viewModel.friendCandidates) { friend in
                        FriendRoomRow(
                            friend: friend,
                            isJoining: viewModel.isLoading,
                            onJoin: {
                                Task { await viewModel.joinFriendRoom(friend) }
                            }
                        )
                    }
                }
            }
        }
        .padding(20)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    /// Room info card (in-room)
    private var roomInfoCard: some View {
        guard let room = viewModel.roomState else { return AnyView(EmptyView()) }

        return AnyView(
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(L("study.room.title"))
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                        Text(room.roomCode)
                            .font(.title2)
                            .fontWeight(.bold)
                    }

                    Spacer()

                    statusBadge(for: room.sessionState)
                }

                Divider()
                    .background(Color.white.opacity(0.1))

                HStack(spacing: 20) {
                    VStack(spacing: 4) {
                        Image(systemName: "person.2.fill")
                            .foregroundColor(Color.brandPurple)
                            .font(.title3)
                        Text("\(room.members.count)/\(room.maxMembers)")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.6))
                    }

                    VStack(spacing: 4) {
                        Image(systemName: "clock.fill")
                            .foregroundColor(Color.brandPink)
                            .font(.title3)
                        Text(sessionStateText(for: room.sessionState))
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.6))
                    }

                    if let timer = room.timer {
                        VStack(spacing: 4) {
                            Image(systemName: "timer")
                                .foregroundColor(Color.brandPurple)
                                .font(.title3)
                            Text(formatDuration(timer.remainingSeconds))
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }

                    Spacer()
                }

                // Remaining timer
                if let remaining = viewModel.remainingSeconds, room.sessionState != .idle {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(L("study.room.remaining"))
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.4))
                            .tracking(0.14)
                        Text(formatDuration(remaining))
                            .font(.system(size: 24, weight: .semibold, design: .monospaced))
                            .foregroundColor(.white)
                    }
                }
            }
            .padding(16)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 5)
        )
    }

    /// Status badge
    private func statusBadge(for state: StudyRoomSessionState) -> some View {
        let color: Color = {
            switch state {
            case .idle: return .gray
            case .focusing: return .green
            case .resting: return .orange
            }
        }()

        return HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(sessionStateText(for: state))
                .font(.caption2)
                .fontWeight(.semibold)
        }
        .foregroundColor(color)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(color.opacity(0.15))
        .clipShape(Capsule())
    }

    /// Participants list
    private var participantsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L("study.room.participants"))
                .font(.headline)
                .fontWeight(.semibold)

            if viewModel.seats.isEmpty {
                emptyParticipantsView
            } else {
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 12) {
                    ForEach(viewModel.seats) { seat in
                        switch seat {
                        case .member(let member):
                            ParticipantAvatar(member: member)
                        case .empty:
                            emptySeat
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// Empty participants view
    private var emptyParticipantsView: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.2.slash")
                .font(.system(size: 40))
                .foregroundColor(.white.opacity(0.2))

            Text(L("study.room.no.participants"))
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.4))

            Text(L("study.room.be.first"))
                .font(.caption)
                .foregroundColor(.white.opacity(0.25))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }

    /// Empty seat
    private var emptySeat: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .strokeBorder(Color.white.opacity(0.15), style: StrokeStyle(lineWidth: 1, dash: [4]))
                    .frame(width: 50, height: 50)
                Image(systemName: "plus")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.25))
            }
        }
    }

    /// Study progress
    private var studyProgressSection: some View {
        guard let timer = viewModel.roomState?.timer else {
            return AnyView(
                VStack(alignment: .leading, spacing: 12) {
                    Text(L("study.room.session.progress"))
                        .font(.headline)
                        .fontWeight(.semibold)
                    Text(L("study.room.no.active.session"))
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.3))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                }
                .padding(16)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            )
        }

        return AnyView(
            VStack(alignment: .leading, spacing: 12) {
                Text(L("study.room.session.progress"))
                    .font(.headline)
                    .fontWeight(.semibold)

                VStack(spacing: 8) {
                    ProgressView(value: progressFraction(for: timer))
                        .tint(Color.brandPurple)
                        .scaleEffect(y: 2)

                    HStack {
                        Text(L("study.room.elapsed"))
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.5))

                        Spacer()

                        Text("\(formatDuration(timer.durationSeconds - timer.remainingSeconds)) / \(formatDuration(timer.durationSeconds))")
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.5))
                    }
                }
            }
            .padding(16)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        )
    }

    /// Session controls
    private var sessionControlsSection: some View {
        VStack(spacing: 12) {
            // Duration selector (host, idle state only)
            if viewModel.isHost && viewModel.roomState?.sessionState == .idle {
                HStack(spacing: 8) {
                    Text(L("study.room.focus.duration"))
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.4))
                        .tracking(0.14)

                    ForEach(DURATION_PRESETS, id: \.self) { minute in
                        Button(action: {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                viewModel.selectedDuration = minute
                            }
                        }) {
                            Text(LF("study.room.duration.minutes", minute))
                                .font(.caption)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(
                                    viewModel.selectedDuration == minute
                                        ? Color.white.opacity(0.15)
                                        : Color.white.opacity(0.05)
                                )
                                .foregroundColor(
                                    viewModel.selectedDuration == minute ? .white : .white.opacity(0.6)
                                )
                                .clipShape(Capsule())
                        }
                    }
                }
                .padding(10)
                .background(Color.white.opacity(0.03))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            // Host action buttons
            if viewModel.isHost {
                HStack(spacing: 10) {
                    Button(action: {
                        Task { await viewModel.performHostAction(.startFocus) }
                    }) {
                        Label(L("study.room.action.start"), systemImage: "play.fill")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.green.opacity(0.75))
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(viewModel.isLoading || viewModel.roomState?.sessionState != .idle)

                    Button(action: {
                        Task { await viewModel.performHostAction(.pause) }
                    }) {
                        Label(L("study.room.action.pause"), systemImage: "pause.fill")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.orange.opacity(0.75))
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(viewModel.isLoading || viewModel.roomState?.sessionState != .focusing)

                    Button(action: {
                        Task { await viewModel.performHostAction(.end) }
                    }) {
                        Label(L("study.room.action.end"), systemImage: "stop.fill")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.gray.opacity(0.75))
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(viewModel.isLoading || viewModel.roomState?.sessionState == .idle)
                }
            } else {
                // View active session button (non-host)
                Button(action: { isShowingTimer = true }) {
                    Label(
                        viewModel.roomState?.sessionState == .idle
                            ? L("study.room.start.session")
                            : L("study.room.view.active"),
                        systemImage: viewModel.roomState?.sessionState == .idle ? "timer" : "eye.fill"
                    )
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        LinearGradient(
                            colors: [Color.brandPurple, Color.brandPink],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
            }

            // Leave room button
            Button(action: {
                Task { await viewModel.leaveRoom() }
            }) {
                Label(L("study.room.leave"), systemImage: "door.left.hand.open")
                    .font(.subheadline)
                    .foregroundColor(Color.error)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.error.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(viewModel.isLoading)
        }
    }

    // MARK: - Background

    private var backgroundGradient: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.10, green: 0.08, blue: 0.20),
                    Color.brandPurple.opacity(0.9),
                    Color.brandPink.opacity(0.7),
                    Color(red: 0.05, green: 0.09, blue: 0.18)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Circle()
                .fill(Color.white.opacity(0.12))
                .frame(width: 280, height: 280)
                .blur(radius: 40)
                .offset(x: -120, y: -220)

            Circle()
                .fill(Color.brandPink.opacity(0.20))
                .frame(width: 220, height: 220)
                .blur(radius: 35)
                .offset(x: 130, y: 240)

            LinearGradient(
                colors: [
                    Color.black.opacity(0.3),
                    Color.black.opacity(0.2),
                    Color.black.opacity(0.4)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    // MARK: - Helpers

    private func sessionStateText(for state: StudyRoomSessionState) -> String {
        studyRoomSessionStateText(state)
    }

    private func progressFraction(for timer: StudyRoomTimerState) -> Double {
        guard timer.durationSeconds > 0 else { return 0 }
        let elapsed = timer.durationSeconds - timer.remainingSeconds
        return min(1.0, max(0, Double(elapsed) / Double(timer.durationSeconds)))
    }

    private func formatDuration(_ seconds: Int) -> String {
        let safe = max(0, seconds)
        let h = safe / 3600
        let m = (safe % 3600) / 60
        let s = safe % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%d:%02d", m, s)
    }
}

// MARK: - Friend Room Row

struct FriendRoomRow: View {
    let friend: FriendStudyCandidate
    let isJoining: Bool
    let onJoin: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Color.brandPurple.opacity(0.2))
                    .frame(width: 44, height: 44)

                Text(String(friend.username.prefix(1)).uppercased())
                    .font(.headline)
                    .foregroundColor(Color.brandPurple)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(friend.username)
                    .font(.subheadline)
                    .fontWeight(.medium)

                if friend.inRoom, let code = friend.roomCode {
                    Text(LF("study.room.friend.room.summary", code, friend.memberCount ?? 0))
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.45))
                } else {
                    Text(friend.isStudying ? L("study.room.friend.status.studying") : L("study.room.friend.status.idle"))
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.35))
                }
            }

            Spacer()

            Button(action: onJoin) {
                Text(friend.inRoom ? L("study.room.join") : "")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(
                        friend.inRoom
                            ? Color.cyan.opacity(0.7)
                            : Color.gray.opacity(0.3)
                    )
                    .clipShape(Capsule())
            }
            .disabled(!friend.inRoom || isJoining)
        }
        .padding(12)
        .background(Color.white.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

private struct ParticipantAvatar: View {
    let member: StudyRoomMember

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 54, height: 54)

                Text(String(member.displayName.prefix(1)).uppercased())
                    .font(.headline)
                    .foregroundColor(.white)
            }

            Text(member.displayName)
                .font(.caption2)
                .foregroundColor(.white.opacity(0.8))
                .lineLimit(1)
        }
    }
}

private struct StudyRoomSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss

    let roomState: StudyRoomState

    var body: some View {
        NavigationStack {
            List {
                Section(L("study.room.information")) {
                    LabeledContent(L("study.room.code"), value: roomState.roomCode)
                    LabeledContent(L("study.room.members"), value: "\(roomState.members.count)/\(roomState.maxMembers)")
                    LabeledContent(L("study.room.current.state"), value: studyRoomSessionStateText(roomState.sessionState))
                }

                Section(L("study.room.participants")) {
                    ForEach(roomState.members) { member in
                        HStack(spacing: 12) {
                            Circle()
                                .fill(Color.brandPurple.opacity(0.2))
                                .frame(width: 32, height: 32)
                                .overlay(
                                    Text(String(member.displayName.prefix(1)).uppercased())
                                        .font(.caption.weight(.semibold))
                                        .foregroundColor(Color.brandPurple)
                                )

                            VStack(alignment: .leading, spacing: 2) {
                                Text(member.displayName)
                                Text(studyRoomMemberStatusText(member.status))
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle(L("study.room.settings"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("study.room.finish")) {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let startSelfStudy = Notification.Name("startSelfStudy")
}

// MARK: - Preview

#Preview("Study Room View") {
    let sampleRoom = StudyRoomState(
        roomCode: "ABC123",
        hostUserId: "user1",
        sessionState: .focusing,
        members: [
            StudyRoomMember(
                userId: "user1",
                displayName: "Alice",
                avatarUrl: nil,
                joinedAt: Date(),
                lastActiveAt: Date(),
                status: .focusing
            ),
            StudyRoomMember(
                userId: "user2",
                displayName: "Bob",
                avatarUrl: nil,
                joinedAt: Date(),
                lastActiveAt: Date(),
                status: .focusing
            ),
            StudyRoomMember(
                userId: "user3",
                displayName: "Charlie",
                avatarUrl: nil,
                joinedAt: Date(),
                lastActiveAt: Date(),
                status: .focusing
            )
        ],
        maxMembers: 10,
        version: 1,
        createdAt: Date(),
        updatedAt: Date(),
        timer: StudyRoomTimerState(
            durationSeconds: 1500,
            startedAt: Date().addingTimeInterval(-300),
            endsAt: Date().addingTimeInterval(1200),
            remainingSeconds: 1200
        )
    )

    StudyRoomView()
}
