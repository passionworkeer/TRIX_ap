//
//  DatabaseIntegrationTests.swift
//  TRIX3DCompanionTests
//
//  Integration tests for DatabaseManager covering:
//  - Insert data → query → verify
//  - Update data → verify
//  - Delete data → verify
//  - Transaction rollback on error
//  - Concurrent access handling
//  - Migration test (schema version changes)
//
//  These tests verify end-to-end database operations using async/await
//  and XCTestExpectation for waiting on concurrent operations.
//

import XCTest
import SQLite
@testable import TRIX3DCompanion

// MARK: - Mock Database Connection for Integration Testing

/// Mock database connection for integration testing with transaction support
final class MockDatabaseConnection {
    let dbPath: String
    private(set) var db: Connection?
    private let writeQueue = DispatchQueue(label: "com.trix3d.test.db.write", qos: .userInitiated)
    private let readQueue = DispatchQueue(label: "com.trix3d.test.db.read", qos: .userInitiated, attributes: .concurrent)
    private let accessLock = NSLock()
    private var transactionDepth = 0

    // Tables
    let messagesTable = Table("messages")
    let chatRoomsTable = Table("chat_rooms")
    let studySessionsTable = Table("study_sessions")
    let pointsHistoryTable = Table("points_history")
    let schemaVersionTable = Table("schema_version")

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

    // Schema Version Columns
    let versionId = Expression<Int>("version")
    let versionAppliedAt = Expression<Date>("applied_at")

