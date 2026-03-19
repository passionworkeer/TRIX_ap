//
//  SupabaseService.swift
//  TRIX3DCompanion
//
//  Unified live Supabase data access for iOS features.
//

import Foundation
import PostgREST
import Realtime
import Supabase

actor SupabaseService {

    static let shared = SupabaseService()

    private struct DatabaseHandle {
        let database: PostgrestClient
    }

    private let client: DatabaseHandle
    private let keychain: KeychainManager
    private var syncedTokenSignature: String?

    private static let botRoomID = "trixbot"
    private static let friendRequestMetaPrefix = "[friend_request_from:]"
    private static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    private static let fallbackISO8601Formatter: ISO8601DateFormatter = {
        ISO8601DateFormatter()
    }()

    init(
        database: PostgrestClient? = nil,
        keychain: KeychainManager = .shared
    ) {
        guard let databaseURL = URL(string: "\(SupabaseConfig.url)/rest/v1") else {
            fatalError("Invalid Supabase REST URL")
        }

        self.client = DatabaseHandle(
            database: database ?? PostgrestClient(
                url: databaseURL,
                headers: [
                    "apikey": SupabaseConfig.anonKey
                ]
            )
        )
        self.keychain = keychain
    }

    func clearSession() async {
        _ = await client.database.setAuth(nil)
        syncedTokenSignature = nil
    }

    func currentUserId() async throws -> String {
        try await sessionContext().userId
    }

    func fetchCurrentProfile() async throws -> User {
        let context = try await sessionContext()
        let rows: [User] = try await client.database
            .from("profiles")
            .select(profileSelectColumns)
            .eq("id", value: context.userId)
            .limit(1)
            .execute()
            .value

        guard let profile = rows.first else {
            throw NetworkError.notFound
        }

        return profile
    }

    func updateCurrentProfile(_ update: ProfileUpdate) async throws -> User {
        let context = try await sessionContext()
        let updatedProfile: User = try await client.database
            .from("profiles")
            .update(update, returning: .representation)
            .eq("id", value: context.userId)
            .single()
            .execute()
            .value

        return updatedProfile
    }

    func fetchUserStats() async throws -> UserStats {
        let context = try await sessionContext()
        let profile = try await fetchProfileRow(userId: context.userId)
        _ = try await fetchOrCreatePointsRow(
            userId: context.userId,
            fallbackPoints: profile.points ?? 0
        )

        let sessionCount = try await countRows(
            table: "study_sessions",
            filters: { $0.eq("user_id", value: context.userId) }
        )

        let now = Date()
        let todayStart = Calendar.current.startOfDay(for: now)
        let weekStart = Calendar.current.date(
            byAdding: .day,
            value: -6,
            to: todayStart
        ) ?? todayStart

        let recentSessions: [SupabaseStudySessionRow] = try await client.database
            .from("study_sessions")
            .select(studySessionSelectColumns)
            .eq("user_id", value: context.userId)
            .gte("started_at", value: Self.iso8601String(from: weekStart))
            .order("started_at", ascending: false)
            .execute()
            .value

        let todayDuration = recentSessions
            .filter { $0.startedAt >= todayStart }
            .reduce(0) { $0 + $1.duration }
        let weekDuration = recentSessions.reduce(0) { $0 + $1.duration }

        let totalStudyTime: Int
        if let profileStudyTime = profile.totalStudyTime {
            totalStudyTime = profileStudyTime
        } else {
            // TODO: Use database aggregate function instead of loading all rows
            // Consider adding a database view or RPC function for sum calculation
            let allDurations: [SupabaseStudyDurationRow] = try await client.database
                .from("study_sessions")
                .select("duration")
                .eq("user_id", value: context.userId)
                .execute()
                .value
            totalStudyTime = allDurations.reduce(0) { $0 + $1.duration }
        }

        let averageDuration = sessionCount > 0 ? totalStudyTime / sessionCount : 0

        return UserStats(
            totalStudyTime: totalStudyTime,
            sessionCount: sessionCount,
            averageDuration: averageDuration,
            streakDays: profile.currentStreak ?? 0,
            todayDuration: todayDuration,
            weekDuration: weekDuration
        )
    }

    func fetchStudySessions(page: Int, limit: Int) async throws -> [StudySession] {
        let context = try await sessionContext()
        let offset = max(page - 1, 0) * limit
        let rows: [SupabaseStudySessionRow] = try await client.database
            .from("study_sessions")
            .select(studySessionSelectColumns)
            .eq("user_id", value: context.userId)
            .order("started_at", ascending: false)
            .range(from: offset, to: offset + max(limit - 1, 0))
            .execute()
            .value

        return rows.map { row in
            StudySession(
                id: row.id,
                userId: row.userId,
                duration: row.duration,
                startedAt: row.startedAt,
                endedAt: row.endedAt,
                earnedPoints: row.earnedPoints,
                isCompleted: row.isCompleted,
                subject: row.subject,
                notes: row.notes,
                createdAt: row.createdAt
            )
        }
    }

    func fetchPoints() async throws -> PointsResponse {
        let context = try await sessionContext()
        let profile = try await fetchProfileRow(userId: context.userId)
        let pointsRow = try await fetchOrCreatePointsRow(
            userId: context.userId,
            fallbackPoints: profile.points ?? 0
        )

        let now = Date()
        let todayStart = Calendar.current.startOfDay(for: now)
        let weekStart = Calendar.current.date(byAdding: .day, value: -6, to: todayStart) ?? todayStart

        let recentTransactions: [SupabasePointTransactionRow] = try await client.database
            .from("point_transactions")
            .select(pointTransactionSelectColumns)
            .eq("user_id", value: context.userId)
            .gte("created_at", value: Self.iso8601String(from: weekStart))
            .order("created_at", ascending: false)
            .execute()
            .value

        let todayEarned = recentTransactions
            .filter { $0.createdAt >= todayStart }
            .reduce(0) { partialResult, transaction in
                partialResult + max(transaction.pointsChange, 0)
            }

        let weekEarned = recentTransactions.reduce(0) { partialResult, transaction in
            partialResult + max(transaction.pointsChange, 0)
        }

        let totalTransactions = try await countRows(
            table: "point_transactions",
            filters: { $0.eq("user_id", value: context.userId) }
        )

        return PointsResponse(
            totalPoints: pointsRow.totalPoints,
            level: pointsRow.level,
            todayEarned: todayEarned,
            weekEarned: weekEarned,
            totalTransactions: totalTransactions
        )
    }

    func fetchPointsHistory(page: Int, limit: Int) async throws -> [PointsTransaction] {
        let context = try await sessionContext()
        let offset = max(page - 1, 0) * limit
        let rows: [SupabasePointTransactionRow] = try await client.database
            .from("point_transactions")
            .select(pointTransactionSelectColumns)
            .eq("user_id", value: context.userId)
            .order("created_at", ascending: false)
            .range(from: offset, to: offset + max(limit - 1, 0))
            .execute()
            .value

        return rows.map { row in
            PointsTransaction(
                id: row.id,
                pointsChange: row.pointsChange,
                type: mapTransactionType(row.transactionType),
                description: row.description ?? "",
                balanceAfter: row.balanceAfter,
                createdAt: row.createdAt
            )
        }
    }

    func applyPointsChange(
        points delta: Int,
        transactionType: TransactionType,
        description: String,
        metadata: [String: String]?
    ) async throws -> PointsResponse {
        let context = try await sessionContext()
        let profile = try await fetchProfileRow(userId: context.userId)
        let current = try await fetchOrCreatePointsRow(
            userId: context.userId,
            fallbackPoints: profile.points ?? 0
        )

        let updatedTotal = current.totalPoints + delta
        guard updatedTotal >= 0 else {
            throw PointsError.insufficientBalance
        }

        let updatedEarned = current.totalEarned + max(delta, 0)
        let updatedSpent = current.totalSpent + max(-delta, 0)
        let updatedLevel = level(for: updatedTotal)

        let updatePayload = SupabaseUserPointsMutation(
            totalPoints: updatedTotal,
            level: updatedLevel,
            totalEarned: updatedEarned,
            totalSpent: updatedSpent,
            updatedAt: Self.iso8601String(from: Date())
        )

        let updatedRow: SupabaseUserPointsRow = try await client.database
            .from("user_points")
            .update(updatePayload, returning: .representation)
            .eq("user_id", value: context.userId)
            .single()
            .execute()
            .value

        do {
            let transactionPayload = SupabasePointTransactionInsert(
                userId: context.userId,
                pointsChange: delta,
                transactionType: transactionType.rawValue,
                description: description,
                metadata: metadata,
                balanceAfter: updatedTotal
            )

            try await client.database
                .from("point_transactions")
                .insert(transactionPayload, returning: .minimal)
                .execute()
        } catch {
            let rollbackPayload = SupabaseUserPointsMutation(
                totalPoints: current.totalPoints,
                level: current.level,
                totalEarned: current.totalEarned,
                totalSpent: current.totalSpent,
                updatedAt: Self.iso8601String(from: Date())
            )

            _ = try? await client.database
                .from("user_points")
                .update(rollbackPayload, returning: .minimal)
                .eq("user_id", value: context.userId)
                .execute()

            throw error
        }

        return PointsResponse(
            totalPoints: updatedRow.totalPoints,
            level: updatedRow.level,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: try await countRows(
                table: "point_transactions",
                filters: { $0.eq("user_id", value: context.userId) }
            )
        )
    }

    // MARK: - Mall Types

    /// Database row for mall_items table
    private struct SupabaseMallItemRow: Decodable {
        let id: String
        let name: String
        let description: String?
        let imageUrl: String?
        let price: Int
        let category: String
        let isActive: Bool
        let createdAt: Date?

        enum CodingKeys: String, CodingKey {
            case id, name, description
            case imageUrl = "image_url"
            case price, category
            case isActive = "is_active"
            case createdAt = "created_at"
        }
    }

    /// Database row for user_purchased_items table
    private struct SupabasePurchasedItemRow: Decodable {
        let id: String
        let userId: String
        let itemId: String
        let quantity: Int
        let pointsSpent: Int
        let purchasedAt: Date

        enum CodingKeys: String, CodingKey {
            case id
            case userId = "user_id"
            case itemId = "item_id"
            case quantity
            case pointsSpent = "points_spent"
            case purchasedAt = "purchased_at"
        }
    }

    /// Insert type for purchasing items
    private struct SupabasePurchaseInsert: Encodable {
        let userId: String
        let itemId: String
        let quantity: Int
        let pointsSpent: Int

        enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case itemId = "item_id"
            case quantity
            case pointsSpent = "points_spent"
        }
    }

    // MARK: - Mall

    /// Fetch mall items with optional category filter
    /// - Parameter category: Optional category filter
    /// - Returns: Array of MallItem
    func fetchMallItems(category: String? = nil) async throws -> [MallItem] {
        let context = try await sessionContext()

        let rows: [SupabaseMallItemRow] = try await client.database
            .from("mall_items")
            .select("*", head: false, count: .none)
            .filter("is_active", operator: .eq, value: true)
            .order("created_at", ascending: false)
            .execute()
            .value

        // Get user's owned items
        let ownedRows: [SupabasePurchasedItemRow] = try await client.database
            .from("user_purchased_items")
            .select("item_id", head: false, count: .none)
            .filter("user_id", operator: .eq, value: context.userId)
            .execute()
            .value

        let ownedItemIds = Set(ownedRows.map { $0.itemId })

        var items = rows.map { row in
            MallItem(
                id: row.id,
                name: row.name,
                description: row.description ?? "",
                image: row.imageUrl ?? "",
                price: row.price,
                category: MallCategory(rawValue: row.category) ?? .clothing,
                isOwned: ownedItemIds.contains(row.id)
            )
        }

        // Apply category filter if provided
        if let category = category {
            items = items.filter { $0.category.rawValue == category }
        }

        return items
    }

    /// Purchase a mall item
    /// - Parameters:
    ///   - itemId: Item ID to purchase
    ///   - quantity: Quantity to purchase (default: 1)
    /// - Returns: PurchaseResponse with success status
    func purchaseMallItem(itemId: String, quantity: Int = 1) async throws -> PurchaseResponse {
        let context = try await sessionContext()

        // Get item info
        let itemRows: [SupabaseMallItemRow] = try await client.database
            .from("mall_items")
            .select("*")
            .eq("id", value: itemId)
            .eq("is_active", value: true)
            .limit(1)
            .execute()
            .value

        guard let item = itemRows.first else {
            throw MallServiceError.fetchFailed(underlying: NSError(domain: "Mall", code: 404, userInfo: [NSLocalizedDescriptionKey: "Item not found"]))
        }

        // Get user points
        let profile = try await fetchProfileRow(userId: context.userId)
        let pointsRow = try await fetchOrCreatePointsRow(userId: context.userId, fallbackPoints: profile.points ?? 0)
        let currentBalance = pointsRow.totalPoints

        let totalCost = item.price * quantity

        // Check if user has enough points
        guard currentBalance >= totalCost else {
            return PurchaseResponse(
                success: false,
                message: "积分不足，需要 \(totalCost) 积分，当前 \(currentBalance) 积分",
                remainingPoints: currentBalance,
                item: nil
            )
        }

        // Check if already owned (for non-stackable items)
        let existingPurchases: [SupabasePurchasedItemRow] = try await client.database
            .from("user_purchased_items")
            .select("*")
            .eq("user_id", value: context.userId)
            .eq("item_id", value: itemId)
            .execute()
            .value

        guard existingPurchases.isEmpty else {
            return PurchaseResponse(
                success: false,
                message: "您已拥有此商品",
                remainingPoints: currentBalance,
                item: nil
            )
        }

        // Deduct points
        let newBalance = currentBalance - totalCost
        let newSpent = pointsRow.totalSpent + totalCost

        let pointsUpdate = SupabaseUserPointsMutation(
            totalPoints: newBalance,
            level: pointsRow.level,
            totalEarned: pointsRow.totalEarned,
            totalSpent: newSpent,
            updatedAt: Self.iso8601String(from: Date())
        )

        _ = try await client.database
            .from("user_points")
            .update(pointsUpdate, returning: .representation)
            .eq("user_id", value: context.userId)
            .single()
            .execute()
            .value

        // Record purchase
        let purchaseInsert = SupabasePurchaseInsert(
            userId: context.userId,
            itemId: itemId,
            quantity: quantity,
            pointsSpent: totalCost
        )

        try await client.database
            .from("user_purchased_items")
            .insert(purchaseInsert, returning: .minimal)
            .execute()

        // Record points transaction
        let transactionInsert = SupabasePointTransactionInsert(
            userId: context.userId,
            pointsChange: -totalCost,
            transactionType: "spend",
            description: "购买商品: \(item.name)",
            metadata: ["item_id": itemId],
            balanceAfter: newBalance
        )

        try await client.database
            .from("point_transactions")
            .insert(transactionInsert, returning: .minimal)
            .execute()

        return PurchaseResponse(
            success: true,
            message: "成功购买 \(item.name)！",
            remainingPoints: newBalance,
            item: MallItem(
                id: item.id,
                name: item.name,
                description: item.description ?? "",
                image: item.imageUrl ?? "",
                price: item.price,
                category: MallCategory(rawValue: item.category) ?? .clothing,
                isOwned: true
            )
        )
    }

    /// Fetch user's purchase history
    /// - Returns: Array of PurchaseHistoryItem
    func fetchPurchaseHistory() async throws -> [PurchaseHistoryItem] {
        let context = try await sessionContext()

        let rows: [SupabasePurchasedItemRow] = try await client.database
            .from("user_purchased_items")
            .select("*")
            .eq("user_id", value: context.userId)
            .order("purchased_at", ascending: false)
            .execute()
            .value

        var result: [PurchaseHistoryItem] = []

        for row in rows {
            // Get item details
            let itemRows: [SupabaseMallItemRow] = try await client.database
                .from("mall_items")
                .select("*")
                .eq("id", value: row.itemId)
                .limit(1)
                .execute()
                .value

            if let item = itemRows.first {
                result.append(PurchaseHistoryItem(
                    id: row.id,
                    item: MallItem(
                        id: item.id,
                        name: item.name,
                        description: item.description ?? "",
                        image: item.imageUrl ?? "",
                        price: item.price,
                        category: MallCategory(rawValue: item.category) ?? .clothing,
                        isOwned: true
                    ),
                    purchasedAt: row.purchasedAt,
                    pointsSpent: row.pointsSpent
                ))
            }
        }

        return result
    }

    /// Get user's points balance for mall
    /// - Returns: PointsBalance
    func fetchUserPointsBalance() async throws -> PointsBalance {
        let context = try await sessionContext()
        let profile = try await fetchProfileRow(userId: context.userId)
        let pointsRow = try await fetchOrCreatePointsRow(userId: context.userId, fallbackPoints: profile.points ?? 0)

        return PointsBalance(
            totalPoints: pointsRow.totalPoints,
            availablePoints: pointsRow.totalPoints,
            pendingPoints: 0,
            level: pointsRow.level,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 0,
            updatedAt: pointsRow.updatedAt ?? Date()
        )
    }

    func fetchAchievements() async throws -> [Achievement] {
        let context = try await sessionContext()
        let unlockedRows: [SupabaseUnlockedAchievementRow] = try await client.database
            .from("user_achievements")
            .select("id,achievement_id,unlocked_at", head: false, count: .none)
            .filter("user_id", operator: .eq, value: context.userId)
            .execute()
            .value

        let unlockedMap = Dictionary(uniqueKeysWithValues: unlockedRows.map {
            ($0.achievementId, $0.unlockedAt)
        })

        return Self.achievementCatalog.map { achievement in
            Achievement(
                id: achievement.id,
                name: achievement.name,
                nameEn: achievement.nameEn,
                description: achievement.description,
                icon: achievement.icon,
                category: achievement.category,
                requirement: achievement.requirement,
                type: achievement.type,
                rarity: achievement.rarity,
                unlockedAt: unlockedMap[achievement.id]
            )
        }
    }

    func checkAndUnlockAchievements() async throws -> AchievementCheckResponse {
        let context = try await sessionContext()
        let stats = try await achievementStats(for: context.userId)
        let existingAchievements = try await fetchAchievements()
        let unlockedIDs = Set(existingAchievements.compactMap { achievement in
            achievement.unlockedAt != nil ? achievement.id : nil
        })

        let candidates = Self.achievementCatalog.filter { achievement in
            !unlockedIDs.contains(achievement.id) && isAchievementUnlocked(achievement, stats: stats)
        }

        guard !candidates.isEmpty else {
            return AchievementCheckResponse(
                newlyUnlocked: [],
                totalUnlocked: unlockedIDs.count
            )
        }

        let inserts = candidates.map {
            SupabaseAchievementInsert(
                userId: context.userId,
                achievementId: $0.id,
                unlockedAt: Self.iso8601String(from: Date())
            )
        }

        try await client.database
            .from("user_achievements")
            .insert(inserts, returning: .minimal)
            .execute()

        let refreshed = try await fetchAchievements()
        let newlyUnlocked = refreshed.filter { candidate in
            candidates.contains(where: { $0.id == candidate.id })
        }

        return AchievementCheckResponse(
            newlyUnlocked: newlyUnlocked,
            totalUnlocked: refreshed.filter { $0.unlockedAt != nil }.count
        )
    }

    func fetchFriends() async throws -> [Friend] {
        let context = try await sessionContext()
        let rows: [SupabaseFriendLatestMessageRow] = try await client.database
            .from("friend_latest_messages")
            .select("friendship_id,user_id,friend_id,name,avatar_url,status,bio,study_time,is_studying,unread_count,last_message,last_message_time,sort_time")
            .eq("user_id", value: context.userId)
            .order("sort_time", ascending: false, nullsFirst: false)
            .execute()
            .value

        let presenceRows = try await fetchPresenceRows(
            ids: rows.map(\.friendId)
        )
        let presenceMap = Dictionary(uniqueKeysWithValues: presenceRows.map { ($0.id, $0) })

        return rows.map { row in
            let presence = presenceMap[row.friendId]
            return Friend(
                id: row.friendshipId,
                userId: row.userId,
                friendId: row.friendId,
                name: row.name,
                avatarUrl: row.avatarUrl,
                status: presenceStatus(for: row, presence: presence),
                bio: row.bio,
                studyTime: row.studyTime,
                isStudying: row.isStudying,
                createdAt: row.sortTime ?? row.lastMessageTime ?? Date(),
                updatedAt: row.sortTime ?? row.lastMessageTime ?? Date()
            )
        }
    }

    func fetchFriendRequests() async throws -> [FriendRequest] {
        let context = try await sessionContext()
        let notifications: [SupabaseNotificationRow] = try await client.database
            .from("notifications")
            .select("id,user_id,type,title,content,avatar_url,is_read,created_at")
            .eq("user_id", value: context.userId)
            .eq("type", value: "friend_request")
            .order("created_at", ascending: false)
            .execute()
            .value

        let requesterIDs = notifications.compactMap { notification in
            extractFriendRequestSenderId(from: notification.content)
        }
        let profiles = try await fetchProfilePreviewRows(ids: requesterIDs)
        let profileMap = Dictionary(uniqueKeysWithValues: profiles.map { ($0.id, $0) })

        return notifications.compactMap { notification in
            guard let fromUserId = extractFriendRequestSenderId(from: notification.content) else {
                return nil
            }

            let profile = profileMap[fromUserId]
            let displayName = resolvedProfileName(profile)

            return FriendRequest(
                id: notification.id,
                fromUserId: fromUserId,
                fromUsername: displayName,
                fromAvatarUrl: profile?.avatarUrl ?? notification.avatarUrl,
                toUserId: notification.userId,
                status: notification.isRead ? "read" : "pending",
                createdAt: notification.createdAt
            )
        }
    }

    func sendFriendRequest(friendId: String) async throws {
        let context = try await sessionContext()

        guard friendId != context.userId else {
            throw FriendServiceError.alreadyFriends
        }

        let existing = try await countRows(
            table: "friends",
            filters: {
                $0.eq("user_id", value: context.userId)
                    .eq("friend_id", value: friendId)
            }
        )

        guard existing == 0 else {
            throw FriendServiceError.alreadyFriends
        }

        let currentProfile = try await fetchProfileRow(userId: context.userId)
        let payload = SupabaseNotificationInsert(
            userId: friendId,
            type: "friend_request",
            title: "好友请求",
            content: "\(resolvedProfileName(currentProfile)) 想添加你为好友\n\(Self.friendRequestMetaPrefix)\(context.userId)",
            avatarUrl: currentProfile.avatarUrl ?? "",
            isRead: false
        )

        try await client.database
            .from("notifications")
            .insert(payload, returning: .minimal)
            .execute()
    }

    func removeFriend(friendId: String) async throws {
        let context = try await sessionContext()

        try await client.database
            .from("friends")
            .delete()
            .eq("user_id", value: context.userId)
            .eq("friend_id", value: friendId)
            .execute()

        try await client.database
            .from("friends")
            .delete()
            .eq("user_id", value: friendId)
            .eq("friend_id", value: context.userId)
            .execute()
    }

    func acceptFriendRequest(requestId: String) async throws {
        let context = try await sessionContext()
        let notification = try await fetchNotification(id: requestId, userId: context.userId)

        guard let requesterId = extractFriendRequestSenderId(from: notification.content) else {
            throw FriendServiceError.friendNotFound
        }

        let now = Self.iso8601String(from: Date())
        let relations = [
            SupabaseFriendInsert(
                userId: context.userId,
                friendId: requesterId,
                status: "accepted",
                isStudying: false,
                studyTime: 0,
                updatedAt: now
            ),
            SupabaseFriendInsert(
                userId: requesterId,
                friendId: context.userId,
                status: "accepted",
                isStudying: false,
                studyTime: 0,
                updatedAt: now
            )
        ]

        try await client.database
            .from("friends")
            .upsert(relations, onConflict: "user_id,friend_id", returning: .minimal)
            .execute()

        let readUpdate = SupabaseNotificationReadUpdate(isRead: true)
        try await client.database
            .from("notifications")
            .update(readUpdate, returning: .minimal)
            .eq("id", value: requestId)
            .execute()
    }

    func declineFriendRequest(requestId: String) async throws {
        let context = try await sessionContext()
        _ = try await fetchNotification(id: requestId, userId: context.userId)

        let readUpdate = SupabaseNotificationReadUpdate(isRead: true)
        try await client.database
            .from("notifications")
            .update(readUpdate, returning: .minimal)
            .eq("id", value: requestId)
            .execute()
    }

    func fetchFriendRecommendations(limit: Int) async throws -> [APIFriendRecommendation] {
        let context = try await sessionContext()
        let existingFriendRows: [SupabaseFriendIDRow] = try await client.database
            .from("friends")
            .select("friend_id")
            .eq("user_id", value: context.userId)
            .execute()
            .value

        let excludedIDs = Set(existingFriendRows.map(\.friendId)).union([context.userId])
        let candidateRows: [SupabaseProfilePreviewRow] = try await client.database
            .from("profiles")
            .select("id,username,full_name,avatar_url,last_active_at,show_online_status,created_at")
            .order("created_at", ascending: false)
            .limit(max(limit * 4, 24))
            .execute()
            .value

        return candidateRows
            .filter { !excludedIDs.contains($0.id) }
            .prefix(limit)
            .map { row in
                APIFriendRecommendation(
                    id: row.id,
                    name: resolvedProfileName(row),
                    avatarUrl: row.avatarUrl,
                    mutualFriends: 0,
                    isOnline: isProfileOnline(row)
                )
            }
    }

    func fetchChatRooms() async throws -> [ChatRoom] {
        let context = try await sessionContext()

        // Fetch friend rows and bot messages concurrently
        async let friendRowsTask: [SupabaseFriendLatestMessageRow] = client.database
            .from("friend_latest_messages")
            .select("friendship_id,user_id,friend_id,name,avatar_url,status,bio,study_time,is_studying,unread_count,last_message,last_message_time,sort_time")
            .eq("user_id", value: context.userId)
            .order("sort_time", ascending: false, nullsFirst: false)
            .execute()
            .value

        async let botMessagesTask: [ChatMessage] = fetchMessages(roomId: Self.botRoomID, page: 1, limit: 1)

        let friendRows = try await friendRowsTask
        let botMessages = try await botMessagesTask
        let botLastMessage = botMessages.last
        let now = Date()

        let botRoom = ChatRoom(
            id: Self.botRoomID,
            name: "TRIX Bot",
            type: .ai,
            participants: [],
            lastMessage: botLastMessage,
            unreadCount: 0,
            createdAt: botLastMessage?.createdAt ?? now,
            updatedAt: botLastMessage?.createdAt ?? now
        )

        let friendRooms = friendRows.map { row in
            ChatRoom(
                id: row.friendId,
                name: row.name,
                type: .privateChat,
                participants: [
                    User(
                        id: row.friendId,
                        username: nil,
                        email: nil,
                        avatarUrl: row.avatarUrl,
                        avatarConfig: nil,
                        fullName: row.name,
                        displayName: row.name,
                        bio: row.bio,
                        website: nil,
                        points: nil,
                        isStudying: row.isStudying,
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
                ],
                lastMessage: row.lastMessage.map { content in
                    ChatMessage(
                        id: "\(row.friendId)-latest",
                        roomId: row.friendId,
                        senderId: row.friendId,
                        sender: .friend,
                        content: content,
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
                        isRead: row.unreadCount == 0,
                        createdAt: row.lastMessageTime ?? row.sortTime ?? now
                    )
                },
                unreadCount: row.unreadCount,
                createdAt: row.sortTime ?? row.lastMessageTime ?? now,
                updatedAt: row.sortTime ?? row.lastMessageTime ?? now
            )
        }

        return [botRoom] + friendRooms
    }

    func fetchChatRoom(id: String) async throws -> ChatRoom {
        // Handle bot room specially
        if id == Self.botRoomID {
            let botMessages = try await fetchMessages(roomId: Self.botRoomID, page: 1, limit: 1)
            let botLastMessage = botMessages.last
            let now = Date()
            return ChatRoom(
                id: Self.botRoomID,
                name: "TRIX Bot",
                type: .ai,
                participants: [],
                lastMessage: botLastMessage,
                unreadCount: 0,
                createdAt: botLastMessage?.createdAt ?? now,
                updatedAt: botLastMessage?.createdAt ?? now
            )
        }

        // Query single room from friend_latest_messages
        let context = try await sessionContext()
        let rows: [SupabaseFriendLatestMessageRow] = try await client.database
            .from("friend_latest_messages")
            .select("friendship_id,user_id,friend_id,name,avatar_url,status,bio,study_time,is_studying,unread_count,last_message,last_message_time,sort_time")
            .eq("user_id", value: context.userId)
            .eq("friend_id", value: id)
            .limit(1)
            .execute()
            .value

        guard let row = rows.first else {
            throw NetworkError.notFound
        }

        let now = Date()
        return ChatRoom(
            id: row.friendId,
            name: row.name,
            type: .privateChat,
            participants: [
                User(
                    id: row.friendId,
                    username: nil,
                    email: nil,
                    avatarUrl: row.avatarUrl,
                    avatarConfig: nil,
                    fullName: row.name,
                    displayName: row.name,
                    bio: row.bio,
                    website: nil,
                    points: nil,
                    isStudying: row.isStudying,
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
            ],
            lastMessage: row.lastMessage.map { content in
                ChatMessage(
                    id: "\(row.friendId)-latest",
                    roomId: row.friendId,
                    senderId: row.friendId,
                    sender: .friend,
                    content: content,
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
                    isRead: row.unreadCount == 0,
                    createdAt: row.lastMessageTime ?? row.sortTime ?? now
                )
            },
            unreadCount: row.unreadCount,
            createdAt: row.sortTime ?? row.lastMessageTime ?? now,
            updatedAt: row.sortTime ?? row.lastMessageTime ?? now
        )
    }

    func fetchMessages(roomId: String, page: Int, limit: Int) async throws -> [ChatMessage] {
        let context = try await sessionContext()
        let conversationID = roomId == Self.botRoomID
            ? botConversationID(for: context.userId)
            : directConversationID(for: context.userId, friendId: roomId)

        let offset = max(page - 1, 0) * limit
        let rows: [SupabaseChatMessageRow] = try await client.database
            .from("chat_messages")
            .select(chatMessageSelectColumns)
            .eq("conversation_id", value: conversationID)
            .order("created_at", ascending: false)
            .range(from: offset, to: offset + max(limit - 1, 0))
            .execute()
            .value

        return rows
            .reversed()
            .map { row in
                mapChatMessage(
                    row,
                    currentUserId: context.userId,
                    roomId: roomId
                )
            }
    }

    /// Fetch messages since a specific date
    func fetchMessagesSince(roomId: String, since: Date) async throws -> [ChatMessage] {
        let context = try await sessionContext()
        let conversationID = roomId == Self.botRoomID
            ? botConversationID(for: context.userId)
            : directConversationID(for: context.userId, friendId: roomId)

        // Convert date to ISO8601 string
        let sinceString = ISO8601DateFormatter().string(from: since)

        let rows: [SupabaseChatMessageRow] = try await client.database
            .from("chat_messages")
            .select(chatMessageSelectColumns)
            .eq("conversation_id", value: conversationID)
            .gt("created_at", value: sinceString)
            .order("created_at", ascending: false)
            .execute()
            .value

        return rows
            .map { row in
                mapChatMessage(
                    row,
                    currentUserId: context.userId,
                    roomId: roomId
                )
            }
    }

    func sendMessage(
        roomId: String,
        content: String,
        contentType: MessageType,
        mediaUrl: String?,
        mediaMimeType: String?
    ) async throws -> ChatMessage {
        let context = try await sessionContext()
        let isBotRoom = roomId == Self.botRoomID
        let conversationID = isBotRoom
            ? botConversationID(for: context.userId)
            : directConversationID(for: context.userId, friendId: roomId)
        let receiverID = isBotRoom ? context.userId : roomId

        let insertPayload = SupabaseChatMessageInsert(
            conversationId: conversationID,
            senderId: context.userId,
            receiverId: receiverID,
            text: content,
            isRead: false,
            messageType: rawMessageType(for: contentType),
            mediaUri: mediaUrl,
            mediaType: mediaMimeType,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: contentType == .voice ? mediaUrl : nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: contentType == .voice ? mediaMimeType : nil
        )

        let insertedRow: SupabaseChatMessageRow = try await client.database
            .from("chat_messages")
            .insert(insertPayload, returning: .representation)
            .single()
            .execute()
            .value

        if !isBotRoom {
            let unreadPayload = SupabaseUnreadCountUpsert(
                userId: receiverID,
                friendId: context.userId,
                unreadCount: 1,
                lastMessage: content,
                lastMessageTime: Self.iso8601String(from: Date())
            )

            _ = try? await client.database
                .from("unread_counts")
                .upsert(
                    unreadPayload,
                    onConflict: "user_id,friend_id",
                    returning: .minimal
                )
                .execute()
        }

        return mapChatMessage(
            insertedRow,
            currentUserId: context.userId,
            roomId: roomId
        )
    }

    func markMessageAsRead(roomId: String, messageId: String) async throws {
        let context = try await sessionContext()
        let updatePayload = SupabaseChatReadUpdate(isRead: true)

        try await client.database
            .from("chat_messages")
            .update(updatePayload, returning: .minimal)
            .eq("id", value: messageId)
            .eq("receiver_id", value: context.userId)
            .execute()
    }

    func deleteChatRoom(roomId: String) async throws {
        let context = try await sessionContext()
        let conversationID = roomId == Self.botRoomID
            ? botConversationID(for: context.userId)
            : directConversationID(for: context.userId, friendId: roomId)

        try await client.database
            .from("chat_messages")
            .delete()
            .eq("conversation_id", value: conversationID)
            .execute()
    }

    // MARK: - Private Helpers

    private func sessionContext() async throws -> SessionContext {
        guard let accessToken = keychain.getAccessToken() else {
            throw NetworkError.unauthorized
        }

        let userId = try resolvedUserId(accessToken: accessToken)
        let keychainSignature = sessionSignature(accessToken: accessToken, userId: userId)
        if syncedTokenSignature != keychainSignature {
            _ = await client.database.setAuth(accessToken)
            syncedTokenSignature = keychainSignature
        }

        return SessionContext(userId: userId)
    }

    private func resolvedUserId(accessToken: String) throws -> String {
        if let userId = normalizedUserId(from: keychain.getUserId()) {
            return userId
        }

        guard
            let claims = decodeJWTClaims(from: accessToken),
            let subject = claims["sub"] as? String,
            let userId = normalizedUserId(from: subject)
        else {
            throw NetworkError.unauthorized
        }

        try? keychain.saveUserId(userId)
        return userId
    }

    private func normalizedUserId(from rawValue: String?) -> String? {
        guard let rawValue else {
            return nil
        }

        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }

        return trimmed.lowercased()
    }

    private func sessionSignature(accessToken: String, userId: String) -> String {
        "\(userId)::\(accessToken.prefix(24))"
    }

    private func decodeJWTClaims(from token: String) -> [String: Any]? {
        let segments = token.split(separator: ".")
        guard segments.count >= 2 else { return nil }

        let payload = String(segments[1])
        guard let data = decodeBase64URL(payload) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private func decodeBase64URL(_ value: String) -> Data? {
        var normalized = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        let remainder = normalized.count % 4
        if remainder != 0 {
            normalized += String(repeating: "=", count: 4 - remainder)
        }

        return Data(base64Encoded: normalized)
    }

    private func fetchProfileRow(userId: String) async throws -> SupabaseProfileRow {
        let rows: [SupabaseProfileRow] = try await client.database
            .from("profiles")
            .select(profileSelectColumns)
            .eq("id", value: userId)
            .limit(1)
            .execute()
            .value

        guard let row = rows.first else {
            throw NetworkError.notFound
        }

        return row
    }

    private func fetchOrCreatePointsRow(
        userId: String,
        fallbackPoints: Int
    ) async throws -> SupabaseUserPointsRow {
        let rows: [SupabaseUserPointsRow] = try await client.database
            .from("user_points")
            .select("id,user_id,total_points,level,total_earned,total_spent,created_at,updated_at")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value

        if let row = rows.first {
            return row
        }

        let insertPayload = SupabaseUserPointsInsert(
            userId: userId,
            totalPoints: fallbackPoints,
            level: level(for: fallbackPoints),
            totalEarned: max(fallbackPoints, 0),
            totalSpent: 0
        )

        return try await client.database
            .from("user_points")
            .insert(insertPayload, returning: .representation)
            .single()
            .execute()
            .value
    }

    private func countRows(
        table: String,
        filters: (PostgrestFilterBuilder) -> PostgrestFilterBuilder
    ) async throws -> Int {
        let response: PostgrestResponse<Void> = try await filters(
            client.database.from(table).select("id")
        ).execute(options: FetchOptions(head: true, count: .exact))

        return response.count ?? 0
    }

    private func fetchPresenceRows(ids: [String]) async throws -> [SupabasePresenceRow] {
        guard !ids.isEmpty else { return [] }

        return try await client.database
            .from("profiles")
            .select("id,last_active_at,show_online_status")
            .in("id", value: ids)
            .execute()
            .value
    }

    private func fetchProfilePreviewRows(ids: [String]) async throws -> [SupabaseProfilePreviewRow] {
        guard !ids.isEmpty else { return [] }

        return try await client.database
            .from("profiles")
            .select("id,username,full_name,avatar_url,last_active_at,show_online_status,created_at")
            .in("id", value: ids)
            .execute()
            .value
    }

    private func fetchNotification(id: String, userId: String) async throws -> SupabaseNotificationRow {
        let rows: [SupabaseNotificationRow] = try await client.database
            .from("notifications")
            .select("id,user_id,type,title,content,avatar_url,is_read,created_at")
            .eq("id", value: id)
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value

        guard let notification = rows.first else {
            throw NetworkError.notFound
        }

        return notification
    }

    private func achievementStats(for userId: String) async throws -> SupabaseAchievementStats {
        let profile = try await fetchProfileRow(userId: userId)
        let sessions: [SupabaseAchievementSessionRow] = try await client.database
            .from("study_sessions")
            .select("duration,started_at")
            .eq("user_id", value: userId)
            .execute()
            .value

        let totalMinutes = profile.totalStudyTime ?? sessions.reduce(0) { $0 + $1.duration }
        let longestSingleSession = sessions.map(\.duration).max() ?? 0
        let totalSessions = sessions.count
        let earlyBirdCount = sessions.reduce(0) { partialResult, session in
            let hour = Calendar.current.component(.hour, from: session.startedAt)
            return partialResult + ((4..<8).contains(hour) ? 1 : 0)
        }
        let nightOwlCount = sessions.reduce(0) { partialResult, session in
            let hour = Calendar.current.component(.hour, from: session.startedAt)
            return partialResult + ((hour >= 22 || hour < 3) ? 1 : 0)
        }
        let weekendCount = sessions.reduce(0) { partialResult, session in
            let weekday = Calendar.current.component(.weekday, from: session.startedAt)
            return partialResult + ((weekday == 1 || weekday == 7) ? 1 : 0)
        }

        return SupabaseAchievementStats(
            totalMinutes: totalMinutes,
            totalSessions: totalSessions,
            dailyStreak: profile.currentStreak ?? 0,
            friendsStudiedCount: 0,
            longestSingleSession: longestSingleSession,
            earlyBirdCount: earlyBirdCount,
            nightOwlCount: nightOwlCount,
            weekendCount: weekendCount
        )
    }

    private func isAchievementUnlocked(
        _ achievement: Achievement,
        stats: SupabaseAchievementStats
    ) -> Bool {
        switch achievement.type {
        case .totalMinutes:
            return stats.totalMinutes >= achievement.requirement
        case .singleSession:
            return stats.longestSingleSession >= achievement.requirement
        case .dailyStreak:
            return stats.dailyStreak >= achievement.requirement
        case .weeklyStreak:
            return stats.dailyStreak >= achievement.requirement * 7
        case .totalSessions:
            return stats.totalSessions >= achievement.requirement
        case .friendsStudied:
            return stats.friendsStudiedCount >= achievement.requirement
        case .earlyBird:
            return stats.earlyBirdCount >= achievement.requirement
        case .nightOwl:
            return stats.nightOwlCount >= achievement.requirement
        case .weekendWarrior:
            return stats.weekendCount >= achievement.requirement
        case .perfectMonth:
            return stats.dailyStreak >= achievement.requirement
        }
    }

    private func extractFriendRequestSenderId(from content: String) -> String? {
        guard let range = content.range(of: Self.friendRequestMetaPrefix) else {
            return nil
        }

        let suffix = content[range.upperBound...]
        return suffix.split(whereSeparator: \.isNewline).first.map(String.init)
    }

    private func resolvedProfileName(_ profile: (any ProfileNameProviding)?) -> String {
        guard let profile else { return "好友" }
        let candidates = [profile.fullName, profile.username]
        return candidates
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first(where: { !$0.isEmpty }) ?? "好友"
    }

    private func presenceStatus(
        for row: SupabaseFriendLatestMessageRow,
        presence: SupabasePresenceRow?
    ) -> FriendStatus {
        guard presence?.showOnlineStatus ?? true else {
            return .offline
        }

        if row.isStudying {
            return .online
        }

        guard let lastActiveAt = presence?.lastActiveAt else {
            return .offline
        }

        let interval = Date().timeIntervalSince(lastActiveAt)
        if interval <= 5 * 60 {
            return .online
        }
        if interval <= 30 * 60 {
            return .away
        }
        return .offline
    }

    private func isProfileOnline(_ profile: SupabaseProfilePreviewRow) -> Bool {
        guard profile.showOnlineStatus ?? true else {
            return false
        }
        guard let lastActiveAt = profile.lastActiveAt else {
            return false
        }
        return Date().timeIntervalSince(lastActiveAt) <= 5 * 60
    }

    private func directConversationID(for userId: String, friendId: String) -> String {
        [userId, friendId].sorted().joined(separator: "_")
    }

    private func botConversationID(for userId: String) -> String {
        "\(Self.botRoomID)_\(userId)"
    }

    private func mapChatMessage(
        _ row: SupabaseChatMessageRow,
        currentUserId: String,
        roomId: String
    ) -> ChatMessage {
        let sender: MessageSender
        if row.senderId == currentUserId {
            sender = .user
        } else if roomId == Self.botRoomID {
            sender = .bot
        } else {
            sender = .friend
        }

        return ChatMessage(
            id: row.id,
            roomId: roomId,
            senderId: row.senderId,
            sender: sender,
            content: row.text,
            messageType: mapMessageType(row.messageType),
            mediaUrl: row.mediaUri,
            mediaMimeType: row.mediaType,
            mediaDuration: row.voiceDuration,
            mediaSize: row.mediaSize,
            mediaMetadata: row.mediaMetadata,
            voiceUrl: row.voiceUrl,
            voiceDuration: row.voiceDuration,
            voiceTranscript: row.voiceTranscript,
            voiceMimeType: row.voiceMimeType,
            isRead: row.isRead,
            createdAt: row.createdAt
        )
    }

    private func mapMessageType(_ rawValue: String?) -> MessageType {
        guard let rawValue else { return .text }
        switch rawValue {
        case "image":
            return .image
        case "voice":
            return .voice
        case "video":
            return .video
        case "file", "mixed":
            return .file
        default:
            return .text
        }
    }

    private func rawMessageType(for type: MessageType) -> String {
        switch type {
        case .text:
            return "text"
        case .image:
            return "image"
        case .voice:
            return "voice"
        case .video:
            return "video"
        case .file:
            return "file"
        }
    }

    private func mapTransactionType(_ rawValue: String) -> TransactionType {
        TransactionType(rawValue: rawValue) ?? .adminAdjust
    }

    private func level(for totalPoints: Int) -> Int {
        switch totalPoints {
        case ..<100:
            return 1
        case 100..<500:
            return 2
        case 500..<1_500:
            return 3
        case 1_500..<3_000:
            return 4
        case 3_000..<5_000:
            return 5
        default:
            return 6 + max(0, (totalPoints - 5_000) / 2_000)
        }
    }

    private static func iso8601String(from date: Date) -> String {
        iso8601Formatter.string(from: date)
    }

    private let profileSelectColumns = """
    id,username,email,avatar_url,avatar_config,full_name,display_name,bio,website,points,is_studying,companion_id,total_study_time,last_active_at,current_streak,days_active,interaction_count,show_online_status,school,grade,created_at,updated_at
    """

    private let pointTransactionSelectColumns = """
    id,user_id,points_change,transaction_type,description,metadata,balance_after,created_at
    """

    private let chatMessageSelectColumns = """
    id,conversation_id,sender_id,receiver_id,text,is_read,created_at,message_type,media_uri,media_type,media_size,media_metadata,voice_url,voice_duration,voice_transcript,voice_mime_type
    """

    private let studySessionSelectColumns = """
    id,user_id,subject,duration,started_at,ended_at,notes,created_at,is_completed,earned_points
    """

    private static let achievementCatalog: [Achievement] = [
        Achievement(id: "duration_10", name: "初学者", nameEn: "Beginner", description: "累计专注 10 分钟", icon: "🌱", category: .duration, requirement: 10, type: .totalMinutes, rarity: .common, unlockedAt: nil),
        Achievement(id: "duration_60", name: "一小时学者", nameEn: "Hour Scholar", description: "累计专注 60 分钟", icon: "📖", category: .duration, requirement: 60, type: .totalMinutes, rarity: .common, unlockedAt: nil),
        Achievement(id: "duration_300", name: "五小时大师", nameEn: "Five Hour Master", description: "累计专注 300 分钟", icon: "🎓", category: .duration, requirement: 300, type: .totalMinutes, rarity: .rare, unlockedAt: nil),
        Achievement(id: "duration_1000", name: "千分钟达人", nameEn: "Thousand Minute Pro", description: "累计专注 1000 分钟", icon: "🏆", category: .duration, requirement: 1000, type: .totalMinutes, rarity: .epic, unlockedAt: nil),
        Achievement(id: "duration_5000", name: "专注传奇", nameEn: "Focus Legend", description: "累计专注 5000 分钟", icon: "👑", category: .duration, requirement: 5000, type: .totalMinutes, rarity: .legendary, unlockedAt: nil),
        Achievement(id: "single_25", name: "番茄达人", nameEn: "Pomodoro Master", description: "单次专注 25 分钟", icon: "🍅", category: .duration, requirement: 25, type: .singleSession, rarity: .common, unlockedAt: nil),
        Achievement(id: "single_45", name: "深度学习者", nameEn: "Deep Learner", description: "单次专注 45 分钟", icon: "🧠", category: .duration, requirement: 45, type: .singleSession, rarity: .rare, unlockedAt: nil),
        Achievement(id: "single_60", name: "一小时王者", nameEn: "Hour Champion", description: "单次专注 60 分钟", icon: "⚡", category: .duration, requirement: 60, type: .singleSession, rarity: .epic, unlockedAt: nil),
        Achievement(id: "streak_3", name: "三天坚持", nameEn: "Three Day Streak", description: "连续学习 3 天", icon: "🔥", category: .streak, requirement: 3, type: .dailyStreak, rarity: .common, unlockedAt: nil),
        Achievement(id: "streak_7", name: "一周达人", nameEn: "Week Warrior", description: "连续学习 7 天", icon: "💪", category: .streak, requirement: 7, type: .dailyStreak, rarity: .rare, unlockedAt: nil),
        Achievement(id: "streak_30", name: "月度冠军", nameEn: "Monthly Champion", description: "连续学习 30 天", icon: "🌟", category: .streak, requirement: 30, type: .dailyStreak, rarity: .epic, unlockedAt: nil),
        Achievement(id: "streak_100", name: "百日英雄", nameEn: "Hundred Day Hero", description: "连续学习 100 天", icon: "🦸", category: .streak, requirement: 100, type: .dailyStreak, rarity: .legendary, unlockedAt: nil),
        Achievement(id: "social_first", name: "结伴学习", nameEn: "Study Buddy", description: "和好友一起学习 1 次", icon: "🤝", category: .social, requirement: 1, type: .friendsStudied, rarity: .common, unlockedAt: nil),
        Achievement(id: "social_10", name: "学习伙伴", nameEn: "Learning Partner", description: "和好友一起学习 10 次", icon: "👥", category: .social, requirement: 10, type: .friendsStudied, rarity: .rare, unlockedAt: nil),
        Achievement(id: "early_bird", name: "早起鸟", nameEn: "Early Bird", description: "在早上 7 点前开始学习", icon: "🌅", category: .special, requirement: 1, type: .earlyBird, rarity: .rare, unlockedAt: nil),
        Achievement(id: "night_owl", name: "夜猫子", nameEn: "Night Owl", description: "在晚上 10 点后开始学习", icon: "🦉", category: .special, requirement: 1, type: .nightOwl, rarity: .rare, unlockedAt: nil),
        Achievement(id: "perfect_month", name: "完美月份", nameEn: "Perfect Month", description: "一个月内每天都有学习", icon: "📅", category: .milestone, requirement: 30, type: .perfectMonth, rarity: .legendary, unlockedAt: nil),
    ]
}

private struct SessionContext {
    let userId: String
}

private protocol ProfileNameProviding {
    var username: String? { get }
    var fullName: String? { get }
}

private struct SupabaseProfileRow: Decodable, ProfileNameProviding {
    let id: String
    let username: String?
    let email: String?
    let avatarUrl: String?
    let fullName: String?
    let displayName: String?
    let bio: String?
    let website: String?
    let points: Int?
    let isStudying: Bool?
    let companionId: String?
    let totalStudyTime: Int?
    let lastActiveAt: Date?
    let currentStreak: Int?
    let daysActive: Int?
    let interactionCount: Int?
    let showOnlineStatus: Bool?
    let school: String?
    let grade: String?
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case email
        case avatarUrl = "avatar_url"
        case fullName = "full_name"
        case displayName = "display_name"
        case bio
        case website
        case points
        case isStudying = "is_studying"
        case companionId = "companion_id"
        case totalStudyTime = "total_study_time"
        case lastActiveAt = "last_active_at"
        case currentStreak = "current_streak"
        case daysActive = "days_active"
        case interactionCount = "interaction_count"
        case showOnlineStatus = "show_online_status"
        case school
        case grade
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

private struct SupabaseStudyDurationRow: Decodable {
    let duration: Int

    enum CodingKeys: String, CodingKey {
        case duration
    }
}

private struct SupabaseStudySessionRow: Decodable {
    let id: String
    let userId: String
    let subject: String?
    let duration: Int
    let startedAt: Date
    let endedAt: Date?
    let notes: String?
    let createdAt: Date?
    let isCompleted: Bool
    let earnedPoints: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case subject
        case duration
        case startedAt = "started_at"
        case endedAt = "ended_at"
        case notes
        case createdAt = "created_at"
        case isCompleted = "is_completed"
        case earnedPoints = "earned_points"
    }
}

private struct SupabaseUserPointsRow: Decodable {
    let id: String
    let userId: String
    let totalPoints: Int
    let level: Int
    let totalEarned: Int
    let totalSpent: Int
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case totalPoints = "total_points"
        case level
        case totalEarned = "total_earned"
        case totalSpent = "total_spent"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

private struct SupabaseUserPointsInsert: Encodable {
    let userId: String
    let totalPoints: Int
    let level: Int
    let totalEarned: Int
    let totalSpent: Int

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case totalPoints = "total_points"
        case level
        case totalEarned = "total_earned"
        case totalSpent = "total_spent"
    }
}

private struct SupabaseUserPointsMutation: Encodable {
    let totalPoints: Int
    let level: Int
    let totalEarned: Int
    let totalSpent: Int
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case totalPoints = "total_points"
        case level
        case totalEarned = "total_earned"
        case totalSpent = "total_spent"
        case updatedAt = "updated_at"
    }
}

