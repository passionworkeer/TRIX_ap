//
//  HomeView.swift
//  TRIX3DCompanion
//
//  Home tab placeholder view
//

import SwiftUI

// Helper function for localization
private func loc(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

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
            .navigationTitle(loc("home.greeting"))
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
                Text(loc("home.welcome"))
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
                            colors: [Color.brandPurple, Color.brandPink],
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
                    .foregroundColor(Color.brandPurple)

                Text(loc("profile.title"))
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()
            }

            Divider()

            HStack {
                Label(loc("profile.points"), systemImage: "star.fill")
                    .foregroundColor(.yellow)
                Spacer()
                Text("\(appState.userPoints)")
                    .fontWeight(.semibold)
            }

            HStack {
                Label(loc("study.total.time"), systemImage: "clock.fill")
                    .foregroundColor(.blue)
                Spacer()
                Text(appState.formattedStudyTime)
                    .fontWeight(.semibold)
            }

            HStack {
                Label(loc("profile.status"), systemImage: appState.isStudying ? "book.fill" : "moon.fill")
                    .foregroundColor(appState.isStudying ? .green : .gray)
                Spacer()
                Text(appState.isStudying ? loc("profile.currently.studying") : loc("profile.idle"))
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
            Text(loc("home.quick.actions"))
                .font(.headline)
                .fontWeight(.semibold)
                .padding(.horizontal, 4)

            HStack(spacing: 16) {
                QuickActionButton(
                    title: loc("study.start"),
                    icon: "play.circle.fill",
                    color: Color.brandPurple
                ) {
                    // Navigate to study
                }

                QuickActionButton(
                    title: loc("study.join.room"),
                    icon: "person.2.fill",
                    color: Color.blue
                ) {
                    // Join room
                }

                QuickActionButton(
                    title: loc("profile.stats"),
                    icon: "chart.bar.fill",
                    color: Color.green
                ) {
                    // View stats
                }
            }
        }
    }

    /// Statistics section
    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(loc("home.overview"))
                .font(.headline)
                .fontWeight(.semibold)
                .padding(.horizontal, 4)

            HStack(spacing: 12) {
                HomeStatCard(
                    title: loc("study.today.time"),
                    value: "2h 15m",
                    icon: "sun.max.fill",
                    color: .orange
                )

                HomeStatCard(
                    title: loc("study.week"),
                    value: "12h 30m",
                    icon: "calendar",
                    color: Color.brandPurple
                )

                HomeStatCard(
                    title: loc("study.streak"),
                    value: "7 " + loc("days"),
                    icon: "flame.fill",
                    color: Color.red
                )
            }
        }
    }

    /// Recent activity section
    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(loc("home.recent.activity"))
                .font(.headline)
                .fontWeight(.semibold)
                .padding(.horizontal, 4)

            VStack(spacing: 8) {
                ActivityRow(
                    icon: "book.fill",
                    title: loc("study.title"),
                    description: loc("home.activity.study.complete"),
                    time: "2 " + loc("hours.ago")
                )

                ActivityRow(
                    icon: "star.fill",
                    title: loc("points.earned"),
                    description: loc("home.activity.points.earned"),
                    time: "2 " + loc("hours.ago")
                )

                ActivityRow(
                    icon: "person.2.fill",
                    title: loc("home.activity.joined"),
                    description: loc("home.activity.joined.room"),
                    time: "5 " + loc("hours.ago")
                )
            }
        }
    }

    /// Background gradient
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.brandPurple.opacity(0.1),
                Color.brandPink.opacity(0.05),
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

// MARK: - Home Stat Card

struct HomeStatCard: View {
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
