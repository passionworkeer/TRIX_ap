//
//  ProfileView.swift
//  TRIX3DCompanion
//
//  Profile tab placeholder view showing user settings and information
//

import SwiftUI
import ActivityIndicatorView

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    key.localized
}

// MARK: - Profile View

/// Main profile screen showing user information and settings
struct ProfileView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var isEditingProfile = false
    @State private var showingSettings = false
    @State private var showingAbout = false
    @State private var showingWardrobeCenter = false
    @State private var equippedOutfits: Set<String> = ["hat1"]
    @State private var achievements: [Achievement] = []
    @State private var isLoadingAchievements = false
    @StateObject private var logoutViewModel = ProfileLogoutViewModel()

    // MARK: - Dependencies

    @StateObject private var achievementService = AchievementService.shared

    // MARK: - Body

    var body: some View {
        NavigationStack {
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

                    // Wardrobe section
                    wardrobeSection
                        .padding(.horizontal)

                    // Settings section
                    settingsSection
                        .padding(.horizontal)

                    // Logout button
                    logoutButton
                        .padding(.horizontal)
                }
                .padding(.bottom, 130)
            }
            .uiTestMarker(ProfileAccessibilityIdentifiers.screen)
            .background(backgroundGradient)
            .navigationTitle(L("profile.title"))
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
            .sheet(isPresented: $showingWardrobeCenter) {
                WardrobeCenterView(equippedOutfits: $equippedOutfits)
            }
            .task {
                await loadAchievements()
            }
            .alert(L("profile.logout.confirm.title"), isPresented: $logoutViewModel.isConfirmationPresented) {
                Button(L("profile.logout.confirm.action"), role: .destructive) {
                    Task {
                        await logoutViewModel.confirmLogout(using: appState)
                    }
                }
                Button(L("action.cancel"), role: .cancel) {
                    logoutViewModel.cancelLogout()
                }
            } message: {
                Text(L("profile.logout.confirm.message"))
            }
        }
    }

    // MARK: - Data Loading

    private func loadAchievements() async {
        isLoadingAchievements = true
        do {
            achievements = try await achievementService.fetchAchievements()
        } catch {
            // Log error and show empty achievements on failure
            SecureLogger.shared.error("Failed to load achievements: \(error.localizedDescription)")
            achievements = []
        }
        isLoadingAchievements = false
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
            .shadow(color: .brandPurple.opacity(0.3), radius: 20, x: 0, y: 10)

            // User info
            VStack(spacing: 4) {
                Text(appState.displayName)
                    .font(.title2)
                    .fontWeight(.bold)

                if let email = appState.currentUser?.email {
                    Text(email)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }

            // Status badge
            HStack(spacing: 6) {
                Circle()
                    .fill(appState.isStudying ? .green : .gray)
                    .frame(width: 8, height: 8)

                Text(appState.isStudying ? "profile.currently.studying".localized : "profile.idle".localized)
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
                    color: .info
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
            HStack {
                Text("profile.achievements".localized)
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()

                if isLoadingAchievements {
                    TrixLoadingIndicator.standard()
                        .scaleEffect(0.8)
                }
            }
            .padding(.horizontal, 4)

            if achievements.isEmpty && !isLoadingAchievements {
                // Empty state
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "trophy")
                            .font(.title)
                            .foregroundColor(.secondary)
                        Text(L("profile.achievements.empty"))
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 20)
                    Spacer()
                }
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(achievements) { achievement in
                            ProfileAchievementBadge(
                                title: achievement.name,
                                icon: achievement.icon,
                                color: colorForAchievement(achievement),
                                isUnlocked: achievement.unlockedAt != nil
                            )
                        }
                    }
                    .padding(.horizontal, 4)
                }
            }
        }
    }

    /// Get color for achievement based on category
    private func colorForAchievement(_ achievement: Achievement) -> Color {
        switch achievement.category {
        case .duration:
            return .blue
        case .streak:
            return .orange
        case .social:
            return .pink
        case .milestone:
            return .purple
        case .special:
            return .yellow
        }
    }

    /// Wardrobe section - quick access to wardrobe
    private var wardrobeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(L("profile.wardrobe.title"))
                    .font(.headline)
                    .fontWeight(.semibold)
                Spacer()
                Button(L("profile.wardrobe.manage")) {
                    showingWardrobeCenter = true
                }
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(
                    LinearGradient(
                        colors: [.brandPurple, .brandPink],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
            }
            .padding(.horizontal, 4)

            Button {
                showingWardrobeCenter = true
            } label: {
                HStack(spacing: 12) {
                    // Equipped items preview
                    ForEach(Array(equippedOutfits.prefix(3)), id: \.self) { _ in
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [Color.brandPurple, Color.brandPink],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 50, height: 50)
                            .overlay {
                                Image(systemName: "sparkles")
                                    .font(.title3)
                                    .foregroundColor(.white)
                            }
                    }

                    // Add more button
                    Circle()
                        .fill(Color.white.opacity(0.1))
                        .frame(width: 50, height: 50)
                        .overlay {
                            Image(systemName: "plus")
                                .font(.title3)
                                .foregroundColor(.secondary)
                        }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.trailing, 2)
                }
                .padding(12)
                .trixSurfaceCard(cornerRadius: 16, borderOpacity: 0.22, shadowOpacity: 0.06, shadowRadius: 8)
            }
            .buttonStyle(.plain)
        }
    }

    private var darkModeBinding: Binding<Bool> {
        Binding(
            get: { appState.isDarkMode },
            set: { appState.setDarkMode($0) }
        )
    }

    private var notificationBinding: Binding<Bool> {
        Binding(
            get: { appState.isPushNotificationEnabled },
            set: { appState.setPushNotificationsEnabled($0) }
        )
    }

    private var languageMenu: some View {
        Menu {
            ForEach(AppDisplayLanguage.allCases) { language in
                Button {
                    appState.setAppLanguage(language)
                } label: {
                    if language == appState.appLanguage {
                        Label(language.displayName, systemImage: "checkmark")
                    } else {
                        Text(language.displayName)
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Text(appState.appLanguage.displayName)
                Image(systemName: "chevron.up.chevron.down")
            }
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundColor(.brandPurple)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.brandPurple.opacity(0.12))
            .clipShape(Capsule())
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
                    title: "settings.appearance".localized,
                    description: appState.isDarkMode ? "settings.theme.dark".localized : "settings.theme.light".localized,
                    color: .purple,
                    trailing: AnyView(
                        Toggle("", isOn: darkModeBinding)
                            .labelsHidden()
                            .tint(.brandPurple)
                            .accessibilityIdentifier(ProfileAccessibilityIdentifiers.darkModeToggle)
                    )
                )

                Divider()
                    .padding(.leading, 60)

                SettingsRow(
                    icon: "globe",
                    title: "settings.language".localized,
                    description: appState.appLanguage.displayName,
                    color: .info,
                    trailing: AnyView(languageMenu)
                )

                Divider()
                    .padding(.leading, 60)

                SettingsRow(
                    icon: "bell.fill",
                    title: "settings.notifications".localized,
                    description: appState.isPushNotificationEnabled ? L("settings.enabled") : L("settings.disabled"),
                    color: .red,
                    trailing: AnyView(
                        Toggle("", isOn: notificationBinding)
                            .labelsHidden()
                            .tint(.brandPurple)
                            .accessibilityIdentifier(ProfileAccessibilityIdentifiers.notificationsToggle)
                    )
                )

                Divider()
                    .padding(.leading, 60)

                SettingsRow(
                    icon: "gear",
                    title: "settings.more.settings".localized,
                    description: "settings.additional.preferences".localized,
                    color: .gray,
                    accessibilityIdentifier: ProfileAccessibilityIdentifiers.moreSettingsButton,
                    action: { showingSettings = true }
                )

                Divider()
                    .padding(.leading, 60)

                SettingsRow(
                    icon: "info.circle.fill",
                    title: "settings.about".localized,
                    description: "settings.app.version".localized,
                    color: .info,
                    accessibilityIdentifier: ProfileAccessibilityIdentifiers.aboutButton,
                    action: { showingAbout = true }
                )
            }
            .trixSurfaceCard(cornerRadius: 16, borderOpacity: 0.2, shadowOpacity: 0.06, shadowRadius: 8)
        }
    }

    /// Logout button
    private var logoutButton: some View {
        Button(action: { logoutViewModel.requestLogout() }) {
            HStack {
                if logoutViewModel.isLoggingOut {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Image(systemName: "arrow.right.square.fill")
                }
                Text(logoutViewModel.isLoggingOut ? L("profile.logout.loading") : "profile.log.out".localized)
                    .fontWeight(.semibold)
            }
            .font(.subheadline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(
                    colors: [.error.opacity(0.85), .error.opacity(0.62)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.15), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .disabled(logoutViewModel.isLoggingOut)
        .accessibilityIdentifier(ProfileAccessibilityIdentifiers.logoutButton)
    }

    /// Background gradient
    private var backgroundGradient: some View {
        Color.clear.trixPageBackground(
            colors: [
                Color.brandPurple.opacity(0.14),
                Color.brandPink.opacity(0.1),
                Color.cyan.opacity(0.06),
                Color.clear
            ]
        )
    }

    // MARK: - Helpers

    private func levelFromPoints(_ points: Int) -> Int {
        return (points / 1000) + 1
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
        .trixSurfaceCard(cornerRadius: 12, borderOpacity: 0.2, shadowOpacity: 0.04, shadowRadius: 6)
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
                    .fill(isUnlocked ? color.opacity(0.2) : Color.tertiaryBackground.opacity(0.1))
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
    let accessibilityIdentifier: String?
    var trailing: AnyView?
    var action: (() -> Void)?

    init(
        icon: String,
        title: String,
        description: String,
        color: Color,
        accessibilityIdentifier: String? = nil,
        trailing: AnyView? = nil,
        action: (() -> Void)? = nil
    ) {
        self.icon = icon
        self.title = title
        self.description = description
        self.color = color
        self.accessibilityIdentifier = accessibilityIdentifier
        self.trailing = trailing
        self.action = action
    }

    @ViewBuilder
    var body: some View {
        if let action {
            Button(action: action) {
                rowContent
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .uiTestIdentifier(accessibilityIdentifier)
        } else {
            rowContent
                .uiTestIdentifier(accessibilityIdentifier)
        }
    }

    private var rowContent: some View {
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
        NavigationStack {
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
                    Button(L("action.cancel")) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("action.save")) {
                        saveProfile()
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.purple)
                    .disabled(isSaving)
                }
            }
            .alert(L("settings.error"), isPresented: $showError) {
                Button(L("action.confirm"), role: .cancel) {}
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
        }
        .padding(.top, 20)
    }

    // MARK: - Form Section

    private var formSection: some View {
        VStack(spacing: 16) {
            // Display Name
            FormField(label: "profile.display.name".localized, text: $displayName, placeholder: "auth.username.placeholder".localized)

            // Bio
            FormField(label: "profile.bio".localized, text: $bio, placeholder: "profile.tell.about.self".localized, isMultiline: true)

            // School
            FormField(label: "profile.school".localized, text: $school, placeholder: "profile.school.university".localized)

            // Grade
            FormField(label: "profile.grade".localized, text: $grade, placeholder: "profile.grade.example".localized)
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
        let trimmedDisplayName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedDisplayName.isEmpty else {
            errorMessage = L("profile.name.empty")
            showError = true
            return
        }

        isSaving = true

        Task {
            do {
                let update = ProfileUpdate(
                    username: appState.currentUser?.username,
                    fullName: trimmedDisplayName,
                    displayName: trimmedDisplayName,
                    bio: bio.nilIfBlank,
                    school: school.nilIfBlank,
                    grade: grade.nilIfBlank,
                    avatarUrl: appState.currentUser?.avatarUrl
                )

                let updatedUser = try await APIClient.shared.updateUserProfile(update)

                await MainActor.run {
                    AuthService.shared.updateCurrentUser(updatedUser)
                    isSaving = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    isSaving = false
                    errorMessage = error.localizedDescription
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

// MARK: - Wardrobe Center

private struct ProfileWardrobeItem: Identifiable {
    let id: String
    let title: String
    let icon: String
    let gradient: [Color]
}

struct WardrobeCenterView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var equippedOutfits: Set<String>

    private let items: [ProfileWardrobeItem] = [
        ProfileWardrobeItem(id: "hat1", title: L("wardrobe.item.star.hat"), icon: "sparkles", gradient: [.brandPurple, .brandPink]),
        ProfileWardrobeItem(id: "book1", title: L("wardrobe.item.study.glasses"), icon: "eyeglasses", gradient: [.blue, .cyan]),
        ProfileWardrobeItem(id: "fire1", title: L("wardrobe.item.streak.flame"), icon: "flame.fill", gradient: [.orange, .red]),
        ProfileWardrobeItem(id: "leaf1", title: L("wardrobe.item.nature.style"), icon: "leaf.fill", gradient: [.green, .mint]),
        ProfileWardrobeItem(id: "moon1", title: L("wardrobe.item.night.owl"), icon: "moon.stars.fill", gradient: [.indigo, .purple]),
        ProfileWardrobeItem(id: "crown1", title: L("wardrobe.item.glory.crown"), icon: "crown.fill", gradient: [.yellow, .orange])
    ]

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(items) { item in
                        Button {
                            toggle(item.id)
                        } label: {
                            VStack(spacing: 10) {
                                Circle()
                                    .fill(
                                        LinearGradient(
                                            colors: item.gradient,
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .frame(width: 62, height: 62)
                                    .overlay {
                                        Image(systemName: item.icon)
                                            .font(.title2)
                                            .foregroundColor(.white)
                                    }
                                    .overlay(alignment: .bottomTrailing) {
                                        if equippedOutfits.contains(item.id) {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundColor(.green)
                                                .background(Color.white, in: Circle())
                                        }
                                    }

                                Text(item.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundColor(.primary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 18)
                            .background(.ultraThinMaterial)
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(
                                        equippedOutfits.contains(item.id) ? Color.brandPurple.opacity(0.6) : Color.white.opacity(0.2),
                                        lineWidth: equippedOutfits.contains(item.id) ? 2 : 1
                                    )
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
            }
            .background(
                LinearGradient(
                    colors: [Color.brandPurple.opacity(0.08), Color.brandPink.opacity(0.05), Color.clear],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .navigationTitle(L("profile.wardrobe.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L("action.close")) {
                        dismiss()
                    }
                }
            }
        }
    }

    private func toggle(_ outfitId: String) {
        if equippedOutfits.contains(outfitId) {
            if equippedOutfits.count > 1 {
                equippedOutfits.remove(outfitId)
            }
            return
        }
        equippedOutfits.insert(outfitId)
    }
}

// MARK: - Settings View

/// Additional settings view
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @State private var isSyncing = false
    @State private var isDeletingAccount = false
    @State private var showingDeleteConfirmation = false
    @State private var deleteAccountError: String?
    @State private var syncMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section(L("settings.appearance")) {
                    Toggle(
                        L("settings.theme.dark"),
                        isOn: Binding(
                            get: { appState.isDarkMode },
                            set: { appState.setDarkMode($0) }
                        )
                    )
                }

                Section(L("settings.notifications")) {
                    Toggle(
                        L("settings.push.notifications"),
                        isOn: Binding(
                            get: { appState.isPushNotificationEnabled },
                            set: { appState.setPushNotificationsEnabled($0) }
                        )
                    )
                }

                Section(L("settings.language")) {
                    Picker(L("settings.language"), selection: Binding(
                        get: { appState.appLanguage },
                        set: { appState.setAppLanguage($0) }
                    )) {
                        ForEach(AppDisplayLanguage.allCases) { language in
                            Text(language.displayName).tag(language)
                        }
                    }
                    .pickerStyle(.menu)
                }

                Section(L("settings.data")) {
                    Button {
                        Task { await runSyncNow() }
                    } label: {
                        HStack {
                            if isSyncing {
                                ProgressView()
                            }
                            Text(isSyncing ? L("settings.syncing") : L("settings.sync.now"))
                        }
                    }
                    .disabled(isSyncing)
                    .accessibilityIdentifier(ProfileAccessibilityIdentifiers.settingsSyncButton)

                    if let syncMessage {
                        Text(syncMessage)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .accessibilityIdentifier(ProfileAccessibilityIdentifiers.settingsSyncMessage)
                    }
                }

                Section {
                    Button(role: .destructive) {
                        showingDeleteConfirmation = true
                    } label: {
                        HStack {
                            if isDeletingAccount {
                                ProgressView()
                            }
                            Text(L("profile.privacy.delete.account"))
                        }
                    }
                    .disabled(isDeletingAccount)
                    .accessibilityIdentifier(ProfileAccessibilityIdentifiers.settingsDeleteAccountButton)

                    if let deleteAccountError {
                        Text(deleteAccountError)
                            .font(.caption)
                            .foregroundColor(.red)
                            .accessibilityIdentifier(ProfileAccessibilityIdentifiers.settingsDeleteAccountError)
                    }
                }
            }
            .accessibilityIdentifier(ProfileAccessibilityIdentifiers.settingsSheet)
            .navigationTitle(L("settings.title"))
            .navigationBarTitleDisplayMode(.inline)
            .confirmationDialog(
                L("profile.privacy.delete.confirm.title"),
                isPresented: $showingDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button(L("profile.privacy.delete.account"), role: .destructive) {
                    Task {
                        await handleDeleteAccount()
                    }
                }
                Button(L("action.cancel"), role: .cancel) {}
            } message: {
                Text(L("profile.privacy.delete.confirm.message"))
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("action.done")) {
                        dismiss()
                    }
                    .accessibilityIdentifier(ProfileAccessibilityIdentifiers.settingsDoneButton)
                }
            }
        }
    }

    private func runSyncNow() async {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }

        do {
            let result = try await DataSyncService.shared.syncAll(priority: .high)
            syncMessage = L("settings.sync.success").replacingOccurrences(of: "%d", with: "\(result.syncedItems)")
        } catch {
            syncMessage = L("settings.sync.failed").replacingOccurrences(of: "%@", with: error.localizedDescription)
        }
    }

    private func handleDeleteAccount() async {
        guard !isDeletingAccount else { return }
        isDeletingAccount = true
        deleteAccountError = nil
        defer { isDeletingAccount = false }

        switch await appState.deleteAccount() {
        case .success:
            dismiss()
        case .failure(let error):
            deleteAccountError = error.errorDescription ?? L("error.unknown")
        }
    }
}

// MARK: - About View

/// About view with app information
struct AboutView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
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
                Text(L("about.app.name"))
                    .font(.title2)
                    .fontWeight(.bold)

                // Version
                Text(String(format: L("about.app.version"), Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                // Description
                Text(L("about.app.description"))
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()

                Spacer()
            }
            .padding()
            .accessibilityIdentifier(ProfileAccessibilityIdentifiers.aboutSheet)
            .navigationTitle(L("settings.about"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("action.done")) {
                        dismiss()
                    }
                    .accessibilityIdentifier(ProfileAccessibilityIdentifiers.aboutDoneButton)
                }
            }
        }
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
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
            title: "settings.appearance".localized,
            description: "settings.theme.dark".localized,
            color: .purple
        )

        Divider()

        SettingsRow(
            icon: "bell.fill",
            title: "settings.notifications".localized,
            description: "Enabled",
            color: .red
        )
    }
    .background(Color.tertiaryBackground.opacity(0.1))
}