private struct SupabasePointTransactionRow: Decodable {
    let id: String
    let userId: String
    let pointsChange: Int
    let transactionType: String
    let description: String?
    let metadata: [String: String]?
    let balanceAfter: Int
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case pointsChange = "points_change"
        case transactionType = "transaction_type"
        case description
        case metadata
        case balanceAfter = "balance_after"
        case createdAt = "created_at"
    }
}

private struct SupabasePointTransactionInsert: Encodable {
    let userId: String
    let pointsChange: Int
    let transactionType: String
    let description: String
    let metadata: [String: String]?
    let balanceAfter: Int

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case pointsChange = "points_change"
        case transactionType = "transaction_type"
        case description
        case metadata
        case balanceAfter = "balance_after"
    }
}

private struct SupabaseUnlockedAchievementRow: Decodable {
    let id: String
    let achievementId: String
    let unlockedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case achievementId = "achievement_id"
        case unlockedAt = "unlocked_at"
    }
}

private struct SupabaseAchievementInsert: Encodable {
    let userId: String
    let achievementId: String
    let unlockedAt: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case achievementId = "achievement_id"
        case unlockedAt = "unlocked_at"
    }
}

private struct SupabaseAchievementSessionRow: Decodable {
    let duration: Int
    let startedAt: Date

