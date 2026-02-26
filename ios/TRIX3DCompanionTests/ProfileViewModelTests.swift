//
//  ProfileViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for ProfileViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for ProfileViewModel
final class ProfileViewModelTests: XCTestCase {

    // MARK: - Properties

    var profileViewModel: ProfileViewModel!
    var mockAPIClient: MockProfileAPIClient!
    var mockImageUploadService: MockImageUploadService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockAPIClient = MockProfileAPIClient()
        mockImageUploadService = MockImageUploadService()

        profileViewModel = ProfileViewModel(
            apiClient: mockAPIClient as! APIClient,
            imageUploadService: mockImageUploadService as! ImageUploadService
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        profileViewModel = nil
        mockAPIClient = nil
        mockImageUploadService = nil
        cancellables = nil
    }

    // MARK: - Load Profile Tests

    func test_loadProfile_success() async throws {
        // Arrange
        let expectedUser = createMockUser()
        mockAPIClient.mockUserProfile = expectedUser

        // Act
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertNotNil(profileViewModel.user)
        XCTAssertEqual(profileViewModel.user?.id, expectedUser.id)
        XCTAssertFalse(profileViewModel.isLoading)
    }

    func test_loadProfile_loadsStatsAndPoints() async throws {
        // Act
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertNotNil(profileViewModel.userStats)
        XCTAssertNotNil(profileViewModel.points)
    }

    func test_loadProfile_setsLoadingState() async throws {
        // Arrange
        var loadingStates: [Bool] = []
        profileViewModel.$isLoading
            .sink { isLoading in
                loadingStates.append(isLoading)
            }
            .store(in: &cancellables)

        // Act
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertTrue(loadingStates.contains(true))
        XCTAssertFalse(profileViewModel.isLoading)
    }

    func test_loadProfile_error_setsErrorMessage() async throws {
        // Arrange
        mockAPIClient.shouldThrowError = true

        // Act
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertNil(profileViewModel.user)
        XCTAssertNotNil(profileViewModel.errorMessage)
        XCTAssertFalse(profileViewModel.isLoading)
    }

    // MARK: - Update Profile Tests

    func test_updateProfile_success() async throws {
        // Arrange
        await profileViewModel.loadProfile()
        let update = ProfileUpdate(
            username: "newusername",
            fullName: "New Name",
            displayName: "New Display Name",
            bio: "New bio"
        )

        // Act
        await profileViewModel.updateProfile(update)

        // Assert
        XCTAssertEqual(profileViewModel.user?.username, "newusername")
        XCTAssertEqual(profileViewModel.successMessage, "Profile updated successfully")
        XCTAssertFalse(profileViewModel.isLoading)
    }

    func test_updateProfile_error_setsErrorMessage() async throws {
        // Arrange
        await profileViewModel.loadProfile()
        mockAPIClient.shouldThrowError = true
        let update = ProfileUpdate(
            username: "newusername",
            fullName: nil,
            displayName: nil,
            bio: nil
        )

        // Act
        await profileViewModel.updateProfile(update)

        // Assert
        XCTAssertNotNil(profileViewModel.errorMessage)
        XCTAssertFalse(profileViewModel.isLoading)
    }

    // MARK: - Update Username Tests

    func test_updateUsername_success() async throws {
        // Arrange
        await profileViewModel.loadProfile()

        // Act
        await profileViewModel.updateUsername("newusername")

        // Assert
        XCTAssertEqual(profileViewModel.user?.username, "newusername")
        XCTAssertNotNil(profileViewModel.successMessage)
    }

    // MARK: - Update Display Name Tests

    func test_updateDisplayName_success() async throws {
        // Arrange
        await profileViewModel.loadProfile()

        // Act
        await profileViewModel.updateDisplayName("New Display Name")

        // Assert
        XCTAssertEqual(profileViewModel.user?.displayName, "New Display Name")
        XCTAssertNotNil(profileViewModel.successMessage)
    }

    // MARK: - Update Bio Tests

    func test_updateBio_success() async throws {
        // Arrange
        await profileViewModel.loadProfile()

        // Act
        await profileViewModel.updateBio("New bio text")

        // Assert
        XCTAssertEqual(profileViewModel.user?.bio, "New bio text")
        XCTAssertNotNil(profileViewModel.successMessage)
    }

