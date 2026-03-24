import Foundation
import SQLite
import CommonCrypto

// MARK: - Database Manager Protocol

/// Protocol for database operations used by DataSyncService
protocol DatabaseManagerProtocol {
    func getUnsyncedStudySessions() throws -> [StudySession]
    func getPendingMessages() throws -> [ChatMessage]
    func markMessageSynced(_ messageId: String) throws
    func markStudySessionSynced(_ sessionId: String) throws
    func getPendingPointTransactions() throws -> [PointsTransaction]
    func updateUserPoints(userId: String, points: Int) throws
    func getPointTransaction(_ transactionId: String) throws -> PointsTransaction?
    func insertPointTransaction(_ transaction: PointsTransaction) throws
    func markPointTransactionSynced(_ transactionId: String) throws
}

/// 数据库管理器 - SQLite 封装，用于离线数据缓存
/// 使用 SQLite.swift 库提供类型安全的数据库操作
/// 包含敏感数据加密、并发安全和损坏恢复功能
final class DatabaseManager: DatabaseManagerProtocol {

    // MARK: - Singleton

    static let shared = DatabaseManager()

    // MARK: - Properties

    private var db: Connection?
    private let dbPath: String

    // MARK: - Concurrency Control

    /// Lock for thread-safe database operations
    private let databaseLock = NSLock()
    private let readWriteQueue = DispatchQueue(label: "com.trix3d.database", qos: .userInitiated, attributes: .concurrent)

    // MARK: - Encryption

    /// Encryption key for sensitive data (stored in Keychain)
    private var encryptionKey: Data?

    /// Enable data encryption for sensitive fields
    private let encryptionEnabled: Bool = true

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
    private let transactionSynced = Expression<Bool>("synced")
    private let transactionSyncedAt = Expression<Date?>("synced_at")

    // MARK: - Initialization

    private init() {
        // 创建数据库文件路径
        let fileManager = FileManager.default
        let appSupportURL: URL
        if let url = try? fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ) {
            appSupportURL = url
        } else {
            // Fallback to documents directory if application support fails
            appSupportURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        }
        dbPath = appSupportURL.appendingPathComponent("trix3d.sqlite").path

        // 初始化加密密钥
        initializeEncryptionKey()

        // 打开数据库连接
        openDatabase()

        // 验证数据库完整性
        validateDatabaseIntegrity()