    enum CodingKeys: String, CodingKey {
        case duration
        case startedAt = "started_at"
    }
}

private struct SupabaseAchievementStats {
    let totalMinutes: Int
    let totalSessions: Int
    let dailyStreak: Int
    let friendsStudiedCount: Int
    let longestSingleSession: Int
    let earlyBirdCount: Int
    let nightOwlCount: Int
    let weekendCount: Int
}

private struct SupabaseFriendLatestMessageRow: Decodable {
    let friendshipId: String
    let userId: String
    let friendId: String
    let name: String
    let avatarUrl: String?
    let status: String?
    let bio: String?
    let studyTime: Int
    let isStudying: Bool
    let unreadCount: Int
    let lastMessage: String?
    let lastMessageTime: Date?
    let sortTime: Date?

    enum CodingKeys: String, CodingKey {
        case friendshipId = "friendship_id"
        case userId = "user_id"
        case friendId = "friend_id"
        case name
        case avatarUrl = "avatar_url"
        case status
        case bio
        case studyTime = "study_time"
        case isStudying = "is_studying"
        case unreadCount = "unread_count"
        case lastMessage = "last_message"
        case lastMessageTime = "last_message_time"
        case sortTime = "sort_time"
    }
}

private struct SupabasePresenceRow: Decodable {
    let id: String
    let lastActiveAt: Date?
    let showOnlineStatus: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case lastActiveAt = "last_active_at"
        case showOnlineStatus = "show_online_status"
    }
}