    // MARK: - Update Avatar Tests

    func test_updateAvatar_success() async throws {
        // Arrange
        await profileViewModel.loadProfile()
        let testImage = mockImageUploadService.createTestImage()
        guard let imageData = testImage.pngData() else {
            XCTFail("Failed to create image data")
            return
        }
        mockImageUploadService.setMockUploadSuccess(url: "https://example.com/avatar.jpg")

        // Act
        await profileViewModel.updateAvatar(imageData)

        // Assert
        XCTAssertNotNil(profileViewModel.successMessage)
        XCTAssertEqual(mockImageUploadService.uploadImageCallCount, 1)
    }

    func test_updateAvatar_uploadError_setsErrorMessage() async throws {
        // Arrange
        await profileViewModel.loadProfile()
        let testImage = mockImageUploadService.createTestImage()
        guard let imageData = testImage.pngData() else {
            XCTFail("Failed to create image data")
            return
        }
        mockImageUploadService.setMockUploadFailure(.networkError(NSError(domain: "test", code: 0)))

        // Act
        await profileViewModel.updateAvatar(imageData)

        // Assert
        XCTAssertNotNil(profileViewModel.errorMessage)
    }

    // MARK: - Refresh Tests

    func test_refresh_reloadsProfile() async throws {
        // Arrange
        await profileViewModel.loadProfile()
        let initialUser = profileViewModel.user

        // Act
        await profileViewModel.refresh()

        // Assert
        XCTAssertNotNil(profileViewModel.user)
    }

    // MARK: - Clear Messages Tests

    func test_clearMessages_clearsMessages() {
        // Arrange
        profileViewModel.errorMessage = "Error"
        profileViewModel.successMessage = "Success"

        // Act
        profileViewModel.clearMessages()

        // Assert
        XCTAssertNil(profileViewModel.errorMessage)
        XCTAssertNil(profileViewModel.successMessage)
    }

    // MARK: - Computed Properties Tests

    func test_displayName_returnsCorrectValue() async throws {
        // Arrange
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertEqual(profileViewModel.displayName, profileViewModel.user?.displayName)
    }

    func test_displayName_fallsBackToUsername() async throws {
        // Arrange
        let user = User(
            id: "1",
            username: "testuser",
            email: "test@example.com",
            avatarUrl: nil,
            fullName: nil,
            displayName: nil,
            bio: nil,
            points: 0,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            createdAt: Date(),
            updatedAt: Date()
        )
        mockAPIClient.mockUserProfile = user
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertEqual(profileViewModel.displayName, "testuser")
    }

    func test_displayName_fallsBackToUser() async throws {
        // Arrange
        mockAPIClient.mockUserProfile = nil

        // Assert
        XCTAssertEqual(profileViewModel.displayName, "User")
    }

    func test_email_returnsCorrectValue() async throws {
        // Arrange
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertEqual(profileViewModel.email, profileViewModel.user?.email)
    }

    func test_bio_returnsCorrectValue() async throws {
        // Arrange
        let user = createMockUser(bio: "Test bio")
        mockAPIClient.mockUserProfile = user
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertEqual(profileViewModel.bio, "Test bio")
    }

    func test_totalPoints_returnsCorrectValue() async throws {
        // Arrange
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertGreaterThan(profileViewModel.totalPoints, 0)
    }

    func test_level_returnsCorrectValue() async throws {
        // Arrange
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertGreaterThan(profileViewModel.level, 0)
    }

    func test_todayEarned_returnsCorrectValue() async throws {
        // Arrange
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertGreaterThanOrEqual(profileViewModel.todayEarned, 0)
    }

    func test_weekEarned_returnsCorrectValue() async throws {
        // Arrange
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertGreaterThanOrEqual(profileViewModel.weekEarned, 0)
    }

    func test_totalStudyTime_returnsCorrectValue() async throws {
        // Arrange
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertGreaterThanOrEqual(profileViewModel.totalStudyTime, 0)
    }

    func test_formattedStudyTime_formatsCorrectly() async throws {
        // Arrange
        let user = createMockUser(totalStudyTime: 90) // 1h 30m
        mockAPIClient.mockUserProfile = user
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertTrue(profileViewModel.formattedStudyTime.contains("h"))
    }

