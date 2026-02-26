//
//  ContentView.swift
//  TRIX3DCompanion
//
//  Root view that manages authentication state and navigation
//  Optimized for fast launch performance
//

import SwiftUI

// MARK: - Content View

/// Root view that determines whether to show auth or main app
struct ContentView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState

    // MARK: - Observed Objects

    @StateObject private var authService = AuthService.shared

    // MARK: - State

    @State private var isAnimating = false
    @State private var hasCompletedInitialLoad = false

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background gradient - simplified for performance
            backgroundView

            // Main content with conditional rendering
            Group {
                if authService.isLoggedIn {
                    MainTabView()
                        .transition(.asymmetric(
                            insertion: .opacity,
                            removal: .opacity
                        ))
                } else {
                    AuthRootView()
                        .transition(.asymmetric(
                            insertion: .opacity,
                            removal: .opacity
                        ))
                }
            }
            .animation(.easeInOut(duration: 0.3), value: authService.isLoggedIn)
        }
        .onChange(of: authService.isLoggedIn) { _, isLoggedIn in
            handleAuthStateChange(isLoggedIn: isLoggedIn)
        }
        .onAppear {
            handleInitialSetup()
        }
    }

    // MARK: - View Components

    /// Background gradient view - optimized for performance
    private var backgroundView: some View {
        LinearGradient(
            colors: [
                Color.brandPurple.opacity(0.3),
                Color.brandPink.opacity(0.2),
                Color.info.opacity(0.1)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    // MARK: - Event Handlers

    /// Handle authentication state changes
    private func handleAuthStateChange(isLoggedIn: Bool) {
        if isLoggedIn {
            // User logged in - refresh session data asynchronously
            Task {
                await appState.refreshSession()
            }
        } else {
            // User logged out - reset state
            appState.selectedTab = .home
        }

        // Add haptic feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(isLoggedIn ? .success : .warning)
    }

    /// Handle initial setup when view appears
    private func handleInitialSetup() {
        // End initial view phase tracking
        AppLaunchOptimizer.shared.endPhase(.initialView)

        // Refresh session if already logged in - deferred
        if authService.isLoggedIn {
            Task {
                await appState.refreshSession()
            }
        }

        // Mark launch complete after first frame
        Task {
            // Wait for first frame to render
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
            _ = AppLaunchOptimizer.shared.completeLaunch()
        }
    }
}

// MARK: - Alternative Implementation with Loading State

/// Alternative content view with explicit loading state
struct ContentViewWithLoading: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState

    // MARK: - Observed Objects

    @StateObject private var authService = AuthService.shared

    // MARK: - State

    @State private var isLoading = true

    // MARK: - Body

    var body: some View {
        ZStack {
            backgroundView

            if isLoading {
                loadingView
            } else if authService.isLoggedIn {
                MainTabView()
                    .transition(.opacity)
            } else {
                AuthRootView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: isLoading)
        .animation(.easeInOut(duration: 0.3), value: authService.isLoggedIn)
        .task {
            await initializeApp()
        }
    }

    // MARK: - View Components

    private var backgroundView: some View {
        LinearGradient(
            colors: [
                Color.brandPurple.opacity(0.3),
                Color.brandPink.opacity(0.2)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    private var loadingView: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
                .tint(.white)

            Text("Loading...")
                .font(.headlineStyle)
                .foregroundStyle(.white)
        }
        .padding(40)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    // MARK: - Initialization

    private func initializeApp() async {
        // Track this phase
        AppLaunchOptimizer.shared.startPhase(.dataLoad)

        // Simulate initial loading
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        // Refresh session if logged in
        if authService.isLoggedIn {
            await appState.refreshSession()
        }

        AppLaunchOptimizer.shared.endPhase(.dataLoad)

        withAnimation {
            isLoading = false
        }
    }
}

// MARK: - Preview

#Preview("Logged In") {
    ContentView()
        .environmentObject(AppState.shared)
}

#Preview("Not Logged In") {
    ContentView()
        .environmentObject(AppState.shared)
}

#Preview("With Loading") {
    ContentViewWithLoading()
        .environmentObject(AppState.shared)
}
