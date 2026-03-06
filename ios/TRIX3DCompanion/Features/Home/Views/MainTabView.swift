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

    @State private var isTabBarVisible = true
    @State private var isWorkbenchPresented = false
    @State private var isChatPresented = false
    @State private var navigationPath = NavigationPath()
    @State private var showingPairingSheet = false
    @State private var showingTrixBotSheet = false

    // MARK: - Body

    var body: some View {
        ZStack(alignment: .bottom) {
            // Tab content using NavigationStack for proper navigation
            NavigationStack(path: $navigationPath) {
                ZStack {
                    // 根据选择的 tab 显示内容
                    switch appState.selectedTab {
                    case .home, .core:
                        // Both home and core show the same HomeView with workbench
                        HomeView(
                            isWorkbenchPresented: $isWorkbenchPresented,
                            isChatPresented: $isChatPresented
                        )
                    case .map:
                        MapView()
                    case .study:
                        StudyListView()
                    case .chat:
                        ChatListView(
                            onNavigateToChat: { conversation in
                                navigationPath.append(conversation)
                            },
                            onNavigateToPairing: {
                                showingPairingSheet = true
                            },
                            onNavigateToTrixBot: {
                                showingTrixBotSheet = true
                            }
                        )
                    case .profile:
                        ProfileView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .navigationDestination(for: ChatConversation.self) { conversation in
                    ChatDetailView(conversation: conversation)
                }
            }
            .navigationBarHidden(true)
            .allowsHitTesting(true)
            .onChange(of: navigationPath) { newPath in
                // Hide tab bar when navigating to detail views
                isTabBarVisible = newPath.isEmpty
            }
            .sheet(isPresented: $showingPairingSheet) {
                NavigationStack {
                    PairingView()
                        .environmentObject(ClawbotChannelViewModel.shared)
                }
            }
            .sheet(isPresented: $showingTrixBotSheet) {
                NavigationStack {
                    TrixBotChatView()
                        .environmentObject(ClawbotChannelViewModel.shared)
                }
            }

            // GlassDock Navigation - 根据导航状态显示/隐藏
            GlassDockView(
                selectedTab: $appState.selectedTab,
                isWorkbenchPresented: $isWorkbenchPresented,
                isChatPresented: $isChatPresented
            )
            .opacity(shouldShowTabBar ? 1 : 0)
            .allowsHitTesting(shouldShowTabBar)  // 关键修复：当透明度为0时禁用触摸
            .animation(.easeInOut(duration: 0.3), value: isWorkbenchPresented)
        }
        .ignoresSafeArea(.keyboard)
        .onChange(of: appState.selectedTab) { newTab in
            handleTabChange(to: newTab)
        }
        .onChange(of: isChatPresented) { newValue in
            if newValue {
                // 点击气泡后切换到聊天 tab，显示聊天列表
                appState.selectedTab = .chat
                // 重置状态
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    isChatPresented = false
                }
            }
        }
    }

    // MARK: - Computed Properties

    private var shouldShowTabBar: Bool {
        // Hide tab bar when:
        // 1. Navigating to detail views (navigationPath is not empty)
        // 2. Showing sheets (pairing or trixbot)
        // Note: Bottom Dock should ALWAYS be visible, even when workbench is shown
        let isNavigating = !navigationPath.isEmpty
        let isShowingSheet = showingPairingSheet || showingTrixBotSheet
        return !isNavigating && !isShowingSheet
    }

    // MARK: - Trix Bot Conversation

    private var trixBotConversation: ChatConversation {
        ChatConversation(
            id: "trix-bot",
            name: "TRIX",
            avatarUrl: "AvatarHead",
            lastMessage: "",
            time: "",
            unreadCount: 0,
            avatarColor: .purple,
            isOnline: true
        )
    }

    // MARK: - Event Handlers

    /// Handle tab selection changes
    private func handleTabChange(to tab: MainTab) {
        // Add haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()

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
