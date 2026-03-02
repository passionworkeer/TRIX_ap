//
//  ProfileView.swift
//  TRIX3DCompanion
//
//  Profile tab placeholder view showing user settings and information
//

import SwiftUI

// MARK: - Profile View

/// Main profile screen showing user information and settings
struct ProfileView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var isEditingProfile = false
    @State private var showingSettings = false
    @State private var showingAbout = false

    // MARK: - Body

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Profile header
                    profileHeader
                        .padding(.top, 20)

                    // Stats section
                    statsSection
                        .padding(.horizontal)

                    // Achievements section
                    achievementsSection
                        .padding(.horizontal)

                    // Settings section
                    settingsSection
                        .padding(.horizontal)

                    // Logout button
                    logoutButton
                        .padding(.horizontal)
                        .padding(.bottom, 100) // Extra padding for tab bar
                }
            }
            .background(backgroundGradient)
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { isEditingProfile = true }) {
                        Image(systemName: "pencil")
                            .foregroundColor(.purple)
                    }
                }
            }
            .sheet(isPresented: $isEditingProfile) {
                EditProfileView()
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
            }
            .sheet(isPresented: $showingAbout) {
                AboutView()
            }
        }
    }

    // MARK: - View Components

    /// Profile header with avatar and user info
    private var profileHeader: some View {
        VStack(spacing: 16) {
            // Avatar
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
                            .font(.system(size: 40))
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                    }
            }
            .frame(width: 100, height: 100)
            .clipShape(Circle())
            .shadow(color: .purple.opacity(0.3), radius: 20, x: 0, y: 10)

            // User info
            VStack(spacing: 4) {
                Text(appState.displayName)
                    .font(.title2)
                    .fontWeight(.bold)

                if appState.currentUser?.email != nil {
                    Text(appState.currentUser!.email!)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }

            // Status badge
            HStack(spacing: 6) {
                Circle()
                    .fill(appState.isStudying ? .green : .gray)
                    .frame(width: 8, height: 8)

                Text(appState.isStudying ? "Currently Studying" : "Idle")
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .foregroundColor(appState.isStudying ? .green : .secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background((appState.isStudying ? Color.green : Color.gray).opacity(0.1))
            .clipShape(Capsule())
        }
    }

    /// Statistics section
    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("profile.stats".localized)
                .font(.headline)
                .fontWeight(.semibold)
                .padding(.horizontal, 4)

            HStack(spacing: 12) {
                ProfileStatCard(
                    title: "profile.total.points".localized,
                    value: "\(appState.userPoints)",
                    icon: "star.fill",
                    color: .yellow
                )

                ProfileStatCard(
                    title: "profile.study.time".localized,
                    value: appState.formattedStudyTime,
                    icon: "clock.fill",
                    color: .blue
                )

                ProfileStatCard(
                    title: "profile.level".localized,
                    value: "\(levelFromPoints(appState.userPoints))",
                    icon: "trophy.fill",
                    color: .purple
                )
            }
        }
    }

    /// Achievements section
    private var achievementsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("profile.achievements".localized)
                .font(.headline)
                .fontWeight(.semibold)
                .padding(.horizontal, 4)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ProfileAchievementBadge(
                        title: "First Study",
                        icon: "book.fill",
                        color: .blue,
                        isUnlocked: true
                    )

                    ProfileAchievementBadge(
                        title: "7 Day Streak",
                        icon: "flame.fill",
                        color: .orange,
                        isUnlocked: true
                    )

                    ProfileAchievementBadge(
                        title: "Social Butterfly",
                        icon: "person.3.fill",
                        color: .pink,
                        isUnlocked: false
                    )

                    ProfileAchievementBadge(
                        title: "Night Owl",
                        icon: "moon.stars.fill",
                        color: .purple,
                        isUnlocked: false
                    )
                }
                .padding(.horizontal, 4)
            }
        }
    }

    /// Settings section
    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("profile.settings".localized)
                .font(.headline)
                .fontWeight(.semibold)
                .padding(.horizontal, 4)

            VStack(spacing: 0) {
                SettingsRow(
                    icon: "paintbrush.fill",
                    title: "Appearance",
                    description: appState.isDarkMode ? "Dark Mode" : "Light Mode",
                    color: .purple,
                    trailing: AnyView(Toggle("", isOn: $appState.isDarkMode))
                )

                Divider()
                    .padding(.leading, 60)

                SettingsRow(
                    icon: "bell.fill",
                    title: "Notifications",
                    description: appState.isPushNotificationEnabled ? "Enabled" : "Disabled",
                    color: .red,
                    trailing: AnyView(Toggle("", isOn: $appState.isPushNotificationEnabled))
                )

                Divider()
                    .padding(.leading, 60)

                SettingsRow(
                    icon: "gear",
                    title: "More Settings",
                    description: "Additional preferences",
                    color: .gray,
                    action: { showingSettings = true }
                )

                Divider()
                    .padding(.leading, 60)

                SettingsRow(
                    icon: "info.circle.fill",
                    title: "About",
                    description: "App version and info",
                    color: .blue,
                    action: { showingAbout = true }
                )
            }
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    /// Logout button
    private var logoutButton: some View {
        Button(action: handleLogout) {
            HStack {
                Image(systemName: "arrow.right.square.fill")
                Text("profile.log.out".localized)
                    .fontWeight(.semibold)
            }
            .font(.subheadline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(
                    colors: [.red.opacity(0.8), .red.opacity(0.6)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
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

    // MARK: - Helpers

    private func levelFromPoints(_ points: Int) -> Int {
        return (points / 1000) + 1
    }

    private func handleLogout() {
        Task {
            await appState.logout()
        }
    }
}

// MARK: - Profile Stat Card

/// Stat card for profile
struct ProfileStatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.title2)

            Text(value)
                .font(.headline)
                .fontWeight(.bold)

            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Achievement Badge

/// Achievement badge component
struct ProfileAchievementBadge: View {
    let title: String
    let icon: String
    let color: Color
    let isUnlocked: Bool

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(isUnlocked ? color.opacity(0.2) : Color.gray.opacity(0.1))
                    .frame(width: 60, height: 60)

                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(isUnlocked ? color : .gray)
            }

            Text(title)
                .font(.caption2)
                .foregroundColor(isUnlocked ? .primary : .secondary)
                .multilineTextAlignment(.center)
        }
        .frame(width: 80)
    }
}

