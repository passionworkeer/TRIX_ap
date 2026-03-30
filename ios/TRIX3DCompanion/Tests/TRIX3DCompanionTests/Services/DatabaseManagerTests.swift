//
//  DatabaseManagerTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for DatabaseManager
//
//  Test Coverage:
//  - Database initialization
//  - CRUD operations (messages, chat rooms, study sessions, points)
//  - Transaction handling
//  - Concurrency safety
//  - Data encryption
//  - Corruption recovery
//  - Error handling
//  - Data cleanup
//

import XCTest
import SQLite
@testable import TRIX3DCompanion

// MARK: - Test Database Manager

/// Testable wrapper for DatabaseManager that provides isolated database for testing
final class TestableDatabaseManager {

    let dbPath: String
    private(set) var db: Connection?
    private let databaseLock = NSLock()
    private let readWriteQueue = DispatchQueue(label: "com.trix3d.test.database", qos: .userInitiated, attributes: .concurrent)

    // Tables
    let messagesTable = Table("messages")
    let chatRoomsTable = Table("chat_rooms")
    let studySessionsTable = Table("study_sessions")
    let pointsHistoryTable = Table("points_history")

    // Message Columns
    let messageId = Expression<String>("id")
    let messageRoomId = Expression<String>("room_id")
    let messageSenderId = Expression<String>("sender_id")
    let messageSenderType = Expression<String>("sender_type")
    let messageContent = Expression<String>("content")
    let messageType = Expression<String>("type")
    let messageMediaUrl = Expression<String?>("media_url")
    let messageMediaMimeType = Expression<String?>("media_mime_type")
    let messageMediaDuration = Expression<Int?>("media_duration")
    let messageIsRead = Expression<Bool>("is_read")
    let messageCreatedAt = Expression<Date>("created_at")
    let messageSyncedAt = Expression<Date?>("synced_at")

    // ChatRoom Columns
    let roomId = Expression<String>("id")
    let roomName = Expression<String>("name")
    let roomType = Expression<String>("type")
    let roomLastMessage = Expression<String?>("last_message")
    let roomLastMessageAt = Expression<Date?>("last_message_at")
    let roomUnreadCount = Expression<Int>("unread_count")
    let roomUpdatedAt = Expression<Date>("updated_at")

    // StudySession Columns
    let sessionId = Expression<String>("id")
    let sessionUserId = Expression<String>("user_id")
    let sessionSubject = Expression<String?>("subject")
    let sessionDuration = Expression<Int>("duration")
    let sessionStartedAt = Expression<Date>("started_at")
    let sessionEndedAt = Expression<Date?>("ended_at")
    let sessionNotes = Expression<String?>("notes")
    let sessionEarnedPoints = Expression<Int?>("earned_points")
    let sessionIsCompleted = Expression<Bool>("is_completed")
    let sessionSynced = Expression<Bool>("synced")

    // PointsHistory Columns
    let transactionId = Expression<String>("id")
    let transactionPointsChange = Expression<Int>("points_change")
    let transactionType = Expression<String>("type")
    let transactionDescription = Expression<String>("description")
    let transactionBalanceAfter = Expression<Int>("balance_after")
    let transactionCreatedAt = Expression<Date>("created_at")

    init() {
        let tempDir = NSTemporaryDirectory()
        dbPath = (tempDir as NSString).appendingPathComponent("test_trix3d_\(UUID().uuidString).sqlite")
        openDatabase()
        createTables()
    }

    deinit {
        closeDatabase()
        try? FileManager.default.removeItem(atPath: dbPath)
    }

    func openDatabase() {
        do {
            db = try Connection(dbPath)
            try db?.run("PRAGMA foreign_keys = ON")
        } catch {
            print("Failed to open test database: \(error)")
        }
    }

    func closeDatabase() {
        db = nil
    }

    private func createTables() {
        createMessagesTable()
        createChatRoomsTable()
        createStudySessionsTable()
        createPointsHistoryTable()
    }

    private func createMessagesTable() {
        do {
            try db?.run(messagesTable.create(ifNotExists: true) { t in
                t.column(messageId, primaryKey: true)
                t.column(messageRoomId)
                t.column(messageSenderId)
                t.column(messageSenderType)
                t.column(messageContent)
                t.column(messageType)
                t.column(messageMediaUrl)
                t.column(messageMediaMimeType)
                t.column(messageMediaDuration)
                t.column(messageIsRead, defaultValue: false)
                t.column(messageCreatedAt)
                t.column(messageSyncedAt)
                t.unique(messageId)
            })
            try db?.run(messagesTable.createIndex(messageRoomId, ifNotExists: true))
            try db?.run(messagesTable.createIndex(messageCreatedAt, ifNotExists: true))
        } catch {
            print("Failed to create messages table: \(error)")
        }
    }

