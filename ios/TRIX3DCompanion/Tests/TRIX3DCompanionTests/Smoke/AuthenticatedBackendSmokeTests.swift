import XCTest
@testable import TRIX3DCompanion

@MainActor
final class AuthenticatedBackendSmokeTests: LiveBackendSmokeTestCase {
    func testPointsAndProfileServicesMatchLiveBackend() async throws {
        let authenticatedUser = try await loginWithAuthService()
        let currentUser = try await APIClient.shared.getCurrentUser()
        let stats = try await APIClient.shared.getUserStats()

        XCTAssertEqual(currentUser.id, authenticatedUser.id)
        XCTAssertEqual(currentUser.email?.lowercased(), authenticatedUser.email?.lowercased())
        XCTAssertGreaterThanOrEqual(stats.totalStudyTime, 0)
        XCTAssertGreaterThanOrEqual(stats.sessionCount, 0)
        XCTAssertGreaterThanOrEqual(stats.streakDays, 0)

        let refreshResult = await PointsService.shared.refreshPoints()
        switch refreshResult {
        case .success(let balance):
            let pointsResponse = try await APIClient.shared.getPoints()
            XCTAssertEqual(balance.totalPoints, pointsResponse.totalPoints)
            XCTAssertEqual(balance.level, pointsResponse.level)
            XCTAssertGreaterThanOrEqual(pointsResponse.totalTransactions, 0)
        case .failure(let error):
            XCTFail("Points refresh failed: \(error.localizedDescription)")
        }
    }

    func testChatAndAchievementReadEndpointsRespond() async throws {
        _ = try await loginWithAuthService()

        let chatRoomsResult = await ChatService.shared.fetchChatRooms()
        switch chatRoomsResult {
        case .success(let rooms):
            XCTAssertGreaterThanOrEqual(rooms.count, 0)
        case .failure(let error):
            XCTFail("Chat room fetch failed: \(error.localizedDescription)")
        }

        let achievements = try await AchievementService.shared.fetchAchievements()
        XCTAssertGreaterThanOrEqual(achievements.count, 0)

        let studySessions = try await APIClient.shared.getStudySessions(page: 1, limit: 5)
        XCTAssertLessThanOrEqual(studySessions.count, 5)
    }

    func testDirectMessageRoundTrip() async throws {
        _ = try await loginWithAuthService()

        let messageContent = "Codex live smoke \(UUID().uuidString)"
        let friends = try await FriendService.shared.fetchFriends()
        guard let friend = friends.first else {
            throw XCTSkip("Missing live friend relationship for direct-message smoke test")
        }

        let sendResult = await ChatService.shared.sendMessage(
            roomId: friend.friendId,
            content: messageContent,
            type: .text,
            mediaUrl: nil,
            mediaMimeType: nil
        )

        let sentMessage: ChatMessage
        switch sendResult {
        case .success(let message):
            sentMessage = message
        case .failure(let error):
            XCTFail("Direct message send failed: \(error.localizedDescription)")
            throw error
        }

        XCTAssertEqual(sentMessage.roomId, friend.friendId)
        XCTAssertEqual(sentMessage.content, messageContent)

        try await poll(timeout: 15) {
            let messages = try await APIClient.shared.getChatMessages(
                roomId: friend.friendId,
                page: 1,
                limit: 20
            )
            return messages.contains(where: { $0.id == sentMessage.id || $0.content == messageContent })
        }
    }
}
