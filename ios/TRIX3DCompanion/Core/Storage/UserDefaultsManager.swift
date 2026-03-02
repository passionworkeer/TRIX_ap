import Foundation

/// UserDefaults 管理器 - 用户偏好设置和缓存数据
final class UserDefaultsManager {

    // MARK: - Singleton

    static let shared = UserDefaultsManager()

    // MARK: - Properties

    private let defaults: UserDefaults

    // MARK: - Keys

    private enum Key {
        // User Info Cache
        static let cachedUser = "cachedUser"
        static let lastSyncTime = "lastSyncTime"

        // App Settings
        static let hasCompletedOnboarding = "hasCompletedOnboarding"
        static let selectedTheme = "selectedTheme"
        static let language = "language"
        static let notificationsEnabled = "notificationsEnabled"
        static let studyRemindersEnabled = "studyRemindersEnabled"
        static let reminderTime = "reminderTime"

        // Study Settings
        static let focusDuration = "focusDuration"
        static let restDuration = "restDuration"
        static let dailyGoalMinutes = "dailyGoalMinutes"

        // Chat Settings
        static let soundEnabled = "soundEnabled"
        static let vibrationEnabled = "vibrationEnabled"
        static let messagePreviewEnabled = "messagePreviewEnabled"

        // Cache
        static let cachedChatRooms = "cachedChatRooms"
        static let cachedStudyStats = "cachedStudyStats"
        static let cachedPointsStats = "cachedPointsStats"

        // Last Known State
        static let lastKnownLocation = "lastKnownLocation"
        static let lastActiveTab = "lastActiveTab"
    }

    // MARK: - Initialization

    private init() {
        defaults = UserDefaults.standard
    }

    // MARK: - User Cache

