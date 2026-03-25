//
//  ProfileViewModel.swift
//  TRIX3DCompanion
//
//  Profile feature ViewModel - manages user profile state and updates
//

import Foundation
import Combine
import UIKit

// MARK: - Profile View Model

/// Profile view model managing user profile data and updates
@MainActor
final class ProfileViewModel: ObservableObject {

    // MARK: - Published Properties

    /// User profile data
    @Published var user: User?

    /// User statistics
    @Published var userStats: UserStats?

    /// Points balance
    @Published var points: PointsResponse?

    /// Whether currently loading
    @Published private(set) var isLoading: Bool = false

    /// Error message to display
    @Published var errorMessage: String?

    /// Success message to display
    @Published var successMessage: String?

    /// Whether showing edit profile sheet
    @Published var showEditProfile: Bool = false

    /// Whether showing avatar picker
    @Published var showAvatarPicker: Bool = false

    // MARK: - Dependencies

    private let apiClient: APIClientProtocol
    private let imageUploadService: ImageUploadServiceProtocol
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize ProfileViewModel
    /// - Parameters:
    ///   - apiClient: API client dependency
    ///   - imageUploadService: Image upload service dependency
    init(
        apiClient: APIClientProtocol? = nil,
        imageUploadService: ImageUploadServiceProtocol? = nil
    ) {
        self.apiClient = apiClient ?? APIClient.shared
        self.imageUploadService = imageUploadService ?? ImageUploadService.shared
    }

    // MARK: - Public Methods

    /// Load user profile data
    func loadProfile() async {
        isLoading = true
        errorMessage = nil

        do {
            // Fetch profile and stats in parallel
            async let userProfile = apiClient.getUserProfile()
            async let stats = apiClient.getUserStats()
            async let pointsData = apiClient.getPoints()

            let (profile, userStatsData, pointsResult) = try await (userProfile, stats, pointsData)

            user = profile
            userStats = userStatsData
            points = pointsResult

        } catch {
            handleError(error)
        }

        isLoading = false
    }

    /// Update user profile
    /// - Parameter update: Profile update data
    func updateProfile(_ update: ProfileUpdate) async {
        isLoading = true
        errorMessage = nil
        successMessage = nil

        do {
            let updatedUser = try await apiClient.updateUserProfile(update)
            user = updatedUser
            successMessage = "Profile updated successfully"
        } catch {
            handleError(error)
        }

        isLoading = false
    }

    /// Update username
    /// - Parameter username: New username
    func updateUsername(_ username: String) async {
        let update = ProfileUpdate(
            username: username,
            fullName: user?.fullName,
            displayName: user?.displayName,
            bio: user?.bio,
            school: user?.school,
            grade: user?.grade,
            avatarUrl: nil
        )
        await updateProfile(update)
    }

    /// Update display name
    /// - Parameter displayName: New display name
    func updateDisplayName(_ displayName: String) async {
        let update = ProfileUpdate(
            username: user?.username,
            fullName: user?.fullName,
            displayName: displayName,
            bio: user?.bio,
            school: user?.school,
            grade: user?.grade,
            avatarUrl: nil
        )
        await updateProfile(update)
    }

    /// Update bio
    /// - Parameter bio: New bio
    func updateBio(_ bio: String) async {
        let update = ProfileUpdate(
            username: user?.username,
            fullName: user?.fullName,
            displayName: user?.displayName,
            bio: bio,
            school: user?.school,
            grade: user?.grade,
            avatarUrl: nil
        )
        await updateProfile(update)
    }

    /// Update avatar
    /// - Parameter imageData: New avatar image data
    func updateAvatar(_ imageData: Data) async {
        isLoading = true
        errorMessage = nil
        successMessage = nil

        do {
            // Convert Data to UIImage
            guard let image = UIImage(data: imageData) else {
                errorMessage = "Invalid image data"
                isLoading = false
                return
            }

            let uploadResponse = await imageUploadService.uploadImage(image, quality: nil)

            // Extract URL from Result
            let avatarUrl: String
            switch uploadResponse {
            case .success(let url):
                avatarUrl = url
            case .failure(let error):
                errorMessage = "Upload failed: \(error.localizedDescription)"
                isLoading = false
                return
            }

            let update = ProfileUpdate(
                username: user?.username,
                fullName: user?.fullName,
                displayName: user?.displayName,
                bio: user?.bio,
                school: user?.school,
                grade: user?.grade,
                avatarUrl: avatarUrl
            )

            let updatedUser = try await apiClient.updateUserProfile(update)
            user = updatedUser
            successMessage = "Avatar updated successfully"
        } catch {
            handleError(error)
        }

        isLoading = false
    }

    /// Refresh profile data
    func refresh() async {
        await loadProfile()
    }

    /// Clear messages
    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }

    // MARK: - Computed Properties

    /// Display name for user
    var displayName: String {
        user?.displayName ?? user?.username ?? "User"
    }

    /// User email
    var email: String? {
        user?.email
    }

    /// User bio
    var bio: String? {
        user?.bio
    }

    /// Avatar URL
    var avatarURL: URL? {
        guard let urlString = user?.avatarUrl else { return nil }
        return URL(string: urlString)
    }

    /// Total points
    var totalPoints: Int {
        points?.totalPoints ?? user?.points ?? 0
    }

    /// User level
    var level: Int {
        points?.level ?? 1
    }

    /// Points earned today
    var todayEarned: Int {
        points?.todayEarned ?? 0
    }

    /// Points earned this week
    var weekEarned: Int {
        points?.weekEarned ?? 0
    }

    /// Total study time
    var totalStudyTime: Int {
        user?.totalStudyTime ?? 0
    }

    /// Formatted study time
    var formattedStudyTime: String {
        let hours = totalStudyTime / 60
        let minutes = totalStudyTime % 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }

    /// Whether user is currently studying
    var isStudying: Bool {
        user?.isStudying ?? false
    }

    // MARK: - Private Methods

    /// Handle error
    /// - Parameter error: Error to handle
    private func handleError(_ error: Error) {
        if let networkError = error as? NetworkError {
            errorMessage = networkError.errorDescription
        } else {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension ProfileViewModel {
    /// Create preview view model with sample data
    static var preview: ProfileViewModel {
        let vm = ProfileViewModel()
        vm.user = User(
            id: "1",
            username: "trix_student",
            email: "student@trix3d.com",
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: "Trix Student",
            displayName: "Trix Student",
            bio: "Learning 3D modeling and animation",
            website: nil,
            points: 2450,
            isStudying: true,
            companionId: "comp_001",
            totalStudyTime: 1230,
            lastActiveAt: nil,
            currentStreak: 5,
            daysActive: 30,
            interactionCount: 100,
            showOnlineStatus: true,
            school: "TRIX Academy",
            grade: "Grade 10",
            createdAt: Date(),
            updatedAt: Date()
        )
        vm.points = PointsResponse(
            totalPoints: 2450,
            level: 3,
            todayEarned: 150,
            weekEarned: 520,
            totalTransactions: 45
        )
        vm.userStats = UserStats(
            totalStudyTime: 1230,
            sessionCount: 42,
            averageDuration: 29,
            streakDays: 7,
            todayDuration: 120,
            weekDuration: 540
        )
        return vm
    }
}
#endif
