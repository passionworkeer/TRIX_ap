import Foundation
import SQLite

/// 数据库管理器 - SQLite 封装，用于离线数据缓存
/// 使用 SQLite.swift 库提供类型安全的数据库操作
final class DatabaseManager {

    // MARK: - Singleton

    static let shared = DatabaseManager()

    // MARK: - Properties

    private var db: Connection?
    private let dbPath: String

    // MARK: - Tables

    private let messagesTable = Table("messages")
    private let chatRoomsTable = Table("chat_rooms")
    private let studySessionsTable = Table("study_sessions")
    private let pointsHistoryTable = Table("points_history")

    // MARK: - Message Columns

    private let messageId = Expression<String>("id")
    private let messageRoomId = Expression<String>("room_id")
    private let messageSenderId = Expression<String>("sender_id")
    private let messageSenderType = Expression<String>("sender_type")
    private let messageContent = Expression<String>("content")
    private let messageType = Expression<String>("type")
    private let messageMediaUrl = Expression<String?>("media_url")
    private let messageMediaMimeType = Expression<String?>("media_mime_type")
    private let messageMediaDuration = Expression<Int?>("media_duration")
    private let messageIsRead = Expression<Bool>("is_read")
    private let messageCreatedAt = Expression<Date>("created_at")
    private let messageSyncedAt = Expression<Date?>("synced_at")

    // MARK: - ChatRoom Columns

    private let roomId = Expression<String>("id")
    private let roomName = Expression<String>("name")
    private let roomType = Expression<String>("type")
    private let roomLastMessage = Expression<String?>("last_message")
    private let roomLastMessageAt = Expression<Date?>("last_message_at")
    private let roomUnreadCount = Expression<Int>("unread_count")
    private let roomUpdatedAt = Expression<Date>("updated_at")

    // MARK: - StudySession Columns

    private let sessionId = Expression<String>("id")
    private let sessionUserId = Expression<String>("user_id")
    private let sessionSubject = Expression<String?>("subject")
    private let sessionDuration = Expression<Int>("duration")
    private let sessionStartedAt = Expression<Date>("started_at")
    private let sessionEndedAt = Expression<Date?>("ended_at")
    private let sessionNotes = Expression<String?>("notes")
    private let sessionEarnedPoints = Expression<Int?>("earned_points")
    private let sessionIsCompleted = Expression<Bool>("is_completed")
    private let sessionSynced = Expression<Bool>("synced")

    // MARK: - PointsHistory Columns

    private let transactionId = Expression<String>("id")
    private let transactionPointsChange = Expression<Int>("points_change")
    private let transactionType = Expression<String>("type")
    private let transactionDescription = Expression<String>("description")
    private let transactionBalanceAfter = Expression<Int>("balance_after")
    private let transactionCreatedAt = Expression<Date>("created_at")

    // MARK: - Initialization

    private init() {
        // 创建数据库文件路径
        let fileManager = FileManager.default
        let appSupportURL = try! fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        dbPath = appSupportURL.appendingPathComponent("trix3d.sqlite").path

        // 打开数据库连接
        openDatabase()
        // 创建表
        createTables()
    }

    // MARK: - Database Connection

    private func openDatabase() {
        do {
            db = try Connection(dbPath)
            // 启用外键约束
            try db?.run("PRAGMA foreign_keys = ON")
            SecureLogger.shared.debug("Database opened at: \(dbPath)")
        } catch {
            SecureLogger.shared.error("Failed to open database: \(error)")
        }
    }

    // MARK: - Schema Creation

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