private struct SupabaseProfilePreviewRow: Decodable, ProfileNameProviding {
    let id: String
    let username: String?
    let fullName: String?
    let avatarUrl: String?
    let lastActiveAt: Date?
    let showOnlineStatus: Bool?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case fullName = "full_name"
        case avatarUrl = "avatar_url"
        case lastActiveAt = "last_active_at"
        case showOnlineStatus = "show_online_status"
        case createdAt = "created_at"
    }
}

private struct SupabaseNotificationRow: Decodable {
    let id: String
    let userId: String
    let type: String
    let title: String?
    let content: String
    let avatarUrl: String?
    let isRead: Bool
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case type
        case title
        case content
        case avatarUrl = "avatar_url"
        case isRead = "is_read"
        case createdAt = "created_at"
    }
}

private struct SupabaseNotificationInsert: Encodable {
    let userId: String
    let type: String
    let title: String
    let content: String
    let avatarUrl: String
    let isRead: Bool

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case type
        case title
        case content
        case avatarUrl = "avatar_url"
        case isRead = "is_read"
    }
}

private struct SupabaseNotificationReadUpdate: Encodable {
    let isRead: Bool

    enum CodingKeys: String, CodingKey {
        case isRead = "is_read"
    }
}

private struct SupabaseFriendInsert: Encodable {
    let userId: String
    let friendId: String
    let status: String
    let isStudying: Bool
    let studyTime: Int
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case friendId = "friend_id"
        case status
        case isStudying = "is_studying"
        case studyTime = "study_time"
        case updatedAt = "updated_at"
    }
}