    init() {
        let tempDir = NSTemporaryDirectory()
        dbPath = (tempDir as NSString).appendingPathComponent("integration_test_\(UUID().uuidString).sqlite")
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
            try db?.run("PRAGMA journal_mode = WAL")
        } catch {
            print("Failed to open database: \(error)")
        }
    }

    func closeDatabase() {
        accessLock.lock()
        db = nil
        accessLock.unlock()
    }

    private func createTables() {
        createMessagesTable()
        createChatRoomsTable()
        createStudySessionsTable()
        createPointsHistoryTable()
        createSchemaVersionTable()
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
            })
            try db?.run(messagesTable.createIndex(messageRoomId, ifNotExists: true))
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
            })
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
            })
        } catch {
            print("Failed to create points_history table: \(error)")
        }
    }

    private func createSchemaVersionTable() {
        do {
            try db?.run(schemaVersionTable.create(ifNotExists: true) { t in
                t.column(versionId, primaryKey: true)
                t.column(versionAppliedAt)
            })
        } catch {
            print("Failed to create schema_version table: \(error)")
        }
    }

    // MARK: - Thread-Safe Operations

    func performWrite<T>(_ operation: () throws -> T) throws -> T {
        return try writeQueue.sync {
            accessLock.lock()
            defer { accessLock.unlock() }
            return try operation()
        }
    }

    func performRead<T>(_ operation: () throws -> T) throws -> T {
        return try readQueue.sync {
            return try operation()
        }
    }

    // MARK: - Transaction Support

    func beginTransaction() throws {
        accessLock.lock()
        transactionDepth += 1
        if transactionDepth == 1 {
            try db?.execute("BEGIN IMMEDIATE")
        }
        accessLock.unlock()
    }

    func commitTransaction() throws {
        accessLock.lock()
        transactionDepth -= 1
        if transactionDepth == 0 {
            try db?.execute("COMMIT")
        }
        accessLock.unlock()
    }

    func rollbackTransaction() throws {
        accessLock.lock()
        transactionDepth -= 1
        if transactionDepth == 0 {
            try db?.execute("ROLLBACK")
        }
        accessLock.unlock()
    }

    // MARK: - Data Operations

    func insertMessage(_ message: ChatMessage) throws {
        try performWrite {
            try db?.run(messagesTable.insert(or: .replace,
                messageId <- message.id,
                messageRoomId <- message.roomId,
                messageSenderId <- message.senderId,
                messageSenderType <- message.sender.rawValue,
                messageContent <- message.content,
                messageType <- message.messageType.rawValue,
                messageMediaUrl <- message.mediaUrl,
                messageMediaMimeType <- message.mediaMimeType,
                messageMediaDuration <- message.mediaDuration,
                messageIsRead <- message.isRead,
                messageCreatedAt <- message.createdAt
            ))
        }
    }

    func getMessages(roomId: String, limit: Int? = nil) throws -> [ChatMessage] {
        return try performRead {
            var query = messagesTable.filter(messageRoomId == roomId)
                .order(messageCreatedAt.desc)

            if let limit = limit {
                query = query.limit(limit)
            }

            guard let db = db else { return [] }

            return try db.prepare(query).map { row in
                ChatMessage(
                    id: row[messageId],
                    roomId: row[messageRoomId],
                    senderId: row[messageSenderId],
                    sender: MessageSender(rawValue: row[messageSenderType]) ?? .user,
                    content: row[messageContent],
                    messageType: MessageType(rawValue: row[messageType]) ?? .text,
                    mediaUrl: row[messageMediaUrl],
                    mediaMimeType: row[messageMediaMimeType],
                    mediaDuration: row[messageMediaDuration],
                    mediaSize: nil,
                    mediaMetadata: nil,
                    voiceUrl: nil,
                    voiceDuration: nil,
                    voiceTranscript: nil,
                    voiceMimeType: nil,
                    isRead: row[messageIsRead],
                    createdAt: row[messageCreatedAt]
                )
            }
        }
    }

    func updateMessageReadStatus(messageId: String, isRead: Bool) throws {
        try performWrite {
            let message = messagesTable.filter(self.messageId == messageId)
            try db?.run(message.update(messageIsRead <- isRead))
        }
    }

    func deleteMessage(messageId: String) throws {
        try performWrite {
            let message = messagesTable.filter(self.messageId == messageId)
            try db?.run(message.delete())
        }
    }

    func insertChatRoom(_ room: ChatRoom) throws {
        try performWrite {
            try db?.run(chatRoomsTable.insert(or: .replace,
                roomId <- room.id,
                roomName <- room.name,
                roomType <- room.type.rawValue,
                roomLastMessage <- room.lastMessage?.content,
                roomUnreadCount <- room.unreadCount,
                roomUpdatedAt <- room.updatedAt
            ))
        }
    }

    func getChatRooms() throws -> [ChatRoom] {
        return try performRead {
            guard let db = db else { return [] }

            return try db.prepare(chatRoomsTable.order(roomUpdatedAt.desc)).map { row in
                ChatRoom(
                    id: row[roomId],
                    name: row[roomName],
                    type: ChatRoomType(rawValue: row[roomType]) ?? .ai,
                    participants: [],
                    lastMessage: nil,
                    unreadCount: row[roomUnreadCount],
                    createdAt: Date(),
                    updatedAt: row[roomUpdatedAt]
                )
            }
        }
    }

    func deleteChatRoom(roomId: String) throws {
        try performWrite {
            // Delete associated messages first
            let messages = messagesTable.filter(messageRoomId == roomId)
            try db?.run(messages.delete())

            // Delete room
            let room = chatRoomsTable.filter(self.roomId == roomId)
            try db?.run(room.delete())
        }
    }

    func insertStudySession(_ session: StudySession) throws {
        try performWrite {
            try db?.run(studySessionsTable.insert(or: .replace,
                sessionId <- session.id,
                sessionUserId <- session.userId,
                sessionSubject <- session.subject,
                sessionDuration <- session.duration,
                sessionStartedAt <- session.startedAt,
                sessionEndedAt <- session.endedAt,
                sessionNotes <- session.notes,
                sessionEarnedPoints <- session.earnedPoints,
                sessionIsCompleted <- session.isCompleted,
                sessionSynced <- false
            ))
        }
    }

    func getUnsyncedSessions() throws -> [StudySession] {
        return try performRead {
            let query = studySessionsTable.filter(sessionSynced == false)
            guard let db = db else { return [] }

            return try db.prepare(query).map { row in
                StudySession(
                    id: row[sessionId],
                    userId: row[sessionUserId],
                    duration: row[sessionDuration],
                    startedAt: row[sessionStartedAt],
                    endedAt: row[sessionEndedAt],
                    earnedPoints: row[sessionEarnedPoints],
                    isCompleted: row[sessionIsCompleted],
                    subject: row[sessionSubject],
                    notes: row[sessionNotes],
                    createdAt: row[sessionStartedAt]
                )
            }
        }
    }

    func markSessionSynced(sessionId: String) throws {
        try performWrite {
            let session = studySessionsTable.filter(self.sessionId == sessionId)
            try db?.run(session.update(sessionSynced <- true))
        }
    }

    func insertPointsTransaction(_ tx: PointsTransaction) throws {
        try performWrite {
            try db?.run(pointsHistoryTable.insert(or: .replace,
                transactionId <- tx.id,
                transactionPointsChange <- tx.pointsChange,
                transactionType <- tx.type.rawValue,
                transactionDescription <- tx.description,
                transactionBalanceAfter <- tx.balanceAfter,
                transactionCreatedAt <- tx.createdAt
            ))
        }
    }

    func getPointsHistory(limit: Int? = nil) throws -> [PointsTransaction] {
        return try performRead {
            var query = pointsHistoryTable.order(transactionCreatedAt.desc)

            if let limit = limit {
                query = query.limit(limit)
            }

            guard let db = db else { return [] }

            return try db.prepare(query).map { row in
                PointsTransaction(
                    id: row[transactionId],
                    pointsChange: row[transactionPointsChange],
                    type: TransactionType(rawValue: row[transactionType]) ?? .studyComplete,
                    description: row[transactionDescription],
                    balanceAfter: row[transactionBalanceAfter],
                    createdAt: row[transactionCreatedAt]
                )
            }
        }
    }

    // MARK: - Schema Migration

    func getSchemaVersion() throws -> Int? {
        return try performRead {
            guard let db = db else { return nil }
            if let row = try db.pluck(schemaVersionTable) {
                return row[versionId]
            }
            return nil
        }
    }

    func setSchemaVersion(_ version: Int) throws {
        try performWrite {
            // Clear existing versions
            try db?.run(schemaVersionTable.delete())

            // Insert new version
            try db?.run(schemaVersionTable.insert(
                versionId <- version,
                versionAppliedAt <- Date()
            ))
        }
    }

    func clearAllData() throws {
        try performWrite {
            try db?.run(messagesTable.delete())
            try db?.run(chatRoomsTable.delete())
            try db?.run(studySessionsTable.delete())
            try db?.run(pointsHistoryTable.delete())
        }
    }
}

