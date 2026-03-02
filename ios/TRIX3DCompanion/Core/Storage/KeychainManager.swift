import Foundation
import Security
import KeychainAccess

// MARK: - KeychainManager Protocol

/// Protocol for Keychain Manager operations to enable testing with mocks
protocol KeychainManagerProtocol {
    func save(key: String, data: Data) throws
    func get(key: String) -> Data?
    func delete(key: String) throws
    func savePairedDevice(deviceId: String, deviceName: String) throws
    func getPairedDeviceId() -> String?
    func getPairedDeviceName() -> String?
    func removePairedDevice() throws
    func migratePairingDataFromUserDefaults() -> Bool
}

/// Keychain 管理器 - 安全存储敏感数据
///
/// 使用 KeychainAccess 库简化 Keychain 操作，提供以下安全特性：
/// - 数据加密存储
/// - 越狱检测
/// - 数据大小验证
/// - 线程安全的写操作
/// - 设备配对状态管理
///
/// ## 使用示例
/// ```swift
/// // 保存 access token
/// try? KeychainManager.shared.saveAccessToken("your_token_here")
///
/// // 获取 access token
/// if let token = KeychainManager.shared.getAccessToken() {
///     print("Token found: \(token)")
/// }
///
/// // 检查会话有效性
/// if KeychainManager.shared.hasValidSession() {
///     print("User is logged in")
/// }
/// ```
final class KeychainManager: KeychainManagerProtocol {

    // MARK: - Singleton

    static let shared = KeychainManager()

    // MARK: - Properties

    private let keychain: Keychain

    // MARK: - Security Configuration

    /// Maximum data size in bytes (100KB limit for security)
    private let maxDataSize = 100 * 1024

    /// Enable security validation
    private let securityValidationEnabled: Bool

    /// Lock for concurrent write operations
    private let writeLock = NSLock()

    // MARK: - Keys

    private enum Key {
        static let accessToken = "com.trix3d.accessToken"
        static let refreshToken = "com.trix3d.refreshToken"
        static let sessionToken = "com.trix3d.sessionToken"
        static let userId = "com.trix3d.userId"
        static let deviceId = "com.trix3d.deviceId"
        static let biometricEnabled = "com.trix3d.biometricEnabled"

        // Pairing state keys (migrated from UserDefaults for enhanced security)
        static let pairedDeviceId = "com.trix3d.pairedDeviceId"
        static let pairedDeviceName = "com.trix3d.pairedDeviceName"
        static let isPaired = "com.trix3d.isPaired"
    }

    // MARK: - Initialization

    private init() {
        // 使用 bundle identifier 作为 service
        let bundleIdentifier = Bundle.main.bundleIdentifier ?? "com.trix3d.companion"

        // Enable security validation in production
        #if DEBUG
        self.securityValidationEnabled = true
        #else
        self.securityValidationEnabled = true
        #endif

        keychain = Keychain(service: bundleIdentifier)
            .synchronizable(false) // 不同步到 iCloud
            .accessibility(.whenUnlockedThisDeviceOnly) // 仅在设备解锁时可访问

        // Run security validation on initialization
        if securityValidationEnabled {
            validateOnInitialization()
        }
    }

    // MARK: - Security Validation

    /// Validate security on initialization
    private func validateOnInitialization() {
        // Check for jailbreak
        let jailbreakResult = JailbreakDetector.shared.check()
        if jailbreakResult.isJailbroken {
            SecureLogger.shared.warning(
                "KeychainManager: Device is jailbroken (\(jailbreakResult.confidence.rawValue) confidence)"
            )
        }

        // Run quick integrity check
        let validator = KeychainSecurityValidator.shared
        let result = validator.validateSecurity()

        if !result.isValid {
            for issue in result.issues {
                if issue.severity == .critical || issue.severity == .high {
                    SecureLogger.shared.error(
                        "KeychainManager security issue: \(issue.description)"
                    )
                }
            }
        }
    }

    /// Validate data size before saving
    /// - Parameter data: Data to validate
    /// - Returns: True if data is within allowed size
    private func validateDataSize(_ data: Data) -> Bool {
        return data.count <= maxDataSize
    }

    /// Validate data size for string
    /// - Parameter string: String to validate
    /// - Returns: True if string is within allowed size
    private func validateStringSize(_ string: String) -> Bool {
        return string.utf8.count <= maxDataSize
    }

    /// Thread-safe save with validation
    /// - Parameters:
    ///   - value: String value to save
    ///   - key: Key to save under
    private func safeSave(_ value: String, key: String) throws {
        guard validateStringSize(value) else {
            throw KeychainError.dataTooLarge(maxSize: maxDataSize, actualSize: value.utf8.count)
        }

        writeLock.lock()
        defer { writeLock.unlock() }

        try keychain.set(value, key: key)
    }