private struct SupabaseFriendIDRow: Decodable {
    let friendId: String

    enum CodingKeys: String, CodingKey {
        case friendId = "friend_id"
    }
}

private struct SupabaseChatMessageRow: Decodable {
    let id: String
    let conversationId: String
    let senderId: String
    let receiverId: String
    let text: String
    let isRead: Bool
    let createdAt: Date
    let messageType: String?
    let mediaUri: String?
    let mediaType: String?
    let mediaSize: Int64?
    let mediaMetadata: [String: AnyCodable]?
    let voiceUrl: String?
    let voiceDuration: Int?
    let voiceTranscript: String?
    let voiceMimeType: String?

    enum CodingKeys: String, CodingKey {
        case id
        case conversationId = "conversation_id"
        case senderId = "sender_id"
        case receiverId = "receiver_id"
        case text
        case isRead = "is_read"
        case createdAt = "created_at"
        case messageType = "message_type"
        case mediaUri = "media_uri"
        case mediaType = "media_type"
        case mediaSize = "media_size"
        case mediaMetadata = "media_metadata"
        case voiceUrl = "voice_url"
        case voiceDuration = "voice_duration"
        case voiceTranscript = "voice_transcript"
        case voiceMimeType = "voice_mime_type"
    }
}

private struct SupabaseChatMessageInsert: Encodable {
    let conversationId: String
    let senderId: String
    let receiverId: String
    let text: String
    let isRead: Bool
    let messageType: String
    let mediaUri: String?
    let mediaType: String?
    let mediaSize: Int64?
    let mediaMetadata: [String: String]?
    let voiceUrl: String?
    let voiceDuration: Int?
    let voiceTranscript: String?
    let voiceMimeType: String?

