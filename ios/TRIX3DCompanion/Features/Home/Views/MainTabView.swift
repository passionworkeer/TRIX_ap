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

    // MARK: - Body

    var body: some View {
        ZStack(alignment: .bottom) {
            // Tab content using ZStack for overlay navigation
            ZStack {
                // 优先显示聊天界面
                if isChatPresented {
                    ChatDetailViewWrapper(
                        conversation: trixBotConversation,
                        onClose: {
                            isChatPresented = false
                        }
                    )
                } else {
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
                        ChatListView()
                    case .profile:
                        ProfileView()
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .ignoresSafeArea()

            // GlassDock Navigation - 聊天界面时不显示，其他界面显示
            GlassDockView(
                selectedTab: $appState.selectedTab,
                isWorkbenchPresented: $isWorkbenchPresented,
                isChatPresented: $isChatPresented
            )
            .opacity(isChatPresented ? 0 : (appState.selectedTab == .home || appState.selectedTab == .core ? (isWorkbenchPresented ? 1 : 0) : 1))
            .allowsHitTesting(!isChatPresented)  // 聊天界面时禁用点击
            .animation(.easeInOut(duration: 0.3), value: isWorkbenchPresented)
        }
        .ignoresSafeArea(.keyboard)
        .onChange(of: appState.selectedTab) { newTab in
            handleTabChange(to: newTab)
        }
        .onChange(of: isChatPresented) { newValue in
            if newValue {
                // 点击气泡后切换到聊天 tab
                appState.selectedTab = .chat
            }
        }
    }

    // MARK: - Trix Bot Conversation

    private var trixBotConversation: ChatConversation {
        ChatConversation(
            id: "trix-bot",
            name: "TRIX Bot",
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
            .padding(.top, 50)
            .padding(.trailing, 16)
        }
    }
}