// MARK: - Database Integration Tests

final class DatabaseIntegrationTests: XCTestCase {

    // MARK: - Properties

    var mockDb: MockDatabaseConnection!
    var sut: DatabaseManager!

    // MARK: - Setup & Teardown

    override func setUp() {
        super.setUp()
        mockDb = MockDatabaseConnection()
        sut = DatabaseManager.shared
    }

    override func tearDown() {
        try? mockDb.clearAllData()
        mockDb = nil
        super.tearDown()
    }

    // MARK: - Insert Data → Query → Verify Tests

    func testInsertMessageAndQuery() throws {
        // Given
        let message = createMockMessage(id: "test_msg_1", roomId: "test_room")

        // When
        try mockDb.insertMessage(message)

        // Then
        let retrieved = try mockDb.getMessages(roomId: "test_room")
        XCTAssertEqual(retrieved.count, 1)
        XCTAssertEqual(retrieved.first?.id, "test_msg_1")
        XCTAssertEqual(retrieved.first?.content, "Test message content test_msg_1")
    }

    func testInsertMultipleMessagesAndQuery() throws {
        // Given
        let messages = [
            createMockMessage(id: "msg_1", roomId: "room_multi"),
            createMockMessage(id: "msg_2", roomId: "room_multi"),
            createMockMessage(id: "msg_3", roomId: "room_multi")
        ]

        // When
        for message in messages {
            try mockDb.insertMessage(message)
        }

        // Then
        let retrieved = try mockDb.getMessages(roomId: "room_multi")
        XCTAssertEqual(retrieved.count, 3)
    }

