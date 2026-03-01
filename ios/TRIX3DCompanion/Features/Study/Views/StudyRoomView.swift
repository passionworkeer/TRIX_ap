//
//  StudyRoomView.swift
//  TRIX3DCompanion
//
//  学习房间详情视图
//  显示房间信息、参与者列表、学习进度等
//

import SwiftUI

// MARK: - Study Room View

/// 学习房间详情视图
struct StudyRoomView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var roomState: StudyRoomState
    @State private var isShowingSettings = false
    @State private var isShowingTimer = false
    @State private var isMemberOfRoom = false
    @State private var isLoading = false
    @State private var errorMessage: String?

    // MARK: - Dependencies

    private let studyService: StudyServiceProtocol

    // MARK: - Initialization

    init(
        roomState: StudyRoomState,
        studyService: StudyServiceProtocol = StudyService.shared
    ) {
        self._roomState = State(initialValue: roomState)
        self.studyService = studyService
    }

    // MARK: - Body

    var body: some View {
        NavigationView {
            ZStack {
                // Background gradient
                backgroundGradient
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Room info card
                        roomInfoCard

                        // Participants section
                        participantsSection

                        // Study progress section
                        studyProgressSection

                        // Session controls
                        sessionControlsSection
                    }
                    .padding()
                }
            }
            .navigationTitle(roomState.roomCode)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { isShowingSettings = true }) {
                        Image(systemName: "ellipsis.circle")
                            .foregroundColor(.primary)
                    }
                }
            }
            .sheet(isPresented: $isShowingSettings) {
                StudyRoomSettingsSheet(roomState: roomState)
            }
            .fullScreenCover(isPresented: $isShowingTimer) {
                StudyTimerView(roomState: $roomState)
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") {
                    errorMessage = nil
                }
            } message: {
                if let errorMessage = errorMessage {
                    Text(errorMessage)
                }
            }
        }
    }

    // MARK: - View Components

    /// 房间信息卡片
    private var roomInfoCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Room name
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Study Room")
                        .font(.caption)
                        .foregroundColor(.textSecondary)

                    Text(roomState.roomCode)
                        .font(.title2)
                        .fontWeight(.bold)
                }

                Spacer()

                // Status badge
                statusBadge
            }

            Divider()

            // Session state info
            HStack(spacing: 20) {
                VStack(spacing: 4) {
                    Image(systemName: "person.2.fill")
                        .foregroundColor(.brandPurple)
                        .font(.title3)

                    Text("\(roomState.members.count)/\(roomState.maxMembers)")
                        .font(.caption)
                        .foregroundColor(.textSecondary)
                }

                VStack(spacing: 4) {
                    Image(systemName: "clock.fill")
                        .foregroundColor(.brandPink)
                        .font(.title3)

                    Text(sessionStateText)
                        .font(.caption)
                        .foregroundColor(.textSecondary)
                }

                if let timer = roomState.timer {
                    VStack(spacing: 4) {
                        Image(systemName: "timer")
                            .foregroundColor(.brandPurple)
                            .font(.title3)

                        Text(formatDuration(timer.remainingSeconds))
                            .font(.caption)
                            .foregroundColor(.textSecondary)
                    }
                }

                Spacer()
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .shadow, radius: 10, x: 0, y: 5)
    }

    /// 状态徽章
    private var statusBadge: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(sessionStateColor)
                .frame(width: 8, height: 8)

            Text(sessionStateText)
                .font(.caption2)
                .fontWeight(.semibold)
        }
        .foregroundColor(sessionStateColor)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(sessionStateColor.opacity(0.15))
        .clipShape(Capsule())
    }

    /// 参与者列表部分
    private var participantsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Participants")
                .font(.headline)
                .fontWeight(.semibold)

            if roomState.members.isEmpty {
                emptyParticipantsView
            } else {
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 12) {
                    ForEach(roomState.members) { member in
                        ParticipantAvatar(member: member)
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// 空参与者视图
    private var emptyParticipantsView: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.2.slash")
                .font(.system(size: 40))
                .foregroundColor(.textTertiary)

            Text("No participants yet")
                .font(.subheadline)
                .foregroundColor(.textSecondary)

            Text("Be the first to join this room!")
                .font(.caption)
                .foregroundColor(.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }

    /// 学习进度部分
    private var studyProgressSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Session Progress")
                .font(.headline)
                .fontWeight(.semibold)

            if let timer = roomState.timer {
                VStack(spacing: 8) {
                    // Progress bar
                    ProgressView(value: progressFraction)
                        .tint(.brandGradient)
                        .scaleEffect(y: 2)

                    HStack {
                        Text("Elapsed")
                            .font(.caption2)
                            .foregroundColor(.textSecondary)

                        Spacer()

                        Text("\(formatDuration(timer.durationSeconds - timer.remainingSeconds)) / \(formatDuration(timer.durationSeconds))")
                            .font(.caption2)
                            .foregroundColor(.textSecondary)
                    }
                }
            } else {
                Text("No active session")
                    .font(.subheadline)
                    .foregroundColor(.textTertiary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// 会话控制部分
    private var sessionControlsSection: some View {
        VStack(spacing: 12) {
            if isMemberOfRoom {
                // Member controls
                if roomState.sessionState == .idle {
                    Button(action: { openTimer() }) {
                        Label("Start Focus Session", systemImage: "timer")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.brandGradient)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                } else {
                    Button(action: { openTimer() }) {
                        Label("View Active Session", systemImage: "eye.fill")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.brandGradient)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                }

                Button(action: { leaveRoom() }) {
                    Label("Leave Room", systemImage: "door.left.hand.open")
                        .font(.subheadline)
                        .foregroundColor(.error)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(.error.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            } else {
                // Join button
                Button(action: { joinRoom() }) {
                    Label("Join Room", systemImage: "arrow.right.circle.fill")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.brandGradient)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .disabled(roomState.members.count >= roomState.maxMembers)
            }
        }
    }

    /// 背景渐变
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.brandPurple.opacity(0.1),
                Color.brandPink.opacity(0.05),
                Color.clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: - Computed Properties

    /// 会话状态文本
    private var sessionStateText: String {
        switch roomState.sessionState {
        case .idle:
            return "Idle"
        case .focusing:
            return "Focusing"
        case .resting:
            return "Resting"
        }
    }

    /// 会话状态颜色
    private var sessionStateColor: Color {
        switch roomState.sessionState {
        case .idle:
            return .textTertiary
        case .focusing:
            return .success
        case .resting:
            return .warning
        }
    }

    /// 进度分数
    private var progressFraction: Double {
        guard let timer = roomState.timer else { return 0 }
        let elapsed = timer.durationSeconds - timer.remainingSeconds
        return Double(elapsed) / Double(timer.durationSeconds)
    }

    // MARK: - Actions

    /// 加入房间
    private func joinRoom() {
        isLoading = true

        Task {
            do {
                try await studyService.joinRoom(roomState.roomCode)
                await MainActor.run {
                    isMemberOfRoom = true
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }

    /// 离开房间
    private func leaveRoom() {
        isLoading = true

        Task {
            do {
                try await studyService.leaveRoom(roomState.roomCode)
                await MainActor.run {
                    isMemberOfRoom = false
                    isLoading = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }

    /// 打开计时器
    private func openTimer() {
        isShowingTimer = true
    }

    /// 格式化时长
    private func formatDuration(_ seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        } else {
            return String(format: "%d:%02d", minutes, secs)
        }
    }
}

// MARK: - Participant Avatar

/// 参与者头像组件
struct ParticipantAvatar: View {
    let member: StudyRoomMember

    var body: some View {
        VStack(spacing: 6) {
            ZStack(alignment: .topTrailing) {
                // Avatar
                if let avatarURL = member.avatarUrl,
                   let url = URL(string: avatarURL) {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        defaultAvatar
                    }
                    .frame(width: 50, height: 50)
                    .clipShape(Circle())
                } else {
                    defaultAvatar
                        .frame(width: 50, height: 50)
                }

                // Status indicator
                Circle()
                    .fill(statusColor)
                    .frame(width: 12, height: 12)
                    .overlay(
                        Circle()
                            .stroke(.background, lineWidth: 2)
                    )
            }

            // Name
            Text(member.displayName)
                .font(.caption2)
                .lineLimit(1)
        }
    }

    private var defaultAvatar: some View {
        ZStack {
            Circle()
                .fill(.brandPurple.opacity(0.2))

            Text(String(member.displayName.prefix(1)).uppercased())
                .font(.headline)
                .foregroundColor(.brandPurple)
        }
    }

    private var statusColor: Color {
        switch member.status {
        case .online:
            return .success
        case .focusing:
            return .brandPurple
        case .resting:
            return .warning
        }
    }
}

// MARK: - Study Room Settings Sheet

/// 房间设置表单
struct StudyRoomSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    let roomState: StudyRoomState

    var body: some View {
        NavigationView {
            Form {
                Section("Room Information") {
                    HStack {
                        Text("Room Code")
                        Spacer()
                        Text(roomState.roomCode)
                            .foregroundColor(.textSecondary)
                    }

                    HStack {
                        Text("Max Members")
                        Spacer()
                        Text("\(roomState.maxMembers)")
                            .foregroundColor(.textSecondary)
                    }
                }

                Section("Session") {
                    HStack {
                        Text("Current State")
                        Spacer()
                        Text(sessionStateText)
                            .foregroundColor(.textSecondary)
                    }
                }
            }
            .navigationTitle("Room Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var sessionStateText: String {
        switch roomState.sessionState {
        case .idle:
            return "Idle"
        case .focusing:
            return "Focusing"
        case .resting:
            return "Resting"
        }
    }
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
                status: .online
            ),
            StudyRoomMember(
                userId: "user3",
                displayName: "Charlie",
                avatarUrl: nil,
                joinedAt: Date(),
                lastActiveAt: Date(),
                status: .resting
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

    StudyRoomView(roomState: sampleRoom)
}
