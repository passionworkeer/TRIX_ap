import Foundation
import Security
import KeychainAccess

/// Keychain 管理器 - 安全存储敏感数据
/// 使用 KeychainAccess 库简化 Keychain 操作
final class KeychainManager {

    // MARK: - Singleton

    static let shared = KeychainManager()

    // MARK: - Properties

    private let keychain: Keychain

    // MARK: - Keys

    private enum Key {
        static let accessToken = "com.trix3d.accessToken"
        static let refreshToken = "com.trix3d.refreshToken"
        static let sessionToken = "com.trix3d.sessionToken"
        static let userId = "com.trix3d.userId"
        static let deviceId = "com.trix3d.deviceId"
        static let biometricEnabled = "com.trix3d.biometricEnabled"
    }

    // MARK: - Initialization

    private init() {
        // 使用 bundle identifier 作为 service
        let bundleIdentifier = Bundle.main.bundleIdentifier ?? "com.trix3d.companion"
        keychain = Keychain(service: bundleIdentifier)
            .synchronizable(false) // 不同步到 iCloud
            .accessibility(.whenUnlockedThisDeviceOnly) // 仅在设备解锁时可访问
    }

    // MARK: - Token Management

    /// 保存 Access Token
    /// - Parameter token: Access Token 字符串
    func saveAccessToken(_ token: String) throws {
        try keychain.set(token, key: Key.accessToken)
    }

    /// 获取 Access Token
    /// - Returns: Access Token，如果不存在则返回 nil
    func getAccessToken() -> String? {
        try? keychain.get(Key.accessToken)
    }

    /// 删除 Access Token
    func deleteAccessToken() throws {
        try keychain.remove(Key.accessToken)
    }

    /// 保存 Refresh Token
    /// - Parameter token: Refresh Token 字符串
    func saveRefreshToken(_ token: String) throws {
        try keychain.set(token, key: Key.refreshToken)
    }

    /// 获取 Refresh Token
    /// - Returns: Refresh Token，如果不存在则返回 nil
    func getRefreshToken() -> String? {
        try? keychain.get(Key.refreshToken)
    }

    /// 删除 Refresh Token
    func deleteRefreshToken() throws {
        try keychain.remove(Key.refreshToken)
    }

    /// 保存 Session Token
    /// - Parameter token: Session Token 字符串
    func saveSessionToken(_ token: String) throws {
        try keychain.set(token, key: Key.sessionToken)
    }

    /// 获取 Session Token
    /// - Returns: Session Token，如果不存在则返回 nil
    func getSessionToken() -> String? {
        try? keychain.get(Key.sessionToken)
    }

    /// 删除 Session Token
    func deleteSessionToken() throws {
        try keychain.remove(Key.sessionToken)
    }

    // MARK: - User Management

    /// 保存用户 ID
    /// - Parameter userId: 用户 ID
    func saveUserId(_ userId: String) throws {
        try keychain.set(userId, key: Key.userId)
    }

    /// 获取用户 ID
    /// - Returns: 用户 ID，如果不存在则返回 nil
    func getUserId() -> String? {
        try? keychain.get(Key.userId)
    }

    /// 删除用户 ID
    func deleteUserId() throws {
        try keychain.remove(Key.userId)
    }

    // MARK: - Device Management

    /// 保存设备 ID
    /// - Parameter deviceId: 设备 ID
    func saveDeviceId(_ deviceId: String) throws {
        try keychain.set(deviceId, key: Key.deviceId)
    }

    /// 获取设备 ID
    /// - Returns: 设备 ID，如果不存在则返回 nil
    func getDeviceId() -> String? {
        try? keychain.get(Key.deviceId)
    }

    /// 获取或创建设备 ID
    /// - Returns: 设备 ID
    func getOrCreateDeviceId() -> String {
        if let existingId = getDeviceId() {
            return existingId
        }

        // 生成新的 UUID 作为设备 ID
        let newDeviceId = UUID().uuidString
        try? saveDeviceId(newDeviceId)
        return newDeviceId
    }

    // MARK: - Biometric Settings

    /// 保存生物识别启用状态
    /// - Parameter enabled: 是否启用
    func saveBiometricEnabled(_ enabled: Bool) throws {
        try keychain.set(enabled ? "true" : "false", key: Key.biometricEnabled)
    }

    /// 获取生物识别启用状态
    /// - Returns: 是否启用生物识别
    func isBiometricEnabled() -> Bool {
        (try? keychain.get(Key.biometricEnabled)) == "true"
    }

    // MARK: - Generic Methods

    /// 保存任意数据
    /// - Parameters:
    ///   - data: 要保存的数据
    ///   - key: 键名
    func saveData(_ data: Data, forKey key: String) throws {
        try keychain.set(data, key: key)
    }

    /// 获取数据
    /// - Parameter key: 键名
    /// - Returns: 数据，如果不存在则返回 nil
    func getData(forKey key: String) -> Data? {
        try? keychain.getData(key)
    }

    /// 保存字符串
    /// - Parameters:
    ///   - string: 要保存的字符串
    ///   - key: 键名
    func saveString(_ string: String, forKey key: String) throws {
        try keychain.set(string, key: key)
    }

    /// 获取字符串
    /// - Parameter key: 键名
    /// - Returns: 字符串，如果不存在则返回 nil
    func getString(forKey key: String) -> String? {
        try? keychain.get(key)
    }

    /// 删除指定键的数据
    /// - Parameter key: 键名
    func remove(forKey key: String) throws {
        try keychain.remove(key)
    }

    // MARK: - Session Management

    /// 保存完整的会话信息
    /// - Parameter session: 用户会话
    func saveSession(_ session: UserSession) throws {
        try saveAccessToken(session.accessToken)
        try saveRefreshToken(session.refreshToken)
        try saveSessionToken(session.sessionToken)
        try saveUserId(session.userId)
    }

    /// 清除所有会话数据（登出时调用）
    func clearSession() throws {
        try deleteAccessToken()
        try deleteRefreshToken()
        try deleteSessionToken()
        try deleteUserId()
    }

    /// 检查是否已登录
    /// - Returns: 是否有有效的会话
    func hasValidSession() -> Bool {
        guard let _ = getAccessToken(),
              let _ = getRefreshToken(),
              let _ = getUserId() else {
            return false
        }
        return true
    }

    // MARK: - Debug Helpers

    #if DEBUG
    /// 清除所有 Keychain 数据（仅用于调试）
    func clearAll() throws {
        try keychain.removeAll()
    }

    /// 打印所有存储的键（仅用于调试）
    func printAllKeys() {
        SecureLogger.shared.debug("=== Keychain Keys ===")
        for key in keychain.allKeys() {
            SecureLogger.shared.debug("- \(key)")
        }
        SecureLogger.shared.debug("====================")
    }
    #endif
}