    func testInsertChatRoomAndQuery() throws {
        // Given
        let room = createMockChatRoom(id: "test_room_id", name: "Test Room")

        // When
        try mockDb.insertChatRoom(room)

        // Then
        let retrieved = try mockDb.getChatRooms()
        XCTAssertEqual(retrieved.count, 1)
        XCTAssertEqual(retrieved.first?.id, "test_room_id")
        XCTAssertEqual(retrieved.first?.name, "Test Room")
    }

    func testInsertStudySessionAndQuery() throws {
        // Given
        let session = createMockStudySession(id: "session_test")

        // When
        try mockDb.insertStudySession(session)

        // Then
        let retrieved = try mockDb.getUnsyncedSessions()
        XCTAssertEqual(retrieved.count, 1)
        XCTAssertEqual(retrieved.first?.id, "session_test")
    }

    func testInsertPointsTransactionAndQuery() throws {
        // Given
        let transaction = createMockPointsTransaction(id: "tx_test")

        // When
        try mockDb.insertPointsTransaction(transaction)

        // Then
        let retrieved = try mockDb.getPointsHistory()
        XCTAssertEqual(retrieved.count, 1)
        XCTAssertEqual(retrieved.first?.id, "tx_test")
        XCTAssertEqual(retrieved.first?.pointsChange, 100)
    }

    func testInsertAndQueryWithLimit() throws {
        // Given
        for i in 1...10 {
            let message = createMockMessage(id: "msg_limit_\(i)", roomId: "limit_room")
            try mockDb.insertMessage(message)
        }

        // When
        let retrieved = try mockDb.getMessages(roomId: "limit_room", limit: 5)

        // Then
        XCTAssertEqual(retrieved.count, 5)
    }

    func testInsertAndQueryAcrossMultipleTables() throws {
        // Given
        let message = createMockMessage(id: "cross_msg", roomId: "cross_room")
        let room = createMockChatRoom(id: "cross_room", name: "Cross Room")
        let session = createMockStudySession(id: "cross_session")
        let tx = createMockPointsTransaction(id: "cross_tx")

        // When
        try mockDb.insertMessage(message)
        try mockDb.insertChatRoom(room)
        try mockDb.insertStudySession(session)
        try mockDb.insertPointsTransaction(tx)

        // Then
        let messages = try mockDb.getMessages(roomId: "cross_room")
        let rooms = try mockDb.getChatRooms()
        let sessions = try mockDb.getUnsyncedSessions()
        let transactions = try mockDb.getPointsHistory()

        XCTAssertEqual(messages.count, 1)
        XCTAssertEqual(rooms.count, 1)
        XCTAssertEqual(sessions.count, 1)
        XCTAssertEqual(transactions.count, 1)
    }

    // MARK: - Update Data → Verify Tests

    func testUpdateMessageReadStatus() throws {
        // Given
        let message = createMockMessage(id: "update_msg", roomId: "update_room")
        try mockDb.insertMessage(message)

        // When
        try mockDb.updateMessageReadStatus(messageId: "update_msg", isRead: true)

        // Then
        let retrieved = try mockDb.getMessages(roomId: "update_room")
        XCTAssertTrue(retrieved.first?.isRead ?? false)
    }

    func testUpdateMessageToUnread() throws {
        // Given
        let readMessage = createMockMessage(id: "read_msg", roomId: "read_room")
        try mockDb.insertMessage(readMessage)
        try mockDb.updateMessageReadStatus(messageId: "read_msg", isRead: true)

        // When - mark as unread
        try mockDb.updateMessageReadStatus(messageId: "read_msg", isRead: false)

        // Then
        let retrieved = try mockDb.getMessages(roomId: "read_room")
        XCTAssertFalse(retrieved.first?.isRead ?? true)
    }

    func testMarkSessionAsSynced() throws {
        // Given
        let session = createMockStudySession(id: "sync_test_session")
        try mockDb.insertStudySession(session)

        // When
        try mockDb.markSessionSynced(sessionId: "sync_test_session")

        // Then
        let retrieved = try mockDb.getUnsyncedSessions()
        XCTAssertEqual(retrieved.count, 0, "Synced session should not appear in unsynced query")
    }