    func test_formattedStudyTime_minutesOnly() async throws {
        // Arrange
        let user = createMockUser(totalStudyTime: 45) // 45m
        mockAPIClient.mockUserProfile = user
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertTrue(profileViewModel.formattedStudyTime.contains("m"))
    }

    func test_isStudying_returnsCorrectValue() async throws {
        // Arrange
        let user = createMockUser(isStudying: true)
        mockAPIClient.mockUserProfile = user
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertTrue(profileViewModel.isStudying)
    }

    func test_avatarURL_returnsCorrectValue() async throws {
        // Arrange
        let user = createMockUser(avatarUrl: "https://example.com/avatar.jpg")
        mockAPIClient.mockUserProfile = user
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertNotNil(profileViewModel.avatarURL)
    }

    func test_avatarURL_nilWhenNoAvatar() async throws {
        // Arrange
        let user = createMockUser(avatarUrl: nil)
        mockAPIClient.mockUserProfile = user
        await profileViewModel.loadProfile()

        // Assert
        XCTAssertNil(profileViewModel.avatarURL)
    }

    // MARK: - Helper Methods

    private func createMockUser(
        id: String = "user-1",
        username: String = "testuser",
        displayName: String = "Test User",
        bio: String? = nil,
        avatarUrl: String? = nil,
        isStudying: Bool = false,
        totalStudyTime: Int = 100
    ) -> User {
        User(
            id: id,
            username: username,
            email: "test@example.com",
            avatarUrl: avatarUrl,
            fullName: "Test User",
            displayName: displayName,
            bio: bio,
            points: 1000,
            isStudying: isStudying,
            companionId: nil,
            totalStudyTime: totalStudyTime,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

// MARK: - Mock Profile APIClient

/// Mock APIClient for ProfileViewModel testing
class MockProfileAPIClient {
    var mockUserProfile: User?
    var mockUserStats: UserStats?
    var mockPoints: PointsResponse?
    var shouldThrowError: Bool = false

    init() {
        mockUserStats = UserStats(
            totalStudyTime: 100,
            sessionCount: 10,
            averageDuration: 10,
            streakDays: 5,
            todayDuration: 30,
            weekDuration: 120
        )

        mockPoints = PointsResponse(
            totalPoints: 1000,
            level: 1,
            todayEarned: 50,
            weekEarned: 200,
            totalTransactions: 10
        )
    }

    func getUserProfile() async throws -> User {
        if shouldThrowError {
            throw NetworkError.serverError(message: "Test error")
        }
        return mockUserProfile ?? User(
            id: "user-1",
            username: "testuser",
            email: "test@example.com",
            avatarUrl: nil,
            fullName: "Test User",
            displayName: "Test User",
            bio: nil,
            points: 1000,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    func getUserStats() async throws -> UserStats {
        if shouldThrowError {
            throw NetworkError.serverError(message: "Test error")
        }
        return mockUserStats!
    }

    func getPoints() async throws -> PointsResponse {
        if shouldThrowError {
            throw NetworkError.serverError(message: "Test error")
        }
        return mockPoints!
    }

    func updateUserProfile(_ update: ProfileUpdate) async throws -> User {
        if shouldThrowError {
            throw NetworkError.serverError(message: "Test error")
        }

        let existingUser = mockUserProfile ?? User(
            id: "user-1",
            username: "testuser",
            email: "test@example.com",
            avatarUrl: nil,
            fullName: "Test User",
            displayName: "Test User",
            bio: nil,
            points: 1000,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 100,
            createdAt: Date(),
            updatedAt: Date()
        )

        return User(
            id: existingUser.id,
            username: update.username ?? existingUser.username,
            email: existingUser.email,
            avatarUrl: update.avatarUrl ?? existingUser.avatarUrl,
            fullName: update.fullName ?? existingUser.fullName,
            displayName: update.displayName ?? existingUser.displayName,
            bio: update.bio ?? existingUser.bio,
            points: existingUser.points,
            isStudying: existingUser.isStudying,
            companionId: existingUser.companionId,
            totalStudyTime: existingUser.totalStudyTime,
            createdAt: existingUser.createdAt,
            updatedAt: Date()
        )
    }
}

// MARK: - ProfileUpdate Model

struct ProfileUpdate: Codable {
    let username: String?
    let fullName: String?
    let displayName: String?
    let bio: String?
    let avatarUrl: String?
}