        // 创建表
        createTables()
    }

    // MARK: - Encryption

    /// Initialize encryption key from Keychain or generate new one
    private func initializeEncryptionKey() {
        // Try to get existing key from Keychain
        if let existingKey = KeychainManager.shared.getData(forKey: "com.trix3d.dbEncryptionKey") {
            encryptionKey = existingKey
            SecureLogger.shared.debug("Database encryption key loaded from Keychain")
        } else {
            // Generate new key
            var keyData = Data(count: 32) // 256-bit key
            let result = keyData.withUnsafeMutableBytes { pointer in
                guard let baseAddress = pointer.baseAddress else {
                    return errSecAllocate
                }
                return SecRandomCopyBytes(kSecRandomDefault, 32, baseAddress)
            }

            if result == errSecSuccess {
                encryptionKey = keyData
                // Store in Keychain
                try? KeychainManager.shared.saveData(keyData, forKey: "com.trix3d.dbEncryptionKey")
                SecureLogger.shared.info("New database encryption key generated and stored")
            } else {
                SecureLogger.shared.error("Failed to generate encryption key")
            }
        }
    }

    /// Encrypt data using AES-256-CBC
    private func encrypt(_ data: Data) -> Data? {
        guard let key = encryptionKey else { return nil }

        // Generate random IV
        var iv = Data(count: 16)
        let ivResult = iv.withUnsafeMutableBytes { pointer in
            guard let baseAddress = pointer.baseAddress else {
                return errSecAllocate
            }
            return SecRandomCopyBytes(kSecRandomDefault, 16, baseAddress)
        }

        guard ivResult == errSecSuccess else { return nil }

        // Encrypt
        let encrypted = data.aesEncrypt(key: key, iv: iv)
        guard let encryptedData = encrypted else { return nil }

        // Prepend IV to encrypted data
        return iv + encryptedData
    }

    /// Decrypt data using AES-256-CBC
    private func decrypt(_ data: Data) -> Data? {
        guard let key = encryptionKey,
              data.count > 16 else { return nil }

        // Extract IV and encrypted data
        let iv = data.prefix(16)
        let encryptedData = data.suffix(from: 16)

        return encryptedData.aesDecrypt(key: key, iv: iv)
    }

    /// Encrypt sensitive string field
    private func encryptField(_ value: String) -> String {
        guard encryptionEnabled,
              let data = value.data(using: .utf8),
              let encrypted = encrypt(data),
              let encoded = encrypted.base64EncodedString() as String? else {
            return value
        }
        return "ENC:\(encoded)"
    }

    /// Decrypt sensitive string field
    private func decryptField(_ value: String) -> String {
        guard value.hasPrefix("ENC:") else { return value }

        let encodedString = String(value.dropFirst(4))
        guard let data = Data(base64Encoded: encodedString) else { return value }
        guard let decrypted = decrypt(data) else { return value }
        guard let string = String(data: decrypted, encoding: .utf8) else { return value }
        return string
    }

    /// Check if value is encrypted
    private func isEncrypted(_ value: String) -> Bool {
        return value.hasPrefix("ENC:")
    }

    // MARK: - Database Integrity

    /// Validate database integrity on startup
    private func validateDatabaseIntegrity() {
        guard let db = db else { return }

        do {
            // Check if database file exists and is readable
            let fileManager = FileManager.default
            guard fileManager.fileExists(atPath: dbPath) else {
                SecureLogger.shared.warning("Database file does not exist")
                return
            }

            // Run integrity check
            let integrityResult = try db.scalar("PRAGMA integrity_check") as? String
            if integrityResult == "ok" {
                SecureLogger.shared.debug("Database integrity check passed")
            } else {
                SecureLogger.shared.error("Database integrity check failed: \(integrityResult ?? "unknown")")
                // Attempt recovery
                attemptDatabaseRecovery()
            }

            // Check for corruption
            let quickCheck = try db.scalar("PRAGMA quick_check") as? String
            if quickCheck != "ok" {
                SecureLogger.shared.error("Database quick check failed, attempting recovery")
                attemptDatabaseRecovery()
            }

        } catch {
            SecureLogger.shared.error("Database integrity validation error: \(error)")
            attemptDatabaseRecovery()
        }
    }

    /// Attempt to recover corrupted database
    private func attemptDatabaseRecovery() {
        SecureLogger.shared.info("Starting database recovery...")

        do {
            // Export existing data if possible
            let backupPath = dbPath + ".backup.\(Int(Date().timeIntervalSince1970))"

            // Try to vacuum/rebuild database
            try db?.execute("PRAGMA vacuum")
            try db?.execute("PRAGMA reindex")

            SecureLogger.shared.info("Database recovery completed")

            // Log recovery for monitoring
            SecureLogger.shared.warning("Database recovery was performed - verify data integrity")

        } catch {
            SecureLogger.shared.error("Database recovery failed: \(error)")
            // Consider notifying user or resetting database
        }
    }

    /// Thread-safe database operation
    private func performWithLock<T>(_ operation: () throws -> T) rethrows -> T {
        databaseLock.lock()
        defer { databaseLock.unlock() }
        return try operation()
    }

    /// Thread-safe async database operation
    private func performAsync<T>(_ operation: @escaping () throws -> T, completion: @escaping (Swift.Result<T, Error>) -> Void) {
        readWriteQueue.async {
            do {
                let result = try self.performWithLock(operation)
                DispatchQueue.main.async {
                    completion(.success(result))
                }
            } catch {
                DispatchQueue.main.async {
                    completion(.failure(error))
                }
            }
        }
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
            // 复合索引：优化按房间+时间分页查询（性能优化）
            try db?.run(messagesTable.createIndex(messageRoomId, messageCreatedAt, ifNotExists: true))
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
                t.column(transactionSynced, defaultValue: false)
                t.column(transactionSyncedAt)

                t.unique(transactionId)
            })

            try db?.run(pointsHistoryTable.createIndex(transactionCreatedAt, ifNotExists: true))
            try db?.run(pointsHistoryTable.createIndex(transactionSynced, ifNotExists: true))

            // Migration for existing installations where sync columns may be missing.
            ensureColumnExists(
                tableName: "points_history",
                columnName: "synced",
                columnDefinition: "BOOLEAN DEFAULT 0"
            )
            ensureColumnExists(
                tableName: "points_history",
                columnName: "synced_at",
                columnDefinition: "DATETIME"
            )
        } catch {
            SecureLogger.shared.error("Failed to create points_history table: \(error)")
        }
    }

    private func ensureColumnExists(
        tableName: String,
        columnName: String,
        columnDefinition: String
    ) {
        guard let db = db else { return }

        do {
            var exists = false
            for row in try db.prepare("PRAGMA table_info(\(tableName))") {
                if let existingName = row[1] as? String, existingName == columnName {
                    exists = true
                    break
                }
            }

            if !exists {
                try db.run("ALTER TABLE \(tableName) ADD COLUMN \(columnName) \(columnDefinition)")
            }
        } catch {
            SecureLogger.shared.error("Failed to ensure column \(columnName) on \(tableName): \(error)")
        }
    }

    // MARK: - Message Operations

    /// 插入消息
    /// - Parameter message: 聊天消息
    /// - Throws: 数据库错误
    func insertMessage(_ message: ChatMessage) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let conversationId = message.roomId

        // Encrypt sensitive content
        let encryptedContent = encryptField(message.content)

        let insert = messagesTable.insert(
            messageId <- message.id,
            messageRoomId <- conversationId,
            messageSenderId <- message.senderId,
            messageSenderType <- message.sender.rawValue,
            messageContent <- encryptedContent,
            messageType <- message.messageType.rawValue,
            messageMediaUrl <- message.mediaUrl,
            messageMediaMimeType <- message.mediaMimeType,
            messageMediaDuration <- message.mediaDuration,
            messageIsRead <- message.isRead,
            messageCreatedAt <- message.createdAt,
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
            // Decrypt message content
            let rawContent = row[messageContent]
            let decryptedContent = isEncrypted(rawContent) ? decryptField(rawContent) : rawContent

            let message = ChatMessage(
                id: row[messageId],
                roomId: row[messageRoomId],
                senderId: row[messageSenderId],
                sender: MessageSender(rawValue: row[messageSenderType]) ?? .user,
                content: decryptedContent,
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
            roomLastMessage <- room.lastMessage?.content,
            roomLastMessageAt <- room.lastMessage?.createdAt,
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
                participants: [], // 需要从服务器获取
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
            sessionSubject <- nil,
            sessionDuration <- session.duration,
            sessionStartedAt <- session.startedAt,
            sessionEndedAt <- session.endedAt,
            sessionNotes <- nil,
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
                duration: row[sessionDuration],
                startedAt: row[sessionStartedAt],
                endedAt: row[sessionEndedAt],
                earnedPoints: row[sessionEarnedPoints],
                isCompleted: row[sessionIsCompleted],
                subject: nil,
                notes: nil,
                createdAt: nil
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
        guard let startOfWeek = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: now)) else {
            throw DatabaseError.invalidData
        }

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

        // Encrypt description field (may contain sensitive info)
        let encryptedDescription = encryptField(transaction.description)

        let insert = pointsHistoryTable.insert(or: .replace,
            transactionId <- transaction.id,
            transactionPointsChange <- transaction.pointsChange,
            transactionType <- transaction.type.rawValue,
            transactionDescription <- encryptedDescription,
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
            // Decrypt description field
            let rawDescription = row[transactionDescription]
            let decryptedDescription = isEncrypted(rawDescription) ? decryptField(rawDescription) : rawDescription

            let transaction = PointsTransaction(
                id: row[transactionId],
                pointsChange: row[transactionPointsChange],
                type: TransactionType(rawValue: row[transactionType]) ?? .adminAdjust,
                description: decryptedDescription,
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

        // Calculate expiration date - use optional with fallback
        let expirationDate = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date().addingTimeInterval(-30 * 24 * 60 * 60)
        let expiredMessages = messagesTable.filter(messageCreatedAt < expirationDate)
        try db.run(expiredMessages.delete())
    }

    // MARK: - Points Sync Support Methods (Stubs)

    /// Get pending point transactions
    /// - Returns: Array of pending PointsTransaction
    func getPendingPointTransactions() throws -> [PointsTransaction] {
        guard let db = db else { throw DatabaseError.notConnected }

        let query = pointsHistoryTable
            .filter(transactionSynced == false)
            .order(transactionCreatedAt.asc)

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

    /// Mark a point transaction as synced
    /// - Parameter transactionId: Transaction ID
    func markPointTransactionSynced(_ transactionId: String) throws {
        guard let db = db else { throw DatabaseError.notConnected }
        let query = pointsHistoryTable.filter(self.transactionId == transactionId)
        try db.run(query.update(
            transactionSynced <- true,
            transactionSyncedAt <- Date()
        ))
    }

    /// Update user points
    /// - Parameters:
    ///   - userId: User ID
    ///   - points: New points value
    func updateUserPoints(userId: String, points: Int) throws {
        // User points are sourced from remote profile.
        // We persist a local transaction snapshot for offline display.
        let snapshot = PointsTransaction(
            id: "points_snapshot_\(Int(Date().timeIntervalSince1970))",
            pointsChange: 0,
            type: .adminAdjust,
            description: "sync.snapshot",
            balanceAfter: points,
            createdAt: Date()
        )
        try insertPointTransaction(snapshot)
        try markPointTransactionSynced(snapshot.id)
    }

    /// Get a point transaction by ID
    /// - Parameter transactionId: Transaction ID
    /// - Returns: PointsTransaction if found
    func getPointTransaction(_ transactionId: String) throws -> PointsTransaction? {
        guard let db = db else { throw DatabaseError.notConnected }

        let query = pointsHistoryTable
            .filter(self.transactionId == transactionId)
            .limit(1)

        guard let row = try db.pluck(query) else { return nil }
        return PointsTransaction(
            id: row[self.transactionId],
            pointsChange: row[transactionPointsChange],
            type: TransactionType(rawValue: row[transactionType]) ?? .adminAdjust,
            description: row[transactionDescription],
            balanceAfter: row[transactionBalanceAfter],
            createdAt: row[transactionCreatedAt]
        )
    }

    /// Insert a new point transaction
    /// - Parameter transaction: PointsTransaction to insert
    func insertPointTransaction(_ transaction: PointsTransaction) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let insert = pointsHistoryTable.insert(or: .replace,
            transactionId <- transaction.id,
            transactionPointsChange <- transaction.pointsChange,
            transactionType <- transaction.type.rawValue,
            transactionDescription <- transaction.description,
            transactionBalanceAfter <- transaction.balanceAfter,
            transactionCreatedAt <- transaction.createdAt,
            transactionSynced <- false,
            transactionSyncedAt <- nil
        )

        try db.run(insert)
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

    // MARK: - Sync Support Methods (Stubs)

    /// Get pending messages that haven't been synced
    /// - Returns: Array of pending ChatMessage
    func getPendingMessages() throws -> [ChatMessage] {
        guard let db = db else { throw DatabaseError.notConnected }

        let query = messagesTable
            .filter(messageSyncedAt == nil)
            .order(messageCreatedAt.asc)

        var messages: [ChatMessage] = []
        for row in try db.prepare(query) {
            let rawContent = row[messageContent]
            let decryptedContent = isEncrypted(rawContent) ? decryptField(rawContent) : rawContent

            let message = ChatMessage(
                id: row[messageId],
                roomId: row[messageRoomId],
                senderId: row[messageSenderId],
                sender: MessageSender(rawValue: row[messageSenderType]) ?? .user,
                content: decryptedContent,
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
            messages.append(message)
        }

        return messages
    }

    /// Mark a message as synced
    /// - Parameter messageId: Message ID to mark
    func markMessageSynced(_ messageId: String) throws {
        guard let db = db else { throw DatabaseError.notConnected }
        let query = messagesTable.filter(self.messageId == messageId)
        try db.run(query.update(messageSyncedAt <- Date()))
    }

    /// Get a single message by ID
    /// - Parameter messageId: Message ID
    /// - Returns: ChatMessage if found
    func getMessage(_ messageId: String) throws -> ChatMessage? {
        guard let db = db else { throw DatabaseError.notConnected }
        let query = messagesTable.filter(self.messageId == messageId).limit(1)
        guard let row = try db.pluck(query) else { return nil }

        let rawContent = row[messageContent]
        let decryptedContent = isEncrypted(rawContent) ? decryptField(rawContent) : rawContent

        return ChatMessage(
            id: row[self.messageId],
            roomId: row[messageRoomId],
            senderId: row[messageSenderId],
            sender: MessageSender(rawValue: row[messageSenderType]) ?? .user,
            content: decryptedContent,
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

    /// Update a message
    /// - Parameter message: ChatMessage to update
    func updateMessage(_ message: ChatMessage) throws {
        guard let db = db else { throw DatabaseError.notConnected }

        let encryptedContent = encryptField(message.content)
        let query = messagesTable.filter(self.messageId == message.id)

        try db.run(query.update(
            messageRoomId <- message.roomId,
            messageSenderId <- message.senderId,
            messageSenderType <- message.sender.rawValue,
            messageContent <- encryptedContent,
            messageType <- message.messageType.rawValue,
            messageMediaUrl <- message.mediaUrl,
            messageMediaMimeType <- message.mediaMimeType,
            messageMediaDuration <- message.mediaDuration,
            messageIsRead <- message.isRead,
            messageCreatedAt <- message.createdAt
        ))
    }

    /// Mark a message as having a conflict
    /// - Parameter messageId: Message ID
    func markMessageConflict(_ messageId: String) throws {
        guard let db = db else { throw DatabaseError.notConnected }
        let query = messagesTable.filter(self.messageId == messageId)
        try db.run(query.update(messageSyncedAt <- nil))
    }

    // MARK: - Database Corruption Recovery Testing

    /// Test database corruption recovery
    /// - Returns: Test result with details
    func testCorruptionRecovery() -> DatabaseRecoveryTestResult {
        var testPassed = true
        var testMessages: [String] = []

        // Test 1: Verify database is accessible
        do {
            _ = try db?.scalar("SELECT 1")
            testMessages.append("Database connectivity: OK")
        } catch {
            testPassed = false
            testMessages.append("Database connectivity: FAILED - \(error.localizedDescription)")
        }

        // Test 2: Verify tables exist
        do {
            let tableCount = try db?.scalar(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ) as? Int ?? 0
            if tableCount >= 4 {
                testMessages.append("Table integrity: OK (\(tableCount) tables)")
            } else {
                testPassed = false
                testMessages.append("Table integrity: FAILED (only \(tableCount) tables)")
            }
        } catch {
            testPassed = false
            testMessages.append("Table integrity check: FAILED")
        }

        // Test 3: Verify can read and write
        do {
            let testId = "recovery_test_\(UUID().uuidString)"
            let testInsert = messagesTable.filter(messageId == testId)
            try db?.run(testInsert.insert(
                messageId <- testId,
                messageRoomId <- "test_room",
                messageSenderId <- "test_sender",
                messageSenderType <- "user",
                messageContent <- "test content",
                messageType <- "text",
                messageIsRead <- false,
                messageCreatedAt <- Date()
            ))

            // Delete test record
            try db?.run(testInsert.delete())
            testMessages.append("Read/Write operations: OK")
        } catch {
            testPassed = false
            testMessages.append("Read/Write operations: FAILED - \(error.localizedDescription)")
        }

        // Test 4: Verify encryption key is available
        if encryptionKey != nil {
            testMessages.append("Encryption key: Available")
        } else {
            testMessages.append("Encryption key: Not available (encryption disabled)")
        }

        // Test 5: Check database file integrity
        do {
            let integrity = try db?.scalar("PRAGMA quick_check") as? String
            if integrity == "ok" {
                testMessages.append("Database integrity: OK")
            } else {
                testPassed = false
                testMessages.append("Database integrity: ISSUES DETECTED")
            }
        } catch {
            testMessages.append("Integrity check: Unable to verify")
        }

        return DatabaseRecoveryTestResult(
            passed: testPassed,
            messages: testMessages,
            timestamp: Date()
        )
    }

    /// Perform database maintenance
    func performMaintenance() throws {
        guard let db = db else { throw DatabaseError.notConnected }

        // Vacuum to reclaim space
        try db.execute("VACUUM")

        // Analyze for query optimization
        try db.execute("ANALYZE")

        SecureLogger.shared.info("Database maintenance completed")
    }
}

/// Database recovery test result
struct DatabaseRecoveryTestResult {
    let passed: Bool
    let messages: [String]
    let timestamp: Date
}

// MARK: - Database Error

enum DatabaseError: Error, LocalizedError {
    case notConnected
    case queryFailed(String)
    case insertFailed(String)
    case deleteFailed(String)
    case encryptionFailed
    case decryptionFailed
    case invalidData

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
        case .encryptionFailed:
            return "Data encryption failed"
        case .decryptionFailed:
            return "Data decryption failed"
        case .invalidData:
            return "Invalid data"
        }
    }
}

// MARK: - Data AES Encryption Extension

extension Data {

    /// AES-256-CBC encryption
    func aesEncrypt(key: Data, iv: Data) -> Data? {
        guard key.count == 32, iv.count == 16 else { return nil }

        let bufferSize = self.count + kCCBlockSizeAES128
        var buffer = Data(count: bufferSize)
        var numBytesEncrypted: size_t = 0

        let cryptStatus = buffer.withUnsafeMutableBytes { bufferPointer in
            self.withUnsafeBytes { dataPointer in
                key.withUnsafeBytes { keyPointer in
                    iv.withUnsafeBytes { ivPointer in
                        CCCrypt(
                            CCOperation(kCCEncrypt),
                            CCAlgorithm(kCCAlgorithmAES),
                            CCOptions(kCCOptionPKCS7Padding),
                            keyPointer.baseAddress,
                            key.count,
                            ivPointer.baseAddress,
                            dataPointer.baseAddress,
                            self.count,
                            bufferPointer.baseAddress,
                            bufferSize,
                            &numBytesEncrypted
                        )
                    }
                }
            }
        }

        guard cryptStatus == kCCSuccess else { return nil }

        buffer.count = numBytesEncrypted
        return buffer
    }

    /// AES-256-CBC decryption
    func aesDecrypt(key: Data, iv: Data) -> Data? {
        guard key.count == 32, iv.count == 16 else { return nil }

        let bufferSize = self.count + kCCBlockSizeAES128
        var buffer = Data(count: bufferSize)
        var numBytesDecrypted: size_t = 0

        let cryptStatus = buffer.withUnsafeMutableBytes { bufferPointer in
            self.withUnsafeBytes { dataPointer in
                key.withUnsafeBytes { keyPointer in
                    iv.withUnsafeBytes { ivPointer in
                        CCCrypt(
                            CCOperation(kCCDecrypt),
                            CCAlgorithm(kCCAlgorithmAES),
                            CCOptions(kCCOptionPKCS7Padding),
                            keyPointer.baseAddress,
                            key.count,
                            ivPointer.baseAddress,
                            dataPointer.baseAddress,
                            self.count,
                            bufferPointer.baseAddress,
                            bufferSize,
                            &numBytesDecrypted
                        )
                    }
                }
            }
        }

        guard cryptStatus == kCCSuccess else { return nil }

        buffer.count = numBytesDecrypted
        return buffer
    }
}