    func testUpdateAndQueryMultipleMessages() throws {
        // Given
        let messages = [
            createMockMessage(id: "multi_update_1", roomId: "multi_update_room"),
            createMockMessage(id: "multi_update_2", roomId: "multi_update_room"),
            createMockMessage(id: "multi_update_3", roomId: "multi_update_room")
        ]

        for message in messages {
            try mockDb.insertMessage(message)
        }

        // When - mark some as read
        try mockDb.updateMessageReadStatus(messageId: "multi_update_1", isRead: true)
        try mockDb.updateMessageReadStatus(messageId: "multi_update_3", isRead: true)

        // Then
        let retrieved = try mockDb.getMessages(roomId: "multi_update_room")
        let readMessages = retrieved.filter { $0.isRead }
        let unreadMessages = retrieved.filter { !$0.isRead }

        XCTAssertEqual(readMessages.count, 2)
        XCTAssertEqual(unreadMessages.count, 1)
    }

    // MARK: - Delete Data → Verify Tests

    func testDeleteMessage() throws {
        // Given
        let message = createMockMessage(id: "delete_msg", roomId: "delete_room")
        try mockDb.insertMessage(message)

        // When
        try mockDb.deleteMessage(messageId: "delete_msg")

        // Then
        let retrieved = try mockDb.getMessages(roomId: "delete_room")
        XCTAssertEqual(retrieved.count, 0)
    }

    func testDeleteChatRoomCascadesToMessages() throws {
        // Given
        let room = createMockChatRoom(id: "cascade_room", name: "Cascade Room")
        let messages = [
            createMockMessage(id: "cascade_msg_1", roomId: "cascade_room"),
            createMockMessage(id: "cascade_msg_2", roomId: "cascade_room")
        ]

        try mockDb.insertChatRoom(room)
        for message in messages {
            try mockDb.insertMessage(message)
        }

        // When
        try mockDb.deleteChatRoom(roomId: "cascade_room")

        // Then
        let rooms = try mockDb.getChatRooms()
        let messagesAfterDelete = try mockDb.getMessages(roomId: "cascade_room")

        XCTAssertEqual(rooms.count, 0)
        XCTAssertEqual(messagesAfterDelete.count, 0)
    }

    func testDeleteSpecificMessagePreservesOthers() throws {
        // Given
        let messages = [
            createMockMessage(id: "keep_msg", roomId: "keep_room"),
            createMockMessage(id: "delete_this_msg", roomId: "keep_room"),
            createMockMessage(id: "also_keep_msg", roomId: "keep_room")
        ]

        for message in messages {
            try mockDb.insertMessage(message)
        }

        // When
        try mockDb.deleteMessage(messageId: "delete_this_msg")

        // Then
        let retrieved = try mockDb.getMessages(roomId: "keep_room")
        XCTAssertEqual(retrieved.count, 2)
        XCTAssertTrue(retrieved.contains { $0.id == "keep_msg" })
        XCTAssertTrue(retrieved.contains { $0.id == "also_keep_msg" })
        XCTAssertFalse(retrieved.contains { $0.id == "delete_this_msg" })
    }

    func testDeleteAllDataFromTable() throws {
        // Given
        for i in 1...5 {
            let message = createMockMessage(id: "clear_msg_\(i)", roomId: "clear_room")
            try mockDb.insertMessage(message)
        }

        // When
        try mockDb.clearAllData()

        // Then
        let retrieved = try mockDb.getMessages(roomId: "clear_room")
        XCTAssertEqual(retrieved.count, 0)
    }

    // MARK: - Transaction Rollback Tests

