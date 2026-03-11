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
                        HomeView(
                            isWorkbenchPresented: $isWorkbenchPresented,
                            onOpenTrixBot: {
                                showingTrixBotSheet = true
                            }
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
                .animation(.spring(response: 0.32, dampingFraction: 0.84), value: appState.selectedTab)
                .navigationDestination(for: ChatConversation.self) { conversation in
                    ChatDetailView(conversation: conversation)
                }
            }
            .navigationBarHidden(true)
            .allowsHitTesting(true)
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
                isWorkbenchPresented: $isWorkbenchPresented
            )
            .opacity(shouldShowTabBar ? 1 : 0)
            .allowsHitTesting(shouldShowTabBar)
            .animation(.easeInOut(duration: 0.24), value: shouldShowTabBar)
        }
        .ignoresSafeArea(.keyboard)
        .onChange(of: appState.selectedTab) { newTab in
            handleTabChange(to: newTab)
        }
    }

    // MARK: - Computed Properties

    private var shouldShowTabBar: Bool {
        let isNavigating = !navigationPath.isEmpty
        let isShowingSheet = showingPairingSheet || showingTrixBotSheet
        return !isNavigating && !isShowingSheet
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