    /// Thread-safe save with validation for data
    /// - Parameters:
    ///   - data: Data to save
    ///   - key: Key to save under
    private func safeSaveData(_ data: Data, key: String) throws {
        guard validateDataSize(data) else {
            throw KeychainError.dataTooLarge(maxSize: maxDataSize, actualSize: data.count)
        }

        writeLock.lock()
        defer { writeLock.unlock() }

        try keychain.set(data, key: key)
    }

    // MARK: - Token Management

    /// 保存 Access Token
    /// - Parameter token: Access Token 字符串
    func saveAccessToken(_ token: String) throws {
        try safeSave(token, key: Key.accessToken)
    }

    /// 获取 Access Token
    /// - Returns: Access Token，如果不存在则返回 nil
    func getAccessToken() -> String? {
        try? keychain.get(Key.accessToken)
    }

    /// 删除 Access Token
    func deleteAccessToken() throws {
        writeLock.lock()
        defer { writeLock.unlock() }
        try keychain.remove(Key.accessToken)
    }

    /// 保存 Refresh Token
    /// - Parameter token: Refresh Token 字符串
    func saveRefreshToken(_ token: String) throws {
        try safeSave(token, key: Key.refreshToken)
    }

    /// 获取 Refresh Token
    /// - Returns: Refresh Token，如果不存在则返回 nil
    func getRefreshToken() -> String? {
        try? keychain.get(Key.refreshToken)
    }

    /// 删除 Refresh Token
    func deleteRefreshToken() throws {
        writeLock.lock()
        defer { writeLock.unlock() }
        try keychain.remove(Key.refreshToken)
    }

    /// 保存 Session Token
    /// - Parameter token: Session Token 字符串
    func saveSessionToken(_ token: String) throws {
        try safeSave(token, key: Key.sessionToken)
    }

    /// 获取 Session Token
    /// - Returns: Session Token，如果不存在则返回 nil
    func getSessionToken() -> String? {
        try? keychain.get(Key.sessionToken)
    }

    /// 删除 Session Token
    func deleteSessionToken() throws {
        writeLock.lock()
        defer { writeLock.unlock() }
        try keychain.remove(Key.sessionToken)
    }

    // MARK: - User Management

    /// 保存用户 ID
    /// - Parameter userId: 用户 ID
    func saveUserId(_ userId: String) throws {
        try safeSave(userId, key: Key.userId)
    }

    /// 获取用户 ID
    /// - Returns: 用户 ID，如果不存在则返回 nil
    func getUserId() -> String? {
        try? keychain.get(Key.userId)
    }

    /// 删除用户 ID
    func deleteUserId() throws {
        writeLock.lock()
        defer { writeLock.unlock() }
        try keychain.remove(Key.userId)
    }

    // MARK: - Device Management

    /// 保存设备 ID
    /// - Parameter deviceId: 设备 ID
    func saveDeviceId(_ deviceId: String) throws {
        try safeSave(deviceId, key: Key.deviceId)
    }

    /// 获取设备 ID
    /// - Returns: 设备 ID，如果不存在则返回 nil
    func getDeviceId() -> String? {
        try? keychain.get(Key.deviceId)
    }

    /// Get or create device ID with cryptographic security
    /// - Returns: Cryptographically secure device ID
    func getOrCreateDeviceId() -> String {
        if let existingId = getDeviceId() {
            return existingId
        }

        // Generate cryptographically secure random ID
        let newDeviceId = generateSecureDeviceId()
        try? saveDeviceId(newDeviceId)
        SecureLogger.shared.info("Generated new cryptographically secure device ID")
        return newDeviceId
    }

    /// Generate cryptographically secure device ID using SecRandomCopyBytes
    /// - Returns: 32-byte hex encoded random string with prefix
    private func generateSecureDeviceId() -> String {
        // Generate 32 bytes of cryptographically secure random data
        var randomBytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)