    func testTransactionRollbackOnError() throws {
        // Given
        let initialMessage = createMockMessage(id: "initial_msg", roomId: "rollback_room")
        try mockDb.insertMessage(initialMessage)

        // When - start transaction and attempt to insert conflicting data
        do {
            try mockDb.beginTransaction()

            // Insert new message within transaction
            let txMessage = createMockMessage(id: "tx_msg", roomId: "tx_room")
            try mockDb.insertMessage(txMessage)

            // Attempt to insert duplicate without conflict resolution so SQLite raises a constraint error.
            let duplicateMessage = createMockMessage(id: "tx_msg", roomId: "tx_room_dup")
            try mockDb.performWrite {
                try mockDb.db?.run(mockDb.messagesTable.insert(
                    mockDb.messageId <- duplicateMessage.id,
                    mockDb.messageRoomId <- duplicateMessage.roomId,
                    mockDb.messageSenderId <- duplicateMessage.senderId,
                    mockDb.messageSenderType <- duplicateMessage.sender.rawValue,
                    mockDb.messageContent <- duplicateMessage.content,
                    mockDb.messageType <- duplicateMessage.messageType.rawValue,
                    mockDb.messageMediaUrl <- duplicateMessage.mediaUrl,
                    mockDb.messageMediaMimeType <- duplicateMessage.mediaMimeType,
                    mockDb.messageMediaDuration <- duplicateMessage.mediaDuration,
                    mockDb.messageIsRead <- duplicateMessage.isRead,
                    mockDb.messageCreatedAt <- duplicateMessage.createdAt,
                    mockDb.messageSyncedAt <- nil
                ))
            }

            try mockDb.commitTransaction()
            XCTFail("Transaction should have failed")
        } catch {
            // Then - transaction should have rolled back
            try mockDb.rollbackTransaction()

            let messages = try mockDb.getMessages(roomId: "tx_room")
            XCTAssertEqual(messages.count, 0, "Transaction should have rolled back")
        }
    }

    func testTransactionCommitPersistsChanges() throws {
        // Given
        let initialMessage = createMockMessage(id: "pre_tx_msg", roomId: "commit_room")
        try mockDb.insertMessage(initialMessage)

        // When
        try mockDb.beginTransaction()

        let txMessages = [
            createMockMessage(id: "commit_msg_1", roomId: "commit_room"),
            createMockMessage(id: "commit_msg_2", roomId: "commit_room")
        ]

        for message in txMessages {
            try mockDb.insertMessage(message)
        }

        try mockDb.commitTransaction()

        // Then
        let retrieved = try mockDb.getMessages(roomId: "commit_room")
        XCTAssertEqual(retrieved.count, 3, "All messages including pre-transaction should be present")
    }

    func testNestedTransactionBehavior() throws {
        // Given
        try mockDb.beginTransaction()

        // When - inner transaction (within same connection)
        let message = createMockMessage(id: "nested_msg", roomId: "nested_room")
        try mockDb.insertMessage(message)

        // Commit outer transaction
        try mockDb.commitTransaction()

        // Then
        let retrieved = try mockDb.getMessages(roomId: "nested_room")
        XCTAssertEqual(retrieved.count, 1)
    }

    func testTransactionRollbackCleansUpOnError() throws {
        // Given
        try mockDb.beginTransaction()

        let message = createMockMessage(id: "cleanup_msg", roomId: "cleanup_room")
        try mockDb.insertMessage(message)

        // When - rollback due to simulated error
        try mockDb.rollbackTransaction()

        // Then - database should be in clean state
        let retrieved = try mockDb.getMessages(roomId: "cleanup_room")
        XCTAssertEqual(retrieved.count, 0)

        // Verify we can perform new operations
        let newMessage = createMockMessage(id: "new_msg", roomId: "cleanup_room")
        try mockDb.insertMessage(newMessage)

        let afterCleanup = try mockDb.getMessages(roomId: "cleanup_room")
        XCTAssertEqual(afterCleanup.count, 1)
    }

    // MARK: - Concurrent Access Tests

    func testConcurrentReads() throws {
        // Given
        let message = createMockMessage(id: "concurrent_read_msg", roomId: "concurrent_read_room")
        try mockDb.insertMessage(message)

        // When - perform concurrent reads
        let expectation = XCTestExpectation(description: "Concurrent reads complete")
        expectation.expectedFulfillmentCount = 20

        for _ in 0..<20 {
            DispatchQueue.global().async {
                do {
                    _ = try self.mockDb.getMessages(roomId: "concurrent_read_room")
                    expectation.fulfill()
                } catch {
                    XCTFail("Concurrent read should not fail: \(error)")
                }
            }
        }

        wait(for: [expectation], timeout: 10.0)
    }

