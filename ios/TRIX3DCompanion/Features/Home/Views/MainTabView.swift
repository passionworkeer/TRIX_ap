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
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // GlassDock Navigation
            GlassDockView(
                selectedTab: $appState.selectedTab,
                isWorkbenchPresented: $isWorkbenchPresented,
                isChatPresented: $isChatPresented
            )
        }
        .ignoresSafeArea(.keyboard)
        .onChange(of: appState.selectedTab) { newTab in
            handleTabChange(to: newTab)
        }
        .sheet(isPresented: $isWorkbenchPresented) {
            WorkbenchView()
        }
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
