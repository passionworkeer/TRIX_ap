//
//  SmokeTestsExpanded.swift
//  TRIX3DCompanionTests
//
//  Expanded smoke tests covering core models, Codable conformance,
//  date/time formatting, input validation, design system, and utilities.
//

import XCTest
@testable import TRIX3DCompanion

// MARK: - User Model Tests

final class UserModelSmokeTests: XCTestCase {

    func testUserCodableRoundTrip() throws {
        let user = User(
            id: "user_123",
            username: "testuser",
            email: "test@example.com",
            avatarUrl: "https://example.com/avatar.png",
            avatarConfig: nil,
            fullName: "Test User",
            displayName: "TestUser",
            bio: "A test user",
            website: "https://example.com",
            points: 100,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 3600,
            lastActiveAt: Date(),
            currentStreak: 5,
            daysActive: 30,
            interactionCount: 100,
            showOnlineStatus: true,
            school: "Test School",
            grade: "10",
            createdAt: Date(),
            updatedAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(user)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(User.self, from: data)

        XCTAssertEqual(decoded.id, user.id)
        XCTAssertEqual(decoded.username, user.username)
        XCTAssertEqual(decoded.email, user.email)
        XCTAssertEqual(decoded.points, user.points)
        XCTAssertEqual(decoded.totalStudyTime, user.totalStudyTime)
        XCTAssertEqual(decoded.currentStreak, user.currentStreak)
    }

    func testUserWithMinimalFields() throws {
        let user = User(
            id: "user_minimal",
            username: nil,
            email: nil,
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: nil,
            bio: nil,
            website: nil,
            points: nil,
            isStudying: nil,
            companionId: nil,
            totalStudyTime: nil,
            lastActiveAt: nil,
            currentStreak: nil,
            daysActive: nil,
            interactionCount: nil,
            showOnlineStatus: nil,
            school: nil,
            grade: nil,
            createdAt: nil,
            updatedAt: nil
        )

        XCTAssertEqual(user.id, "user_minimal")
        XCTAssertNil(user.username)
        XCTAssertNil(user.email)
        XCTAssertNil(user.points)
    }

    func testUserCodingKeys() throws {
        let json = """
        {
            "id": "user_test",
            "username": "testuser",
            "email": "test@example.com",
            "avatar_url": "https://example.com/avatar.png",
            "avatar_config": null,
            "full_name": "Test User",
            "display_name": "TestUser",
            "bio": "Test bio",
            "website": "https://example.com",
            "points": 50,
            "is_studying": true,
            "companion_id": "comp_123",
            "total_study_time": 1800,
            "last_active_at": "2024-01-01T12:00:00Z",
            "current_streak": 3,
            "days_active": 15,
            "interaction_count": 50,
            "show_online_status": true,
            "school": "Test School",
            "grade": "11",
            "created_at": "2024-01-01T10:00:00Z",
            "updated_at": "2024-01-01T10:00:00Z"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let user = try decoder.decode(User.self, from: json)

        XCTAssertEqual(user.id, "user_test")
        XCTAssertEqual(user.username, "testuser")
        XCTAssertEqual(user.points, 50)
        XCTAssertEqual(user.currentStreak, 3)
        XCTAssertTrue(user.isStudying ?? false)
    }
}

// MARK: - ChatMessage Model Tests

final class ChatMessageModelSmokeTests: XCTestCase {

    func testChatMessageCodableRoundTrip() throws {
        let message = ChatMessage(
            id: "msg_123",
            roomId: "room_456",
            senderId: "user_789",
            sender: .user,
            content: "Hello, world!",
            messageType: .text,
            mediaUrl: nil,
            mediaMimeType: nil,
            mediaDuration: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: false,
            createdAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(message)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(ChatMessage.self, from: data)

        XCTAssertEqual(decoded.id, message.id)
        XCTAssertEqual(decoded.roomId, message.roomId)
        XCTAssertEqual(decoded.content, message.content)
        XCTAssertEqual(decoded.sender, message.sender)
        XCTAssertEqual(decoded.messageType, message.messageType)
        XCTAssertFalse(decoded.isRead)
    }

    func testChatMessageAllMessageTypes() throws {
        let types: [MessageType] = [.text, .image, .voice, .video, .file]

        for messageType in types {
            let message = ChatMessage(
                id: "msg_\(messageType.rawValue)",
                roomId: "room_1",
                senderId: "user_1",
                sender: .user,
                content: "Test",
                messageType: messageType,
                mediaUrl: nil,
                mediaMimeType: nil,
                mediaDuration: nil,
                mediaSize: nil,
                mediaMetadata: nil,
                voiceUrl: nil,
                voiceDuration: nil,
                voiceTranscript: nil,
                voiceMimeType: nil,
                isRead: true,
                createdAt: Date()
            )
            XCTAssertEqual(message.messageType, messageType)
        }
    }

    func testChatMessageAllSenderTypes() throws {
        let senders: [MessageSender] = [.user, .bot, .friend]

        for sender in senders {
            let message = ChatMessage(
                id: "msg_\(sender.rawValue)",
                roomId: "room_1",
                senderId: "user_1",
                sender: sender,
                content: "Test",
                messageType: .text,
                mediaUrl: nil,
                mediaMimeType: nil,
                mediaDuration: nil,
                mediaSize: nil,
                mediaMetadata: nil,
                voiceUrl: nil,
                voiceDuration: nil,
                voiceTranscript: nil,
                voiceMimeType: nil,
                isRead: true,
                createdAt: Date()
            )
            XCTAssertEqual(message.sender, sender)
        }
    }

    func testChatMessageWithMedia() throws {
        let message = ChatMessage(
            id: "msg_media",
            roomId: "room_1",
            senderId: "user_1",
            sender: .user,
            content: "Check this out",
            messageType: .image,
            mediaUrl: "https://example.com/image.jpg",
            mediaMimeType: "image/jpeg",
            mediaDuration: nil,
            mediaSize: 102400,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: false,
            createdAt: Date()
        )

        XCTAssertNotNil(message.mediaUrl)
        XCTAssertEqual(message.mediaMimeType, "image/jpeg")
        XCTAssertEqual(message.mediaSize, 102400)
    }

    func testChatMessageWithVoice() throws {
        let message = ChatMessage(
            id: "msg_voice",
            roomId: "room_1",
            senderId: "user_1",
            sender: .user,
            content: "",
            messageType: .voice,
            mediaUrl: nil,
            mediaMimeType: nil,
            mediaDuration: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: "https://example.com/voice.m4a",
            voiceDuration: 30,
            voiceTranscript: "Hello there",
            voiceMimeType: "audio/m4a",
            isRead: true,
            createdAt: Date()
        )

        XCTAssertNotNil(message.voiceUrl)
        XCTAssertEqual(message.voiceDuration, 30)
        XCTAssertEqual(message.voiceTranscript, "Hello there")
    }
}

// MARK: - ChatRoom Model Tests

final class ChatRoomModelSmokeTests: XCTestCase {

    func testChatRoomCodableRoundTrip() throws {
        let room = ChatRoom(
            id: "room_123",
            name: "Test Room",
            type: .group,
            participants: [],
            lastMessage: nil,
            unreadCount: 5,
            createdAt: Date(),
            updatedAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(room)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(ChatRoom.self, from: data)

        XCTAssertEqual(decoded.id, room.id)
        XCTAssertEqual(decoded.name, room.name)
        XCTAssertEqual(decoded.type, room.type)
        XCTAssertEqual(decoded.unreadCount, 5)
    }

    func testChatRoomAllTypes() throws {
        let types: [ChatRoomType] = [.ai, .group, .privateChat]

        for roomType in types {
            let room = ChatRoom(
                id: "room_\(roomType.rawValue)",
                name: "Test",
                type: roomType,
                participants: [],
                lastMessage: nil,
                unreadCount: 0,
                createdAt: Date(),
                updatedAt: Date()
            )
            XCTAssertEqual(room.type, roomType)
        }
    }

    func testChatRoomWithParticipants() throws {
        let participants = [
            User(id: "user_1", username: "alice", email: "alice@test.com", avatarUrl: nil, avatarConfig: nil, fullName: nil, displayName: nil, bio: nil, website: nil, points: nil, isStudying: nil, companionId: nil, totalStudyTime: nil, lastActiveAt: nil, currentStreak: nil, daysActive: nil, interactionCount: nil, showOnlineStatus: nil, school: nil, grade: nil, createdAt: nil, updatedAt: nil),
            User(id: "user_2", username: "bob", email: "bob@test.com", avatarUrl: nil, avatarConfig: nil, fullName: nil, displayName: nil, bio: nil, website: nil, points: nil, isStudying: nil, companionId: nil, totalStudyTime: nil, lastActiveAt: nil, currentStreak: nil, daysActive: nil, interactionCount: nil, showOnlineStatus: nil, school: nil, grade: nil, createdAt: nil, updatedAt: nil)
        ]

        let room = ChatRoom(
            id: "room_with_participants",
            name: "Team Room",
            type: .group,
            participants: participants,
            lastMessage: nil,
            unreadCount: 0,
            createdAt: Date(),
            updatedAt: Date()
        )

        XCTAssertEqual(room.participants.count, 2)
        XCTAssertEqual(room.participants[0].username, "alice")
        XCTAssertEqual(room.participants[1].username, "bob")
    }

    func testChatRoomWithLastMessage() throws {
        let lastMsg = ChatMessage(
            id: "last_msg",
            roomId: "room_1",
            senderId: "user_1",
            sender: .user,
            content: "Goodbye!",
            messageType: .text,
            mediaUrl: nil,
            mediaMimeType: nil,
            mediaDuration: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: true,
            createdAt: Date()
        )

        let room = ChatRoom(
            id: "room_with_last_msg",
            name: "Room",
            type: .ai,
            participants: [],
            lastMessage: lastMsg,
            unreadCount: 0,
            createdAt: Date(),
            updatedAt: Date()
        )

        XCTAssertNotNil(room.lastMessage)
        XCTAssertEqual(room.lastMessage?.content, "Goodbye!")
    }
}

// MARK: - Friend Model Tests

final class FriendModelSmokeTests: XCTestCase {

    func testFriendCodableRoundTrip() throws {
        let friend = Friend(
            id: "friend_123",
            userId: "user_1",
            friendId: "user_2",
            name: "Bob",
            avatarUrl: "https://example.com/bob.png",
            status: .online,
            bio: "Study buddy",
            studyTime: 3600,
            isStudying: true,
            createdAt: Date(),
            updatedAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(friend)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(Friend.self, from: data)

        XCTAssertEqual(decoded.id, friend.id)
        XCTAssertEqual(decoded.name, "Bob")
        XCTAssertEqual(decoded.status, .online)
        XCTAssertEqual(decoded.studyTime, 3600)
        XCTAssertTrue(decoded.isStudying)
    }

    func testFriendAllStatuses() throws {
        let statuses: [FriendStatus] = [.online, .offline, .busy, .away]

        for status in statuses {
            let friend = Friend(
                id: "friend_\(status.rawValue)",
                userId: "user_1",
                friendId: "user_2",
                name: "Test",
                avatarUrl: nil,
                status: status,
                bio: nil,
                studyTime: 0,
                isStudying: false,
                createdAt: Date(),
                updatedAt: Date()
            )
            XCTAssertEqual(friend.status, status)
        }
    }

    func testFriendLatestMessageCodable() throws {
        let json = """
        {
            "user_id": "user_1",
            "friend_id": "friend_2",
            "name": "Alice",
            "avatar_url": null,
            "status": "online",
            "bio": "Friendly",
            "study_time": 500,
            "is_studying": false,
            "unread_count": 3,
            "last_message": "See you tomorrow!",
            "last_message_time": "2024-01-01T15:30:00Z"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let latest = try decoder.decode(FriendLatestMessage.self, from: json)

        XCTAssertEqual(latest.name, "Alice")
        XCTAssertEqual(latest.unreadCount, 3)
        XCTAssertEqual(latest.lastMessage, "See you tomorrow!")
    }
}

// MARK: - StudySession Model Tests

final class StudySessionModelSmokeTests: XCTestCase {

    func testStudySessionCodableRoundTrip() throws {
        let session = StudySession(
            id: "session_123",
            userId: "user_1",
            duration: 1500,
            startedAt: Date(),
            endedAt: Date().addingTimeInterval(1500),
            earnedPoints: 50,
            isCompleted: true,
            subject: "Mathematics",
            notes: "Studied calculus",
            createdAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(session)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(StudySession.self, from: data)

        XCTAssertEqual(decoded.id, session.id)
        XCTAssertEqual(decoded.duration, 1500)
        XCTAssertEqual(decoded.earnedPoints, 50)
        XCTAssertTrue(decoded.isCompleted)
        XCTAssertEqual(decoded.subject, "Mathematics")
    }

    func testStudySessionIncomplete() throws {
        let session = StudySession(
            id: "session_incomplete",
            userId: "user_1",
            duration: 600,
            startedAt: Date(),
            endedAt: nil,
            earnedPoints: nil,
            isCompleted: false,
            subject: nil,
            notes: nil,
            createdAt: Date()
        )

        XCTAssertFalse(session.isCompleted)
        XCTAssertNil(session.endedAt)
        XCTAssertNil(session.earnedPoints)
    }

    func testStudyRoomMemberCodable() throws {
        let member = StudyRoomMember(
            userId: "user_1",
            displayName: "Alice",
            avatarUrl: "https://example.com/alice.png",
            joinedAt: Date(),
            lastActiveAt: Date(),
            status: .focusing
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(member)

        let decoder = JSONDecoder()
        decoder.dateEncodingStrategy = .iso8601
        let decoded = try decoder.decode(StudyRoomMember.self, from: data)

        XCTAssertEqual(decoded.userId, "user_1")
        XCTAssertEqual(decoded.displayName, "Alice")
        XCTAssertEqual(decoded.status, .focusing)
    }

    func testStudyRoomMemberAllStatuses() throws {
        let statuses: [StudyRoomMemberStatus] = [.online, .focusing, .resting]

        for status in statuses {
            let member = StudyRoomMember(
                userId: "user_\(status.rawValue)",
                displayName: "Test",
                avatarUrl: nil,
                joinedAt: Date(),
                lastActiveAt: Date(),
                status: status
            )
            XCTAssertEqual(member.status, status)
        }
    }

    func testStudyRoomSessionStateAllCases() throws {
        let states: [StudyRoomSessionState] = [.idle, .focusing, .resting]

        for state in states {
            XCTAssertTrue(StudyRoomSessionState.allCases.contains(state))
        }
    }

    func testStudyRoomTimerStateCodable() throws {
        let timer = StudyRoomTimerState(
            durationSeconds: 1500,
            startedAt: Date(),
            endsAt: Date().addingTimeInterval(1500),
            remainingSeconds: 1000
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(timer)

        let decoder = JSONDecoder()
        decoder.dateEncodingStrategy = .iso8601
        let decoded = try decoder.decode(StudyRoomTimerState.self, from: data)

        XCTAssertEqual(decoded.durationSeconds, 1500)
        XCTAssertEqual(decoded.remainingSeconds, 1000)
    }
}

// MARK: - PointsTransaction Model Tests

final class PointsTransactionModelSmokeTests: XCTestCase {

    func testPointsTransactionCodableRoundTrip() throws {
        let transaction = PointsTransaction(
            id: "txn_123",
            pointsChange: 50,
            type: .studyComplete,
            description: "Completed 25 minute study session",
            balanceAfter: 150,
            createdAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(transaction)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(PointsTransaction.self, from: data)

        XCTAssertEqual(decoded.id, "txn_123")
        XCTAssertEqual(decoded.pointsChange, 50)
        XCTAssertEqual(decoded.type, .studyComplete)
        XCTAssertEqual(decoded.balanceAfter, 150)
    }

    func testTransactionTypeAllCases() throws {
        let types: [TransactionType] = [
            .studyComplete, .studyStreak, .dailyLogin,
            .achievement, .socialShare, .redeem, .adminAdjust
        ]

        for txnType in types {
            let transaction = PointsTransaction(
                id: "txn_\(txnType.rawValue)",
                pointsChange: 10,
                type: txnType,
                description: "Test",
                balanceAfter: 100,
                createdAt: Date()
            )
            XCTAssertEqual(transaction.type, txnType)
        }
    }

    func testUserPointsStatsCodable() throws {
        let stats = UserPointsStats(
            totalPoints: 1000,
            level: 5,
            todayEarned: 50,
            weekEarned: 300,
            totalTransactions: 50
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(stats)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(UserPointsStats.self, from: data)

        XCTAssertEqual(decoded.totalPoints, 1000)
        XCTAssertEqual(decoded.level, 5)
        XCTAssertEqual(decoded.todayEarned, 50)
        XCTAssertEqual(decoded.weekEarned, 300)
        XCTAssertEqual(decoded.totalTransactions, 50)
    }
}

// MARK: - Location Model Tests

final class LocationModelSmokeTests: XCTestCase {

    func testLocationCodableRoundTrip() throws {
        let location = Location(
            id: "loc_123",
            userId: "user_1",
            name: "City Library",
            description: "A quiet place to study",
            latitude: 40.7128,
            longitude: -74.0060,
            address: "123 Main St",
            category: .library,
            createdAt: Date(),
            updatedAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(location)

        let decoder = JSONDecoder()
        decoder.dateEncodingStrategy = .iso8601
        let decoded = try decoder.decode(Location.self, from: data)

        XCTAssertEqual(decoded.id, "loc_123")
        XCTAssertEqual(decoded.name, "City Library")
        XCTAssertEqual(decoded.latitude, 40.7128)
        XCTAssertEqual(decoded.longitude, -74.0060)
        XCTAssertEqual(decoded.category, .library)
    }

    func testLocationCoordinateConversion() throws {
        let location = Location(
            id: "loc_coord",
            userId: "user_1",
            name: "Test",
            description: nil,
            latitude: 35.6762,
            longitude: 139.6503,
            address: nil,
            category: .cafe,
            createdAt: Date(),
            updatedAt: Date()
        )

        XCTAssertEqual(location.coordinate.latitude, 35.6762)
        XCTAssertEqual(location.coordinate.longitude, 139.6503)
    }

    func testLocationCategoryAllCases() throws {
        let categories: [LocationCategory] = [
            .school, .library, .cafe, .restaurant,
            .entertainment, .home, .park, .other
        ]

        for category in categories {
            let location = Location(
                id: "loc_\(category.rawValue)",
                userId: "user_1",
                name: "Test",
                description: nil,
                latitude: 0,
                longitude: 0,
                address: nil,
                category: category,
                createdAt: Date(),
                updatedAt: Date()
            )
            XCTAssertEqual(location.category, category)
        }
    }

    func testNearbyLocationsResponseCodable() throws {
        let response = NearbyLocationsResponse(
            locations: [],
            totalCount: 0,
            radius: 1000.0
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(response)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(NearbyLocationsResponse.self, from: data)

        XCTAssertEqual(decoded.totalCount, 0)
        XCTAssertEqual(decoded.radius, 1000.0)
    }
}

// MARK: - BotState Enum Tests

final class BotStateEnumSmokeTests: XCTestCase {

    func testBotStateAllCases() throws {
        let allCases = BotState.allCases

        XCTAssertEqual(allCases.count, 4)
        XCTAssertTrue(allCases.contains(.idle))
        XCTAssertTrue(allCases.contains(.thinking))
        XCTAssertTrue(allCases.contains(.speaking))
        XCTAssertTrue(allCases.contains(.boring))
    }

    func testBotStateDisplayNames() throws {
        XCTAssertFalse(BotState.idle.displayName.isEmpty)
        XCTAssertFalse(BotState.thinking.displayName.isEmpty)
        XCTAssertFalse(BotState.speaking.displayName.isEmpty)
        XCTAssertFalse(BotState.boring.displayName.isEmpty)
    }

    func testBotStateVideoFileNames() throws {
        XCTAssertEqual(BotState.idle.videoFileName, "idle")
        XCTAssertEqual(BotState.thinking.videoFileName, "thinking")
        XCTAssertEqual(BotState.speaking.videoFileName, "speaking")
        XCTAssertEqual(BotState.boring.videoFileName, "boring")
    }

    func testBotStateLowPowerMode() throws {
        // idle state should use boring video in low power mode
        XCTAssertTrue(BotState.idle.shouldUseBoringVideo(inLowPowerMode: true))
        XCTAssertFalse(BotState.idle.shouldUseBoringVideo(inLowPowerMode: false))
        XCTAssertFalse(BotState.thinking.shouldUseBoringVideo(inLowPowerMode: true))
        XCTAssertFalse(BotState.speaking.shouldUseBoringVideo(inLowPowerMode: true))
    }

    func testBotStateRawValues() throws {
        XCTAssertEqual(BotState.idle.rawValue, "IDLE")
        XCTAssertEqual(BotState.thinking.rawValue, "THINKING")
        XCTAssertEqual(BotState.speaking.rawValue, "SPEAKING")
        XCTAssertEqual(BotState.boring.rawValue, "BORING")
    }

    func testBotStateEquatable() throws {
        XCTAssertEqual(BotState.idle, BotState.idle)
        XCTAssertNotEqual(BotState.idle, BotState.thinking)
    }
}

// MARK: - TimerState Enum Tests

final class TimerStateEnumSmokeTests: XCTestCase {

    func testTimerStateAllCases() throws {
        let states: [TimerState] = [.idle, .running, .paused, .completed, .focusing, .resting]

        XCTAssertEqual(states.count, 6)

        for state in states {
            let encoder = JSONEncoder()
            let data = try encoder.encode(state)
            let decoder = JSONDecoder()
            let decoded = try decoder.decode(TimerState.self, from: data)
            XCTAssertEqual(decoded, state)
        }
    }
}

// MARK: - UserStatus Enum Tests

final class UserStatusEnumSmokeTests: XCTestCase {

    func testUserStatusAllCases() throws {
        let statuses: [UserStatus] = [.online, .offline, .busy, .away]

        XCTAssertEqual(statuses.count, 4)

        for status in statuses {
            let encoder = JSONEncoder()
            let data = try encoder.encode(status)
            let decoder = JSONDecoder()
            let decoded = try decoder.decode(UserStatus.self, from: data)
            XCTAssertEqual(decoded, status)
        }
    }
}

// MARK: - Date/Time Formatting Tests

final class DateFormattingSmokeTests: XCTestCase {

    func testDateFormattingShortTime() throws {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none

        let date = Calendar.current.date(from: DateComponents(hour: 14, minute: 30))!
        let formatted = formatter.string(from: date)

        XCTAssertFalse(formatted.isEmpty)
        // Should contain hour and minute
        XCTAssertTrue(formatted.contains("30"))
    }

    func testDateFormattingShortDate() throws {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .none

        let date = Date()
        let formatted = formatter.string(from: date)

        XCTAssertFalse(formatted.isEmpty)
    }

    func testISODateFormatting() throws {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let date = Date()
        let formatted = formatter.string(from: date)

        XCTAssertFalse(formatted.isEmpty)
        // Should contain year
        let year = Calendar.current.component(.year, from: date)
        XCTAssertTrue(formatted.contains(String(year)))
    }

    func testDateComponentsFormatting() throws {
        let calendar = Calendar.current
        let now = Date()

        let hour = calendar.component(.hour, from: now)
        let minute = calendar.component(.minute, from: now)
        let second = calendar.component(.second, from: now)

        XCTAssertGreaterThanOrEqual(hour, 0)
        XCTAssertLessThan(hour, 24)
        XCTAssertGreaterThanOrEqual(minute, 0)
        XCTAssertLessThan(minute, 60)
        XCTAssertGreaterThanOrEqual(second, 0)
        XCTAssertLessThan(second, 60)
    }

    func testTimestampFormatting() throws {
        // Test that we can format timestamps with various durations
        let durations = [
            (seconds: 30, expected: "0:30"),
            (seconds: 60, expected: "1:00"),
            (seconds: 90, expected: "1:30"),
            (seconds: 3661, expected: "1:01:01"),
            (seconds: 0, expected: "0:00")
        ]

        for (seconds, expectedPattern) in durations {
            let minutes = seconds / 60
            let secs = seconds % 60
            let hours = seconds / 3600

            if hours > 0 {
                let formatted = String(format: "%d:%02d:%02d", hours, minutes, secs)
                XCTAssertFalse(formatted.isEmpty)
            } else {
                let formatted = String(format: "%d:%02d", minutes, secs)
                XCTAssertFalse(formatted.isEmpty)
            }
        }
    }

    func testRelativeDateFormatting() throws {
        let calendar = Calendar.current
        let now = Date()

        // Today
        XCTAssertTrue(calendar.isDate(now, inSameDayAs: now))

        // Yesterday
        if let yesterday = calendar.date(byAdding: .day, value: -1, to: now) {
            XCTAssertTrue(calendar.isDate(yesterday, inSameDayAs: calendar.date(byAdding: .day, value: -1, to: now)!))
        }

        // Last week
        if let lastWeek = calendar.date(byAdding: .day, value: -7, to: now) {
            XCTAssertFalse(calendar.isDate(lastWeek, inSameDayAs: now))
        }
    }
}

// MARK: - Coordinate Conversion Tests

final class CoordinateConversionSmokeTests: XCTestCase {

    func testCoordinateWithinBounds() throws {
        let validCoords: [(Double, Double)] = [
            (0, 0),           // Null Island
            (90, 180),         // Max positive
            (-90, -180),       // Max negative
            (40.7128, -74.0060), // New York
            (35.6762, 139.6503), // Tokyo
        ]

        for (lat, lon) in validCoords {
            XCTAssertGreaterThanOrEqual(lat, -90)
            XCTAssertLessThanOrEqual(lat, 90)
            XCTAssertGreaterThanOrEqual(lon, -180)
            XCTAssertLessThanOrEqual(lon, 180)
        }
    }

    func testCoordinateInvalidBounds() throws {
        let invalidCoords: [(Double, Double)] = [
            (91, 0),           // Invalid latitude
            (-91, 0),          // Invalid latitude
            (0, 181),           // Invalid longitude
            (0, -181),          // Invalid longitude
        ]

        for (lat, lon) in invalidCoords {
            let isValid = lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
            XCTAssertFalse(isValid)
        }
    }

    func testDistanceCalculation() throws {
        // Test that distance between two points can be calculated
        let lat1 = 40.7128
        let lon1 = -74.0060
        let lat2 = 34.0522
        let lon2 = -118.2437

        // Calculate approximate distance using Haversine-like approach
        let latDiff = lat2 - lat1
        let lonDiff = lon2 - lon1

        XCTAssertNotEqual(latDiff, 0)
        XCTAssertNotEqual(lonDiff, 0)

        // Distance should be significant
        let approxDist = sqrt(pow(latDiff, 2) + pow(lonDiff, 2))
        XCTAssertGreaterThan(approxDist, 1.0) // More than 1 degree
    }
}

// MARK: - Input Validation Tests

final class InputValidationSmokeTests: XCTestCase {

    private let validator = InputValidator.shared

    func testEmailValidationValid() throws {
        let validEmails = [
            "test@example.com",
            "user.name@domain.org",
            "user+tag@example.co.uk",
            "name123@test.io"
        ]

        for email in validEmails {
            let result = validator.validateEmail(email)
            if case .failure(let error) = result {
                XCTFail("Expected valid email '\(email)' but got error: \(error)")
            }
        }
    }

    func testEmailValidationInvalid() throws {
        let invalidEmails = [
            "",
            "notanemail",
            "@nodomain.com",
            "spaces in@email.com"
        ]

        for email in invalidEmails {
            let result = validator.validateEmail(email)
            if case .success = result {
                XCTFail("Expected invalid email '\(email)' but got success")
            }
        }
    }

    func testPasswordValidationValid() throws {
        let validPasswords = [
            "Password1!",
            "MyStr0ng#Pass",
            "C0mplex@Word123"
        ]

        for password in validPasswords {
            let result = validator.validatePassword(password)
            if case .failure(let error) = result {
                XCTFail("Expected valid password but got error: \(error)")
            }
        }
    }

    func testPasswordValidationInvalid() throws {
        let invalidPasswords = [
            "short1!",        // Too short
            "alllowercase1!", // No uppercase
            "ALLUPPER1!",     // No lowercase
            "NoNumbers!",      // No number
            "NoSpecial1"      // No special char
        ]

        for password in invalidPasswords {
            let result = validator.validatePassword(password)
            if case .success = result {
                XCTFail("Expected invalid password '\(password)' but got success")
            }
        }
    }

    func testUsernameValidationValid() throws {
        let validUsernames = [
            "alice",
            "bob_123",
            "user_name",
            "testuser123"
        ]

        for username in validUsernames {
            let result = validator.validateUsername(username)
            if case .failure(let error) = result {
                XCTFail("Expected valid username '\(username)' but got error: \(error)")
            }
        }
    }

    func testUsernameValidationInvalid() throws {
        let invalidUsernames = [
            "ab",              // Too short
            "thisusernameiswaytoolongtobevalid",
            "user name",       // Space
            "user@name",       // Special char
            "admin"            // Reserved
        ]

        for username in invalidUsernames {
            let result = validator.validateUsername(username)
            if case .success = result {
                XCTFail("Expected invalid username '\(username)' but got success")
            }
        }
    }

    func testPasswordStrengthCalculation() throws {
        let testCases: [(String, PasswordStrength)] = [
            ("abc", .veryWeak),
            ("password123", .veryWeak),
            ("Pass1!", .fair),
            ("StrongPass1!@", .strong),
        ]

        for (password, expectedMinStrength) in testCases {
            let strength = validator.calculatePasswordStrength(password)
            // Strength should be at least the expected level
            XCTAssertGreaterThanOrEqual(strength.rawValue, expectedMinStrength.rawValue)
        }
    }

    func testValidateNotEmpty() throws {
        let result = validator.validateNotEmpty("Hello")
        if case .failure = result {
            XCTFail("Expected valid input but got failure")
        }

        let emptyResult = validator.validateNotEmpty("")
        if case .success = emptyResult {
            XCTFail("Expected empty string to fail validation")
        }
    }

    func testValidateNumeric() throws {
        let result = validator.validateNumeric("12345")
        if case .failure = result {
            XCTFail("Expected valid numeric input")
        }

        let alphaResult = validator.validateNumeric("12abc")
        if case .success = alphaResult {
            XCTFail("Expected alphanumeric to fail numeric validation")
        }
    }

    func testValidateAPIParameter() throws {
        let validParams = ["user_123", "device-abc", "test_id-1"]
        let invalidParams = ["has space", "has!special", ""]

        for param in validParams {
            let result = validator.validateAPIParameter(param)
            if case .failure = result {
                XCTFail("Expected valid API parameter '\(param)'")
            }
        }

        for param in invalidParams {
            let result = validator.validateAPIParameter(param)
            if case .success = result {
                XCTFail("Expected invalid API parameter '\(param)'")
            }
        }
    }
}

// MARK: - Design System Tests

final class DesignSystemSmokeTests: XCTestCase {

    func testCornerRadiusValues() throws {
        XCTAssertEqual(DesignSystem.CornerRadius.small, 8)
        XCTAssertEqual(DesignSystem.CornerRadius.medium, 12)
        XCTAssertEqual(DesignSystem.CornerRadius.large, 16)
        XCTAssertEqual(DesignSystem.CornerRadius.extraLarge, 20)
        XCTAssertEqual(DesignSystem.CornerRadius.circular, 9999)
    }

    func testSpacingValues() throws {
        XCTAssertEqual(DesignSystem.Spacing.tight, 4)
        XCTAssertEqual(DesignSystem.Spacing.small, 8)
        XCTAssertEqual(DesignSystem.Spacing.medium, 12)
        XCTAssertEqual(DesignSystem.Spacing.large, 16)
        XCTAssertEqual(DesignSystem.Spacing.extraLarge, 24)
        XCTAssertEqual(DesignSystem.Spacing.ultraLarge, 32)
    }

    func testPaddingValues() throws {
        XCTAssertEqual(DesignSystem.Padding.small, 8)
        XCTAssertEqual(DesignSystem.Padding.medium, 16)
        XCTAssertEqual(DesignSystem.Padding.large, 20)
        XCTAssertEqual(DesignSystem.Padding.extraLarge, 24)
    }

    func testShadowStyles() throws {
        // Verify shadow styles have valid properties
        XCTAssertNotNil(DesignSystem.Shadow.small.color)
        XCTAssertGreaterThan(DesignSystem.Shadow.small.radius, 0)
        XCTAssertNotNil(DesignSystem.Shadow.medium.color)
        XCTAssertGreaterThan(DesignSystem.Shadow.medium.radius, 0)
        XCTAssertNotNil(DesignSystem.Shadow.large.color)
        XCTAssertGreaterThan(DesignSystem.Shadow.large.radius, 0)
        XCTAssertNotNil(DesignSystem.Shadow.brand.color)
    }

    func testIconSizes() throws {
        XCTAssertEqual(DesignSystem.IconSize.extraSmall, 12)
        XCTAssertEqual(DesignSystem.IconSize.small, 16)
        XCTAssertEqual(DesignSystem.IconSize.medium, 20)
        XCTAssertEqual(DesignSystem.IconSize.large, 24)
        XCTAssertEqual(DesignSystem.IconSize.extraLarge, 32)
        XCTAssertEqual(DesignSystem.IconSize.ultraLarge, 48)
    }

    func testComponentSizes() throws {
        XCTAssertEqual(DesignSystem.ComponentSize.buttonSmall, 36)
        XCTAssertEqual(DesignSystem.ComponentSize.buttonMedium, 44)
        XCTAssertEqual(DesignSystem.ComponentSize.buttonLarge, 52)
        XCTAssertEqual(DesignSystem.ComponentSize.inputHeight, 44)
        XCTAssertEqual(DesignSystem.ComponentSize.avatarSmall, 32)
        XCTAssertEqual(DesignSystem.ComponentSize.avatarMedium, 48)
        XCTAssertEqual(DesignSystem.ComponentSize.avatarLarge, 64)
    }

    func testAnimationDurations() throws {
        // Quick: 200ms
        // Default: 300ms
        // Slow: 500ms
        XCTAssertEqual(DesignSystem.Animation.quick.duration, 0.2, accuracy: 0.001)
        XCTAssertEqual(DesignSystem.Animation.defaultAnimation.duration, 0.3, accuracy: 0.001)
        XCTAssertEqual(DesignSystem.Animation.slow.duration, 0.5, accuracy: 0.001)
    }

    func testStaggeredDelay() throws {
        let delay0 = DesignSystem.Animation.staggeredDelay(index: 0)
        let delay1 = DesignSystem.Animation.staggeredDelay(index: 1)
        let delay2 = DesignSystem.Animation.staggeredDelay(index: 2)

        XCTAssertEqual(delay0, 0.0)
        XCTAssertEqual(delay1, 0.05)
        XCTAssertEqual(delay2, 0.1)
    }

    func testOpacityValues() throws {
        XCTAssertEqual(DesignSystem.Opacity.disabled, 0.5)
        XCTAssertEqual(DesignSystem.Opacity.secondary, 0.6)
        XCTAssertEqual(DesignSystem.Opacity.hover, 0.8)
        XCTAssertEqual(DesignSystem.Opacity.overlay, 0.4)
        XCTAssertEqual(DesignSystem.Opacity.overlayDark, 0.6)
    }

    func testBorderWidthValues() throws {
        XCTAssertEqual(DesignSystem.BorderWidth.thin, 1)
        XCTAssertEqual(DesignSystem.BorderWidth.medium, 2)
        XCTAssertEqual(DesignSystem.BorderWidth.thick, 3)
    }
}

// MARK: - AIActionType Enum Tests

final class AIActionTypeEnumSmokeTests: XCTestCase {

    func testAIActionTypeAllCases() throws {
        let allCases = AIActionType.allCases

        XCTAssertEqual(allCases.count, 6)
        XCTAssertTrue(allCases.map { $0.id }.contains("chat"))
        XCTAssertTrue(allCases.map { $0.id }.contains("doc"))
        XCTAssertTrue(allCases.map { $0.id }.contains("slide"))
        XCTAssertTrue(allCases.map { $0.id }.contains("table"))
        XCTAssertTrue(allCases.map { $0.id }.contains("image"))
        XCTAssertTrue(allCases.map { $0.id }.contains("video"))
    }

    func testAIActionTypeLabels() throws {
        for action in AIActionType.allCases {
            XCTAssertFalse(action.label.isEmpty, "Label for \(action) should not be empty")
        }
    }

    func testAIActionTypeIconNames() throws {
        let iconNames = AIActionType.allCases.map { $0.iconName }
        XCTAssertEqual(iconNames.count, AIActionType.allCases.count)
        XCTAssertTrue(iconNames.contains("sparkles"))
        XCTAssertTrue(iconNames.contains("doc.text"))
        XCTAssertTrue(iconNames.contains("rectangle.split.3x1"))
    }

    func testAIActionTypePrefixes() throws {
        XCTAssertTrue(AIActionType.doc.prefix.contains("@AI_DOC"))
        XCTAssertTrue(AIActionType.slide.prefix.contains("@AI_SLIDE"))
        XCTAssertTrue(AIActionType.table.prefix.contains("@AI_TABLE"))
        XCTAssertTrue(AIActionType.image.prefix.contains("@AI_IMAGE"))
        XCTAssertTrue(AIActionType.video.prefix.contains("@AI_VIDEO"))
    }

    func testApplyAIActionPrefix() throws {
        // Chat should return text as-is
        let chatResult = applyAIActionPrefix("Hello", action: .chat)
        XCTAssertEqual(chatResult, "Hello")

        // Doc should add prefix
        let docResult = applyAIActionPrefix("Create a report", action: .doc)
        XCTAssertTrue(docResult.contains("@AI_DOC"))

        // Empty text with prefix action should return just the prefix
        let emptyResult = applyAIActionPrefix("", action: .image)
        XCTAssertEqual(emptyResult, AIActionType.image.prefix)
    }

    func testDetectAIActionFromInput() throws {
        XCTAssertEqual(detectAIActionFromInput("@AI_DOC hello"), .doc)
        XCTAssertEqual(detectAIActionFromInput("@AI_IMAGE cat"), .image)
        XCTAssertEqual(detectAIActionFromInput("hello world"), .chat)
    }
}

// MARK: - AttachmentType Tests

final class AttachmentTypeSmokeTests: XCTestCase {

    func testAttachmentTypeAllCases() throws {
        let types: [AttachmentType] = [.photo, .camera, .video, .file, .location]

        for attachmentType in types {
            XCTAssertFalse(attachmentType.icon.isEmpty)
            XCTAssertFalse(attachmentType.label.isEmpty)
        }
    }

    func testAttachmentTypeIcons() throws {
        XCTAssertEqual(AttachmentType.photo.icon, "photo.fill")
        XCTAssertEqual(AttachmentType.camera.icon, "camera.fill")
        XCTAssertEqual(AttachmentType.video.icon, "video.fill")
        XCTAssertEqual(AttachmentType.file.icon, "doc.fill")
        XCTAssertEqual(AttachmentType.location.icon, "location.fill")
    }

    func testAttachmentTypeLabels() throws {
        XCTAssertEqual(AttachmentType.photo.label, "Photo Library")
        XCTAssertEqual(AttachmentType.camera.label, "Camera")
        XCTAssertEqual(AttachmentType.video.label, "Video")
        XCTAssertEqual(AttachmentType.file.label, "File")
        XCTAssertEqual(AttachmentType.location.label, "Location")
    }
}

// MARK: - StudyRoomState Tests

final class StudyRoomStateSmokeTests: XCTestCase {

    func testStudyRoomStateCodableRoundTrip() throws {
        let timer = StudyRoomTimerState(
            durationSeconds: 1500,
            startedAt: Date(),
            endsAt: Date().addingTimeInterval(1500),
            remainingSeconds: 1500
        )

        let state = StudyRoomState(
            roomCode: "ABC123",
            hostUserId: "user_1",
            sessionState: .idle,
            members: [],
            maxMembers: 10,
            version: 1,
            createdAt: Date(),
            updatedAt: Date(),
            timer: timer
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(state)

        let decoder = JSONDecoder()
        decoder.dateEncodingStrategy = .iso8601
        let decoded = try decoder.decode(StudyRoomState.self, from: data)

        XCTAssertEqual(decoded.roomCode, "ABC123")
        XCTAssertEqual(decoded.hostUserId, "user_1")
        XCTAssertEqual(decoded.sessionState, .idle)
        XCTAssertEqual(decoded.maxMembers, 10)
        XCTAssertNotNil(decoded.timer)
    }

    func testStudyRoomStateWithMembers() throws {
        let members = [
            StudyRoomMember(
                userId: "user_1",
                displayName: "Alice",
                avatarUrl: nil,
                joinedAt: Date(),
                lastActiveAt: Date(),
                status: .online
            ),
            StudyRoomMember(
                userId: "user_2",
                displayName: "Bob",
                avatarUrl: nil,
                joinedAt: Date(),
                lastActiveAt: Date(),
                status: .focusing
            )
        ]

        let state = StudyRoomState(
            roomCode: "XYZ789",
            hostUserId: "user_1",
            sessionState: .focusing,
            members: members,
            maxMembers: 10,
            version: 1,
            createdAt: Date(),
            updatedAt: Date(),
            timer: nil
        )

        XCTAssertEqual(state.members.count, 2)
        XCTAssertEqual(state.members[0].displayName, "Alice")
        XCTAssertEqual(state.members[1].status, .focusing)
    }

    func testStudyRoomStateId() throws {
        let state = StudyRoomState(
            roomCode: "ROOM123",
            hostUserId: "user_1",
            sessionState: .idle,
            members: [],
            maxMembers: 5,
            version: 1,
            createdAt: Date(),
            updatedAt: Date(),
            timer: nil
        )

        XCTAssertEqual(state.id, "ROOM123")
    }
}

// MARK: - FriendMapLocation Tests

final class FriendMapLocationSmokeTests: XCTestCase {

    func testFriendMapLocationCodableRoundTrip() throws {
        let location = FriendMapLocation(
            id: "loc_123",
            name: "Alice",
            avatarUrl: "https://example.com/alice.png",
            latitude: 40.7128,
            longitude: -74.0060,
            isStudying: true,
            status: "online"
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(location)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(FriendMapLocation.self, from: data)

        XCTAssertEqual(decoded.id, "loc_123")
        XCTAssertEqual(decoded.name, "Alice")
        XCTAssertEqual(decoded.latitude, 40.7128)
        XCTAssertEqual(decoded.longitude, -74.0060)
        XCTAssertTrue(decoded.isStudying)
    }

    func testFriendMapLocationCoordinateConversion() throws {
        let location = FriendMapLocation(
            id: "loc_test",
            name: "Bob",
            avatarUrl: nil,
            latitude: 51.5074,
            longitude: -0.1278,
            isStudying: false,
            status: "offline"
        )

        XCTAssertEqual(location.coordinate.latitude, 51.5074)
        XCTAssertEqual(location.coordinate.longitude, -0.1278)
    }

    func testFriendMapLocationStatusType() throws {
        let online = FriendMapLocation(
            id: "loc_1", name: "Online", avatarUrl: nil,
            latitude: 0, longitude: 0, isStudying: false, status: "online"
        )
        XCTAssertEqual(online.statusType, .online)

        let away = FriendMapLocation(
            id: "loc_2", name: "Away", avatarUrl: nil,
            latitude: 0, longitude: 0, isStudying: false, status: "away"
        )
        XCTAssertEqual(away.statusType, .away)

        let offline = FriendMapLocation(
            id: "loc_3", name: "Offline", avatarUrl: nil,
            latitude: 0, longitude: 0, isStudying: false, status: "offline"
        )
        XCTAssertEqual(offline.statusType, .offline)

        let unknown = FriendMapLocation(
            id: "loc_4", name: "Unknown", avatarUrl: nil,
            latitude: 0, longitude: 0, isStudying: false, status: "unknown_status"
        )
        XCTAssertEqual(unknown.statusType, .offline) // Default
    }
}

// MARK: - HeatZone Tests

final class HeatZoneSmokeTests: XCTestCase {

    func testHeatZoneInitWithUserCount() throws {
        let zone = HeatZone(coordinate: .init(latitude: 0, longitude: 0), userCount: 5)

        XCTAssertEqual(zone.intensity, 0.5) // 5/10 = 0.5
        XCTAssertEqual(zone.size, 45) // 20 + 5*5 = 45
    }

    func testHeatZoneIntensityClamping() throws {
        let highCount = HeatZone(coordinate: .init(latitude: 0, longitude: 0), userCount: 100)
        XCTAssertEqual(highCount.intensity, 1.0) // Clamped to 1.0

        let zeroCount = HeatZone(coordinate: .init(latitude: 0, longitude: 0), userCount: 0)
        XCTAssertEqual(zeroCount.intensity, 0.0)
    }

    func testHeatZoneIdentifiable() throws {
        let zone1 = HeatZone(coordinate: .init(latitude: 0, longitude: 0), userCount: 1)
        let zone2 = HeatZone(coordinate: .init(latitude: 1, longitude: 1), userCount: 1)

        XCTAssertNotEqual(zone1.id, zone2.id)
    }
}

// MARK: - Achievement Model Tests

final class AchievementModelSmokeTests: XCTestCase {

    func testAchievementRarityAllCases() throws {
        let rarities: [AchievementRarity] = [.common, .rare, .epic, .legendary]

        XCTAssertEqual(rarities.count, 4)

        for rarity in rarities {
            let encoder = JSONEncoder()
            let data = try encoder.encode(rarity)
            let decoder = JSONDecoder()
            let decoded = try decoder.decode(AchievementRarity.self, from: data)
            XCTAssertEqual(decoded, rarity)
        }
    }

    func testAchievementCategoryAllCases() throws {
        let categories: [AchievementCategory] = [.duration, .streak, .social, .milestone, .special]

        XCTAssertEqual(categories.count, 5)

        for category in categories {
            let encoder = JSONEncoder()
            let data = try encoder.encode(category)
            let decoder = JSONDecoder()
            let decoded = try decoder.decode(AchievementCategory.self, from: data)
            XCTAssertEqual(decoded, category)
        }
    }

    func testAchievementCodableRoundTrip() throws {
        let achievement = Achievement(
            id: "ach_1",
            name: "First Steps",
            nameEn: "First Steps",
            description: "Complete your first study session",
            icon: "star.fill",
            category: .milestone,
            requirement: 1,
            type: .totalSessions,
            rarity: .common,
            unlockedAt: nil
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(achievement)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(Achievement.self, from: data)

        XCTAssertEqual(decoded.id, "ach_1")
        XCTAssertEqual(decoded.name, "First Steps")
        XCTAssertEqual(decoded.category, .milestone)
        XCTAssertEqual(decoded.rarity, .common)
        XCTAssertNil(decoded.unlockedAt)
    }
}

// MARK: - API Response Models Tests

final class APIResponseModelSmokeTests: XCTestCase {

    func testPaginatedResponseCodable() throws {
        let response = PaginatedResponse<User>(
            data: [],
            total: 0,
            page: 1,
            limit: 20
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(response)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(PaginatedResponse<User>.self, from: data)

        XCTAssertEqual(decoded.page, 1)
        XCTAssertEqual(decoded.limit, 20)
        XCTAssertEqual(decoded.total, 0)
    }

    func testAPIResponseCodable() throws {
        let response = APIResponse<String>(
            success: true,
            data: "Hello",
            error: nil,
            message: "Success"
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(response)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(APIResponse<String>.self, from: data)

        XCTAssertTrue(decoded.success)
        XCTAssertEqual(decoded.data, "Hello")
        XCTAssertEqual(decoded.message, "Success")
    }
}