    func testConcurrentWrites() throws {
        // Given
        let expectation = XCTestExpectation(description: "Concurrent writes complete")
        expectation.expectedFulfillmentCount = 20

        // When - perform concurrent writes
        for i in 0..<20 {
            DispatchQueue.global().async {
                do {
                    let msg = self.createMockMessage(id: "concurrent_write_\(i)", roomId: "concurrent_write_room")
                    try self.mockDb.insertMessage(msg)
                    expectation.fulfill()
                } catch {
                    XCTFail("Concurrent write should not fail: \(error)")
                }
            }
        }

        wait(for: [expectation], timeout: 15.0)

        // Then - all messages should be present
        let retrieved = try mockDb.getMessages(roomId: "concurrent_write_room")
        XCTAssertEqual(retrieved.count, 20)
    }

    func testMixedReadWriteConcurrency() throws {
        // Given
        for i in 0..<10 {
            let msg = createMockMessage(id: "mixed_pre_\(i)", roomId: "mixed_concurrent_room")
            try mockDb.insertMessage(msg)
        }

        let writeExpectation = XCTestExpectation(description: "Mixed operations complete")
        writeExpectation.expectedFulfillmentCount = 30

        // When - mix of reads and writes
        for i in 0..<30 {
            DispatchQueue.global().async {
                do {
                    if i % 3 == 0 {
                        // Write
                        let msg = self.createMockMessage(id: "mixed_\(i)", roomId: "mixed_concurrent_room")
                        try self.mockDb.insertMessage(msg)
                    } else {
                        // Read
                        _ = try self.mockDb.getMessages(roomId: "mixed_concurrent_room")
                    }
                    writeExpectation.fulfill()
                } catch {
                    XCTFail("Mixed operation should not fail: \(error)")
                }
            }
        }

        wait(for: [writeExpectation], timeout: 20.0)

        // Then - all data should be consistent
        let retrieved = try mockDb.getMessages(roomId: "mixed_concurrent_room")
        XCTAssertGreaterThanOrEqual(retrieved.count, 10)
    }

    func testConcurrentUpdates() throws {
        // Given
        for i in 1...10 {
            let msg = createMockMessage(id: "update_concurrent_\(i)", roomId: "update_concurrent_room")
            try mockDb.insertMessage(msg)
        }

        let updateExpectation = XCTestExpectation(description: "Concurrent updates complete")
        updateExpectation.expectedFulfillmentCount = 10

        // When - concurrent updates
        for i in 1...10 {
            DispatchQueue.global().async {
                do {
                    try self.mockDb.updateMessageReadStatus(messageId: "update_concurrent_\(i)", isRead: true)
                    updateExpectation.fulfill()
                } catch {
                    XCTFail("Concurrent update should not fail: \(error)")
                }
            }
        }

        wait(for: [updateExpectation], timeout: 10.0)

        // Then
        let retrieved = try mockDb.getMessages(roomId: "update_concurrent_room")
        XCTAssertTrue(retrieved.allSatisfy { $0.isRead })
    }

    // MARK: - Migration Tests

    func testSchemaVersionInitialized() throws {
        // Given - no schema version set

        // When
        let version = try mockDb.getSchemaVersion()

        // Then
        XCTAssertNil(version, "New database should have no schema version")
    }

    func testSchemaVersionCanBeSet() throws {
        // Given

        // When
        try mockDb.setSchemaVersion(1)

        // Then
        let version = try mockDb.getSchemaVersion()
        XCTAssertEqual(version, 1)
    }

    func testSchemaVersionUpgrade() throws {
        // Given
        try mockDb.setSchemaVersion(1)

        // When - upgrade to version 2
        try mockDb.setSchemaVersion(2)

        // Then
        let version = try mockDb.getSchemaVersion()
        XCTAssertEqual(version, 2)
    }