// MARK: - Settings Row

/// Row component for settings
struct SettingsRow: View {
    let icon: String
    let title: String
    let description: String
    let color: Color
    var trailing: AnyView?
    var action: (() -> Void)?

    init(
        icon: String,
        title: String,
        description: String,
        color: Color,
        trailing: AnyView? = nil,
        action: (() -> Void)? = nil
    ) {
        self.icon = icon
        self.title = title
        self.description = description
        self.color = color
        self.trailing = trailing
        self.action = action
    }

    var body: some View {
        Button(action: action ?? {}) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(color)
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)

                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if let trailing = trailing {
                    trailing
                } else {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
    }
}

// MARK: - Edit Profile View

/// Modal view for editing profile
struct EditProfileView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var displayName: String = ""
    @State private var bio: String = ""
    @State private var school: String = ""
    @State private var grade: String = ""
    @State private var isSaving = false
    @State private var showError = false
    @State private var errorMessage = ""

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Avatar section
                    avatarSection

                    // Form fields
                    formSection
                }
                .padding()
            }
            .navigationTitle("profile.edit.profile".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveProfile()
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.purple)
                    .disabled(isSaving)
                }
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage)
            }
            .onAppear {
                loadCurrentProfile()
            }
        }
    }

    // MARK: - Avatar Section

    private var avatarSection: some View {
        VStack(spacing: 12) {
            // Avatar
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
                        Text(String(displayName.prefix(1)).uppercased())
                            .font(.system(size: 30))
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                    }
            }
            .frame(width: 80, height: 80)
            .clipShape(Circle())
            .shadow(color: .purple.opacity(0.3), radius: 10, x: 0, y: 5)

            Button("profile.change.photo".localized) {
                // Would open photo picker
            }
            .font(.subheadline)
            .foregroundColor(.purple)
        }
        .padding(.top, 20)
    }

    // MARK: - Form Section

    private var formSection: some View {
        VStack(spacing: 16) {
            // Display Name
            FormField(label: "profile.display.name".localized, text: $displayName, placeholder: "auth.username.placeholder".localized)

            // Bio
            FormField(label: "profile.bio".localized, text: $bio, placeholder: "Tell us about yourself", isMultiline: true)

            // School
            FormField(label: "profile.school".localized, text: $school, placeholder: "Your school or university")

            // Grade
            FormField(label: "profile.grade".localized, text: $grade, placeholder: "e.g., Grade 10, Year 2")
        }
    }

    // MARK: - Actions

    private func loadCurrentProfile() {
        displayName = appState.displayName
        // Load other profile fields from user model
        if let user = appState.currentUser {
            bio = user.bio ?? ""
            school = user.school ?? ""
            grade = user.grade ?? ""
        }
    }

    private func saveProfile() {
        guard !displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Display name cannot be empty"
            showError = true
            return
        }

        isSaving = true

        Task {
            do {
                // Call API to update profile
                // let _: ProfileUpdateResponse = try await apiClient.request(
                //     .PUT,
                //     endpoint: "/users/profile",
                //     body: ProfileUpdateRequest(
                //         displayName: displayName,
                //         bio: bio,
                //         school: school,
                //         grade: grade
                //     )
                // )

                // Update local state - reload profile to reflect changes
                isSaving = false
                dismiss()
            } catch {
                await MainActor.run {
                    isSaving = false
                    errorMessage = "Failed to save profile. Please try again."
                    showError = true
                }
            }
        }
    }
}

