//
//  StudyTimerView.swift
//  TRIX3DCompanion
//
//  学习计时器视图
//  提供专注计时、深呼吸动画、本地通知等功能
//

import SwiftUI
import UserNotifications

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

private func L(_ key: String, _ args: CVarArg...) -> String {
    String(format: NSLocalizedString(key, comment: ""), args)
}

// MARK: - Points Service Integration

/// Extension to add study points via PointsService
extension StudyTimerView {
    /// Award points for completed study session
    private func awardStudyPoints() async {
        let pointsService = PointsService.shared

        // Add points using PointsService
        let metadata: [String: String] = [
            "source": "study_session",
            "duration_minutes": "\(actualStudyDuration)",
            "room_code": roomState.roomCode
        ]

        let result = await pointsService.addPoints(
            earnedPoints,
            description: String(format: NSLocalizedString("study.points.reward.description", comment: ""), actualStudyDuration),
            metadata: metadata
        )

        switch result {
        case .success(let balance):
            SecureLogger.shared.info("Points awarded successfully. New balance: \(balance.totalPoints)")
        case .insufficientBalance, .invalidAmount, .failed:
            SecureLogger.shared.warning("Failed to award points")
        }
    }
}

// MARK: - Study Timer View

/// 学习计时器视图
struct StudyTimerView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @Binding var roomState: StudyRoomState
    @State private var timerState: TimerState = .idle
    @State private var remainingSeconds: Int = 0
    @State private var totalSeconds: Int = 0
    @State private var isBreathing = false
    @State private var breathingScale: CGFloat = 1.0
    @State private var isFocusMode = false
    @State private var notificationPermissionGranted = false
    @State private var showMusicSelector = false
    @State private var showTimerSettings = false
    @State private var showCelebration = false
    @State private var earnedPoints = 0
    @State private var actualStudyDuration = 0
    @State private var focusDurationMinutes = 25

    // MARK: - Dependencies

    private let studyService: any StudyServiceProtocol
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    // MARK: - Initialization

    init(
        roomState: Binding<StudyRoomState>,
        studyService: (any StudyServiceProtocol)? = nil
    ) {
        self._roomState = roomState
        self.studyService = studyService ?? StudyService.shared

        // Initialize timer state from room state
        self._remainingSeconds = State(initialValue: roomState.wrappedValue.timer?.remainingSeconds ?? 0)
        let initialDuration = roomState.wrappedValue.timer?.durationSeconds ?? 1500
        self._totalSeconds = State(initialValue: initialDuration)
        self._focusDurationMinutes = State(initialValue: max(1, initialDuration / 60))
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background
            backgroundGradient
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                header

                Spacer()

                // Main content
                if isFocusMode {
                    focusModeContent
                } else {
                    normalModeContent
                }

                Spacer()

                // Controls
                controlsSection
                    .padding(.bottom, 40)
            }
        }
        .onAppear {
            requestNotificationPermission()
            startBreathingAnimation()
        }
        .onDisappear {
            stopBreathingAnimation()
        }
        .onReceive(timer) { _ in
            updateTimer()
        }
        .fullScreenCover(isPresented: $showCelebration) {
            CelebrationAnimationView(
                studyDuration: actualStudyDuration,
                earnedPoints: earnedPoints,
                hasCompanion: false,
                companionName: nil,
                onDismiss: {
                    showCelebration = false
                    dismiss()
                }
            )
        }
    }

    // MARK: - View Components

    /// 头部
    private var header: some View {
        HStack {
            Button(action: { dismiss() }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(.textSecondary)
            }

            Spacer()

            // 音乐控制按钮
            MusicButton(showMusicSelector: $showMusicSelector)

            // Focus mode toggle
            Button(action: { toggleFocusMode() }) {
                HStack(spacing: 6) {
                    Image(systemName: isFocusMode ? "eye.slash.fill" : "eye.fill")
                    Text(isFocusMode ? L("study.timer.exit.focus") : L("study.timer.focus.mode"))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                .foregroundColor(.brandPurple)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.brandPurple.opacity(0.1))
                .clipShape(Capsule())
            }

            Spacer()

            // Settings button (hidden in focus mode)
            if !isFocusMode {
                Button(action: { showTimerSettings = true }) {
                    Image(systemName: "gearshape.fill")
                        .font(.title2)
                        .foregroundColor(.textSecondary)
                }
            }
        }
        .padding()
        .sheet(isPresented: $showMusicSelector) {
            MusicSelectorView()
        }
        .sheet(isPresented: $showTimerSettings) {
            TimerSettingsSheet(
                focusMinutes: $focusDurationMinutes,
                onApply: applyTimerSettings
            )
        }
    }

    /// 普通模式内容
    private var normalModeContent: some View {
        VStack(spacing: 30) {
            // Session state badge
            sessionStateBadge

            // Timer display
            timerDisplay

            // Breathing animation
            if roomState.sessionState == .focusing {
                breathingAnimationView
            }

            // Progress bar
            progressBar
            .padding(.horizontal, 40)
        }
    }

    /// 专注模式内容
    private var focusModeContent: some View {
        VStack(spacing: 40) {
            // Large timer
            Text(formatTime(remainingSeconds))
                .font(.system(size: 80, weight: .thin, design: .rounded))
                .foregroundColor(.textPrimary)

            // Breathing animation
            breathingAnimationView
                .scaleEffect(1.5)

            // Session state
            Text(sessionStateText.uppercased())
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.textSecondary)
                .tracking(2)
        }
    }

    /// 会话状态徽章
    private var sessionStateBadge: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(sessionStateColor)
                .frame(width: 8, height: 8)

            Text(sessionStateText)
                .font(.subheadline)
                .fontWeight(.semibold)
        }
        .foregroundColor(sessionStateColor)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .shadow(color: .shadow, radius: 5, x: 0, y: 2)
    }

    /// 计时器显示
    private var timerDisplay: some View {
        VStack(spacing: 8) {
            Text(formatTime(remainingSeconds))
                .font(.system(size: isFocusMode ? 60 : 72, weight: .thin, design: .rounded))
                .foregroundColor(.textPrimary)
                .animation(.easeInOut(duration: 0.3), value: remainingSeconds)

            if totalSeconds > 0 {
                Text("/ \(formatTime(totalSeconds))")
                    .font(.title3)
                    .foregroundColor(.textTertiary)
            }
        }
    }

    /// 呼吸动画视图
    private var breathingAnimationView: some View {
        ZStack {
            // Outer circles
            Circle()
                .stroke(.brandPurple.opacity(0.2), lineWidth: 2)
                .frame(width: 200, height: 200)
                .scaleEffect(breathingScale)

            Circle()
                .stroke(.brandPink.opacity(0.15), lineWidth: 2)
                .frame(width: 160, height: 160)
                .scaleEffect(breathingScale * 0.9)

            // Inner circle
            Circle()
                .fill(
                    LinearGradient(
                        colors: [.brandPurple.opacity(0.3), .brandPink.opacity(0.2)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 120, height: 120)
                .scaleEffect(breathingScale * 0.8)
                .blur(radius: 20)

            // Breathing instruction
            if !isFocusMode {
                VStack {
                    Text(breathingText)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.textPrimary)
                }
            }
        }
        .onAppear {
            withAnimation(
                Animation.easeInOut(duration: 4.0)
                    .repeatForever(autoreverses: true)
            ) {
                breathingScale = 1.3
            }
        }
    }

    /// 进度条
    private var progressBar: some View {
        VStack(spacing: 8) {
            ProgressView(value: progressFraction)
                .tint(.brandPurple)
                .scaleEffect(y: 3)

            HStack {
                Text(L("study.timer.progress"))
                    .font(.caption2)
                    .foregroundColor(.textSecondary)

                Spacer()

                Text("\(Int(progressFraction * 100))%")
                    .font(.caption2)
                    .foregroundColor(.textSecondary)
                    .fontWeight(.semibold)
            }
        }
    }

    /// 控制按钮部分
    private var controlsSection: some View {
        HStack(spacing: 20) {
            ControlButton(
                icon: controlButtonIcon,
                title: controlButtonTitle,
                color: controlButtonColor,
                action: { handleControlButton() }
            )

            if timerState != .idle {
                ControlButton(
                    icon: "stop.fill",
                    title: L("study.timer.end"),
                    color: .error,
                    action: { endSession() }
                )
            }
        }
        .padding(.horizontal, 40)
    }

    /// 背景渐变 - 使用动态背景效果
    private var backgroundGradient: some View {
        ZStack {
            // 基础渐变
            LinearGradient(
                colors: [
                    Color.brandPurple.opacity(0.15),
                    Color.brandPink.opacity(0.1),
                    Color.clear
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // 动态粒子效果
            ParticleView(
                particleCount: 25,
                primaryColor: Color.brandPurple.opacity(0.2),
                secondaryColor: Color.brandPink.opacity(0.2)
            )
        }
    }

    // MARK: - Computed Properties

    /// 会话状态文本
    private var sessionStateText: String {
        switch roomState.sessionState {
        case .idle:
            return L("study.timer.ready")
        case .focusing:
            return L("study.timer.focus.time")
        case .resting:
            return L("study.timer.break.time")
        }
    }

    /// 会话状态颜色
    private var sessionStateColor: Color {
        switch roomState.sessionState {
        case .idle:
            return .textTertiary
        case .focusing:
            return Color.brandPurple
        case .resting:
            return .success
        }
    }

    /// 呼吸文本
    private var breathingText: String {
        if breathingScale < 1.1 {
            return L("study.timer.breathe.in")
        } else if breathingScale < 1.2 {
            return L("study.timer.hold")
        } else {
            return L("study.timer.breathe.out")
        }
    }

    /// 进度分数
    private var progressFraction: Double {
        guard totalSeconds > 0 else { return 0 }
        let elapsed = totalSeconds - remainingSeconds
        return Double(elapsed) / Double(totalSeconds)
    }

    /// 控制按钮图标
    private var controlButtonIcon: String {
        switch timerState {
        case .idle:
            return "play.fill"
        case .running, .focusing, .resting:
            return "pause.fill"
        case .paused:
            return "play.fill"
        case .completed:
            return "arrow.clockwise"
        }
    }

    /// 控制按钮标题
    private var controlButtonTitle: String {
        switch timerState {
        case .idle:
            return L("study.timer.start")
        case .running, .focusing, .resting:
            return L("study.timer.pause")
        case .paused:
            return L("study.timer.resume")
        case .completed:
            return L("study.timer.restart")
        }
    }

    /// 控制按钮颜色
    private var controlButtonColor: Color {
        switch timerState {
        case .idle, .paused, .completed:
            return .brandPurple
        case .running, .focusing, .resting:
            return .warning
        }
    }

    // MARK: - Actions

    /// 切换专注模式
    private func toggleFocusMode() {
        withAnimation(.easeInOut(duration: 0.3)) {
            isFocusMode.toggle()
        }
    }

    /// 处理控制按钮
    private func handleControlButton() {
        switch timerState {
        case .idle:
            startSession()
        case .running, .focusing, .resting:
            pauseSession()
        case .paused:
            resumeSession()
        case .completed:
            restartSession()
        }
    }

    /// 开始会话
    private func startSession() {
        Task {
            let result = await studyService.startFocusSession(roomCode: roomState.roomCode)

            await MainActor.run {
                switch result {
                case .success:
                    timerState = .focusing
                    scheduleNotification()
                case .failure(let error):
                    SecureLogger.shared.error("Error starting session: \(error.localizedDescription)")
                }
            }
        }
    }

    /// 暂停会话
    private func pauseSession() {
        Task {
            do {
                try await studyService.pauseSession(roomCode: roomState.roomCode)
                await MainActor.run {
                    timerState = .paused
                }
            } catch {
                // Handle error
                SecureLogger.shared.error("Error pausing session: \(error)")
            }
        }
    }

    /// 恢复会话
    private func resumeSession() {
        Task {
            do {
                try await studyService.resumeSession(roomCode: roomState.roomCode)
                await MainActor.run {
                    timerState = roomState.sessionState == .focusing ? .focusing : .resting
                }
            } catch {
                // Handle error
                SecureLogger.shared.error("Error resuming session: \(error)")
            }
        }
    }

    /// 结束会话
    private func endSession() {
        Task {
            let studiedMinutes = (totalSeconds - remainingSeconds) / 60
            actualStudyDuration = max(1, studiedMinutes)
            earnedPoints = actualStudyDuration * 2

            let result = await studyService.endSession(roomCode: roomState.roomCode)

            switch result {
            case .success:
                await awardStudyPoints()
                await MainActor.run {
                    timerState = .completed
                    showCelebration = true
                }
            case .failure(let error):
                SecureLogger.shared.error("Error ending session: \(error.localizedDescription)")
                await MainActor.run {
                    timerState = .idle
                    remainingSeconds = totalSeconds
                    dismiss()
                }
            }
        }
    }

    /// 重新开始会话
    private func restartSession() {
        remainingSeconds = totalSeconds
        startSession()
    }

    private func applyTimerSettings() {
        let newDuration = max(1, focusDurationMinutes) * 60
        totalSeconds = newDuration

        if timerState == .idle || timerState == .completed {
            remainingSeconds = newDuration
            return
        }

        remainingSeconds = min(remainingSeconds, newDuration)
    }

    /// 更新计时器
    private func updateTimer() {
        if timerState == .focusing || timerState == .resting {
            if remainingSeconds > 0 {
                remainingSeconds -= 1
            } else {
                // Timer completed
                timerCompleted()
            }
        }
    }

    /// 计时器完成
    private func timerCompleted() {
        if timerState == .focusing {
            // Switch to rest
            timerState = .resting
            remainingSeconds = 300 // 5 minute break
            scheduleNotification()
        } else {
            // Session fully completed - calculate points and show celebration
            let studiedMinutes = (totalSeconds - remainingSeconds) / 60
            actualStudyDuration = max(1, studiedMinutes) // At least 1 minute
            earnedPoints = actualStudyDuration * 2 // 2 points per minute

            // Award points asynchronously
            Task {
                await awardStudyPoints()
            }

            // Show celebration modal instead of immediately dismissing
            timerState = .completed
            showCelebration = true
        }
    }

    /// 开始呼吸动画
    private func startBreathingAnimation() {
        isBreathing = true
    }

    /// 停止呼吸动画
    private func stopBreathingAnimation() {
        isBreathing = false
        breathingScale = 1.0
    }

    /// 格式化时间
    private func formatTime(_ seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        } else {
            return String(format: "%d:%02d", minutes, secs)
        }
    }

    // MARK: - Notifications

    /// 请求通知权限
    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            notificationPermissionGranted = granted
        }
    }

    /// 安排通知
    private func scheduleNotification() {
        guard notificationPermissionGranted else { return }

        let content = UNMutableNotificationContent()
        content.title = timerState == .focusing ? L("study.notification.focus.complete") : L("study.notification.break.over")
        content.body = timerState == .focusing ? L("study.notification.break.message") : L("study.notification.focus.message")
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: Double(remainingSeconds), repeats: false)
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request)
    }

    /// 发送完成通知
    private func sendCompletionNotification() {
        guard notificationPermissionGranted else { return }

        let content = UNMutableNotificationContent()
        content.title = L("study.notification.great.job")
        content.body = L("study.notification.session.complete")
        content.sound = .default

        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}

private struct TimerSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var focusMinutes: Int
    let onApply: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section(L("study.timer.focus.duration")) {
                    Stepper(value: $focusMinutes, in: 1...180) {
                        Text(L("study.timer.minutes", focusMinutes))
                    }
                }
            }
            .navigationTitle(L("study.timer.settings"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L("action.cancel")) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("action.apply")) {
                        onApply()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
}

// MARK: - Control Button

/// 控制按钮组件
struct ControlButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(.white)

                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(
                LinearGradient(
                    colors: color == .brandPurple ? [.brandPurple, .brandPink] : [color, color],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: color.opacity(0.3), radius: 10, x: 0, y: 5)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("Study Timer View") {
    let sampleRoom = StudyRoomState(
        roomCode: "ABC123",
        hostUserId: "user1",
        sessionState: .focusing,
        members: [],
        maxMembers: 10,
        version: 1,
        createdAt: Date(),
        updatedAt: Date(),
        timer: StudyRoomTimerState(
            durationSeconds: 1500,
            startedAt: Date(),
            endsAt: Date().addingTimeInterval(1500),
            remainingSeconds: 1500
        )
    )

    StudyTimerView(roomState: .constant(sampleRoom as StudyRoomState))
}
