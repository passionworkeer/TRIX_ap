//
//  HomeView.swift
//  TRIX3DCompanion
//
//  Home screen matching web端的 Home.tsx
//

import SwiftUI
import PhotosUI
import UIKit

// MARK: - Localization Helper
private func L(_ key: String) -> String {
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

                Color.clear
                    .contentShape(Rectangle())
                    .ignoresSafeArea()
                    .onTapGesture {
                        if !isWorkbenchPresented {
                            UITestEventLogger.log("Home background tapped -> workbench")
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                                isWorkbenchPresented = true
                            }
                        }
                    }
                    .allowsHitTesting(!isWorkbenchPresented)

                if isWorkbenchPresented {
                    WorkbenchOverlay(
                        isPresented: $isWorkbenchPresented,
                        onCardClick: handleWorkbenchCardClick
                    )
                }

                VStack(spacing: 0) {
                    if isWorkbenchPresented {
                        topBar
                            .padding(.horizontal, 20)
                            .padding(.top, geometry.safeAreaInsets.top + 12)
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }
                    Spacer()
                }
                .animation(.easeInOut(duration: 0.24), value: isWorkbenchPresented)

                VStack {
                    HStack {
                        Spacer()
                        HomeBotBubbleView(
                            botName: "TRIX",
                            botAvatar: "sparkles"
                        ) {
                            let destination: PendingCompanionRoute = clawbotChannel.isPaired ? .trixBot : .pairing
                            UITestEventLogger.log(
                                "Home bot bubble tapped -> \(destination == .trixBot ? "chat" : "pairing")"
                            )
                            appState.pendingCompanionRoute = destination
                            appState.selectTab(.chat)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, geometry.safeAreaInsets.top + (isWorkbenchPresented ? 86 : 36))
                    Spacer()
                }
                .animation(.easeInOut(duration: 0.24), value: isWorkbenchPresented)
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
        .confirmationDialog(L("home.quickSnap"), isPresented: $showQuickSnapOptions, titleVisibility: .visible) {
            Button(L("home.takePhoto")) {
                showCameraCapture = true
            }

            Button(L("home.selectFromAlbum")) {
                showPhotoPicker = true
            }

            Button(L("home.viewAlbum")) {
                showSnapshot = true
            }

            Button(L("action.cancel"), role: .cancel) {}
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
        .onChange(of: isWorkbenchPresented) { isPresented in
            UITestEventLogger.log("Home isWorkbenchPresented -> \(isPresented)")
        }
        .uiTestMarker(HomeAccessibilityIdentifiers.screen)
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            Spacer()

            HStack(spacing: 12) {
                toolbarCapsuleButton(icon: "envelope.fill", accessibilityLabel: "Mail") {
                    showMailPanel = true
                }

                toolbarCapsuleButton(icon: "bell.fill", accessibilityLabel: "Notifications") {
                    showNotificationPanel = true
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                Capsule(style: .continuous)
                    .fill(.ultraThinMaterial)
            )
            .overlay(
                Capsule(style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [Color.white.opacity(0.35), Color.white.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .shadow(color: .black.opacity(0.18), radius: 18, x: 0, y: 10)
        }
    }

    private func toolbarCapsuleButton(icon: String, accessibilityLabel: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.18),
                                Color.brandPurple.opacity(0.20),
                                Color.black.opacity(0.12)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.96))
            }
            .frame(width: 42, height: 42)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(0.14), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.12), radius: 8, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
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

    @State private var offset: CGFloat = 180
    @State private var backdropOpacity: Double = 0

    // 底部 Dock 高度 + 安全区域
    private let dockHeight: CGFloat = 120
    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    private let shortcuts: [WorkbenchShortcut] = [
        WorkbenchShortcut(
            id: "snapshot",
            icon: "camera.fill",
            label: L("workbench.snapshot"),
            subtitle: L("workbench.snapshot.subtitle"),
            color: .orange,
            accessibilityIdentifier: HomeAccessibilityIdentifiers.workbenchSnapshotCard
        ),
        WorkbenchShortcut(
            id: "location",
            icon: "location.fill",
            label: L("workbench.location"),
            subtitle: L("workbench.location.subtitle"),
            color: .green,
            accessibilityIdentifier: HomeAccessibilityIdentifiers.workbenchLocationCard
        ),
        WorkbenchShortcut(
            id: "schedule",
            icon: "calendar",
            label: L("workbench.schedule"),
            subtitle: L("workbench.schedule.subtitle"),
            color: .blue,
            accessibilityIdentifier: HomeAccessibilityIdentifiers.workbenchScheduleCard
        ),
        WorkbenchShortcut(
            id: "todo",
            icon: "checklist",
            label: L("workbench.todo"),
            subtitle: L("workbench.todo.subtitle"),
            color: .purple,
            accessibilityIdentifier: HomeAccessibilityIdentifiers.workbenchTodoCard
        )
    ]

    var body: some View {
        ZStack(alignment: .bottom) {
            // 半透明背景 - 点击关闭
            Color.black.opacity(backdropOpacity)
                .ignoresSafeArea()
                .onTapGesture {
                    closeWorkbench()
                }

            VStack(alignment: .leading, spacing: 18) {
                Capsule(style: .continuous)
                    .fill(Color.white.opacity(0.36))
                    .frame(width: 38, height: 5)
                    .frame(maxWidth: .infinity)

                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(L("workbench.title"))
                            .font(.system(size: 24, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)

                        Text(L("workbench.instruction"))
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundStyle(.white.opacity(0.72))
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 0)

                    Text(L("workbench.dismissHint"))
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.82))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(
                            Capsule(style: .continuous)
                                .fill(Color.white.opacity(0.08))
                        )
                        .overlay(
                            Capsule(style: .continuous)
                                .stroke(Color.white.opacity(0.12), lineWidth: 1)
                        )
                }
                .padding(.bottom, 2)

                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(shortcuts) { shortcut in
                        WorkbenchOverlayCard(
                            icon: shortcut.icon,
                            label: shortcut.label,
                            subtitle: shortcut.subtitle,
                            color: shortcut.color,
                            accessibilityIdentifier: shortcut.accessibilityIdentifier,
                            action: {
                                onCardClick(shortcut.id)
                                closeWorkbench()
                            }
                        )
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 18)
            .frame(maxWidth: 380, alignment: .leading)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: 30, style: .continuous)
                        .fill(.ultraThinMaterial)

                    RoundedRectangle(cornerRadius: 30, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.black.opacity(0.56),
                                    Color.brandPurple.opacity(0.24),
                                    Color.brandPink.opacity(0.12),
                                    Color.black.opacity(0.46)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 30, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [Color.white.opacity(0.28), Color.white.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .shadow(color: .black.opacity(0.22), radius: 24, x: 0, y: 14)
            .padding(.horizontal, 18)
            .padding(.bottom, dockHeight + 8)
            .offset(y: offset)
        }
        .accessibilityIdentifier(HomeAccessibilityIdentifiers.workbenchOverlay)
        .uiTestMarker(HomeAccessibilityIdentifiers.workbenchOverlay)
        .onAppear {
            openWorkbench()
        }
    }

    private func openWorkbench() {
        withAnimation(.spring(response: 0.38, dampingFraction: 0.84)) {
            offset = 0
            backdropOpacity = 0.34
        }
    }

    private func closeWorkbench() {
        withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
            offset = 180
            backdropOpacity = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
            isPresented = false
        }
    }
}

