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
    @State private var isHomeViewExpanded = true

    // MARK: - Body

    var body: some View {
        ZStack(alignment: .bottom) {
            // Tab content using ZStack for overlay navigation
            ZStack {
                switch appState.selectedTab {
                case .home:
                    HomeView(
                        isWorkbenchPresented: $isWorkbenchPresented,
                        isChatPresented: $isChatPresented
                    )
                case .map:
                    MapView()
                case .study:
                    StudyListView()
                case .core:
                    WorkbenchView()
                case .chat:
                    ChatListView()
                case .profile:
                    ProfileView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // GlassDock Navigation
            if isTabBarVisible {
                GlassDockView(
                    selectedTab: $appState.selectedTab,
                    isWorkbenchPresented: $isWorkbenchPresented,
                    isChatPresented: $isChatPresented
                )
            }
        }
        .ignoresSafeArea(.keyboard)
        .onChange(of: appState.selectedTab) { newTab in
            handleTabChange(to: newTab)
        }
        .onChange(of: isWorkbenchPresented) { newValue in
            if newValue {
                // Workbench is being shown
            }
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
