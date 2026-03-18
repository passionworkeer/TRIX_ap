//
//  NewProfileView.swift
//  TRIX3DCompanion
//
//  Profile main view with native iOS design
//

import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - New Profile View

/// Main profile screen with native iOS design
struct NewProfileView: View {

    // MARK: - State Objects

    @StateObject private var viewModel = ProfileViewModel()

    // MARK: - Environment

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var showEditProfile = false
    @State private var showImagePicker = false
    @State private var showDeleteAlert = false
    @State private var showOpenClawControl = false

    // MARK: - Body

    var body: some View {
        NavigationView {
            ZStack {
                // Background
                Color(.systemGroupedBackground)
                    .ignoresSafeArea()

                // Content
                if viewModel.isLoading {
                    loadingView
                } else {
                    contentView
                }
            }
            .navigationTitle(L("profile.title"))
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                toolbarContent
            }
            .sheet(isPresented: $showEditProfile) {
                EditProfileSheet(viewModel: viewModel)
            }
            .sheet(isPresented: $showOpenClawControl) {
                Text(L("profile.openclaw.control"))
            }
            .alert(L("common.error"), isPresented: .constant(viewModel.errorMessage != nil)) {
                Button(L("common.ok")) {
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
                    Label(L("profile.edit.profile"), systemImage: "pencil")
                }

                Button(action: { /* Settings */ }) {
                    Label(L("profile.settings"), systemImage: "gear")
                }

                Divider()

                Button(role: .destructive, action: { showDeleteAlert = true }) {
                    Label(L("profile.delete.account"), systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
                    .foregroundColor(.purple)
            }
        }
    }

    // MARK: - View Components

    private var contentView: some View {
        ScrollView {
            VStack(spacing: 20) {
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

                // Points card
                pointsCard
                    .padding(.horizontal)

                // Stats section
                if let stats = viewModel.userStats {
                    statsSection(stats: stats)
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

    private var pointsCard: some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                Image(systemName: "star.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.yellow)

                VStack(alignment: .leading, spacing: 2) {
                    Text(L("profile.points.balance"))
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text("\(L("profile.level")) \(viewModel.level)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            // Points display
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(viewModel.totalPoints)")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(.yellow)

                Text(L("profile.points"))
                    .font(.headline)
                    .foregroundColor(.secondary)
            }

            // Progress bar
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("\(L("profile.points.to.level")) \(viewModel.level + 1)")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer()

                    Text("\(viewModel.level * 1000 - viewModel.totalPoints) \(L("profile.points"))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color(.systemGray5))

                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.yellow)
                            .frame(
                                width: geometry.size.width *
                                    Double((viewModel.totalPoints % 1000)) / 1000.0
                            )
                    }
                    .frame(height: 8)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func statsSection(stats: UserStats) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L("profile.stats"))
                .font(.headline)
                .padding(.horizontal, 4)

            HStack(spacing: 12) {
                StatCard(
                    title: L("profile.stats.today.study"),
                    value: formatDuration(stats.todayDuration),
                    icon: "clock.fill",
                    color: .blue
                )

                StatCard(
                    title: L("profile.stats.streak"),
                    value: "\(stats.streakDays)",
                    icon: "flame.fill",
                    color: .orange
                )

                StatCard(
                    title: L("profile.stats.sessions"),
                    value: "\(stats.sessionCount)",
                    icon: "book.fill",
                    color: .green
                )
            }
        }
    }

    private var additionalActions: some View {
        List {
            Section {
                Button {
                    // Points history
                } label: {
                    Label(L("profile.points.history"), systemImage: "star.fill")
                }

                Button {
                    // Settings
                } label: {
                    Label(L("profile.settings"), systemImage: "gear")
                }

                Button {
                    // Privacy
                } label: {
                    Label(L("profile.privacy.security"), systemImage: "hand.raised.fill")
                }
            }

            Section {
                Button {
                    // Achievements
                } label: {
                    Label(L("profile.achievements"), systemImage: "trophy.fill")
                }

                Button {
                    // Study History
                } label: {
                    Label(L("profile.study.history"), systemImage: "clock.fill")
                }

                Button {
                    showOpenClawControl = true
                } label: {
                    Label(L("profile.openclaw.control"), systemImage: "robot.fill")
                }
            }

            Section {
                Button {
                    // About
                } label: {
                    Label(L("profile.about"), systemImage: "info.circle.fill")
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var versionInfo: some View {
        VStack(spacing: 4) {
            Text(L("about.app.name"))
                .font(.caption)
                .foregroundColor(.secondary)

            Text(String(format: L("about.app.version"), "1.0.0"))
                .font(.caption2)
                .foregroundColor(Color(.tertiaryLabel))
        }
    }

    private var loadingView: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Profile info card skeleton
                VStack(spacing: 16) {
                    HStack(spacing: 16) {
                        SkeletonAvatar(size: 80)

                        VStack(alignment: .leading, spacing: 8) {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(.gray.opacity(0.2))
                                .frame(width: 140, height: 18)
                                .shimmer(cornerRadius: 6)

                            RoundedRectangle(cornerRadius: 6)
                                .fill(.gray.opacity(0.2))
                                .frame(width: 100, height: 14)
                                .shimmer(cornerRadius: 6)

                            RoundedRectangle(cornerRadius: 6)
                                .fill(.gray.opacity(0.2))
                                .frame(width: 180, height: 12)
                                .shimmer(cornerRadius: 6)
                        }

                        Spacer()
                    }

                    RoundedRectangle(cornerRadius: 6)
                        .fill(.gray.opacity(0.2))
                        .frame(height: 40)
                        .shimmer(cornerRadius: 6)
                }
                .padding()
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)

                // Points card skeleton
                VStack(spacing: 16) {
                    HStack {
                        Circle()
                            .fill(.gray.opacity(0.2))
                            .frame(width: 32, height: 32)
                            .shimmer(cornerRadius: 16)

                        VStack(alignment: .leading, spacing: 4) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(.gray.opacity(0.2))
                                .frame(width: 80, height: 14)
                                .shimmer(cornerRadius: 4)

                            RoundedRectangle(cornerRadius: 4)
                                .fill(.gray.opacity(0.2))
                                .frame(width: 50, height: 12)
                                .shimmer(cornerRadius: 4)
                        }

                        Spacer()
                    }

                    RoundedRectangle(cornerRadius: 6)
                        .fill(.gray.opacity(0.2))
                        .frame(width: 120, height: 36)
                        .shimmer(cornerRadius: 6)

                    RoundedRectangle(cornerRadius: 4)
                        .fill(.gray.opacity(0.2))
                        .frame(height: 8)
                        .shimmer(cornerRadius: 4)
                }
                .padding()
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)

                // Stats section skeleton
                HStack(spacing: 12) {
                    ForEach(0..<3, id: \.self) { _ in
                        VStack(spacing: 8) {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(.gray.opacity(0.2))
                                .frame(height: 60)
                                .shimmer(cornerRadius: 8)

                            RoundedRectangle(cornerRadius: 4)
                                .fill(.gray.opacity(0.2))
                                .frame(width: 50, height: 12)
                                .shimmer(cornerRadius: 4)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal)

                // Actions skeleton
                VStack(spacing: 0) {
                    ForEach(0..<3, id: \.self) { _ in
                        HStack {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(.gray.opacity(0.2))
                                .frame(width: 200, height: 16)
                                .shimmer(cornerRadius: 6)

                            Spacer()

                            Circle()
                                .fill(.gray.opacity(0.2))
                                .frame(width: 12, height: 12)
                                .shimmer(cornerRadius: 6)
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 14)

                        Divider()
                    }
                }
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)
            }
            .padding(.top, 20)
            .padding(.bottom, 100)
        }
    }

    // MARK: - Helper Methods

    private func formatDuration(_ duration: Int) -> String {
        let hours = duration / 3600
        let minutes = duration / 60 % 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes)m"
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
                Section(L("profile.display.name")) {
                    TextField(L("profile.display.name.placeholder"), text: $displayName)
                }

                Section(L("profile.bio")) {
                    TextEditor(text: $bio)
                        .frame(minHeight: 100)
                }
            }
            .navigationTitle(L("profile.edit.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L("action.cancel")) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("action.save")) {
                        Task {
                            await viewModel.updateDisplayName(displayName)
                            await viewModel.updateBio(bio)
                            dismiss()
                        }
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.purple)
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