        if status == errSecSuccess {
            // Convert to hex string
            let hexString = randomBytes.map { String(format: "%02x", $0) }.joined()
            return "trix_\(hexString)"
        } else {
            // Fallback: Use UUID (less secure but functional)
            SecureLogger.shared.warning("SecRandomCopyBytes failed, falling back to UUID")
            return "trix_\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))"
        }
    }

    // MARK: - Biometric Settings

    /// 保存生物识别启用状态
    /// - Parameter enabled: 是否启用
    func saveBiometricEnabled(_ enabled: Bool) throws {
        try safeSave(enabled ? "true" : "false", key: Key.biometricEnabled)
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
        try safeSaveData(data, key: key)
    }

    /// 保存任意数据（别名方法，与 saveData 功能相同）
    /// - Parameters:
    ///   - key: 键名
    ///   - data: 要保存的数据
    func save(key: String, data: Data) throws {
        try safeSaveData(data, key: key)
    }

    /// 获取数据
    /// - Parameter key: 键名
    /// - Returns: 数据，如果不存在则返回 nil
    func getData(forKey key: String) -> Data? {
        try? keychain.getData(key)
    }

    /// 获取数据（别名方法，与 getData 功能相同）
    /// - Parameter key: 键名
    /// - Returns: 数据，如果不存在则返回 nil
    func get(key: String) -> Data? {
        try? keychain.getData(key)
    }

    /// 保存字符串
    /// - Parameters:
    ///   - string: 要保存的字符串
    ///   - key: 键名
    func saveString(_ string: String, forKey key: String) throws {
        try safeSave(string, key: key)
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

    /// 删除指定键的数据（别名方法，与 remove 功能相同）
    /// - Parameter key: 键名
    func delete(key: String) throws {
        try keychain.remove(key)
    }

    // MARK: - Session Management

    /// 保存完整的会话信息
    /// - Parameter session: 用户会话
    func saveSession(_ session: UserSession) throws {
        try saveAccessToken(session.accessToken)
        try saveRefreshToken(session.refreshToken)
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

    // MARK: - Pairing State Management

    /// Save paired device information
    /// - Parameters:
    ///   - deviceId: Paired device ID
    ///   - deviceName: Paired device name
    func savePairedDevice(deviceId: String, deviceName: String) throws {
        try safeSave(deviceId, key: Key.pairedDeviceId)
        try safeSave(deviceName, key: Key.pairedDeviceName)
        try safeSave("true", key: Key.isPaired)
        SecureLogger.shared.info("Paired device saved to Keychain: \(deviceName)")
    }

    /// Get paired device ID
    /// - Returns: Paired device ID, or nil if not paired
    func getPairedDeviceId() -> String? {
        return try? keychain.get(Key.pairedDeviceId)
    }

    /// Get paired device name
    /// - Returns: Paired device name, or nil if not paired
    func getPairedDeviceName() -> String? {
        return try? keychain.get(Key.pairedDeviceName)
    }

    /// Check if device is currently paired
    /// - Returns: True if paired, false otherwise
    func isDevicePaired() -> Bool {
        let isPaired = (try? keychain.get(Key.isPaired)) == "true"
        let hasDeviceId = getPairedDeviceId() != nil
        return isPaired && hasDeviceId
    }

    /// Remove paired device information
    func removePairedDevice() throws {
        writeLock.lock()
        defer { writeLock.unlock() }
        try keychain.remove(Key.pairedDeviceId)
        try keychain.remove(Key.pairedDeviceName)
        try keychain.remove(Key.isPaired)
        SecureLogger.shared.info("Paired device removed from Keychain")
    }

    /// Migrate pairing data from UserDefaults to Keychain (one-time migration)
    /// - Returns: True if migration was performed, false if no data to migrate
    @discardableResult
    func migratePairingDataFromUserDefaults() -> Bool {
        let oldPairedKey = "clawbot_paired"
        let oldDeviceIdKey = "clawbot_device_id"

        // Check if there's data in UserDefaults to migrate
        let isPairedInDefaults = UserDefaults.standard.bool(forKey: oldPairedKey)
        let deviceIdInDefaults = UserDefaults.standard.string(forKey: oldDeviceIdKey)

        // Only migrate if there's data in UserDefaults and nothing in Keychain yet
        if isPairedInDefaults, let deviceId = deviceIdInDefaults, !isDevicePaired() {
            let deviceName = "Migrated Device" // Default name for migrated devices

            do {
                try savePairedDevice(deviceId: deviceId, deviceName: deviceName)

                // Clear old UserDefaults data
                UserDefaults.standard.removeObject(forKey: oldPairedKey)
                UserDefaults.standard.removeObject(forKey: oldDeviceIdKey)

                SecureLogger.shared.info("Successfully migrated pairing data from UserDefaults to Keychain")
                return true
            } catch {
                SecureLogger.shared.error("Failed to migrate pairing data: \(error.localizedDescription)")
                return false
            }
        }

        return false
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

// MARK: - Keychain Errors

/// Keychain specific errors
enum KeychainError: Error, LocalizedError {
    case dataTooLarge(maxSize: Int, actualSize: Int)
    case jailbreakDetected
    case securityValidationFailed
    case concurrentWriteConflict

    var errorDescription: String? {
        switch self {
        case .dataTooLarge(let maxSize, let actualSize):
            return "Data too large: \(actualSize) bytes exceeds maximum of \(maxSize) bytes"
        case .jailbreakDetected:
            return "Device is jailbroken - security cannot be guaranteed"
        case .securityValidationFailed:
            return "Keychain security validation failed"
        case .concurrentWriteConflict:
            return "Concurrent write operation detected"
        }
    }
}