// MARK: - Form Field Component

struct FormField: View {
    let label: String
    @Binding var text: String
    let placeholder: String
    var isMultiline: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.secondary)

            if isMultiline {
                TextEditor(text: $text)
                    .frame(minHeight: 80)
                    .padding(8)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(.systemGray4), lineWidth: 1)
                    )
            } else {
                TextField(placeholder, text: $text)
                    .padding()
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(.systemGray4), lineWidth: 1)
                    )
            }
        }
    }
}

// MARK: - Settings View

/// Additional settings view
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VStack {
                Text("Additional Settings")
                    .font(.title2)
                    .fontWeight(.bold)
                Text("Coming soon...")
                    .foregroundColor(.secondary)
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - About View

/// About view with app information
struct AboutView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                // App icon
                RoundedRectangle(cornerRadius: 20)
                    .fill(
                        LinearGradient(
                            colors: [.purple, .pink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 80, height: 80)

                // App name
                Text("TRIX 3D Companion")
                    .font(.title2)
                    .fontWeight(.bold)

                // Version
                Text("Version 1.0.0")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                // Description
                Text("Your intelligent study companion for collaborative learning")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()

                Spacer()
            }
            .padding()
            .navigationTitle("About")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("Profile View") {
    ProfileView()
        .environmentObject(AppState.shared)
}

#Preview("Settings Row") {
    VStack(spacing: 0) {
        SettingsRow(
            icon: "paintbrush.fill",
            title: "Appearance",
            description: "Dark Mode",
            color: .purple
        )

        Divider()

        SettingsRow(
            icon: "bell.fill",
            title: "Notifications",
            description: "Enabled",
            color: .red
        )
    }
    .background(Color.gray.opacity(0.1))
}
