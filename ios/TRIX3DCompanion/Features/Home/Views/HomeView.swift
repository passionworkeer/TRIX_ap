//
//  HomeView.swift
//  TRIX3DCompanion
//
//  Home screen matching web端的 Home.tsx
//

import SwiftUI
import PhotosUI
import UIKit

// Helper function for localization
private func loc(_ key: String) -> String {
    key.localized
}

// MARK: - Home View

/// Main home screen matching web design
struct HomeView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var clawbotChannel: ClawbotChannelViewModel

    // MARK: - Bindings

    @Binding var isWorkbenchPresented: Bool
    let onOpenTrixBot: () -> Void

    // MARK: - State

    @State private var showMailPanel = false
    @State private var showNotificationPanel = false
    @State private var showStudyRoom = false
    @State private var showSnapshot = false
    @State private var showQuickSnapOptions = false
    @State private var showCameraCapture = false
    @State private var showPhotoPicker = false
    @State private var showTodo = false
    @State private var showSchedule = false
    @State private var showLocation = false
    @State private var useRobotBackground = true
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var showTrixBotFromSnapshot = false
    @State private var pendingSnapshotImage: UIImage?
    @State private var pendingSnapshotImageURL: String?

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

                LinearGradient(
                    colors: [.black.opacity(0.02), .black.opacity(0.36), .black.opacity(0.58)],
                    startPoint: .top,
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
                    if !isWorkbenchPresented {
                        isWorkbenchPresented = true
                    }
                }
                .allowsHitTesting(!isWorkbenchPresented)

                // Workbench Modal (appears on background tap) - 底部浮窗效果
                if isWorkbenchPresented {
                    WorkbenchOverlay(
                        isPresented: $isWorkbenchPresented,
                        onCardClick: handleWorkbenchCardClick
                    )
                }

                VStack(spacing: 0) {
                    homeHeader
                        .padding(.horizontal, 20)
                        .padding(.top, geometry.safeAreaInsets.top + 10)

                    Spacer()
                }

                VStack {
                    HStack {
                        Spacer()
                        HomeBotBubbleView(
                            botName: "TRIX",
                            botAvatar: "sparkles"
                        ) { onOpenTrixBot() }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, geometry.safeAreaInsets.top + 110)
                    Spacer()
                }

                VStack {
                    Spacer()
                    commandDeck
                        .padding(.horizontal, 20)
                        .padding(.bottom, 112)
                        .onTapGesture {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                                isWorkbenchPresented = true
                            }
                        }
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

        }
        .confirmationDialog("快拍", isPresented: $showQuickSnapOptions, titleVisibility: .visible) {
            Button("拍照") {
                showCameraCapture = true
            }

            Button("从相册选择") {
                showPhotoPicker = true
            }

            Button("查看快拍相册") {
                showSnapshot = true
            }

            Button("取消", role: .cancel) {}
        }
        .fullScreenCover(isPresented: $showCameraCapture, onDismiss: presentPendingSnapshotChatIfNeeded) {
            CameraView { image, uploadedImageURL in
                pendingSnapshotImage = image
                pendingSnapshotImageURL = uploadedImageURL
            }
        }
        .fullScreenCover(isPresented: $showSnapshot) {
            SnapshotListView()
        }
        .fullScreenCover(isPresented: $showTrixBotFromSnapshot, onDismiss: clearPendingSnapshotSelection) {
            NavigationStack {
                TrixBotChatView(
                    initialAttachedImage: pendingSnapshotImage,
                    initialAttachedImageURL: pendingSnapshotImageURL
                )
                .environmentObject(clawbotChannel)
            }
        }
        .photosPicker(
            isPresented: $showPhotoPicker,
            selection: $selectedPhotoItem,
            matching: .images,
            preferredItemEncoding: .automatic
        )
        .onChange(of: selectedPhotoItem) { item in
            guard let item else { return }

            Task {
                let imageData = try? await item.loadTransferable(type: Data.self)
                let selectedImage = imageData.flatMap { UIImage(data: $0) }

                await MainActor.run {
                    pendingSnapshotImage = selectedImage
                    pendingSnapshotImageURL = nil
                    showTrixBotFromSnapshot = selectedImage != nil
                    selectedPhotoItem = nil
                }
            }
        }
        .sheet(isPresented: $showLocation) {
            LocationPickerView(showAsSheet: true)
        }
        .sheet(isPresented: $showSchedule) {
            ScheduleListView(showAsSheet: true)
        }
        .sheet(isPresented: $showTodo) {
            TodoListView(showAsSheet: true)
        }
        .uiTestMarker(HomeAccessibilityIdentifiers.screen)
    }

    // MARK: - Header

    private var homeHeader: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("TRIX Companion")
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text("机器人当前处于\(clawbotChannel.botState.displayName)状态，点击下方卡片可快速打开拍照、日程、待办和定位。")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.82))
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 16)

                HStack(spacing: 12) {
                    toolbarOrbButton(icon: "envelope.fill", accessibilityLabel: "Mail") {
                        showMailPanel = true
                    }

                    toolbarOrbButton(icon: "bell.fill", accessibilityLabel: "Notifications") {
                        showNotificationPanel = true
                    }
                }
            }

            HStack(spacing: 10) {
                statusChip(icon: "waveform.badge.mic", text: "TRIX 在线")
                statusChip(icon: "hand.tap.fill", text: "点空白打开工作台")
            }
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.black.opacity(0.32),
                            Color.brandPurple.opacity(0.18),
                            Color.brandPink.opacity(0.12)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.16), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.2), radius: 22, x: 0, y: 12)
    }

    private var commandDeck: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("打开工作台")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text("一键进入快拍、定位、日程和 Todo 的主操作层。")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.78))
                }

                Spacer()

                Image(systemName: "square.grid.2x2.fill")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.92))
                    .padding(12)
                    .background(Color.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }

            HStack(spacing: 10) {
                quickFeaturePill(icon: "camera.fill", text: "快拍")
                quickFeaturePill(icon: "calendar", text: "日程")
                quickFeaturePill(icon: "checklist", text: "Todo")
                quickFeaturePill(icon: "location.fill", text: "定位")
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.brandPurple.opacity(0.26),
                            Color.black.opacity(0.34),
                            Color.brandPink.opacity(0.16)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.14), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.28), radius: 24, x: 0, y: 14)
    }

    private func toolbarOrbButton(icon: String, accessibilityLabel: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.title3.weight(.semibold))
                .foregroundColor(.white)
                .frame(width: 48, height: 48)
                .background(
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color.brandPurple.opacity(0.36), Color.brandPink.opacity(0.22)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
                .overlay(Circle().stroke(Color.white.opacity(0.18), lineWidth: 1))
                .shadow(color: .black.opacity(0.16), radius: 10, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }

    private func statusChip(icon: String, text: String) -> some View {
        Label(text, systemImage: icon)
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .foregroundStyle(.white.opacity(0.9))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.white.opacity(0.1), in: Capsule())
            .overlay(Capsule().stroke(Color.white.opacity(0.12), lineWidth: 1))
    }

    private func quickFeaturePill(icon: String, text: String) -> some View {
        Label(text, systemImage: icon)
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(Color.white.opacity(0.1), in: Capsule())
            .overlay(Capsule().stroke(Color.white.opacity(0.12), lineWidth: 1))
    }

    // MARK: - Workbench Card Actions

    private func handleWorkbenchCardClick(_ itemId: String) {
        isWorkbenchPresented = false

        switch itemId {
        case "snapshot":
            showQuickSnapOptions = true
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

    private func presentPendingSnapshotChatIfNeeded() {
        guard pendingSnapshotImage != nil else { return }
        showTrixBotFromSnapshot = true
    }

    private func clearPendingSnapshotSelection() {
        pendingSnapshotImage = nil
        pendingSnapshotImageURL = nil
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
                        .fill(Color.white.opacity(0.4))
                        .frame(width: 40, height: 5)
                        .padding(.top, 12)
                        .padding(.bottom, 12)

                    VStack(spacing: 6) {
                        Text(loc("workbench.title"))
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)

                        Text("常用动作集中到这里，轻点即可打开对应功能。")
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundStyle(.white.opacity(0.72))
                    }
                    .padding(.bottom, 18)

                    // Cards scroll
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 20) {
                            WorkbenchOverlayCard(
                                icon: "camera.fill",
                                label: loc("workbench.snapshot"),
                                subtitle: "拍照、选图、查看快拍",
                                color: .orange,
                                accessibilityIdentifier: HomeAccessibilityIdentifiers.workbenchSnapshotCard,
                                action: {
                                    onCardClick("snapshot")
                                    closeWorkbench()
                                }
                            )

                            WorkbenchOverlayCard(
                                icon: "location.fill",
                                label: loc("workbench.location"),
                                subtitle: "地图、地点与位置选择",
                                color: .green,
                                accessibilityIdentifier: HomeAccessibilityIdentifiers.workbenchLocationCard,
                                action: {
                                    onCardClick("location")
                                    closeWorkbench()
                                }
                            )

                            WorkbenchOverlayCard(
                                icon: "calendar",
                                label: loc("workbench.schedule"),
                                subtitle: "学习节奏和时间安排",
                                color: .blue,
                                accessibilityIdentifier: HomeAccessibilityIdentifiers.workbenchScheduleCard,
                                action: {
                                    onCardClick("schedule")
                                    closeWorkbench()
                                }
                            )

                            WorkbenchOverlayCard(
                                icon: "checklist",
                                label: loc("workbench.todo"),
                                subtitle: "快速记录待办事项",
                                color: .purple,
                                accessibilityIdentifier: HomeAccessibilityIdentifiers.workbenchTodoCard,
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
                .frame(height: 224)
                .background(
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.black.opacity(0.72),
                                    Color.brandPurple.opacity(0.24),
                                    Color.brandPink.opacity(0.18)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .stroke(Color.white.opacity(0.22), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.24), radius: 20)
            }
            .padding(.bottom, dockHeight)  // 避开底部 Dock
            .offset(y: offset)
        }
        .accessibilityIdentifier(HomeAccessibilityIdentifiers.workbenchOverlay)
        .uiTestMarker(HomeAccessibilityIdentifiers.workbenchOverlay)
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
    let subtitle: String
    let color: Color
    let accessibilityIdentifier: String?
    let action: () -> Void

    @State private var isPressed = false

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [color, color.opacity(0.7)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 58, height: 58)

                    Image(systemName: icon)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(label)
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text(subtitle)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.74))
                        .lineLimit(2)
                }
            }
            .frame(width: 148, height: 156, alignment: .topLeading)
            .padding(18)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.16),
                                color.opacity(0.18),
                                Color.black.opacity(0.18)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.white.opacity(0.18), lineWidth: 1)
            )
            .shadow(color: color.opacity(0.2), radius: 18, x: 0, y: 10)
            .scaleEffect(isPressed ? 0.95 : 1.0)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .uiTestIdentifier(accessibilityIdentifier)
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
                    .fill(.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )
        }
    }
}

// MARK: - Preview

#Preview("Home View") {
    HomeView(
        isWorkbenchPresented: .constant(false),
        onOpenTrixBot: {}
    )
    .environmentObject(AppState.shared)
}