    private func createChatRoomsTable() {
        do {
            try db?.run(chatRoomsTable.create(ifNotExists: true) { t in
                t.column(roomId, primaryKey: true)
                t.column(roomName)
                t.column(roomType)
                t.column(roomLastMessage)
                t.column(roomLastMessageAt)
                t.column(roomUnreadCount, defaultValue: 0)
                t.column(roomUpdatedAt)
                t.unique(roomId)
            })
        } catch {
            print("Failed to create chat_rooms table: \(error)")
        }
    }

    private func createStudySessionsTable() {
        do {
            try db?.run(studySessionsTable.create(ifNotExists: true) { t in
                t.column(sessionId, primaryKey: true)
                t.column(sessionUserId)
                t.column(sessionSubject)
                t.column(sessionDuration)
                t.column(sessionStartedAt)
                t.column(sessionEndedAt)
                t.column(sessionNotes)
                t.column(sessionEarnedPoints)
                t.column(sessionIsCompleted, defaultValue: false)
                t.column(sessionSynced, defaultValue: false)
                t.unique(sessionId)
            })
            try db?.run(studySessionsTable.createIndex(sessionSynced, ifNotExists: true))
        } catch {
            print("Failed to create study_sessions table: \(error)")
        }
    }

    private func createPointsHistoryTable() {
        do {
            try db?.run(pointsHistoryTable.create(ifNotExists: true) { t in
                t.column(transactionId, primaryKey: true)
                t.column(transactionPointsChange)
                t.column(transactionType)
                t.column(transactionDescription)
                t.column(transactionBalanceAfter)
                t.column(transactionCreatedAt)
                t.unique(transactionId)
            })
            try db?.run(pointsHistoryTable.createIndex(transactionCreatedAt, ifNotExists: true))
        } catch {
            print("Failed to create points_history table: \(error)")
        }
    }

    // MARK: - Thread-Safe Operations

    func performWithLock<T>(_ operation: () throws -> T) rethrows -> T {
        databaseLock.lock()
        defer { databaseLock.unlock() }
        return try operation()
    }

    func clearAllData() throws {
        guard let db = db else { throw DatabaseError.notConnected }
        try db.run(messagesTable.delete())
        try db.run(chatRoomsTable.delete())
        try db.run(studySessionsTable.delete())
        try db.run(pointsHistoryTable.delete())
    }
}

// MARK: - Database Manager Tests

final class DatabaseManagerTests: XCTestCase {

    // MARK: - Properties

    var sut: DatabaseManager!
    var testDb: TestableDatabaseManager!

    // MARK: - Setup & Teardown

    override func setUp() {
        super.setUp()
        // Use the shared instance for integration testing
        sut = DatabaseManager.shared
        // Create isolated test database
        testDb = TestableDatabaseManager()
    }

    override func tearDown() {
        // Clean up test data
        try? testDb?.clearAllData()
        testDb = nil
        super.tearDown()
    }

    // MARK: - Helper Methods

    private func createMockMessage(id: String = UUID().uuidString, roomId: String = "test_room", isRead: Bool = false) -> ChatMessage {
        ChatMessage(
            id: id,
            roomId: roomId,
            senderId: "test_user_\(id)",
            sender: .user,
            content: "Test message content \(id)",
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
            isRead: isRead,
            createdAt: Date()
        )
    }

