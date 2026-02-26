//
//  NewProfileView.swift
//  TRIX3DCompanion
//
//  Profile main view - comprehensive user profile with stats and actions
//

import SwiftUI

// MARK: - New Profile View

/// Main profile screen showing user information and quick actions
struct NewProfileView: View {

    // MARK: - State Objects

    @StateObject private var viewModel = ProfileViewModel()

    // MARK: - Environment

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var showSettings = false
    @State private var showPointsHistory = false
    @State private var showPrivacySettings = false
    @State private var showAbout = false
    @State private var showEditProfile = false
    @State private var showImagePicker = false
    @State private var showDeleteAlert = false

    // MARK: - Body

    var body: some View {
        NavigationView {
            ZStack {
                // Background gradient
                backgroundGradient
                    .ignoresSafeArea()

                // Content
                if viewModel.isLoading {
                    loadingView
                } else {
                    contentView
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                toolbarContent
            }
            .sheet(isPresented: $showSettings) {
                SettingsScreen()
            }
            .sheet(isPresented: $showPointsHistory) {
                PointsHistoryScreen()
            }
            .sheet(isPresented: $showPrivacySettings) {
                PrivacySettingsScreen()
            }
            .sheet(isPresented: $showAbout) {
                AboutScreen()
            }
            .sheet(isPresented: $showEditProfile) {
                EditProfileSheet(viewModel: viewModel)
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    viewModel.clearMessages()
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
            .task {
                await viewModel.loadProfile()
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarTrailing) {
            Menu {
                Button(action: { showEditProfile = true }) {
                    Label("Edit Profile", systemImage: "pencil")
                }

                Button(action: { showSettings = true }) {
                    Label("Settings", systemImage: "gear")
                }

                Divider()

                Button(role: .destructive, action: { showDeleteAlert = true }) {
                    Label("Delete Account", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
                    .foregroundColor(.brandPurple)
            }
        }
    }

    // MARK: - View Components

    private var contentView: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Profile info card
                ProfileInfoCard(
                    user: viewModel.user,
                    avatarURL: viewModel.avatarURL,
                    displayName: viewModel.displayName,
                    email: viewModel.email,
                    bio: viewModel.bio,
                    isStudying: viewModel.isStudying,
                    onAvatarTap: { showImagePicker = true },
                    onEditTap: { showEditProfile = true }
                )
                .padding(.horizontal)

                // Quick actions
                quickActions
                    .padding(.horizontal)

                // Points card
                pointsCard
                    .padding(.horizontal)

                // Stats section
                if let stats = viewModel.userStats {
                    StatsSection(
                        totalPoints: viewModel.totalPoints,
                        level: viewModel.level,
                        totalStudyTime: viewModel.totalStudyTime,
                        todayStudyTime: stats.todayDuration,
                        streakDays: stats.streakDays,
                        sessionCount: stats.sessionCount
                    )
                    .padding(.horizontal)
                }

                // Additional actions
                additionalActions
                    .padding(.horizontal)

                // Version info
                versionInfo
                    .padding(.top, 20)
            }
            .padding(.top, 20)
            .padding(.bottom, 100)
        }
        .refreshable {
            await viewModel.refresh()
        }
    }

    private var quickActions: some View {
        HStack(spacing: 12) {
            QuickActionButton(
                icon: "star.fill",
                title: "Points",
                subtitle: "\(viewModel.totalPoints)",
                color: .yellow
            ) {
                showPointsHistory = true
            }

            QuickActionButton(
                icon: "gearshape.fill",
                title: "Settings",
                subtitle: "Preferences",
                color: .purple
            ) {
                showSettings = true
            }

            QuickActionButton(
                icon: "hand.raised.fill",
                title: "Privacy",
                subtitle: "Security",
                color: .blue
            ) {
                showPrivacySettings = true
            }
        }
    }

    private var pointsCard: some View {
        GlassPanelContainer {
            VStack(spacing: 16) {
                // Header
                HStack {
                    Image(systemName: "star.circle.fill")
                        .font(.title2)
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.yellow, .orange],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Points Balance")
                            .font(.headline)
                            .fontWeight(.semibold)

                        Text("Level \(viewModel.level)")
                            .font(.caption)
                            .foregroundColor(.textSecondary)
                    }

                    Spacer()

                    Button(action: { showPointsHistory = true }) {
                        Text("History")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.brandPurple)
                    }
                    .buttonStyle(.plain)
                }

                // Points display
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(viewModel.totalPoints)")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.yellow, .orange],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    Text("pts")
                        .font(.headline)
                        .foregroundColor(.textSecondary)
                }

                // Progress bar
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Progress to Level \(viewModel.level + 1)")
                            .font(.caption)
                            .foregroundColor(.textSecondary)

                        Spacer()

                        Text("\(viewModel.level * 1000 - viewModel.totalPoints) pts to go")
                            .font(.caption)
                            .foregroundColor(.textSecondary)
                    }

                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.gray.opacity(0.2))

                            RoundedRectangle(cornerRadius: 4)
                                .fill(
                                    LinearGradient(
                                        colors: [.yellow, .orange],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(
                                    width: geometry.size.width *
                                        Double((viewModel.totalPoints % 1000)) / 1000.0
                                )
                        }
                        .frame(height: 8)
                    }
                }
            }
        }
    }

    private var additionalActions: some View {
        VStack(spacing: 0) {
            SettingsRow(
                icon: "trophy.fill",
                title: "Achievements",
                description: "View your achievements",
                color: .yellow,
                action: { /* TODO: Show achievements */ }
            )

            Divider()
                .padding(.leading, 60)

            SettingsRow(
                icon: "clock.fill",
                title: "Study History",
                description: "View your study sessions",
                color: .blue,
                action: { /* TODO: Show study history */ }
            )

            Divider()
                .padding(.leading, 60)

            SettingsRow(
                icon: "info.circle.fill",
                title: "About",
                description: "App version and info",
                color: .gray,
                action: { showAbout = true }
            )
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var versionInfo: some View {
        VStack(spacing: 4) {
            Text("TRIX 3D Companion")
                .font(.caption)
                .foregroundColor(.textSecondary)

            Text("Version 1.0.0")
                .font(.caption2)
                .foregroundColor(.textTertiary)
        }
    }

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)

            Text("Loading profile...")
                .font(.subheadline)
                .foregroundColor(.textSecondary)
        }
    }

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
    }
}