                // 索引
                t.unique(messageId)
            })

            // 创建索引以加速查询
            try db?.run(messagesTable.createIndex(messageRoomId, ifNotExists: true))
            try db?.run(messagesTable.createIndex(messageCreatedAt, ifNotExists: true))
        } catch {
            SecureLogger.shared.error("Failed to create messages table: \(error)")
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
            SecureLogger.shared.error("Failed to create chat_rooms table: \(error)")
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

            // 创建索引用于查询未同步的会话
            try db?.run(studySessionsTable.createIndex(sessionSynced, ifNotExists: true))
        } catch {
            SecureLogger.shared.error("Failed to create study_sessions table: \(error)")
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
            SecureLogger.shared.error("Failed to create points_history table: \(error)")
        }
    }

    // MARK: - Message Operations

    /// 插入消息
    /// - Parameter message: 聊天消息
    /// - Throws: 数据库错误
    func insertMessage(_ message: ChatMessage) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let conversationId = message.roomId ?? message.friendId ?? ""
        let insert = messagesTable.insert(
            messageId <- message.id,
            messageRoomId <- conversationId,
            messageSenderId <- message.senderId ?? "",
            messageSenderType <- message.sender.rawValue,
            messageContent <- message.text,
            messageType <- message.messageType?.rawValue ?? "text",
            messageMediaUrl <- message.mediaUri,
            messageMediaMimeType <- message.mediaType,
            messageMediaDuration <- message.mediaMetadata?.duration,
            messageIsRead <- message.isRead,
            messageCreatedAt <- message.timestamp,
            messageSyncedAt <- nil
        )

        try db.run(insert)
    }

    /// 批量插入消息
    /// - Parameter messages: 消息数组
    /// - Throws: 数据库错误
    func insertMessages(_ messages: [ChatMessage]) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        try db.transaction {
            for message in messages {
                try insertMessage(message)
            }
        }
    }

    /// 获取房间的消息列表
    /// - Parameters:
    ///   - roomId: 房间 ID
    ///   - limit: 限制数量
    ///   - before: 在此时间之前的消息
    /// - Returns: 消息数组
    /// - Throws: 数据库错误
    func getMessages(roomId: String, limit: Int = 50, before date: Date? = nil) throws -> [ChatMessage] {
        guard let db = db else { throw DatabaseError.notConnected }

        var query = messagesTable
            .filter(messageRoomId == roomId)
            .order(messageCreatedAt.desc)
            .limit(limit)

        if let date = date {
            query = messagesTable
                .filter(messageRoomId == roomId && messageCreatedAt < date)
                .order(messageCreatedAt.desc)
                .limit(limit)
        }

        var messages: [ChatMessage] = []
        for row in try db.prepare(query) {
            let message = ChatMessage(
                id: row[messageId],
                roomId: row[messageRoomId],
                friendId: nil,
                sender: MessageSender(rawValue: row[messageSenderType]) ?? .user,
                senderId: row[messageSenderId],
                text: row[messageContent],
                timestamp: row[messageCreatedAt],
                messageType: MessageContentType(rawValue: row[messageType]),
                mediaUri: row[messageMediaUrl],
                mediaType: row[messageMediaMimeType],
                mediaSize: nil,
                mediaMetadata: row[messageMediaDuration].map { duration in
                    MediaMetadata(width: nil, height: nil, duration: duration, thumbnail: nil)
                },
                isRead: row[messageIsRead]
            )
            messages.append(message)
        }

        // 按时间正序返回
        return messages.reversed()
    }

    /// 标记消息为已读
    /// - Parameter messageId: 消息 ID
    /// - Throws: 数据库错误
    func markMessageAsRead(_ messageId: String) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let message = messagesTable.filter(self.messageId == messageId)
        try db.run(message.update(messageIsRead <- true))
    }

    /// 标记房间所有消息为已读
    /// - Parameter roomId: 房间 ID
    /// - Throws: 数据库错误
    func markAllMessagesAsRead(roomId: String) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let messages = messagesTable.filter(messageRoomId == roomId)
        try db.run(messages.update(messageIsRead <- true))
    }

    /// 删除消息
    /// - Parameter messageId: 消息 ID
    /// - Throws: 数据库错误
    func deleteMessage(_ messageId: String) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let message = messagesTable.filter(self.messageId == messageId)
        try db.run(message.delete())
    }

    /// 删除房间的所有消息
    /// - Parameter roomId: 房间 ID
    /// - Throws: 数据库错误
    func deleteMessages(roomId: String) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let messages = messagesTable.filter(messageRoomId == roomId)
        try db.run(messages.delete())
    }

    /// 获取未读消息数量
    /// - Parameter roomId: 房间 ID
    /// - Returns: 未读数量
    /// - Throws: 数据库错误
    func getUnreadCount(roomId: String) throws -> Int {
        guard let db = db else { throw DatabaseError.notConnected }

        let count = try db.scalar(
            messagesTable
                .filter(messageRoomId == roomId && messageIsRead == false)
                .count
        )
        return count
    }

    // MARK: - ChatRoom Operations

    /// 保存聊天房间
    /// - Parameter room: 聊天房间
    /// - Throws: 数据库错误
    func saveChatRoom(_ room: ChatRoom) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let insert = chatRoomsTable.insert(or: .replace,
            roomId <- room.id,
            roomName <- room.name,
            roomType <- room.type.rawValue,
            roomLastMessage <- room.lastMessage?.text,
            roomLastMessageAt <- room.lastMessage?.timestamp,
            roomUnreadCount <- room.unreadCount,
            roomUpdatedAt <- room.updatedAt
        )

        try db.run(insert)
    }

    /// 批量保存聊天房间
    /// - Parameter rooms: 房间数组
    /// - Throws: 数据库错误
    func saveChatRooms(_ rooms: [ChatRoom]) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        try db.transaction {
            for room in rooms {
                try saveChatRoom(room)
            }
        }
    }

    /// 获取所有聊天房间
    /// - Returns: 房间数组
    /// - Throws: 数据库错误
    func getChatRooms() throws -> [ChatRoom] {
        guard let db = db else { throw DatabaseError.notConnected }

        let query = chatRoomsTable.order(roomUpdatedAt.desc)

        var rooms: [ChatRoom] = []
        for row in try db.prepare(query) {
            // 注意：这里返回简化的房间信息，不包含完整的参与者列表
            let room = ChatRoom(
                id: row[roomId],
                name: row[roomName],
                type: ChatRoomType(rawValue: row[roomType]) ?? .ai,
                participants: nil, // 需要从服务器获取
                lastMessage: nil, // 简化处理
                unreadCount: row[roomUnreadCount],
                createdAt: Date(), // 简化处理
                updatedAt: row[roomUpdatedAt]
            )
            rooms.append(room)
        }

        return rooms
    }

    /// 删除聊天房间
    /// - Parameter roomId: 房间 ID
    /// - Throws: 数据库错误
    func deleteChatRoom(_ roomId: String) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let room = chatRoomsTable.filter(self.roomId == roomId)
        try db.run(room.delete())

        // 同时删除房间的消息
        try deleteMessages(roomId: roomId)
    }

    /// 更新房间未读数
    /// - Parameters:
    ///   - roomId: 房间 ID
    ///   - count: 未读数
    /// - Throws: 数据库错误
    func updateRoomUnreadCount(roomId: String, count: Int) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let room = chatRoomsTable.filter(self.roomId == roomId)
        try db.run(room.update(roomUnreadCount <- count))
    }

    // MARK: - StudySession Operations

    /// 保存学习会话
    /// - Parameter session: 学习会话
    /// - Throws: 数据库错误
    func saveStudySession(_ session: StudySession) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let insert = studySessionsTable.insert(or: .replace,
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
        )

        try db.run(insert)
    }

    /// 获取未同步的学习会话
    /// - Returns: 未同步的会话数组
    /// - Throws: 数据库错误
    func getUnsyncedStudySessions() throws -> [StudySession] {
        guard let db = db else { throw DatabaseError.notConnected }

        let query = studySessionsTable.filter(sessionSynced == false && sessionIsCompleted == true)

        var sessions: [StudySession] = []
        for row in try db.prepare(query) {
            let session = StudySession(
                id: row[sessionId],
                userId: row[sessionUserId],
                subject: row[sessionSubject],
                duration: row[sessionDuration],
                startedAt: row[sessionStartedAt],
                endedAt: row[sessionEndedAt],
                notes: row[sessionNotes],
                earnedPoints: row[sessionEarnedPoints],
                isCompleted: row[sessionIsCompleted],
                createdAt: row[sessionStartedAt]
            )
            sessions.append(session)
        }

        return sessions
    }

    /// 标记学习会话为已同步
    /// - Parameter sessionId: 会话 ID
    /// - Throws: 数据库错误
    func markStudySessionSynced(_ sessionId: String) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let session = studySessionsTable.filter(self.sessionId == sessionId)
        try db.run(session.update(sessionSynced <- true))
    }

    /// 获取学习统计
    /// - Parameter userId: 用户 ID
    /// - Returns: 学习统计
    /// - Throws: 数据库错误
    func getStudyStats(userId: String) throws -> StudyStats {
        guard let db = db else { throw DatabaseError.notConnected }

        let calendar = Calendar.current
        let now = Date()
        let startOfDay = calendar.startOfDay(for: now)
        let startOfWeek = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: now))!

        // 总学习时长
        let totalDuration = try db.scalar(
            studySessionsTable
                .filter(sessionUserId == userId && sessionIsCompleted == true)
                .select(sessionDuration.sum)
        ) ?? 0

        // 学习次数
        let sessionCount = try db.scalar(
            studySessionsTable
                .filter(sessionUserId == userId && sessionIsCompleted == true)
                .count
        )

        // 今日时长
        let todayDuration = try db.scalar(
            studySessionsTable
                .filter(
                    sessionUserId == userId &&
                    sessionIsCompleted == true &&
                    sessionStartedAt >= startOfDay
                )
                .select(sessionDuration.sum)
        ) ?? 0

        // 本周时长
        let weekDuration = try db.scalar(
            studySessionsTable
                .filter(
                    sessionUserId == userId &&
                    sessionIsCompleted == true &&
                    sessionStartedAt >= startOfWeek
                )
                .select(sessionDuration.sum)
        ) ?? 0

        return StudyStats(
            totalDuration: totalDuration,
            sessionCount: sessionCount,
            averageDuration: sessionCount > 0 ? totalDuration / sessionCount : 0,
            streakDays: 0, // 需要复杂计算，暂时返回 0
            todayDuration: todayDuration,
            weekDuration: weekDuration
        )
    }

    // MARK: - PointsHistory Operations

    /// 保存积分记录
    /// - Parameter transaction: 积分记录
    /// - Throws: 数据库错误
    func savePointsTransaction(_ transaction: PointsTransaction) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let insert = pointsHistoryTable.insert(or: .replace,
            transactionId <- transaction.id,
            transactionPointsChange <- transaction.pointsChange,
            transactionType <- transaction.type.rawValue,
            transactionDescription <- transaction.description,
            transactionBalanceAfter <- transaction.balanceAfter,
            transactionCreatedAt <- transaction.createdAt
        )

        try db.run(insert)
    }

    /// 批量保存积分记录
    /// - Parameter transactions: 积分记录数组
    /// - Throws: 数据库错误
    func savePointsTransactions(_ transactions: [PointsTransaction]) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        try db.transaction {
            for transaction in transactions {
                try savePointsTransaction(transaction)
            }
        }
    }

    /// 获取积分历史
    /// - Parameters:
    ///   - limit: 限制数量
    ///   - offset: 偏移量
    /// - Returns: 积分记录数组
    /// - Throws: 数据库错误
    func getPointsHistory(limit: Int = 50, offset: Int = 0) throws -> [PointsTransaction] {
        guard let db = db else { throw DatabaseError.notConnected }

        let query = pointsHistoryTable
            .order(transactionCreatedAt.desc)
            .limit(limit, offset: offset)

        var transactions: [PointsTransaction] = []
        for row in try db.prepare(query) {
            let transaction = PointsTransaction(
                id: row[transactionId],
                pointsChange: row[transactionPointsChange],
                type: TransactionType(rawValue: row[transactionType]) ?? .adminAdjust,
                description: row[transactionDescription],
                balanceAfter: row[transactionBalanceAfter],
                createdAt: row[transactionCreatedAt]
            )
            transactions.append(transaction)
        }

        return transactions
    }

    // MARK: - Cleanup

    /// 清除所有数据
    /// - Throws: 数据库错误
    func clearAllData() throws {
        guard let db = db else { throw DatabaseError.notConnected }

        try db.run(messagesTable.delete())
        try db.run(chatRoomsTable.delete())
        try db.run(studySessionsTable.delete())
        try db.run(pointsHistoryTable.delete())
    }

    /// 清除过期数据（超过 30 天的消息）
    /// - Throws: 数据库错误
    func clearExpiredData() throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let expirationDate = Calendar.current.date(byAdding: .day, value: -30, to: Date())!
        let expiredMessages = messagesTable.filter(messageCreatedAt < expirationDate)
        try db.run(expiredMessages.delete())
    }

    // MARK: - Database Info

    /// 获取数据库大小
    /// - Returns: 数据库文件大小（字节）
    func getDatabaseSize() -> UInt64 {
        do {
            let attributes = try FileManager.default.attributesOfItem(atPath: dbPath)
            return (attributes[.size] as? UInt64) ?? 0
        } catch {
            return 0
        }
    }

    /// 获取消息数量
    /// - Returns: 消息总数
    func getMessageCount() throws -> Int {
        guard let db = db else { throw DatabaseError.notConnected }
        return try db.scalar(messagesTable.count)
    }
}

// MARK: - Database Error

enum DatabaseError: Error, LocalizedError {
    case notConnected
    case queryFailed(String)
    case insertFailed(String)
    case deleteFailed(String)

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "Database not connected"
        case .queryFailed(let message):
            return "Query failed: \(message)"
        case .insertFailed(let message):
            return "Insert failed: \(message)"
        case .deleteFailed(let message):
            return "Delete failed: \(message)"
        }
    }
}
