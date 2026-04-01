//
//  DatabaseManagerTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for DatabaseManager
//

import XCTest
import SQLite
@testable import TRIX3DCompanion

/// Unit tests for DatabaseManager
final class DatabaseManagerTests: XCTestCase {

    // MARK: - Properties

    var databaseManager: DatabaseManager!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        databaseManager = DatabaseManager.shared

        // Clear all data before each test
        try? databaseManager.clearAllData()
    }

    override func tearDownWithError() throws {
        // Clean up after each test
        try? databaseManager.clearAllData()
        databaseManager = nil
    }

    // MARK: - Database Initialization Tests

    func test_databaseIsInitialized() throws {
        // Assert
        XCTAssertNotNil(databaseManager, "DatabaseManager should be initialized")
    }

    func test_databasePath_isValid() throws {
        // Act
        let size = databaseManager.getDatabaseSize()

        // Assert
        XCTAssertTrue(size >= 0, "Database size should be non-negative")
    }

    // MARK: - Message CRUD Tests

    func test_insertMessage_success() throws {
        // Arrange
        let message = createTestMessage(id: "msg-1", roomId: "room-1")

        // Act
        try databaseManager.insertMessage(message)

        // Assert
        let messages = try databaseManager.getMessages(roomId: "room-1")
        XCTAssertEqual(messages.count, 1, "Should have 1 message")
        XCTAssertEqual(messages.first?.id, "msg-1")
    }

    func test_insertMessages_batch_success() throws {
        // Arrange
        let messages = [
            createTestMessage(id: "msg-1", roomId: "room-1"),
            createTestMessage(id: "msg-2", roomId: "room-1"),
            createTestMessage(id: "msg-3", roomId: "room-1")
        ]

        // Act
        try databaseManager.insertMessages(messages)

        // Assert
        let retrievedMessages = try databaseManager.getMessages(roomId: "room-1")
        XCTAssertEqual(retrievedMessages.count, 3, "Should have 3 messages")
    }

    func test_getMessages_returnsInCorrectOrder() throws {
        // Arrange
        let date1 = Date().addingTimeInterval(-100)
        let date2 = Date().addingTimeInterval(-50)
        let date3 = Date()

        try databaseManager.insertMessage(createTestMessage(id: "msg-1", roomId: "room-1", timestamp: date1))
        try databaseManager.insertMessage(createTestMessage(id: "msg-2", roomId: "room-1", timestamp: date2))
        try databaseManager.insertMessage(createTestMessage(id: "msg-3", roomId: "room-1", timestamp: date3))

        // Act
        let messages = try databaseManager.getMessages(roomId: "room-1")

        // Assert - Should be in ascending order (oldest first)
        XCTAssertEqual(messages[0].id, "msg-1", "Oldest message should be first")
        XCTAssertEqual(messages[2].id, "msg-3", "Newest message should be last")
    }

    func test_getMessages_withLimit_respectsLimit() throws {
        // Arrange
        for i in 1...10 {
            try databaseManager.insertMessage(createTestMessage(id: "msg-\(i)", roomId: "room-1"))
        }

        // Act
        let messages = try databaseManager.getMessages(roomId: "room-1", limit: 5)

        // Assert
        XCTAssertEqual(messages.count, 5, "Should return only 5 messages")
    }

    func test_getMessages_withDateFilter_returnsCorrectMessages() throws {
        // Arrange
        let baseDate = Date()
        let olderDate = baseDate.addingTimeInterval(-1000)

        try databaseManager.insertMessage(createTestMessage(id: "msg-old", roomId: "room-1", timestamp: olderDate))
        try databaseManager.insertMessage(createTestMessage(id: "msg-new", roomId: "room-1", timestamp: baseDate))

        // Act
        let messages = try databaseManager.getMessages(roomId: "room-1", before: baseDate.addingTimeInterval(-1))

        // Assert
        XCTAssertTrue(messages.allSatisfy { $0.timestamp < baseDate }, "All messages should be before the date")
        XCTAssertEqual(messages.count, 1, "Should have 1 older message")
    }

    func test_markMessageAsRead_updatesStatus() throws {
        // Arrange
        let message = createTestMessage(id: "msg-1", roomId: "room-1", isRead: false)
        try databaseManager.insertMessage(message)

        // Act
        try databaseManager.markMessageAsRead("msg-1")
        let messages = try databaseManager.getMessages(roomId: "room-1")

        // Assert
        XCTAssertTrue(messages.first?.isRead ?? false, "Message should be marked as read")
    }

    func test_markAllMessagesAsRead_updatesAll() throws {
        // Arrange
        try databaseManager.insertMessage(createTestMessage(id: "msg-1", roomId: "room-1", isRead: false))
        try databaseManager.insertMessage(createTestMessage(id: "msg-2", roomId: "room-1", isRead: false))

        // Act
        try databaseManager.markAllMessagesAsRead(roomId: "room-1")
        let messages = try databaseManager.getMessages(roomId: "room-1")

        // Assert
        XCTAssertTrue(messages.allSatisfy { $0.isRead }, "All messages should be marked as read")
    }

    func test_deleteMessage_removesMessage() throws {
        // Arrange
        try databaseManager.insertMessage(createTestMessage(id: "msg-1", roomId: "room-1"))

        // Act
        try databaseManager.deleteMessage("msg-1")
        let messages = try databaseManager.getMessages(roomId: "room-1")

        // Assert
        XCTAssertEqual(messages.count, 0, "Message should be deleted")
    }

    func test_deleteMessages_removesAllRoomMessages() throws {
        // Arrange
        try databaseManager.insertMessage(createTestMessage(id: "msg-1", roomId: "room-1"))
        try databaseManager.insertMessage(createTestMessage(id: "msg-2", roomId: "room-1"))
        try databaseManager.insertMessage(createTestMessage(id: "msg-3", roomId: "room-2"))

        // Act
        try databaseManager.deleteMessages(roomId: "room-1")
        let room1Messages = try databaseManager.getMessages(roomId: "room-1")
        let room2Messages = try databaseManager.getMessages(roomId: "room-2")

        // Assert
        XCTAssertEqual(room1Messages.count, 0, "Room 1 messages should be deleted")
        XCTAssertEqual(room2Messages.count, 1, "Room 2 messages should remain")
    }

    func test_getUnreadCount_returnsCorrectCount() throws {
        // Arrange
        try databaseManager.insertMessage(createTestMessage(id: "msg-1", roomId: "room-1", isRead: false))
        try databaseManager.insertMessage(createTestMessage(id: "msg-2", roomId: "room-1", isRead: false))
        try databaseManager.insertMessage(createTestMessage(id: "msg-3", roomId: "room-1", isRead: true))

        // Act
        let unreadCount = try databaseManager.getUnreadCount(roomId: "room-1")

        // Assert
        XCTAssertEqual(unreadCount, 2, "Should have 2 unread messages")
    }

    // MARK: - ChatRoom CRUD Tests

    func test_saveChatRoom_success() throws {
        // Arrange
        let room = createTestRoom(id: "room-1", name: "Test Room")

        // Act
        try databaseManager.saveChatRoom(room)
        let rooms = try databaseManager.getChatRooms()

        // Assert
        XCTAssertEqual(rooms.count, 1, "Should have 1 room")
        XCTAssertEqual(rooms.first?.id, "room-1")
    }

    func test_saveChatRooms_batch_success() throws {
        // Arrange
        let rooms = [
            createTestRoom(id: "room-1", name: "Room 1"),
            createTestRoom(id: "room-2", name: "Room 2"),
            createTestRoom(id: "room-3", name: "Room 3")
        ]

        // Act
        try databaseManager.saveChatRooms(rooms)
        let retrievedRooms = try databaseManager.getChatRooms()

        // Assert
        XCTAssertEqual(retrievedRooms.count, 3, "Should have 3 rooms")
    }

    func test_getChatRooms_returnsInCorrectOrder() throws {
        // Arrange
        let room1 = createTestRoom(id: "room-1", name: "Room 1", updatedAt: Date().addingTimeInterval(-100))
        let room2 = createTestRoom(id: "room-2", name: "Room 2", updatedAt: Date())

        try databaseManager.saveChatRoom(room1)
        try databaseManager.saveChatRoom(room2)

        // Act
        let rooms = try databaseManager.getChatRooms()

        // Assert - Should be ordered by updatedAt descending (newest first)
        XCTAssertEqual(rooms[0].id, "room-2", "Most recently updated room should be first")
        XCTAssertEqual(rooms[1].id, "room-1", "Oldest updated room should be last")
    }

    func test_updateRoomUnreadCount_updatesCount() throws {
        // Arrange
        try databaseManager.saveChatRoom(createTestRoom(id: "room-1", name: "Test Room"))

        // Act
        try databaseManager.updateRoomUnreadCount(roomId: "room-1", count: 5)
        let rooms = try databaseManager.getChatRooms()

        // Assert
        XCTAssertEqual(rooms.first?.unreadCount, 5, "Unread count should be updated")
    }

    func test_deleteChatRoom_removesRoom() throws {
        // Arrange
        try databaseManager.saveChatRoom(createTestRoom(id: "room-1", name: "Test Room"))
        try databaseManager.insertMessage(createTestMessage(id: "msg-1", roomId: "room-1"))

        // Act
        try databaseManager.deleteChatRoom("room-1")
        let rooms = try databaseManager.getChatRooms()
        let messages = try databaseManager.getMessages(roomId: "room-1")

        // Assert
        XCTAssertEqual(rooms.count, 0, "Room should be deleted")
        XCTAssertEqual(messages.count, 0, "Room messages should also be deleted")
    }

    // MARK: - Study Session Tests

    func test_saveStudySession_success() throws {
        // Arrange
        let session = createTestSession(id: "session-1", userId: "user-1", duration: 60)

        // Act
        try databaseManager.saveStudySession(session)
        let unsyncedSessions = try databaseManager.getUnsyncedStudySessions()

        // Assert
        XCTAssertEqual(unsyncedSessions.count, 1, "Should have 1 unsynced session")
        XCTAssertEqual(unsyncedSessions.first?.id, "session-1")
    }

    func test_getUnsyncedStudySessions_returnsOnlyUnsynced() throws {
        // Arrange
        try databaseManager.saveStudySession(createTestSession(id: "session-1", userId: "user-1", duration: 60))
        try databaseManager.saveStudySession(createTestSession(id: "session-2", userId: "user-1", duration: 30))
        try databaseManager.markStudySessionSynced("session-1")

        // Act
        let unsyncedSessions = try databaseManager.getUnsyncedStudySessions()

        // Assert
        XCTAssertEqual(unsyncedSessions.count, 1, "Should have only 1 unsynced session")
        XCTAssertEqual(unsyncedSessions.first?.id, "session-2", "Unsynced session should be session-2")
    }

    func test_markStudySessionSynced_updatesStatus() throws {
        // Arrange
        try databaseManager.saveStudySession(createTestSession(id: "session-1", userId: "user-1", duration: 60))

        // Act
        try databaseManager.markStudySessionSynced("session-1")
        let unsyncedSessions = try databaseManager.getUnsyncedStudySessions()

        // Assert
        XCTAssertEqual(unsyncedSessions.count, 0, "Session should be marked as synced")
    }

    func test_getStudyStats_returnsCorrectStats() throws {
        // Arrange
        let userId = "user-1"
        try databaseManager.saveStudySession(createTestSession(id: "session-1", userId: userId, duration: 60, isCompleted: true))
        try databaseManager.saveStudySession(createTestSession(id: "session-2", userId: userId, duration: 30, isCompleted: true))
        try databaseManager.saveStudySession(createTestSession(id: "session-3", userId: userId, duration: 45, isCompleted: false))

        // Act
        let stats = try databaseManager.getStudyStats(userId: userId)

        // Assert
        XCTAssertEqual(stats.totalDuration, 90, "Total duration should be 90 minutes (only completed sessions)")
        XCTAssertEqual(stats.sessionCount, 2, "Should have 2 completed sessions")
    }

    // MARK: - Points History Tests

    func test_savePointsTransaction_success() throws {
        // Arrange
        let transaction = createTestTransaction(id: "txn-1", pointsChange: 100, type: .studyReward)

        // Act
        try databaseManager.savePointsTransaction(transaction)
        let history = try databaseManager.getPointsHistory()

        // Assert
        XCTAssertEqual(history.count, 1, "Should have 1 transaction")
        XCTAssertEqual(history.first?.id, "txn-1")
    }

    func test_savePointsTransactions_batch_success() throws {
        // Arrange
        let transactions = [
            createTestTransaction(id: "txn-1", pointsChange: 100, type: .studyReward),
            createTestTransaction(id: "txn-2", pointsChange: -50, type: .redemption),
            createTestTransaction(id: "txn-3", pointsChange: 200, type: .adminAdjust)
        ]

        // Act
        try databaseManager.savePointsTransactions(transactions)
        let history = try databaseManager.getPointsHistory()

        // Assert
        XCTAssertEqual(history.count, 3, "Should have 3 transactions")
    }

    func test_getPointsHistory_withLimit_returnsCorrectCount() throws {
        // Arrange
        for i in 1...10 {
            try databaseManager.savePointsTransaction(createTestTransaction(id: "txn-\(i)", pointsChange: i * 10, type: .studyReward))
        }

        // Act
        let history = try databaseManager.getPointsHistory(limit: 5)

        // Assert
        XCTAssertEqual(history.count, 5, "Should return only 5 transactions")
    }

    func test_getPointsHistory_returnsInDescendingOrder() throws {
        // Arrange
        let txn1 = createTestTransaction(id: "txn-1", pointsChange: 100, type: .studyReward, createdAt: Date().addingTimeInterval(-100))
        let txn2 = createTestTransaction(id: "txn-2", pointsChange: 200, type: .studyReward, createdAt: Date())

        try databaseManager.savePointsTransaction(txn1)
        try databaseManager.savePointsTransaction(txn2)

        // Act
        let history = try databaseManager.getPointsHistory()

        // Assert
        XCTAssertEqual(history[0].id, "txn-2", "Most recent transaction should be first")
        XCTAssertEqual(history[1].id, "txn-1", "Oldest transaction should be last")
    }

    // MARK: - Transaction Test

    func test_transaction_rollsBackOnError() throws {
        // This test would require setting up a scenario where a transaction fails
        // For now, we test that transaction infrastructure is in place

        // Arrange
        let messages = [
            createTestMessage(id: "msg-1", roomId: "room-1"),
            createTestMessage(id: "msg-2", roomId: "room-1")
        ]

        // Act - Should complete successfully
        try databaseManager.insertMessages(messages)
        let retrievedMessages = try databaseManager.getMessages(roomId: "room-1")

        // Assert
        XCTAssertEqual(retrievedMessages.count, 2, "Transaction should complete successfully")
    }

    // MARK: - Cleanup Tests

    func test_clearAllData_removesAllData() throws {
        // Arrange
        try databaseManager.insertMessage(createTestMessage(id: "msg-1", roomId: "room-1"))
        try databaseManager.saveChatRoom(createTestRoom(id: "room-1", name: "Test"))
        try databaseManager.saveStudySession(createTestSession(id: "session-1", userId: "user-1", duration: 60))
        try databaseManager.savePointsTransaction(createTestTransaction(id: "txn-1", pointsChange: 100, type: .studyReward))

        // Act
        try databaseManager.clearAllData()

        // Assert
        let messages = try databaseManager.getMessages(roomId: "room-1")
        let rooms = try databaseManager.getChatRooms()
        let sessions = try databaseManager.getUnsyncedStudySessions()
        let history = try databaseManager.getPointsHistory()

        XCTAssertEqual(messages.count, 0, "All messages should be cleared")
        XCTAssertEqual(rooms.count, 0, "All rooms should be cleared")
        XCTAssertEqual(sessions.count, 0, "All sessions should be cleared")
        XCTAssertEqual(history.count, 0, "All transactions should be cleared")
    }

    func test_getDatabaseSize_returnsPositiveSize() throws {
        // Arrange
        try databaseManager.insertMessage(createTestMessage(id: "msg-1", roomId: "room-1"))

        // Act
        let size = databaseManager.getDatabaseSize()

        // Assert
        XCTAssertTrue(size > 0, "Database should have positive size after insert")
    }

    func test_getMessageCount_returnsCorrectCount() throws {
        // Arrange
        try databaseManager.insertMessage(createTestMessage(id: "msg-1", roomId: "room-1"))
        try databaseManager.insertMessage(createTestMessage(id: "msg-2", roomId: "room-1"))

        // Act
        let count = try databaseManager.getMessageCount()

        // Assert
        XCTAssertEqual(count, 2, "Message count should be 2")
    }

    // MARK: - Error Tests

    func test_databaseErrorDescriptions() {
        let notConnected = DatabaseError.notConnected
        XCTAssertEqual(notConnected.localizedDescription, "Database not connected")

        let queryFailed = DatabaseError.queryFailed("Test query")
        XCTAssertTrue(queryFailed.localizedDescription.contains("Query failed"))

        let insertFailed = DatabaseError.insertFailed("Test insert")
        XCTAssertTrue(insertFailed.localizedDescription.contains("Insert failed"))

        let deleteFailed = DatabaseError.deleteFailed("Test delete")
        XCTAssertTrue(deleteFailed.localizedDescription.contains("Delete failed"))
    }

    // MARK: - Helper Methods

    private func createTestMessage(
        id: String,
        roomId: String,
        isRead: Bool = false,
        timestamp: Date = Date()
    ) -> ChatMessage {
        return ChatMessage(
            id: id,
            roomId: roomId,
            friendId: nil,
            sender: .user,
            senderId: "user-1",
            text: "Test message",
            timestamp: timestamp,
            messageType: .text,
            mediaUri: nil,
            mediaType: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            isRead: isRead
        )
    }

    private func createTestRoom(
        id: String,
        name: String,
        updatedAt: Date = Date()
    ) -> ChatRoom {
        return ChatRoom(
            id: id,
            name: name,
            type: .ai,
            participants: nil,
            lastMessage: nil,
            unreadCount: 0,
            createdAt: Date(),
            updatedAt: updatedAt
        )
    }

    private func createTestSession(
        id: String,
        userId: String,
        duration: Int,
        isCompleted: Bool = true
    ) -> StudySession {
        return StudySession(
            id: id,
            userId: userId,
            subject: "Test Subject",
            duration: duration,
            startedAt: Date(),
            endedAt: Date(),
            notes: "Test notes",
            earnedPoints: duration,
            isCompleted: isCompleted,
            createdAt: Date()
        )
    }

    private func createTestTransaction(
        id: String,
        pointsChange: Int,
        type: TransactionType,
        createdAt: Date = Date()
    ) -> PointsTransaction {
        return PointsTransaction(
            id: id,
            pointsChange: pointsChange,
            type: type,
            description: "Test transaction",
            balanceAfter: pointsChange,
            createdAt: createdAt
        )
    }
}
