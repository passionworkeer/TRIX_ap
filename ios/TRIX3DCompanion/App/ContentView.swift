//
//  ContentView.swift
//  TRIX3DCompanion
//
//  Root view that manages authentication state and navigation
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

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background gradient
            backgroundView

            // Main content with conditional rendering
            Group {
                if authService.isLoggedIn {
                    MainTabView()
                        .transition(.asymmetric(
                            insertion: .scale(scale: 0.95).combined(with: .opacity),
                            removal: .scale(scale: 1.05).combined(with: .opacity)
                        ))
                } else {
                    AuthRootView()
                        .transition(.asymmetric(
                            insertion: .move(edge: .bottom).combined(with: .opacity),
                            removal: .move(edge: .top).combined(with: .opacity)
                        ))
                }
            }
            .animation(.spring(response: 0.5, dampingFraction: 0.8), value: authService.isLoggedIn)
        }
        .onChange(of: authService.isLoggedIn) { _, isLoggedIn in
            handleAuthStateChange(isLoggedIn: isLoggedIn)
        }
        .onAppear {
            handleInitialSetup()
        }
    }

    // MARK: - View Components

    /// Background gradient view
    private var backgroundView: some View {
        LinearGradient(
            colors: [
                Color.purple.opacity(0.3),
                Color.pink.opacity(0.2),
                Color.blue.opacity(0.1)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
        .overlay {
            // Subtle animated background pattern
            if authService.isLoggedIn {
                Color.clear
            } else {
                // Show pattern for auth screens
                backgroundPattern
            }
        }
    }

    /// Background pattern overlay
    private var backgroundPattern: some View {
        Canvas { context, size in
            // Draw subtle circles pattern
            for i in stride(from: 0, to: 10, by: 1) {
                for j in stride(from: 0, to: 10, by: 1) {
                    let x = CGFloat(i) * size.width / 10
                    let y = CGFloat(j) * size.height / 10
                    let circleSize: CGFloat = 2

                    context.fill(
                        Path { path in
                            path.addEllipse(in: CGRect(
                                x: x - circleSize / 2,
                                y: y - circleSize / 2,
                                width: circleSize,
                                height: circleSize
                            ))
                        },
                        with: .color(.white.opacity(0.1))
                    )
                }
            }
        }
        .ignoresSafeArea()
    }

    // MARK: - Event Handlers

    /// Handle authentication state changes
    private func handleAuthStateChange(isLoggedIn: Bool) {
        if isLoggedIn {
            // User logged in - refresh session data
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
        // Refresh session if already logged in
        if authService.isLoggedIn {
            Task {
                await appState.refreshSession()
            }
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
                    .transition(.asymmetric(
                        insertion: .scale.combined(with: .opacity),
                        removal: .identity
                    ))
            } else {
                AuthRootView()
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom).combined(with: .opacity),
                        removal: .identity
                    ))
            }
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.8), value: isLoading)
        .animation(.spring(response: 0.5, dampingFraction: 0.8), value: authService.isLoggedIn)
        .task {
            await initializeApp()
        }
    }

    // MARK: - View Components

    private var backgroundView: some View {
        LinearGradient(
            colors: [
                Color.purple.opacity(0.3),
                Color.pink.opacity(0.2)
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
                .font(.headline)
                .foregroundColor(.white)
        }
        .padding(40)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    // MARK: - Initialization

    private func initializeApp() async {
        // Simulate initial loading
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        // Refresh session if logged in
        if authService.isLoggedIn {
            await appState.refreshSession()
        }

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