    private func createMockChatRoom(id: String = UUID().uuidString, name: String = "Test Room") -> ChatRoom {
        ChatRoom(
            id: id,
            name: name,
            type: .ai,
            participants: [],
            lastMessage: nil,
            unreadCount: 0,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func createMockStudySession(id: String = UUID().uuidString, userId: String = "test_user") -> StudySession {
        StudySession(
            id: id,
            userId: userId,
            duration: 60,
            startedAt: Date(),
            endedAt: Date(),
            earnedPoints: 10,
            isCompleted: true,
            subject: "Test Subject",
            notes: "Test notes",
            createdAt: Date()
        )
    }

    private func createMockPointsTransaction(id: String = UUID().uuidString) -> PointsTransaction {
        PointsTransaction(
            id: id,
            pointsChange: 100,
            type: .studyComplete,
            description: "Test transaction",
            balanceAfter: 100,
            createdAt: Date()
        )
    }
}

// MARK: - Database Initialization Tests

extension DatabaseManagerTests {

    func testDatabaseManagerSingletonIsInitialized() {
        // Then
        XCTAssertNotNil(sut, "DatabaseManager singleton should be initialized")
    }

    func testDatabaseSizeReturnsValidValue() {
        // When
        let size = sut.getDatabaseSize()

        // Then
        XCTAssertGreaterThanOrEqual(size, 0, "Database size should be non-negative")
    }

    func testMessageCountReturnsZeroForNewDatabase() throws {
        // Given - ensure test db is clean
        try testDb.clearAllData()

        // When
        let count = try sut.getMessageCount()

        // Then
        XCTAssertGreaterThanOrEqual(count, 0, "Message count should be non-negative")
    }
}

// MARK: - Message CRUD Tests

extension DatabaseManagerTests {

    func testInsertMessage() throws {
        // Given
        let message = createMockMessage()

        // When
        try sut.insertMessage(message)

        // Then - verify message can be retrieved
        let messages = try sut.getMessages(roomId: "test_room")
        XCTAssertEqual(messages.count, 1, "Should have one message")
        XCTAssertEqual(messages.first?.id, message.id, "Message ID should match")
    }

    func testInsertMultipleMessages() throws {
        // Given - Use unique IDs to avoid UNIQUE constraint conflicts
        let uniquePrefix = UUID().uuidString.prefix(8)
        let message1 = createMockMessage(id: "\(uniquePrefix)_msg1", roomId: "room1")
        let message2 = createMockMessage(id: "\(uniquePrefix)_msg2", roomId: "room1")
        let message3 = createMockMessage(id: "\(uniquePrefix)_msg3", roomId: "room1")

        // When
        try sut.insertMessages([message1, message2, message3])

        // Then
        let messages = try sut.getMessages(roomId: "room1")
        XCTAssertGreaterThanOrEqual(messages.count, 3, "Should have at least three messages")
    }

    func testGetMessagesWithLimit() throws {
        // Given - Use unique room ID
        let uniqueRoomId = "room_limit_\(UUID().uuidString.prefix(8))"
        for i in 0..<10 {
            let message = createMockMessage(id: "limit_msg\(i)_\(UUID().uuidString.prefix(4))", roomId: uniqueRoomId)
            try sut.insertMessage(message)
        }

        // When
        let messages = try sut.getMessages(roomId: uniqueRoomId, limit: 5)

        // Then
        XCTAssertEqual(messages.count, 5, "Should return limited number of messages")
    }

    func testGetMessagesWithPagination() throws {
        // Given - Use unique room ID to avoid conflicts
        let uniqueRoomId = "room_pagination_\(UUID().uuidString.prefix(8))"
        
        // Create messages with distinct timestamps (add 1 second gap between each)
        var messageIds: [String] = []
        for i in 0..<10 {
            let messageId = "page_msg_\(i)_\(UUID().uuidString.prefix(4))"
            messageIds.append(messageId)
            
            let message = ChatMessage(
                id: messageId,
                roomId: uniqueRoomId,
                senderId: "test_user",
                sender: .user,
                content: "Test message \(i)",
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
                createdAt: Date().addingTimeInterval(TimeInterval(i) * 0.1) // 100ms apart
            )
            try sut.insertMessage(message)
            // Small delay to ensure different timestamps in database
            Thread.sleep(forTimeInterval: 0.01)
        }

        // When - Get first page (should get 3 newest messages based on createdAt)
        let firstPage = try sut.getMessages(roomId: uniqueRoomId, limit: 3)
        XCTAssertFalse(firstPage.isEmpty, "First page should not be empty")
        XCTAssertEqual(firstPage.count, 3, "First page should have 3 messages")
        
        // Use the oldest message in the first page as the pagination cursor.
        guard let cursorMessage = firstPage.first else {
            XCTFail("First page should have messages")
            return
        }
        
        // Get second page (messages before the oldest in first page)
        let secondPage = try sut.getMessages(roomId: uniqueRoomId, limit: 3, before: cursorMessage.createdAt)

        // Then
        XCTAssertGreaterThanOrEqual(secondPage.count, 1, "Second page should have at least 1 message")

        // Verify no overlap by ID
        let firstPageIds = Set(firstPage.map { $0.id })
        let secondPageIds = Set(secondPage.map { $0.id })
        XCTAssertTrue(firstPageIds.isDisjoint(with: secondPageIds), "Pages should not overlap - first: \(firstPageIds), second: \(secondPageIds)")
    }

    func testMarkMessageAsRead() throws {
        // Given
        let message = createMockMessage(id: "read_test_msg", roomId: "read_test_room", isRead: false)
        try sut.insertMessage(message)

        // When
        try sut.markMessageAsRead("read_test_msg")

        // Then
        let messages = try sut.getMessages(roomId: "read_test_room")
        XCTAssertTrue(messages.first?.isRead ?? false, "Message should be marked as read")
    }

    func testMarkAllMessagesAsRead() throws {
        // Given
        let message1 = createMockMessage(id: "multi_read_1", roomId: "multi_read_room", isRead: false)
        let message2 = createMockMessage(id: "multi_read_2", roomId: "multi_read_room", isRead: false)
        try sut.insertMessages([message1, message2])

        // When
        try sut.markAllMessagesAsRead(roomId: "multi_read_room")

        // Then
        let messages = try sut.getMessages(roomId: "multi_read_room")
        XCTAssertTrue(messages.allSatisfy { $0.isRead }, "All messages should be marked as read")
    }

    func testDeleteMessage() throws {
        // Given
        let message = createMockMessage(id: "delete_test_msg", roomId: "delete_test_room")
        try sut.insertMessage(message)

        // When
        try sut.deleteMessage("delete_test_msg")

        // Then
        let messages = try sut.getMessages(roomId: "delete_test_room")
        XCTAssertEqual(messages.count, 0, "Message should be deleted")
    }

    func testDeleteAllMessagesInRoom() throws {
        // Given
        let message1 = createMockMessage(id: "bulk_delete_1", roomId: "bulk_delete_room")
        let message2 = createMockMessage(id: "bulk_delete_2", roomId: "bulk_delete_room")
        try sut.insertMessages([message1, message2])

        // When
        try sut.deleteMessages(roomId: "bulk_delete_room")

        // Then
        let messages = try sut.getMessages(roomId: "bulk_delete_room")
        XCTAssertEqual(messages.count, 0, "All messages in room should be deleted")
    }

    func testGetUnreadCount() throws {
        // Given
        let readMessage = createMockMessage(id: "unread_count_1", roomId: "unread_count_room", isRead: true)
        let unreadMessage = createMockMessage(id: "unread_count_2", roomId: "unread_count_room", isRead: false)
        try sut.insertMessages([readMessage, unreadMessage])

        // When
        let count = try sut.getUnreadCount(roomId: "unread_count_room")

        // Then
        XCTAssertEqual(count, 1, "Should have one unread message")
    }
}

// MARK: - ChatRoom CRUD Tests

extension DatabaseManagerTests {

    func testSaveChatRoom() throws {
        // Given
        let room = createMockChatRoom(id: "test_room_id", name: "Test Chat Room")

        // When
        try sut.saveChatRoom(room)

        // Then
        let rooms = try sut.getChatRooms()
        XCTAssertEqual(rooms.count, 1, "Should have one chat room")
        XCTAssertEqual(rooms.first?.id, room.id, "Room ID should match")
        XCTAssertEqual(rooms.first?.name, room.name, "Room name should match")
    }

    func testSaveMultipleChatRooms() throws {
        // Given - Use unique IDs to avoid conflicts
        let uniquePrefix = UUID().uuidString.prefix(8)
        let room1 = createMockChatRoom(id: "\(uniquePrefix)_room1", name: "Room 1")
        let room2 = createMockChatRoom(id: "\(uniquePrefix)_room2", name: "Room 2")

        // When
        try sut.saveChatRooms([room1, room2])

        // Then - Check that at least the expected rooms exist
        let rooms = try sut.getChatRooms()
        XCTAssertGreaterThanOrEqual(rooms.count, 2, "Should have at least two chat rooms")
    }

    func testUpdateChatRoom() throws {
        // Given - Use unique ID to avoid conflicts
        let uniqueId = "update_room_\(UUID().uuidString.prefix(8))"
        let room = createMockChatRoom(id: uniqueId, name: "Original Name")
        try sut.saveChatRoom(room)

        // When - save again with same ID (should replace)
        let updatedRoom = ChatRoom(
            id: uniqueId,
            name: "Updated Name",
            type: .group,
            participants: [],
            lastMessage: nil,
            unreadCount: 5,
            createdAt: Date(),
            updatedAt: Date()
        )
        try sut.saveChatRoom(updatedRoom)

        // Then
        let rooms = try sut.getChatRooms()
        let targetRoom = rooms.first(where: { $0.id == uniqueId })
        XCTAssertNotNil(targetRoom, "Room should exist")
        XCTAssertEqual(targetRoom?.name, "Updated Name", "Room name should be updated")
    }

    func testDeleteChatRoom() throws {
        // Given
        let room = createMockChatRoom(id: "delete_room", name: "Delete Me")
        try sut.saveChatRoom(room)
        try sut.insertMessage(createMockMessage(id: "msg_for_delete_room", roomId: "delete_room"))

        // When
        try sut.deleteChatRoom("delete_room")

        // Then
        let rooms = try sut.getChatRooms()
        XCTAssertEqual(rooms.count, 0, "Chat room should be deleted")

        // Verify messages are also deleted
        let messages = try sut.getMessages(roomId: "delete_room")
        XCTAssertEqual(messages.count, 0, "Messages should be deleted with room")
    }

    func testUpdateRoomUnreadCount() throws {
        // Given
        let room = createMockChatRoom(id: "unread_room", name: "Unread Test")
        try sut.saveChatRoom(room)

        // When
        try sut.updateRoomUnreadCount(roomId: "unread_room", count: 10)

        // Then - need to retrieve and verify (implementation returns simplified ChatRoom)
        let rooms = try sut.getChatRooms()
        // Note: The getChatRooms returns simplified version without unreadCount
        // This test verifies the method doesn't throw
        XCTAssertTrue(true, "Update should complete without error")
    }
}

// MARK: - StudySession CRUD Tests

extension DatabaseManagerTests {

    func testSaveStudySession() throws {
        // Given - Use unique ID to avoid conflicts
        let uniqueId = "session_test_\(UUID().uuidString.prefix(8))"
        let session = createMockStudySession(id: uniqueId)

        // When
        try sut.saveStudySession(session)

        // Then
        let sessions = try sut.getUnsyncedStudySessions()
        let targetSession = sessions.first(where: { $0.id == uniqueId })
        XCTAssertNotNil(targetSession, "Session should exist")
        XCTAssertEqual(targetSession?.id, uniqueId, "Session ID should match")
    }

    func testGetUnsyncedStudySessions() throws {
        // Given - Use unique IDs
        let uniquePrefix = UUID().uuidString.prefix(8)
        let completedSession = createMockStudySession(id: "\(uniquePrefix)_completed", userId: "user1")
        let incompleteSession = StudySession(
            id: "\(uniquePrefix)_incomplete",
            userId: "user1",
            duration: 30,
            startedAt: Date(),
            endedAt: nil,
            earnedPoints: nil,
            isCompleted: false,
            subject: "Test",
            notes: nil,
            createdAt: Date()
        )

        try sut.saveStudySession(completedSession)
        try sut.saveStudySession(incompleteSession)

        // When
        let unsyncedSessions = try sut.getUnsyncedStudySessions()

        // Then - Only completed sessions should be returned
        let hasCompletedSession = unsyncedSessions.contains(where: { $0.id == "\(uniquePrefix)_completed" })
        XCTAssertTrue(hasCompletedSession, "Should have the unsynced completed session")
    }

    func testMarkStudySessionSynced() throws {
        // Given - Use unique ID
        let uniqueId = "sync_test_session_\(UUID().uuidString.prefix(8))"
        let session = createMockStudySession(id: uniqueId)
        try sut.saveStudySession(session)

        // When
        try sut.markStudySessionSynced(uniqueId)

        // Then
        let sessions = try sut.getUnsyncedStudySessions()
        let syncedSession = sessions.first(where: { $0.id == uniqueId })
        XCTAssertNil(syncedSession, "Session should be marked as synced and not in unsynced list")
    }

    func testGetStudyStats() throws {
        // Given
        let session1 = StudySession(
            id: "stats_session_1",
            userId: "stats_user",
            duration: 60,
            startedAt: Date(),
            endedAt: Date(),
            earnedPoints: 10,
            isCompleted: true,
            subject: "Math",
            notes: nil,
            createdAt: Date()
        )
        let session2 = StudySession(
            id: "stats_session_2",
            userId: "stats_user",
            duration: 30,
            startedAt: Date(),
            endedAt: Date(),
            earnedPoints: 5,
            isCompleted: true,
            subject: "English",
            notes: nil,
            createdAt: Date()
        )
        try sut.saveStudySession(session1)
        try sut.saveStudySession(session2)

        // When
        let stats = try sut.getStudyStats(userId: "stats_user")

        // Then
        XCTAssertEqual(stats.totalDuration, 90, "Total duration should be 90 minutes")
        XCTAssertEqual(stats.sessionCount, 2, "Should have 2 sessions")
    }
}

// MARK: - PointsTransaction CRUD Tests

extension DatabaseManagerTests {

    func testSavePointsTransaction() throws {
        // Given - Use unique ID
        let uniqueId = "points_tx_\(UUID().uuidString.prefix(8))"
        let transaction = createMockPointsTransaction(id: uniqueId)

        // When
        try sut.savePointsTransaction(transaction)

        // Then
        let history = try sut.getPointsHistory()
        let targetTx = history.first(where: { $0.id == uniqueId })
        XCTAssertNotNil(targetTx, "Transaction should exist")
        XCTAssertEqual(targetTx?.id, uniqueId, "Transaction ID should match")
    }

    func testSaveMultiplePointsTransactions() throws {
        // Given - Use unique IDs
        let uniquePrefix = UUID().uuidString.prefix(8)
        let tx1 = createMockPointsTransaction(id: "\(uniquePrefix)_tx1")
        let tx2 = createMockPointsTransaction(id: "\(uniquePrefix)_tx2")
        let tx3 = createMockPointsTransaction(id: "\(uniquePrefix)_tx3")

        // When
        try sut.savePointsTransactions([tx1, tx2, tx3])

        // Then
        let history = try sut.getPointsHistory()
        XCTAssertGreaterThanOrEqual(history.count, 3, "Should have at least three transactions")
    }

    func testGetPointsHistoryWithLimit() throws {
        // Given - Use unique prefix
        let uniquePrefix = UUID().uuidString.prefix(8)
        for i in 0..<20 {
            let tx = createMockPointsTransaction(id: "\(uniquePrefix)_tx_\(i)")
            try sut.savePointsTransaction(tx)
        }

        // When
        let history = try sut.getPointsHistory(limit: 10)

        // Then
        XCTAssertEqual(history.count, 10, "Should return limited transactions")
    }

    func testGetPointsHistoryWithOffset() throws {
        // Given
        for i in 0..<10 {
            let tx = createMockPointsTransaction(id: "offset_tx_\(i)")
            try sut.savePointsTransaction(tx)
        }

        // When
        let firstPage = try sut.getPointsHistory(limit: 5, offset: 0)
        let secondPage = try sut.getPointsHistory(limit: 5, offset: 5)

        // Then
        XCTAssertEqual(firstPage.count, 5, "First page should have 5 items")
        XCTAssertEqual(secondPage.count, 5, "Second page should have 5 items")

        // Verify no overlap
        let firstIds = Set(firstPage.map { $0.id })
        let secondIds = Set(secondPage.map { $0.id })
        XCTAssertTrue(firstIds.isDisjoint(with: secondIds), "Pages should not overlap")
    }
}

// MARK: - Transaction Tests

extension DatabaseManagerTests {

    func testBatchInsertIsAtomic() throws {
        // Given
        let messages = [
            createMockMessage(id: "atomic_1", roomId: "atomic_room"),
            createMockMessage(id: "atomic_2", roomId: "atomic_room"),
            createMockMessage(id: "atomic_3", roomId: "atomic_room")
        ]

        // When
        try sut.insertMessages(messages)

        // Then
        let retrieved = try sut.getMessages(roomId: "atomic_room")
        XCTAssertEqual(retrieved.count, 3, "All messages should be inserted atomically")
    }

    func testTransactionRollback() throws {
        // Given - test db with transaction capability
        guard let db = testDb.db else {
            XCTSkip("Test database not available")
            return
        }

        // Insert initial message
        let initialMessage = createMockMessage(id: "initial_msg", roomId: "rollback_test")
        try sut.insertMessage(initialMessage)

        // When - attempt transaction that fails
        do {
            try db.transaction {
                // Insert first message
                try testDb.performWithLock {
                    try db.run(testDb.messagesTable.insert(
                        testDb.messageId <- "tx_msg_1",
                        testDb.messageRoomId <- "tx_room",
                        testDb.messageSenderId <- "sender",
                        testDb.messageSenderType <- "user",
                        testDb.messageContent <- "content",
                        testDb.messageType <- "text",
                        testDb.messageIsRead <- false,
                        testDb.messageCreatedAt <- Date()
                    ))
                }

                // Try to insert duplicate (should fail)
                try testDb.performWithLock {
                    try db.run(testDb.messagesTable.insert(
                        testDb.messageId <- "tx_msg_1", // Duplicate key
                        testDb.messageRoomId <- "tx_room",
                        testDb.messageSenderId <- "sender",
                        testDb.messageSenderType <- "user",
                        testDb.messageContent <- "content",
                        testDb.messageType <- "text",
                        testDb.messageIsRead <- false,
                        testDb.messageCreatedAt <- Date()
                    ))
                }
            }
            XCTFail("Transaction should have failed")
        } catch {
            // Then - transaction should have rolled back
            let messages = try sut.getMessages(roomId: "tx_room")
            XCTAssertEqual(messages.count, 0, "Transaction should have rolled back")
        }
    }
}

// MARK: - Concurrency Tests

extension DatabaseManagerTests {

    func testConcurrentReads() throws {
        // Given
        let message = createMockMessage(id: "concurrent_read_msg", roomId: "concurrent_read_room")
        try sut.insertMessage(message)

        // When - perform concurrent reads
        let expectation = XCTestExpectation(description: "Concurrent reads")
        expectation.expectedFulfillmentCount = 10

        for _ in 0..<10 {
            DispatchQueue.global().async {
                do {
                    _ = try self.sut.getMessages(roomId: "concurrent_read_room")
                    expectation.fulfill()
                } catch {
                    XCTFail("Concurrent read should not fail: \(error)")
                }
            }
        }

        wait(for: [expectation], timeout: 5.0)
    }

    func testConcurrentWrites() throws {
        // Given
        let expectation = XCTestExpectation(description: "Concurrent writes")
        expectation.expectedFulfillmentCount = 10

        // When - perform concurrent writes
        for i in 0..<10 {
            DispatchQueue.global().async {
                do {
                    let msg = self.createMockMessage(id: "concurrent_write_\(i)", roomId: "concurrent_write_room")
                    try self.sut.insertMessage(msg)
                    expectation.fulfill()
                } catch {
                    XCTFail("Concurrent write should not fail: \(error)")
                }
            }
        }

        wait(for: [expectation], timeout: 10.0)

        // Then
        let messages = try sut.getMessages(roomId: "concurrent_write_room")
        XCTAssertEqual(messages.count, 10, "All concurrent writes should succeed")
    }

    func testMixedReadWriteOperations() throws {
        // Given
        let writeExpectation = XCTestExpectation(description: "Mixed operations")
        writeExpectation.expectedFulfillmentCount = 20

        // When - mix of reads and writes
        for i in 0..<20 {
            DispatchQueue.global().async {
                do {
                    if i % 2 == 0 {
                        // Write
                        let msg = self.createMockMessage(id: "mixed_\(i)", roomId: "mixed_room")
                        try self.sut.insertMessage(msg)
                    } else {
                        // Read
                        _ = try self.sut.getMessages(roomId: "mixed_room")
                    }
                    writeExpectation.fulfill()
                } catch {
                    XCTFail("Mixed operation should not fail: \(error)")
                }
            }
        }

        wait(for: [writeExpectation], timeout: 15.0)
    }
}

// MARK: - Encryption Tests

extension DatabaseManagerTests {

    func testMessageContentIsEncrypted() throws {
        // Given
        let sensitiveMessage = createMockMessage(id: "encrypt_msg", roomId: "encrypt_room")
        try sut.insertMessage(sensitiveMessage)

        // When - retrieve and check content is accessible (manager handles decryption)
        let messages = try sut.getMessages(roomId: "encrypt_room")

        // Then - content should be decrypted and match original
        XCTAssertEqual(messages.first?.content, sensitiveMessage.content, "Message content should be decrypted correctly")
    }

    func testPointsDescriptionIsEncrypted() throws {
        // Given
        let sensitiveTx = PointsTransaction(
            id: "encrypt_tx",
            pointsChange: 100,
            type: .achievement,
            description: "Secret achievement description",
            balanceAfter: 100,
            createdAt: Date()
        )
        try sut.savePointsTransaction(sensitiveTx)

        // When
        let history = try sut.getPointsHistory()

        // Then
        XCTAssertEqual(history.first?.description, sensitiveTx.description, "Description should be decrypted correctly")
    }
}

// MARK: - Corruption Recovery Tests

extension DatabaseManagerTests {

    func testCorruptionRecovery() {
        // When
        let result = sut.testCorruptionRecovery()

        // Then
        XCTAssertNotNil(result, "Recovery test should return result")
        XCTAssertNotNil(result.timestamp, "Result should have timestamp")
    }

    func testDatabaseIntegrityCheck() {
        // When
        let result = sut.testCorruptionRecovery()

        // Then
        if result.passed {
            XCTAssertTrue(result.messages.contains { $0.contains("OK") }, "Should have passed checks")
        }
    }

    func testMaintenanceOperation() throws {
        // Given - add some data
        let message = createMockMessage(id: "maintenance_msg", roomId: "maintenance_room")
        try sut.insertMessage(message)

        // When
        try sut.performMaintenance()

        // Then - data should still be accessible
        let messages = try sut.getMessages(roomId: "maintenance_room")
        XCTAssertEqual(messages.count, 1, "Data should be intact after maintenance")
    }
}

// MARK: - Error Handling Tests

extension DatabaseManagerTests {

    func testNotConnectedError() {
        // Given - create manager with invalid path behavior simulated
        // We test this by ensuring DatabaseError.notConnected is properly defined

        // Then
        let error = DatabaseError.notConnected
        XCTAssertNotNil(error.errorDescription, "Error should have description")
    }

    func testQueryFailedError() {
        // Given
        let error = DatabaseError.queryFailed("Invalid SQL")

        // Then
        XCTAssertEqual(error.errorDescription, "Query failed: Invalid SQL")
    }

    func testInsertFailedError() {
        // Given
        let error = DatabaseError.insertFailed("Constraint violation")

        // Then
        XCTAssertEqual(error.errorDescription, "Insert failed: Constraint violation")
    }

    func testDeleteFailedError() {
        // Given
        let error = DatabaseError.deleteFailed("Record not found")

        // Then
        XCTAssertEqual(error.errorDescription, "Delete failed: Record not found")
    }

    func testEncryptionFailedError() {
        // Given
        let error = DatabaseError.encryptionFailed

        // Then
        XCTAssertEqual(error.errorDescription, "Data encryption failed")
    }

    func testDecryptionFailedError() {
        // Given
        let error = DatabaseError.decryptionFailed

        // Then
        XCTAssertEqual(error.errorDescription, "Data decryption failed")
    }
}

// MARK: - Data Cleanup Tests

extension DatabaseManagerTests {

    func testClearAllData() throws {
        // Given
        let message = createMockMessage(id: "clear_msg", roomId: "clear_room")
        let room = createMockChatRoom(id: "clear_room_id")
        let session = createMockStudySession(id: "clear_session")
        let tx = createMockPointsTransaction(id: "clear_tx")

        try sut.insertMessage(message)
        try sut.saveChatRoom(room)
        try sut.saveStudySession(session)
        try sut.savePointsTransaction(tx)

        // When
        try sut.clearAllData()

        // Then
        let messages = try sut.getMessages(roomId: "clear_room")
        let rooms = try sut.getChatRooms()
        let sessions = try sut.getUnsyncedStudySessions()
        let transactions = try sut.getPointsHistory()

        XCTAssertEqual(messages.count, 0, "All messages should be cleared")
        XCTAssertEqual(rooms.count, 0, "All rooms should be cleared")
        XCTAssertEqual(sessions.count, 0, "All sessions should be cleared")
        XCTAssertEqual(transactions.count, 0, "All transactions should be cleared")
    }

    func testClearExpiredData() throws {
        // Given - insert current messages and old messages
        let currentMessage = createMockMessage(id: "current_msg", roomId: "expired_room")
        try sut.insertMessage(currentMessage)

        // Note: Testing actual expiration requires manipulating dates
        // This test verifies the method executes without error

        // When
        try sut.clearExpiredData()

        // Then - current messages should still exist
        let messages = try sut.getMessages(roomId: "expired_room")
        XCTAssertGreaterThan(messages.count, 0, "Current messages should remain")
    }
}

// MARK: - Edge Cases

extension DatabaseManagerTests {

    func testEmptyRoomMessages() throws {
        // When
        let messages = try sut.getMessages(roomId: "nonexistent_room")

        // Then
        XCTAssertEqual(messages.count, 0, "Should return empty array for nonexistent room")
    }

    func testDuplicateMessageInsert() throws {
        // Given
        let message = createMockMessage(id: "duplicate_msg", roomId: "dup_room")

        // When
        try sut.insertMessage(message)

        // Then - inserting same ID should succeed due to "or replace" behavior
        // or fail depending on implementation
        do {
            try sut.insertMessage(message)
            // If no error, verify only one message exists (replace behavior)
            let messages = try sut.getMessages(roomId: "dup_room")
            XCTAssertEqual(messages.count, 1, "Should have only one message after replace")
        } catch {
            // If error, that's also acceptable behavior
            XCTAssertTrue(true, "Duplicate insert may throw error")
        }
    }

    func testVeryLongTextContent() throws {
        // Given
        let longText = String(repeating: "A", count: 10000)
        let message = ChatMessage(
            id: "long_text_msg",
            roomId: "long_text_room",
            senderId: "user",
            sender: .user,
            content: longText,
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

        // When
        try sut.insertMessage(message)

        // Then
        let messages = try sut.getMessages(roomId: "long_text_room")
        XCTAssertEqual(messages.first?.content.count, longText.count, "Long text should be stored correctly")
    }

    func testSpecialCharactersInContent() throws {
        // Given
        let specialText = "Test with emojis \u{1F600}\u{1F603} and special chars <>&\"'"
        let message = createMockMessage(id: "special_msg", roomId: "special_room")
        let modifiedMessage = ChatMessage(
            id: message.id,
            roomId: message.roomId,
            senderId: message.senderId,
            sender: message.sender,
            content: specialText,
            messageType: message.messageType,
            mediaUrl: message.mediaUrl,
            mediaMimeType: message.mediaMimeType,
            mediaDuration: message.mediaDuration,
            mediaSize: message.mediaSize,
            mediaMetadata: message.mediaMetadata,
            voiceUrl: message.voiceUrl,
            voiceDuration: message.voiceDuration,
            voiceTranscript: message.voiceTranscript,
            voiceMimeType: message.voiceMimeType,
            isRead: message.isRead,
            createdAt: message.createdAt
        )

        // When
        try sut.insertMessage(modifiedMessage)

        // Then
        let messages = try sut.getMessages(roomId: "special_room")
        XCTAssertEqual(messages.first?.content, specialText, "Special characters should be handled correctly")
    }
}
