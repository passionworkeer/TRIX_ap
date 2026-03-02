//
//  MainTabView.swift
//  TRIX3DCompanion
//
//  Main tab navigation for the application
//

import SwiftUI

// MARK: - Main Tab View

/// Bottom tab navigation with 4 main sections
struct MainTabView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var isTabBarVisible = true

    // MARK: - Body

    var body: some View {
        ZStack(alignment: .bottom) {
            // Tab content
            TabView(selection: $appState.selectedTab) {
                HomeView()
                    .tabItem {
                        Label(MainTab.home.rawValue, systemImage: MainTab.home.systemImage)
                    }
                    .tag(MainTab.home)

                ChatListView()
                    .tabItem {
                        Label(MainTab.chat.rawValue, systemImage: MainTab.chat.systemImage)
                    }
                    .tag(MainTab.chat)

                StudyListView()
                    .tabItem {
                        Label(MainTab.study.rawValue, systemImage: MainTab.study.systemImage)
                    }
                    .tag(MainTab.study)

                ProfileView()
                    .tabItem {
                        Label(MainTab.profile.rawValue, systemImage: MainTab.profile.systemImage)
                    }
                    .tag(MainTab.profile)
            }
            .tint(.purple)

            // Custom tab bar overlay (optional - for advanced customization)
            if isTabBarVisible {
                // System tab bar is used by default
                // Uncomment below for custom tab bar
                // CustomTabBar()
            }
        }
        .onChange(of: appState.selectedTab) { newTab in
            handleTabChange(to: newTab)
        }
        .onAppear {
            setupTabBarAppearance()
        }
    }

    // MARK: - Setup

    /// Configure tab bar appearance
    private func setupTabBarAppearance() {
        if #available(iOS 16.0, *) {
            // iOS 16+ styling is handled by modifiers
        } else {
            // Fallback for iOS 15
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.95)

            UITabBar.appearance().standardAppearance = appearance
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }

        // Save user preference when tab changes
        UserDefaults.standard.set(appState.selectedTab.rawValue, forKey: "selectedTab")
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

// MARK: - Custom Tab Bar (Optional)

/// Custom tab bar component for advanced styling
struct CustomTabBar: View {
    @EnvironmentObject private var appState: AppState
    @State private var offsetY: CGFloat = 0

    var body: some View {
        HStack(spacing: 0) {
            ForEach(MainTab.allCases, id: \.self) { tab in
                TabBarItem(
                    tab: tab,
                    isSelected: appState.selectedTab == tab
                ) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        appState.selectedTab = tab
                    }
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(.ultraThinMaterial)
                .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 5)
        )
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .offset(y: offsetY)
    }
}

// MARK: - Tab Bar Item

/// Individual tab bar item
struct TabBarItem: View {
    let tab: MainTab
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: tab.systemImage)
                    .font(.system(size: 20))
                    .symbolVariant(isSelected ? .fill : .none)

                Text(tab.rawValue)
                    .font(.caption2)
            }
            .foregroundColor(isSelected ? .purple : .secondary)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("Main Tabs") {
    MainTabView()
        .environmentObject(AppState.shared)
}

#Preview("Custom Tab Bar") {
    ZStack(alignment: .bottom) {
        Color.gray.opacity(0.2)

        CustomTabBar()
            .environmentObject(AppState.shared)
    }
    .ignoresSafeArea()
}
