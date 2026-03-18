//
//  MainTabView.swift
//  TRIX3DCompanion
//
//  Main tab navigation for the application with GlassDock
//

import SwiftUI

// MARK: - Main Tab View

/// Bottom tab navigation with GlassDock floating style
struct MainTabView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var isWorkbenchPresented = false
    @State private var navigationPath = NavigationPath()

    // MARK: - Body

    var body: some View {
        ZStack {
            NavigationStack(path: $navigationPath) {
                tabContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .animation(.spring(response: 0.32, dampingFraction: 0.84), value: appState.selectedTab)
                    .navigationDestination(for: ChatConversation.self) { conversation in
                        ChatDetailView(conversation: conversation)
                    }
            }
            .navigationBarHidden(true)
            .allowsHitTesting(true)

            // GlassDockView 放在 ZStack 中，避免 safeAreaInset 导致的点击问题
            VStack {
                Spacer()
                if shouldShowTabBar {
                    GlassDockView(isWorkbenchPresented: $isWorkbenchPresented)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .ignoresSafeArea(.keyboard)
        .safeAreaInset(edge: .top) {
            Color.clear.frame(height: 0)
        }
        .accessibilityIdentifier(MainNavigationAccessibilityIdentifiers.mainTabView)
        .uiTestMarker(MainNavigationAccessibilityIdentifiers.selectedTab(for: appState.selectedTab))
        .onChange(of: appState.selectedTab) { newTab in
            UITestEventLogger.log("MainTabView observed selectedTab -> \(newTab.rawValue)")
            handleTabChange(to: newTab)
        }
        .animation(.easeInOut(duration: 0.24), value: shouldShowTabBar)
    }

    // MARK: - Computed Properties

    private var shouldShowTabBar: Bool {
        Self.shouldShowDock(
            selectedTab: appState.selectedTab,
            isWorkbenchPresented: isWorkbenchPresented,
            isNavigating: !navigationPath.isEmpty
        )
    }

    @ViewBuilder
    private var tabContent: some View {
        switch appState.selectedTab {
        case .home, .core:
            HomeView(isWorkbenchPresented: $isWorkbenchPresented)
            .id("tab.home")
        case .map:
            MapView()
                .id("tab.map")
        case .study:
            StudyListView()
                .id("tab.study")
        case .chat:
            ChatListView(onNavigateToChat: { conversation in
                navigationPath.append(conversation)
            })
            .id("tab.chat")
        case .profile:
            ProfileView()
                .id("tab.profile")
        }
    }

    // MARK: - Event Handlers

    static func shouldShowDock(
        selectedTab: MainTab,
        isWorkbenchPresented: Bool,
        isNavigating: Bool
    ) -> Bool {
        guard !isNavigating else { return false }

        let isHomeSurface = selectedTab == .home || selectedTab == .core
        if isHomeSurface {
            return isWorkbenchPresented
        }

        return true
    }

    /// Handle tab selection changes
    private func handleTabChange(to tab: MainTab) {
        // Add haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()

        if tab != .home && tab != .core {
            isWorkbenchPresented = false
        }

        // Save to UserDefaults
        UserDefaults.standard.set(tab.rawValue, forKey: "selectedTab")
    }
}

// MARK: - Preview

#Preview("Main Tabs") {
    MainTabView()
        .environmentObject(AppState.shared)
}

// MARK: - Chat Detail View Wrapper

/// 聊天详情视图包装器，添加关闭按钮
struct ChatDetailViewWrapper: View {
    let conversation: ChatConversation
    let onClose: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            ChatDetailView(conversation: conversation)

            // 关闭按钮
            Button(action: onClose) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title)
                    .foregroundColor(.white)
                    .padding()
            }
            .padding(.top, 60)  // 避开状态栏和灵动岛
            .padding(.trailing, 16)
        }
    }
}