    enum CodingKeys: String, CodingKey {
        case conversationId = "conversation_id"
        case senderId = "sender_id"
        case receiverId = "receiver_id"
        case text
        case isRead = "is_read"
        case messageType = "message_type"
        case mediaUri = "media_uri"
        case mediaType = "media_type"
        case mediaSize = "media_size"
        case mediaMetadata = "media_metadata"
        case voiceUrl = "voice_url"
        case voiceDuration = "voice_duration"
        case voiceTranscript = "voice_transcript"
        case voiceMimeType = "voice_mime_type"
    }
}

private struct SupabaseChatReadUpdate: Encodable {
    let isRead: Bool

    enum CodingKeys: String, CodingKey {
        case isRead = "is_read"
    }
}

private struct SupabaseUnreadCountUpsert: Encodable {
    let userId: String
    let friendId: String
    let unreadCount: Int
    let lastMessage: String
    let lastMessageTime: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case friendId = "friend_id"
        case unreadCount = "unread_count"
        case lastMessage = "last_message"
        case lastMessageTime = "last_message_time"
    }
}

// MARK: - Realtime Message Subscription

/// Realtime message subscription manager using Supabase Realtime
/// Uses native WebSocket connection for true real-time updates
@MainActor
final class RealtimeMessageSubscription: ObservableObject {
    static let shared = RealtimeMessageSubscription()

