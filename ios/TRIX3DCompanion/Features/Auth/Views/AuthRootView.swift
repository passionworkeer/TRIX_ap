//
//  AuthRootView.swift
//  TRIX3DCompanion
//
//  Root view for authentication flow with animated transitions
//

import SwiftUI

struct AuthRootView: View {
    // MARK: - Observed Objects

    @StateObject private var authService = AuthService.shared

    // MARK: - State

    @State private var showingLogin = true
    @State private var animationOffset: CGFloat = 0

    // MARK: - Namespace for matched geometry

    @Namespace private var animation

    // MARK: - Body

    var body: some View {
        ZStack {
            if showingLogin {
                LoginView {
                    withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                        showingLogin = false
                    }
                }
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .leading).combined(with: .opacity)
                ))
            } else {
                RegisterView {
                    withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                        showingLogin = true
                    }
                }
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .leading).combined(with: .opacity)
                ))
            }
        }
        .onChange(of: authService.isLoggedIn) { _, isLoggedIn in
            if isLoggedIn {
                // Authentication successful - parent view will handle dismissal
                print("User logged in successfully")
            }
        }
    }
}

// MARK: - Alternative Implementation with TabView

struct AuthRootViewTab: View {
    // MARK: - Observed Objects

    @StateObject private var authService = AuthService.shared

    @State private var selectedTab = 0

    // MARK: - Body

    var body: some View {
        TabView(selection: $selectedTab) {
            LoginView {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                    selectedTab = 1
                }
            }
            .tag(0)

            RegisterView {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                    selectedTab = 0
                }
            }
            .tag(1)
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .ignoresSafeArea()
        .onChange(of: authService.isLoggedIn) { _, isLoggedIn in
            if isLoggedIn {
                print("User logged in successfully")
            }
        }
    }
}

// MARK: - Card-Based Auth View (Alternative)

struct AuthRootViewCard: View {
    // MARK: - Observed Objects

    @StateObject private var authService = AuthService.shared

    @State private var showingLogin = true
    @State private var cardRotation: Double = 0

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [
                    Color.purple.opacity(0.8),
                    Color.pink.opacity(0.7)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Flip card animation
            ZStack {
                if showingLogin {
                    LoginView {
                        withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                            showingLogin = false
                        }
                    }
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                    .shadow(color: .black.opacity(0.3), radius: 30, x: 0, y: 20)
                    .padding(.horizontal, 24)
                    .transition(.flip)

                } else {
                    RegisterView {
                        withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                            showingLogin = true
                        }
                    }
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                    .shadow(color: .black.opacity(0.3), radius: 30, x: 0, y: 20)
                    .padding(.horizontal, 24)
                    .transition(.flip)
                }
            }
        }
        .onChange(of: authService.isLoggedIn) { _, isLoggedIn in
            if isLoggedIn {
                print("User logged in successfully")
            }
        }
    }
}

// MARK: - Custom Transitions

extension AnyTransition {
    static var flip: AnyTransition {
        .asymmetric(
            insertion: .opacity.combined(with: .scale(scale: 0.8)),
            removal: .opacity.combined(with: .scale(scale: 0.8))
        )
    }

    static var slideAndFade: AnyTransition {
        .asymmetric(
            insertion: .move(edge: .trailing).combined(with: .opacity),
            removal: .move(edge: .leading).combined(with: .opacity)
        )
    }
}

// MARK: - Preview

#Preview("Default") {
    AuthRootView()
}

#Preview("TabView Style") {
    AuthRootViewTab()
}

#Preview("Card Style") {
    AuthRootViewCard()
}