    /// 缓存用户信息
    /// - Parameter user: 用户对象
    func cacheUser(_ user: User) {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(user)
            defaults.set(data, forKey: Key.cachedUser)
        } catch {
            SecureLogger.shared.error("Failed to cache user: \(error)")
        }
    }

    /// 获取缓存的用户信息
    /// - Returns: 用户对象，如果不存在则返回 nil
    func getCachedUser() -> User? {
        guard let data = defaults.data(forKey: Key.cachedUser) else {
            return nil
        }
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(User.self, from: data)
        } catch {
            SecureLogger.shared.error("Failed to decode cached user: \(error)")
            return nil
        }
    }

    /// 清除缓存的用户信息
    func clearCachedUser() {
        defaults.removeObject(forKey: Key.cachedUser)
    }

    /// 更新最后同步时间
    func updateLastSyncTime() {
        defaults.set(Date(), forKey: Key.lastSyncTime)
    }

    /// 获取最后同步时间
    /// - Returns: 最后同步时间
    func getLastSyncTime() -> Date? {
        defaults.object(forKey: Key.lastSyncTime) as? Date
    }

    // MARK: - App Settings

    /// 检查是否已完成引导
    /// - Returns: 是否已完成引导
    func hasCompletedOnboarding() -> Bool {
        defaults.bool(forKey: Key.hasCompletedOnboarding)
    }

    /// 设置引导完成状态
    /// - Parameter completed: 是否完成
    func setOnboardingCompleted(_ completed: Bool) {
        defaults.set(completed, forKey: Key.hasCompletedOnboarding)
    }

    /// 获取选中的主题
    /// - Returns: 主题设置
    func getSelectedTheme() -> AppTheme {
        guard let rawValue = defaults.string(forKey: Key.selectedTheme),
              let theme = AppTheme(rawValue: rawValue) else {
            return .system
        }
        return theme
    }

    /// 设置主题
    /// - Parameter theme: 主题
    func setSelectedTheme(_ theme: AppTheme) {
        defaults.set(theme.rawValue, forKey: Key.selectedTheme)
    }

    /// 获取语言设置
    /// - Returns: 语言代码
    func getLanguage() -> String? {
        defaults.string(forKey: Key.language)
    }

    /// 设置语言
    /// - Parameter language: 语言代码
    func setLanguage(_ language: String) {
        defaults.set(language, forKey: Key.language)
    }

    // MARK: - Notification Settings

    /// 检查通知是否启用
    /// - Returns: 是否启用通知
    func isNotificationsEnabled() -> Bool {
        // 默认启用
        defaults.object(forKey: Key.notificationsEnabled) as? Bool ?? true
    }

    /// 设置通知启用状态
    /// - Parameter enabled: 是否启用
    func setNotificationsEnabled(_ enabled: Bool) {
        defaults.set(enabled, forKey: Key.notificationsEnabled)
    }

    /// 检查学习提醒是否启用
    /// - Returns: 是否启用学习提醒
    func isStudyRemindersEnabled() -> Bool {
        defaults.bool(forKey: Key.studyRemindersEnabled)
    }

    /// 设置学习提醒启用状态
    /// - Parameter enabled: 是否启用
    func setStudyRemindersEnabled(_ enabled: Bool) {
        defaults.set(enabled, forKey: Key.studyRemindersEnabled)
    }

    /// 获取提醒时间
    /// - Returns: 提醒时间（小时和分钟）
    func getReminderTime() -> (hour: Int, minute: Int)? {
        guard let timeString = defaults.string(forKey: Key.reminderTime) else {
            return nil
        }
        let components = timeString.split(separator: ":").compactMap { Int($0) }
        guard components.count == 2 else { return nil }
        return (hour: components[0], minute: components[1])
    }

    /// 设置提醒时间
    /// - Parameters:
    ///   - hour: 小时
    ///   - minute: 分钟
    func setReminderTime(hour: Int, minute: Int) {
        let timeString = String(format: "%02d:%02d", hour, minute)
        defaults.set(timeString, forKey: Key.reminderTime)
    }

    // MARK: - Study Settings

    /// 获取专注时长（分钟）
    /// - Returns: 专注时长，默认 25 分钟
    func getFocusDuration() -> Int {
        let duration = defaults.integer(forKey: Key.focusDuration)
        return duration > 0 ? duration : 25
    }

    /// 设置专注时长
    /// - Parameter duration: 时长（分钟）
    func setFocusDuration(_ duration: Int) {
        defaults.set(duration, forKey: Key.focusDuration)
    }

    /// 获取休息时长（分钟）
    /// - Returns: 休息时长，默认 5 分钟
    func getRestDuration() -> Int {
        let duration = defaults.integer(forKey: Key.restDuration)
        return duration > 0 ? duration : 5
    }

    /// 设置休息时长
    /// - Parameter duration: 时长（分钟）
    func setRestDuration(_ duration: Int) {
        defaults.set(duration, forKey: Key.restDuration)
    }

    /// 获取每日目标（分钟）
    /// - Returns: 每日目标，默认 120 分钟
    func getDailyGoalMinutes() -> Int {
        let goal = defaults.integer(forKey: Key.dailyGoalMinutes)
        return goal > 0 ? goal : 120
    }

    /// 设置每日目标
    /// - Parameter minutes: 分钟数
    func setDailyGoalMinutes(_ minutes: Int) {
        defaults.set(minutes, forKey: Key.dailyGoalMinutes)
    }

    // MARK: - Chat Settings

    /// 检查声音是否启用
    /// - Returns: 是否启用声音
    func isSoundEnabled() -> Bool {
        defaults.object(forKey: Key.soundEnabled) as? Bool ?? true
    }

    /// 设置声音启用状态
    /// - Parameter enabled: 是否启用
    func setSoundEnabled(_ enabled: Bool) {
        defaults.set(enabled, forKey: Key.soundEnabled)
    }

    /// 检查震动是否启用
    /// - Returns: 是否启用震动
    func isVibrationEnabled() -> Bool {
        defaults.object(forKey: Key.vibrationEnabled) as? Bool ?? true
    }

    /// 设置震动启用状态
    /// - Parameter enabled: 是否启用
    func setVibrationEnabled(_ enabled: Bool) {
        defaults.set(enabled, forKey: Key.vibrationEnabled)
    }

    /// 检查消息预览是否启用
    /// - Returns: 是否启用消息预览
    func isMessagePreviewEnabled() -> Bool {
        defaults.object(forKey: Key.messagePreviewEnabled) as? Bool ?? true
    }

    /// 设置消息预览启用状态
    /// - Parameter enabled: 是否启用
    func setMessagePreviewEnabled(_ enabled: Bool) {
        defaults.set(enabled, forKey: Key.messagePreviewEnabled)
    }

    // MARK: - Cache Data

    /// 缓存聊天房间列表
    /// - Parameter rooms: 聊天房间数组
    func cacheChatRooms(_ rooms: [ChatRoom]) {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(rooms)
            defaults.set(data, forKey: Key.cachedChatRooms)
            updateLastSyncTime()
        } catch {
            SecureLogger.shared.error("Failed to cache chat rooms: \(error)")
        }
    }

    /// 获取缓存的聊天房间列表
    /// - Returns: 聊天房间数组
    func getCachedChatRooms() -> [ChatRoom]? {
        guard let data = defaults.data(forKey: Key.cachedChatRooms) else {
            return nil
        }
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode([ChatRoom].self, from: data)
        } catch {
            SecureLogger.shared.error("Failed to decode cached chat rooms: \(error)")
            return nil
        }
    }

    /// 缓存学习统计
    /// - Parameter stats: 学习统计
    func cacheStudyStats(_ stats: StudyStats) {
        do {
            let encoder = JSONEncoder()
            let data = try encoder.encode(stats)
            defaults.set(data, forKey: Key.cachedStudyStats)
        } catch {
            SecureLogger.shared.error("Failed to cache study stats: \(error)")
        }
    }

    /// 获取缓存的学习统计
    /// - Returns: 学习统计
    func getCachedStudyStats() -> StudyStats? {
        guard let data = defaults.data(forKey: Key.cachedStudyStats) else {
            return nil
        }
        do {
            return try JSONDecoder().decode(StudyStats.self, from: data)
        } catch {
            SecureLogger.shared.error("Failed to decode cached study stats: \(error)")
            return nil
        }
    }

    /// 缓存积分统计
    /// - Parameter stats: 积分统计
    func cachePointsStats(_ stats: UserPointsStats) {
        do {
            let data = try JSONEncoder().encode(stats)
            defaults.set(data, forKey: Key.cachedPointsStats)
        } catch {
            SecureLogger.shared.error("Failed to cache points stats: \(error)")
        }
    }

    /// 获取缓存的积分统计
    /// - Returns: 积分统计
    func getCachedPointsStats() -> UserPointsStats? {
        guard let data = defaults.data(forKey: Key.cachedPointsStats) else {
            return nil
        }
        do {
            return try JSONDecoder().decode(UserPointsStats.self, from: data)
        } catch {
            SecureLogger.shared.error("Failed to decode cached points stats: \(error)")
            return nil
        }
    }

    // MARK: - Last Known State

    /// 保存最后已知位置
    /// - Parameter location: 位置坐标
    func saveLastKnownLocation(latitude: Double, longitude: Double) {
        defaults.set(latitude, forKey: "lastKnownLatitude")
        defaults.set(longitude, forKey: "lastKnownLongitude")
    }

    /// 获取最后已知位置
    /// - Returns: 位置坐标
    func getLastKnownLocation() -> (latitude: Double, longitude: Double)? {
        let latitude = defaults.double(forKey: "lastKnownLatitude")
        let longitude = defaults.double(forKey: "lastKnownLongitude")

        // 检查是否有有效值
        if latitude != 0 && longitude != 0 {
            return (latitude: latitude, longitude: longitude)
        }
        return nil
    }

    /// 保存最后活动的 Tab
    /// - Parameter tabIndex: Tab 索引
    func saveLastActiveTab(_ tabIndex: Int) {
        defaults.set(tabIndex, forKey: Key.lastActiveTab)
    }

    /// 获取最后活动的 Tab
    /// - Returns: Tab 索引
    func getLastActiveTab() -> Int {
        defaults.integer(forKey: Key.lastActiveTab)
    }

    // MARK: - Generic Methods

    /// 保存任意值
    /// - Parameters:
    ///   - value: 值
    ///   - key: 键名
    func set<T>(_ value: T, forKey key: String) {
        defaults.set(value, forKey: key)
    }

    /// 获取值
    /// - Parameter key: 键名
    /// - Returns: 值
    func get<T>(_ key: String) -> T? {
        defaults.object(forKey: key) as? T
    }

    /// 保存任意 Data 类型
    /// - Parameters:
    ///   - data: Data 对象
    ///   - key: 键名
    func setData(_ data: Data, forKey key: String) {
        defaults.set(data, forKey: key)
    }

    /// 获取 Data 类型
    /// - Parameter key: 键名
    /// - Returns: Data 对象
    func getData(forKey key: String) -> Data? {
        defaults.data(forKey: key)
    }

    /// 删除指定键的值
    /// - Parameter key: 键名
    func remove(forKey key: String) {
        defaults.removeObject(forKey: key)
    }

    // MARK: - Clear Data

    /// 清除所有缓存数据（保留设置）
    func clearCache() {
        defaults.removeObject(forKey: Key.cachedUser)
        defaults.removeObject(forKey: Key.cachedChatRooms)
        defaults.removeObject(forKey: Key.cachedStudyStats)
        defaults.removeObject(forKey: Key.cachedPointsStats)
        defaults.removeObject(forKey: Key.lastSyncTime)
    }

    /// 清除所有数据（登出时调用）
    func clearAll() {
        clearCache()
        defaults.removeObject(forKey: Key.hasCompletedOnboarding)
        defaults.removeObject(forKey: Key.lastActiveTab)
        // 保留用户偏好设置
    }
}

// MARK: - Supporting Types

/// 应用主题
enum AppTheme: String, CaseIterable, Identifiable {
    case system = "system"
    case light = "light"
    case dark = "dark"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system:
            return "跟随系统"
        case .light:
            return "浅色模式"
        case .dark:
            return "深色模式"
        }
    }
}