// MARK: - Quick Action Button

struct QuickActionButton: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.15))
                        .frame(width: 50, height: 50)

                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(color)
                }

                VStack(spacing: 2) {
                    Text(title)
                        .font(.caption)
                        .fontWeight(.semibold)

                    Text(subtitle)
                        .font(.caption2)
                        .foregroundColor(.textSecondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.1), .clear],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Edit Profile Sheet

struct EditProfileSheet: View {
    @Environment(\.dismiss) private var dismiss
    let viewModel: ProfileViewModel

    @State private var displayName: String = ""
    @State private var bio: String = ""

    var body: some View {
        NavigationView {
            Form {
                Section("Display Name") {
                    TextField("Your display name", text: $displayName)
                }

                Section("Bio") {
                    TextEditor(text: $bio)
                        .frame(minHeight: 100)
                }
            }
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        Task {
                            await viewModel.updateDisplayName(displayName)
                            await viewModel.updateBio(bio)
                            dismiss()
                        }
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.brandPurple)
                }
            }
        }
        .onAppear {
            displayName = viewModel.displayName
            bio = viewModel.bio ?? ""
        }
    }
}

// MARK: - Preview

#Preview("Profile View") {
    NewProfileView()
        .environmentObject(AppState.shared)
}

#Preview("Quick Actions") {
    HStack(spacing: 12) {
        QuickActionButton(
            icon: "star.fill",
            title: "Points",
            subtitle: "2450",
            color: .yellow
        ) {}

        QuickActionButton(
            icon: "gearshape.fill",
            title: "Settings",
            subtitle: "Preferences",
            color: .purple
        ) {}
    }
    .padding()
    .background(
        LinearGradient(
            colors: [.brandPurple.opacity(0.1), .brandPink.opacity(0.05)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}