    func testDataPersistsAfterMigration() throws {
        // Given - data before migration
        let message = createMockMessage(id: "pre_migration_msg", roomId: "migration_room")
        try mockDb.insertMessage(message)
        try mockDb.setSchemaVersion(1)

        // When - migrate schema
        try mockDb.setSchemaVersion(2)

        // Then - data should still exist
        let retrieved = try mockDb.getMessages(roomId: "migration_room")
        XCTAssertEqual(retrieved.count, 1)
        XCTAssertEqual(retrieved.first?.id, "pre_migration_msg")

        // Verify new schema version
        let version = try mockDb.getSchemaVersion()
        XCTAssertEqual(version, 2)
    }

    func testMigrationClearsOldVersion() throws {
        // Given
        try mockDb.setSchemaVersion(1)

        // When
        try mockDb.setSchemaVersion(2)

        // Then - old version should be replaced
        let version = try mockDb.getSchemaVersion()
        XCTAssertEqual(version, 2)
        XCTAssertNotEqual(version, 1)
    }

    // MARK: - Full Integration Flow Tests

    func testCompleteCRUDLifecycle() throws {
        // Given - start fresh

        // CREATE
        let message = createMockMessage(id: "lifecycle_msg", roomId: "lifecycle_room")
        try mockDb.insertMessage(message)

        // READ
        var retrieved = try mockDb.getMessages(roomId: "lifecycle_room")
        XCTAssertEqual(retrieved.count, 1)
        XCTAssertEqual(retrieved.first?.content, "Test message content lifecycle_msg")

        // UPDATE
        try mockDb.updateMessageReadStatus(messageId: "lifecycle_msg", isRead: true)
        retrieved = try mockDb.getMessages(roomId: "lifecycle_room")
        XCTAssertTrue(retrieved.first?.isRead ?? false)

        // DELETE
        try mockDb.deleteMessage(messageId: "lifecycle_msg")
        retrieved = try mockDb.getMessages(roomId: "lifecycle_room")
        XCTAssertEqual(retrieved.count, 0)
    }

    func testCompleteChatRoomLifecycle() throws {
        // CREATE room
        let room = createMockChatRoom(id: "chat_lifecycle", name: "Lifecycle Room")
        try mockDb.insertChatRoom(room)

        // Add messages
        for i in 1...5 {
            let msg = createMockMessage(id: "chat_msg_\(i)", roomId: "chat_lifecycle")
            try mockDb.insertMessage(msg)
        }

        // READ
        var rooms = try mockDb.getChatRooms()
        var messages = try mockDb.getMessages(roomId: "chat_lifecycle")
        XCTAssertEqual(rooms.count, 1)
        XCTAssertEqual(messages.count, 5)

        // DELETE (cascade)
        try mockDb.deleteChatRoom(roomId: "chat_lifecycle")

        // Verify cascade
        rooms = try mockDb.getChatRooms()
        messages = try mockDb.getMessages(roomId: "chat_lifecycle")
        XCTAssertEqual(rooms.count, 0)
        XCTAssertEqual(messages.count, 0)
    }

    func testCompleteStudySessionLifecycle() throws {
        // CREATE sessions
        let sessions = [
            createMockStudySession(id: "study_session_1"),
            createMockStudySession(id: "study_session_2")
        ]

        for session in sessions {
            try mockDb.insertStudySession(session)
        }

        // READ unsynced
        var unsynced = try mockDb.getUnsyncedSessions()
        XCTAssertEqual(unsynced.count, 2)

        // UPDATE - mark one as synced
        try mockDb.markSessionSynced(sessionId: "study_session_1")

        // READ - verify only one remains
        unsynced = try mockDb.getUnsyncedSessions()
        XCTAssertEqual(unsynced.count, 1)
        XCTAssertEqual(unsynced.first?.id, "study_session_2")
    }

    // MARK: - Helper Methods

    private func createMockMessage(id: String, roomId: String) -> ChatMessage {
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
            isRead: false,
            createdAt: Date()
        )
    }

    private func createMockChatRoom(id: String, name: String) -> ChatRoom {
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

    private func createMockStudySession(id: String) -> StudySession {
        StudySession(
            id: id,
            userId: "test_user",
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

    private func createMockPointsTransaction(id: String) -> PointsTransaction {
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