private struct WorkbenchShortcut: Identifiable {
    let id: String
    let icon: String
    let label: String
    let subtitle: String
    let color: Color
    let accessibilityIdentifier: String
}

// MARK: - Workbench Overlay Card

struct WorkbenchOverlayCard: View {
    let icon: String
    let label: String
    let subtitle: String
    let color: Color
    let accessibilityIdentifier: String
    let action: () -> Void

    @State private var isPressed = false

    var body: some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [color, color.opacity(0.72)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 48, height: 48)

                    Image(systemName: icon)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(label)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text(subtitle)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white.opacity(0.42))
            }
            .frame(maxWidth: .infinity, minHeight: 92, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(Color.white.opacity(0.10))

                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    color.opacity(0.18),
                                    Color.white.opacity(0.03),
                                    Color.black.opacity(0.16)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.white.opacity(0.12), lineWidth: 1)
            )
            .shadow(color: color.opacity(0.12), radius: 14, x: 0, y: 8)
            .scaleEffect(isPressed ? 0.97 : 1.0)
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
                Text(L("study.room.title"))
                    .font(.title2)
                    .fontWeight(.bold)

                Text(L("study.room.subtitle"))
                    .foregroundColor(.secondary)

                Button(L("study.room.start")) {
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
    HomeView(isWorkbenchPresented: .constant(false))
    .environmentObject(AppState.shared)
    .environmentObject(ClawbotChannelViewModel.shared)
}