    @Published private(set) var isSubscribed = false
    @Published private(set) var connectionStatus: String = "disconnected"

    private var supabase: SupabaseClient?
    private var currentConversationId: String?
    private var currentUserId: String?
    private var callback: ((ChatMessage) -> Void)?
    private var currentChannel: RealtimeChannel?

    private init() {}

    /// Initialize with Supabase client
    func initialize(supabase: SupabaseClient, userId: String) {
        self.supabase = supabase
        self.currentUserId = userId
        connectionStatus = "initialized"
    }

    /// Subscribe to new messages using Supabase Realtime
    func subscribe(conversationId: String, onMessage: @escaping (ChatMessage) -> Void) async {
        // Unsubscribe from previous if any
        await unsubscribe()

        guard let supabase = supabase, let userId = currentUserId else {
            SecureLogger.shared.warning("Realtime: Cannot subscribe - supabase or userId is nil")
            return
        }

        self.callback = onMessage
        self.currentConversationId = conversationId
        connectionStatus = "connecting"

        // Connect to realtime socket first
        supabase.realtime.connect()

        // Create a channel for this conversation
        let channel = supabase.realtime.channel("chat:\(conversationId)")

        // Subscribe to postgres INSERT changes on chat_messages table
        channel.on(
            "postgres_changes",
            filter: ChannelFilter(
                event: "INSERT",
                schema: "public",
                table: "chat_messages",
                filter: "conversation_id=eq.\(conversationId)"
            )
        ) { [weak self] message in
            guard let self = self else { return }

            // Parse the payload
            if let payload = message.payload as? [String: Any],
               let newRecord = payload["new"] as? [String: Any],
               let senderId = newRecord["sender_id"] as? String,
               // Only process messages from others
               senderId != userId,
               let chatMessage = self.parseRecord(newRecord, currentUserId: userId, conversationId: conversationId) {
                Task {
                    await SecureLogger.shared.debug("Realtime: Received new message \(chatMessage.id)")
                }
                DispatchQueue.main.async {
                    self.callback?(chatMessage)
                }
            }
        }

        // Subscribe to the channel
        channel.subscribe { [weak self] state, _ in
            Task {
                await SecureLogger.shared.debug("Realtime: Subscribe state changed to \(String(describing: state))")
            }
            DispatchQueue.main.async {
                self?.isSubscribed = (state == .subscribed)
                self?.connectionStatus = state == .subscribed ? "connected" : "connecting"
            }
        }

        self.currentChannel = channel
        await SecureLogger.shared.info("Realtime: Connected to conversation: \(conversationId)")
    }

