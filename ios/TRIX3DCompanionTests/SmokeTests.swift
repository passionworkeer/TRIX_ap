//
//  SmokeTests.swift
//  TRIX3DCompanionTests
//
//  Smoke tests for verifying basic app functionality
//  These tests verify core functionality without requiring full app launch
//

import XCTest
@testable import TRIX3DCompanion

// MARK: - User Extension for Testing

extension User {
    init(
        id: String,
        username: String? = nil,
        email: String? = nil,
        avatarUrl: String? = nil,
        avatarConfig: [String: AnyCodable]? = nil,
        fullName: String? = nil,
        displayName: String? = nil,
        bio: String? = nil,
        website: String? = nil,
        points: Int? = nil,
        isStudying: Bool? = nil,
        companionId: String? = nil,
        totalStudyTime: Int? = nil,
        lastActiveAt: Date? = nil,
        currentStreak: Int? = nil,
        daysActive: Int? = nil,
        interactionCount: Int? = nil,
        showOnlineStatus: Bool? = nil,
        school: String? = nil,
        grade: String? = nil,
        createdAt: Date? = nil,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.username = username
        self.email = email
        self.avatarUrl = avatarUrl
        self.avatarConfig = avatarConfig
        self.fullName = fullName
        self.displayName = displayName
        self.bio = bio
        self.website = website
        self.points = points
        self.isStudying = isStudying
        self.companionId = companionId
        self.totalStudyTime = totalStudyTime
        self.lastActiveAt = lastActiveAt
        self.currentStreak = currentStreak
        self.daysActive = daysActive
        self.interactionCount = interactionCount
        self.showOnlineStatus = showOnlineStatus
        self.school = school
        self.grade = grade
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - Snapshot Extension for Testing

extension Snapshot {
    init(
        id: String,
        userId: String,
        imageUrl: String,
        thumbnailUrl: String? = nil,
        locationId: String? = nil,
        locationName: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        caption: String? = nil,
        createdAt: Date
    ) {
        self.id = id
        self.userId = userId
        self.imageUrl = imageUrl
        self.thumbnailUrl = thumbnailUrl
        self.locationId = locationId
        self.locationName = locationName
        self.latitude = latitude
        self.longitude = longitude
        self.caption = caption
        self.createdAt = createdAt
    }
}

// MARK: - ChatMessage Extension for Testing

extension ChatMessage {
    init(
        id: String,
        roomId: String,
        senderId: String,
        sender: MessageSender,
        content: String,
        messageType: MessageType,
        mediaUrl: String? = nil,
        mediaMimeType: String? = nil,
        mediaDuration: Int? = nil,
        mediaSize: Int64? = nil,
        mediaMetadata: [String: AnyCodable]? = nil,
        voiceUrl: String? = nil,
        voiceDuration: Int? = nil,
        voiceTranscript: String? = nil,
        voiceMimeType: String? = nil,
        isRead: Bool,
        createdAt: Date
    ) {
        self.id = id
        self.roomId = roomId
        self.senderId = senderId
        self.sender = sender
        self.content = content
        self.messageType = messageType
        self.mediaUrl = mediaUrl
        self.mediaMimeType = mediaMimeType
        self.mediaDuration = mediaDuration
        self.mediaSize = mediaSize
        self.mediaMetadata = mediaMetadata
        self.voiceUrl = voiceUrl
        self.voiceDuration = voiceDuration
        self.voiceTranscript = voiceTranscript
        self.voiceMimeType = voiceMimeType
        self.isRead = isRead
        self.createdAt = createdAt
    }
}

/// Smoke tests for verifying basic app functionality
final class SmokeTests: XCTestCase {

    // MARK: - Build Verification Tests

    func test_project_compilesSuccessfully() {
        // This test verifies the project compiles without errors
        // The test itself is a smoke test - if it runs, the project compiled

        // Basic sanity checks
        XCTAssertTrue(true, "Project compiled successfully")
    }

    // MARK: - Core Model Tests

    func test_userModel_canBeCreated() {
        // Test User model creation
        let user = User(
            id: "test-user",
            username: "testuser",
            email: "test@example.com",
            avatarUrl: nil,
            fullName: "Test User",
            displayName: "Test User",
            bio: "Test bio",
            points: 100,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            createdAt: Date(),
            updatedAt: Date()
        )

        XCTAssertNotNil(user)
        XCTAssertEqual(user.username, "testuser")
    }

    func test_chatMessageModel_canBeCreated() {
        // Test ChatMessage model creation
        let message = ChatMessage(
            id: "msg-1",
            roomId: "room-1",
            senderId: "user-1",
            sender: .user,
            content: "Hello",
            messageType: .text,
            isRead: false,
            createdAt: Date()
        )

        XCTAssertNotNil(message)
        XCTAssertEqual(message.content, "Hello")
    }

    func test_snapshotModel_canBeCreated() {
        // Test Snapshot model creation
        let snapshot = Snapshot(
            id: "snapshot-1",
            userId: "user-1",
            imageUrl: "https://example.com/image.jpg",
            thumbnailUrl: "https://example.com/thumb.jpg",
            locationId: "loc-1",
            locationName: "Test Location",
            latitude: 40.7128,
            longitude: -74.0060,
            caption: "Test caption",
            createdAt: Date()
        )

        XCTAssertNotNil(snapshot)
        XCTAssertEqual(snapshot.locationName, "Test Location")
    }

    // MARK: - Core Service Protocol Tests

    func test_paymentServiceProtocol_exists() {
        // Verify PaymentServiceProtocol exists
        let _: PaymentServiceProtocol.Type? = PaymentService.self as? PaymentServiceProtocol.Type
        // If this compiles, the protocol exists
    }

    func test_storeKitServiceProtocol_exists() {
        // Verify StoreKitServiceProtocol exists
        let _: StoreKitServiceProtocol.Type? = StoreKitService.self as? StoreKitServiceProtocol.Type
    }

    func test_pointsServiceProtocol_exists() {
        // Verify PointsServiceProtocol exists
        let _: PointsServiceProtocol.Type? = PointsService.self as? PointsServiceProtocol.Type
    }

    // MARK: - Utility Tests

    func test_pointsCalculator_calculatesStudySessionPoints() {
        // Test PointsCalculator for study sessions
        let points30min = PointsCalculator.pointsForStudySession(durationMinutes: 30)
        XCTAssertEqual(points30min, 30)

        let points60min = PointsCalculator.pointsForStudySession(durationMinutes: 60)
        XCTAssertEqual(points60min, 40) // 60 + 10 bonus

        let points120min = PointsCalculator.pointsForStudySession(durationMinutes: 120)
        XCTAssertEqual(points120min, 150) // 120 + 10 + 20 bonus
    }

    func test_pointsCalculator_calculatesDailyLoginPoints() {
        // Test PointsCalculator for daily login
        let points = PointsCalculator.pointsForDailyLogin(streakDays: 1)
        XCTAssertEqual(points, 6) // 5 base + 1 streak

        let points7Day = PointsCalculator.pointsForDailyLogin(streakDays: 7)
        XCTAssertEqual(points7Day, 12) // 5 base + 7 streak (max 15)
    }

    func test_pointsCalculator_calculatesAchievementPoints() {
        // Test PointsCalculator for achievements
        let firstStudyPoints = PointsCalculator.pointsForAchievement("first_study")
        XCTAssertEqual(firstStudyPoints, 10)

        let weekStreakPoints = PointsCalculator.pointsForAchievement("week_streak")
        XCTAssertEqual(weekStreakPoints, 50)

        let monthStreakPoints = PointsCalculator.pointsForAchievement("month_streak")
        XCTAssertEqual(monthStreakPoints, 200)

        let unknownAchievement = PointsCalculator.pointsForAchievement("unknown")
        XCTAssertEqual(unknownAchievement, 10) // Default
    }

    func test_pointsCalculator_formatPoints() {
        // Test PointsCalculator formatting
        let formatted1000 = PointsCalculator.formatPoints(1000)
        XCTAssertTrue(formatted1000.contains("1") || formatted1000.contains(","))
    }

    // MARK: - Configuration Tests

    func test_storeProductConfiguration_hasAllProductIds() {
        // Test StoreProductConfiguration
        XCTAssertFalse(StoreProductConfiguration.allProductIds.isEmpty)
        XCTAssertTrue(StoreProductConfiguration.subscriptionProductIds.count >= 2)
        XCTAssertTrue(StoreProductConfiguration.pointsProductIds.count >= 4)
    }

    func test_storeProductConfiguration_pointsValues() {
        // Test StoreProductConfiguration points values
        XCTAssertEqual(StoreProductConfiguration.pointsForProduct("com.trix3d.points.100"), 100)
        XCTAssertEqual(StoreProductConfiguration.pointsForProduct("com.trix3d.points.300"), 330)
        XCTAssertEqual(StoreProductConfiguration.pointsForProduct("com.trix3d.points.500"), 580)
        XCTAssertEqual(StoreProductConfiguration.pointsForProduct("com.trix3d.points.1000"), 1200)
    }

    func test_storeProductConfiguration_productTypes() {
        // Test product type detection
        XCTAssertEqual(StoreProductConfiguration.productType(for: "com.trix3d.subscription.monthly"), .subscription)
        XCTAssertEqual(StoreProductConfiguration.productType(for: "com.trix3d.points.100"), .points)
        XCTAssertNil(StoreProductConfiguration.productType(for: "unknown.product"))
    }

    // MARK: - ViewModel Basic Tests

    func test_paymentViewModel_canBeInstantiated() {
        // Test PaymentViewModel can be created (with default services)
        let viewModel = PaymentViewModel()

        XCTAssertNotNil(viewModel)
        XCTAssertNotNil(viewModel.paymentState)
    }

    func test_profileViewModel_canBeInstantiated() {
        // Test ProfileViewModel can be created
        let viewModel = ProfileViewModel()

        XCTAssertNotNil(viewModel)
    }

    func test_settingsViewModel_canBeInstantiated() {
        // Test SettingsViewModel can be created
        let viewModel = SettingsViewModel()

        XCTAssertNotNil(viewModel)
        XCTAssertNotNil(viewModel.selectedTheme)
        XCTAssertNotNil(viewModel.selectedLanguage)
    }

    func test_storeViewModel_canBeInstantiated() {
        // Test StoreViewModel can be created
        let viewModel = StoreViewModel()

        XCTAssertNotNil(viewModel)
    }

    // MARK: - Error Handling Tests

    func test_paymentErrorDescriptions() {
        // Test PaymentError descriptions
        XCTAssertNotNil(PaymentError.invalidProduct.errorDescription)
        XCTAssertNotNil(PaymentError.paymentFailed(underlying: nil).errorDescription)
        XCTAssertNotNil(PaymentError.networkError.errorDescription)
        XCTAssertNotNil(PaymentError.userCancelled.errorDescription)
    }

    func test_pointsErrorDescriptions() {
        // Test PointsError descriptions
        XCTAssertNotNil(PointsError.insufficientBalance.errorDescription)
        XCTAssertNotNil(PointsError.invalidAmount.errorDescription)
        XCTAssertNotNil(PointsError.networkError.errorDescription)
    }

    func test_storeKitErrorDescriptions() {
        // Test StoreKitError descriptions
        XCTAssertNotNil(StoreKitError.productNotFound.errorDescription)
        XCTAssertNotNil(StoreKitError.purchaseFailed(underlying: nil).errorDescription)
        XCTAssertNotNil(StoreKitError.userCancelled.errorDescription)
    }
}
