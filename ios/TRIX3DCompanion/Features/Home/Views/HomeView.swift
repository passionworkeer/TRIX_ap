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
    @State private var botState: BotState = .idle
    @State private var useRobotBackground = true

    // MARK: - Body

    var body: some View {
        ZStack {
            // Hero Background - with robot or gradient
            Group {
                if useRobotBackground {
                    RobotHeroBackgroundView(
                        botState: botState,
                        onActiveVideoSourceChange: { source in
                            print("Active video source: \(source)")
                        }
                    )
                    .ignoresSafeArea()
                } else {
                    HeroBackgroundView()
                        .ignoresSafeArea()
                }
            }

            // Main content
            VStack(spacing: 0) {
                // Top bar with mail and notification buttons
                topBar
                    .padding(.horizontal, 20)
                    .padding(.top, 50)

                Spacer()

                // Home Bot Bubble
                botBubbleSection

                Spacer()
            }
            .contentShape(Rectangle())
            .onTapGesture {
                // Tap on background opens workbench
                isWorkbenchPresented = true
            }

            // Workbench Modal (appears on background tap)
            if isWorkbenchPresented {
                WorkbenchOverlay(
                    isPresented: $isWorkbenchPresented,
                    onCardClick: handleWorkbenchCardClick
                )
            }

            // Study Room Overlay
            if showStudyRoom {
                StudyRoomOverlay(isPresented: $showStudyRoom)
            }
        }
        .ignoresSafeArea()
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            // User greeting
            VStack(alignment: .leading, spacing: 4) {
                Text(loc("home.welcome"))
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.8))

                Text(appState.displayName)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
            }

            Spacer()

            // Mail button
            Button {
                showMailPanel = true
            } label: {
                Image(systemName: "envelope.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }

            // Notification button
            Button {
                showNotificationPanel = true
            } label: {
                Image(systemName: "bell.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }
        }
    }

    // MARK: - Bot Bubble Section

    private var botBubbleSection: some View {
        VStack {
            Spacer()

            // Home Bot Bubble
            HomeBotBubbleView(
                botName: "TRIX Bot",
                botAvatar: "sparkles"
            ) {
                isChatPresented = true
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
        .frame(maxHeight: .infinity)
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

    @State private var selectedCard: String?

    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture {
                    isPresented = false
                }

            // Cards container
            VStack(spacing: 0) {
                // Handle bar
                RoundedRectangle(cornerRadius: 2.5)
                    .fill(Color.secondary.opacity(0.4))
                    .frame(width: 40, height: 5)
                    .padding(.top, 12)

                // Title
                VStack(spacing: 4) {
                    Text(loc("workbench.title"))
                        .font(.title2)
                        .fontWeight(.bold)

                    Text(loc("workbench.subtitle"))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 16)

                // Cards scroll
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 16) {
                        WorkbenchOverlayCard(
                            icon: "camera.fill",
                            label: loc("workbench.snapshot"),
                            color: .orange,
                            action: { onCardClick("snapshot") }
                        )

                        WorkbenchOverlayCard(
                            icon: "location.fill",
                            label: loc("workbench.location"),
                            color: .green,
                            action: { onCardClick("location") }
                        )

                        WorkbenchOverlayCard(
                            icon: "calendar",
                            label: loc("workbench.schedule"),
                            color: .blue,
                            action: { onCardClick("schedule") }
                        )

                        WorkbenchOverlayCard(
                            icon: "checklist",
                            label: loc("workbench.todo"),
                            color: .purple,
                            action: { onCardClick("todo") }
                        )
                    }
                    .padding(.horizontal, 20)
                }

                Spacer()
            }
            .frame(maxHeight: 250)
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(.ultraThinMaterial)
            )
            .shadow(color: .black.opacity(0.2), radius: 20)
            .padding(.horizontal, 16)
            .padding(.bottom, 120)
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
                    .fill(.ultraThinMaterial)
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
                    .fill(.ultraThinMaterial)
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