    /// Parse database record to ChatMessage
    private func parseRecord(_ record: [String: Any], currentUserId: String, conversationId: String) -> ChatMessage? {
        guard let id = record["id"] as? String,
              let senderId = record["sender_id"] as? String else {
            return nil
        }

        let text = record["text"] as? String ?? ""
        let createdAtString = record["created_at"] as? String ?? ""
        let messageTypeString = record["message_type"] as? String ?? "text"

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let createdAt = formatter.date(from: createdAtString) ?? Date()

        let sender: MessageSender = senderId == currentUserId ? .user : .friend

        let messageType: MessageType
        switch messageTypeString {
        case "image": messageType = .image
        case "video": messageType = .video
        case "voice": messageType = .voice
        case "file": messageType = .file
        default: messageType = .text
        }

        return ChatMessage(
            id: id,
            roomId: conversationId,
            senderId: senderId,
            sender: sender,
            content: text,
            messageType: messageType,
            mediaUrl: record["media_uri"] as? String,
            mediaMimeType: record["media_type"] as? String,
            mediaDuration: record["media_duration"] as? Int,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: record["voice_url"] as? String,
            voiceDuration: record["voice_duration"] as? Int,
            voiceTranscript: record["voice_transcript"] as? String,
            voiceMimeType: record["voice_mime_type"] as? String,
            isRead: record["is_read"] as? Bool ?? false,
            createdAt: createdAt
        )
    }

    /// Unsubscribe and disconnect
    func unsubscribe() async {
        if let channel = currentChannel {
            channel.unsubscribe()
            await SecureLogger.shared.info("Realtime: Unsubscribed from channel")
        }

        currentChannel = nil
        callback = nil
        currentConversationId = nil
        isSubscribed = false
        connectionStatus = "disconnected"
    }
}
