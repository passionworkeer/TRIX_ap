//
//  HomeView.swift
//  TRIX3DCompanion
//
//  Home screen matching web端的 Home.tsx
//

import SwiftUI

// Helper function for localization
private func loc(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Home View

/// Main home screen matching web design
struct HomeView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var clawbotChannel: ClawbotChannelViewModel

    // MARK: - Bindings

    @Binding var isWorkbenchPresented: Bool
    @Binding var isChatPresented: Bool

    // MARK: - State

    @State private var showMailPanel = false
    @State private var showNotificationPanel = false
    @State private var showStudyRoom = false
    @State private var showSnapshot = false
    @State private var showTodo = false
    @State private var showSchedule = false
    @State private var showLocation = false
    @State private var useRobotBackground = true

    // MARK: - Body

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // 视频背景 - 根据 Web 端实现，使用 ClawbotChannel 的 botState
                if useRobotBackground {
                    VideoBackgroundView(botState: clawbotChannel.botState)
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .ignoresSafeArea()
                } else {
                    HeroBackgroundView()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .ignoresSafeArea()
                }

                // Gradient overlay for readability
                LinearGradient(
                    colors: [.clear, .black.opacity(0.3)],
                    startPoint: .center,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                // Main content - 顶部工具栏，根据工作台状态显示/隐藏
                // 使用覆盖整个屏幕的点击区域
                VStack(spacing: 0) {
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .onTapGesture {
                    // Web端逻辑：点击背景显示工作台
                    // 工作台带有半透明背景，点击半透明背景可以关闭工作台
                    isWorkbenchPresented = true
                }

                // 顶部工具栏 - 工作台显示时显示（在聊天气泡下方）
                VStack(spacing: 0) {
                    // Top bar with mail and notification buttons
                    topBar
                        .padding(.horizontal, 20)
                        .padding(.top, geometry.safeAreaInsets.top)  // 向上移动到顶
                        .opacity(isWorkbenchPresented ? 1 : 0)
                        .animation(.easeInOut(duration: 0.3), value: isWorkbenchPresented)

                    Spacer()
                }

                // Workbench Modal (appears on background tap) - 底部浮窗效果
                if isWorkbenchPresented {
                    WorkbenchOverlay(
                        isPresented: $isWorkbenchPresented,
                        onCardClick: handleWorkbenchCardClick
                    )
                }

                // 右上角聊天气泡 - 始终显示在最上层
                VStack {
                    HStack {
                        Spacer()
                        HomeBotBubbleView(
                            botName: "TRIX Bot",
                            botAvatar: "sparkles"
                        ) {
                            isChatPresented = true
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, geometry.safeAreaInsets.top + 10)  // 在工具栏下方
                    Spacer()
                }
            }

            // Study Room Overlay
            if showStudyRoom {
                StudyRoomOverlay(isPresented: $showStudyRoom)
            }

            // Mail Panel
            if showMailPanel {
                MailPanelView(isPresented: $showMailPanel)
            }

            // Notification Panel
            if showNotificationPanel {
                NotificationPanelView(isPresented: $showNotificationPanel)
            }

            // Snapshot View - 直接显示，使用子视图自带的关闭按钮
            if showSnapshot {
                SnapshotListView()
            }

            // Location View - 直接显示
            if showLocation {
                LocationPickerView()
            }

            // Schedule View - 直接显示
            if showSchedule {
                ScheduleListView()
            }

            // Todo View - 直接显示
            if showTodo {
                TodoListView()
            }
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            // Spacer to balance the layout (removed welcome text)
            Spacer()

            // Mail button - 加大按钮
            Button {
                showMailPanel = true
            } label: {
                Image(systemName: "envelope.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 50, height: 50)  // 加大
                    .background(Color.gray.opacity(0.3))
                    .clipShape(Circle())
            }

            Spacer()
                .frame(width: 16)

            // Notification button - 加大
            Button {
                showNotificationPanel = true
            } label: {
                Image(systemName: "bell.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 50, height: 50)  // 加大
                    .background(Color.gray.opacity(0.3))
                    .clipShape(Circle())
            }
        }
    }

    // MARK: - Workbench Card Actions

    private func handleWorkbenchCardClick(_ itemId: String) {
        isWorkbenchPresented = false

        switch itemId {
        case "snapshot":
            showSnapshot = true
        case "location":
            showLocation = true
        case "schedule":
            showSchedule = true
        case "todo":
            showTodo = true
        default:
            break
        }
    }
}

// MARK: - Workbench Overlay

struct WorkbenchOverlay: View {
    @Binding var isPresented: Bool
    let onCardClick: (String) -> Void

    @State private var offset: CGFloat = 300
    @State private var backdropOpacity: Double = 0

    // 底部 Dock 高度 + 安全区域
    private let dockHeight: CGFloat = 120

    var body: some View {
        ZStack {
            // 半透明背景 - 点击关闭
            Color.black.opacity(backdropOpacity)
                .ignoresSafeArea()
                .onTapGesture {
                    closeWorkbench()
                }

            // 底部浮窗卡片 - 往上移动，避开底部 Dock
            VStack {
                Spacer()

                // 卡片内容
                VStack(spacing: 0) {
                    // Handle bar
                    RoundedRectangle(cornerRadius: 2.5)
                        .fill(Color.secondary.opacity(0.4))
                        .frame(width: 40, height: 5)
                        .padding(.top, 12)
                        .padding(.bottom, 8)

                    // Title
                    Text(loc("workbench.title"))
                        .font(.headline)
                        .fontWeight(.bold)
                        .padding(.bottom, 16)

                    // Cards scroll
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 20) {
                            WorkbenchOverlayCard(
                                icon: "camera.fill",
                                label: loc("workbench.snapshot"),
                                color: .orange,
                                action: {
                                    onCardClick("snapshot")
                                    closeWorkbench()
                                }
                            )

                            WorkbenchOverlayCard(
                                icon: "location.fill",
                                label: loc("workbench.location"),
                                color: .green,
                                action: {
                                    onCardClick("location")
                                    closeWorkbench()
                                }
                            )

                            WorkbenchOverlayCard(
                                icon: "calendar",
                                label: loc("workbench.schedule"),
                                color: .blue,
                                action: {
                                    onCardClick("schedule")
                                    closeWorkbench()
                                }
                            )

                            WorkbenchOverlayCard(
                                icon: "checklist",
                                label: loc("workbench.todo"),
                                color: .purple,
                                action: {
                                    onCardClick("todo")
                                    closeWorkbench()
                                }
                            )
                        }
                        .padding(.horizontal, 20)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 20)
                .frame(height: 200)
                .background(
                    RoundedRectangle(cornerRadius: 24)
                        .fill(Color.gray.opacity(0.2))
                )
                .shadow(color: .black.opacity(0.3), radius: 20)
            }
            .padding(.bottom, dockHeight)  // 避开底部 Dock
            .offset(y: offset)
        }
        .onAppear {
            openWorkbench()
        }
    }

    private func openWorkbench() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            offset = 0
            backdropOpacity = 0.3
        }
    }

    private func closeWorkbench() {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            offset = 300
            backdropOpacity = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            isPresented = false
        }
    }
}

// MARK: - Workbench Overlay Card

struct WorkbenchOverlayCard: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    @State private var isPressed = false

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [color, color.opacity(0.7)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 50, height: 50)

                    Image(systemName: icon)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                }

                Text(label)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
            }
            .frame(width: 80, height: 90)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.gray.opacity(0.2))
            )
            .scaleEffect(isPressed ? 0.95 : 1.0)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}

// MARK: - Study Room Overlay

struct StudyRoomOverlay: View {
    @Binding var isPresented: Bool

    var body: some View {
        ZStack {
            Color.black.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture {
                    isPresented = false
                }

            VStack(spacing: 20) {
                Text("学习房间")
                    .font(.title2)
                    .fontWeight(.bold)

                Text("与朋友一起学习")
                    .foregroundColor(.secondary)

                Button("开始学习") {
                    isPresented = false
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(30)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.gray.opacity(0.2))
            )
        }
    }
}

// MARK: - Preview

#Preview("Home View") {
    HomeView(
        isWorkbenchPresented: .constant(false),
        isChatPresented: .constant(false)
    )
    .environmentObject(AppState.shared)
}
