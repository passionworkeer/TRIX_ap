//
//  HomeView.swift
//  TRIX3DCompanion
//
//  Home tab placeholder view
//

import SwiftUI

// MARK: - Home View

/// Main home screen showing user overview and quick actions
struct HomeView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var isRefreshing = false

    // MARK: - Body

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header Section
                    headerSection
                        .padding(.horizontal)
                        .padding(.top, 20)

                    // User Info Card
                    userInfoCard
                        .padding(.horizontal)

                    // Quick Actions
                    quickActionsSection
                        .padding(.horizontal)

                    // Stats Overview
                    statsSection
                        .padding(.horizontal)

                    // Recent Activity
                    recentActivitySection
                        .padding(.horizontal)
                        .padding(.bottom, 100) // Extra padding for tab bar
                }
            }
            .background(backgroundGradient)
            .navigationTitle("Home")
            .navigationBarTitleDisplayMode(.large)
            .refreshable {
                await refreshData()
            }
        }
    }

    // MARK: - View Components

    /// Header section with greeting
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Welcome back,")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Text(appState.displayName)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.primary)
            }

            Spacer()

            // Avatar placeholder
            AsyncImage(url: appState.avatarURL) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.purple, .pink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay {
                        Text(String(appState.displayName.prefix(1)))
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                    }
            }
            .frame(width: 50, height: 50)
            .clipShape(Circle())
        }
    }

    /// User information card
    private var userInfoCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "person.circle.fill")
                    .foregroundColor(.purple)

                Text("My Profile")
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()
            }

            Divider()

            HStack {
                Label("Points", systemImage: "star.fill")
                    .foregroundColor(.yellow)
                Spacer()
                Text("\(appState.userPoints)")
                    .fontWeight(.semibold)
            }

            HStack {
                Label("Study Time", systemImage: "clock.fill")
                    .foregroundColor(.blue)
                Spacer()
                Text(appState.formattedStudyTime)
                    .fontWeight(.semibold)
            }

            HStack {
                Label("Status", systemImage: appState.isStudying ? "book.fill" : "moon.fill")
                    .foregroundColor(appState.isStudying ? .green : .gray)
                Spacer()
                Text(appState.isStudying ? "Studying" : "Idle")
                    .fontWeight(.semibold)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 5)
    }

    /// Quick actions section
    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline)
                .fontWeight(.semibold)
                .padding(.horizontal, 4)

            HStack(spacing: 16) {
                QuickActionButton(
                    title: "Start Study",
                    icon: "play.circle.fill",
                    color: .purple
                ) {
                    // Action
                }

                QuickActionButton(
                    title: "Join Room",
                    icon: "person.2.fill",
                    color: .blue
                ) {
                    // Action
                }

                QuickActionButton(
                    title: "View Stats",
                    icon: "chart.bar.fill",
                    color: .green
                ) {
                    // Action
                }
            }
        }
    }

    /// Statistics section
    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Overview")
                .font(.headline)
                .fontWeight(.semibold)
                .padding(.horizontal, 4)

            HStack(spacing: 12) {
                StatCard(
                    title: "Today",
                    value: "2h 15m",
                    icon: "sun.max.fill",
                    color: .orange
                )

                StatCard(
                    title: "This Week",
                    value: "12h 30m",
                    icon: "calendar",
                    color: .purple
                )

                StatCard(
                    title: "Streak",
                    value: "7 days",
                    icon: "flame.fill",
                    color: .red
                )
            }
        }
    }

    /// Recent activity section
    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Activity")
                .font(.headline)
                .fontWeight(.semibold)
                .padding(.horizontal, 4)

            VStack(spacing: 8) {
                ActivityRow(
                    icon: "book.fill",
                    title: "Study Session",
                    description: "Completed 45min study session",
                    time: "2 hours ago"
                )

                ActivityRow(
                    icon: "star.fill",
                    title: "Points Earned",
                    description: "+50 points for studying",
                    time: "2 hours ago"
                )

                ActivityRow(
                    icon: "person.2.fill",
                    title: "Joined Room",
                    description: "Entered 'Math Study' room",
                    time: "5 hours ago"
                )
            }
        }
    }

    /// Background gradient
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.purple.opacity(0.1),
                Color.pink.opacity(0.05),
                Color.clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    // MARK: - Actions

    private func refreshData() async {
        isRefreshing = true
        await appState.refreshSession()
        isRefreshing = false
    }
}

// MARK: - Quick Action Button

struct QuickActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 28))
                    .foregroundColor(.white)
                    .frame(width: 50, height: 50)
                    .background(
                        LinearGradient(
                            colors: [color, color.opacity(0.8)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                Text(title)
                    .font(.caption)
                    .foregroundColor(.primary)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Stat Card

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.title3)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)

            Text(value)
                .font(.headline)
                .fontWeight(.bold)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Activity Row

struct ActivityRow: View {
    let icon: String
    let title: String
    let description: String
    let time: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.purple)
                .frame(width: 36, height: 36)
                .background(.purple.opacity(0.1))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text(time)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Preview

#Preview("Home View") {
    HomeView()
        .environmentObject(AppState.shared)
}
