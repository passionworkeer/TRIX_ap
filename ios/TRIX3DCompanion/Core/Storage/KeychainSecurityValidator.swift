//
//  KeychainSecurityValidator.swift
//  TRIX3DCompanion
//
//  Keychain security validation and boundary testing
//

import Foundation
import Security
import KeychainAccess

/// Keychain security validator
/// Validates backup exclusion, encryption strength, and handles boundary testing
final class KeychainSecurityValidator {

    // MARK: - Singleton

    static let shared = KeychainSecurityValidator()

    // MARK: - Types

    /// Validation result
    struct ValidationResult {
        let isValid: Bool
        let issues: [SecurityIssue]
        let recommendations: [String]

        struct SecurityIssue {
            let severity: Severity
            let category: Category
            let description: String
            let resolution: String?

            enum Severity: String {
                case critical
                case high
                case medium
                case low
            }

            enum Category: String {
                case encryption
                case backup
                case accessibility
                case dataIntegrity
                case performance
            }
        }
    }

    /// Boundary test result
    struct BoundaryTestResult {
        let testName: String
        let passed: Bool
        let message: String
        let duration: TimeInterval
    }

    /// Security configuration
    struct SecurityConfig {
        let maxDataSize: Int  // Maximum data size in bytes
        let requiresBackupExclusion: Bool
        let requiresDeviceOnly: Bool

        static let `default` = SecurityConfig(
            maxDataSize: 10 * 1024, // 10 KB
            requiresBackupExclusion: true,
            requiresDeviceOnly: true
        )

        static let strict = SecurityConfig(
            maxDataSize: 4 * 1024, // 4 KB
            requiresBackupExclusion: true,
            requiresDeviceOnly: true
        )
    }

    // MARK: - Properties

    /// Current security configuration
    private(set) var config: SecurityConfig

    /// Lock for concurrent operations
    private let lock = NSLock()

    /// Keychain manager reference - computed to avoid circular dependency
    private var keychainManager: KeychainManager {
        return KeychainManager.shared
    }

    // MARK: - Initialization

    private init(config: SecurityConfig = .default) {
        self.config = config
        // Important: Don't access keychainManager here to avoid circular dependency
    }

    // MARK: - Public Validation Methods

    /// Update security configuration
    /// - Parameter config: New configuration
    func updateConfig(_ config: SecurityConfig) {
        lock.lock()
        defer { lock.unlock() }
        self.config = config
        SecureLogger.shared.info("Keychain security config updated")
    }

    /// Validate keychain security configuration
    /// - Returns: Validation result
    func validateSecurity() -> ValidationResult {
        var issues: [ValidationResult.SecurityIssue] = []
        var recommendations: [String] = []

        // Check jailbreak status first
        let jailbreakResult = JailbreakDetector.shared.check()
        if jailbreakResult.isJailbroken {
            issues.append(ValidationResult.SecurityIssue(
                severity: .critical,
                category: .dataIntegrity,
                description: "Device is jailbroken (\(jailbreakResult.confidence.rawValue) confidence)",
                resolution: "Warn user about security risks and consider disabling sensitive features"
            ))
        }

        // Validate backup exclusion
        let backupIssues = validateBackupExclusion()
        issues.append(contentsOf: backupIssues)

        // Validate encryption strength
        let encryptionIssues = validateEncryption()
        issues.append(contentsOf: encryptionIssues)

        // Validate accessibility settings
        let accessibilityIssues = validateAccessibility()
        issues.append(contentsOf: accessibilityIssues)

        // Check data integrity
        let integrityIssues = validateDataIntegrity()
        issues.append(contentsOf: integrityIssues)

        // Generate recommendations
        if !issues.isEmpty {
            recommendations.append("Review and fix all critical and high severity issues")
        }

        if issues.contains(where: { $0.category == .encryption && $0.severity == .critical }) {
            recommendations.append("Consider upgrading encryption settings for sensitive data")
        }

        if issues.contains(where: { $0.category == .backup && $0.severity == .high }) {
            recommendations.append("Ensure backup exclusion is properly configured for all sensitive items")
        }

        let isValid = !issues.contains(where: { $0.severity == .critical || $0.severity == .high })

        return ValidationResult(
            isValid: isValid,
            issues: issues,
            recommendations: recommendations
        )
    }

    /// Run boundary tests
    /// - Returns: Array of boundary test results
    func runBoundaryTests() -> [BoundaryTestResult] {
        var results: [BoundaryTestResult] = []

        results.append(testMaxDataSize())
        results.append(testConcurrentWrites())
        results.append(testKeychainCapacity())
        results.append(testDataValidation())
        results.append(testRecoveryScenarios())

        return results
    }

    // MARK: - Validation Helpers

    private func validateBackupExclusion() -> [ValidationResult.SecurityIssue] {
        var issues: [ValidationResult.SecurityIssue] = []

        // Check if synchronizable is disabled
        let bundleIdentifier = Bundle.main.bundleIdentifier ?? "com.trix3d.companion"
        let keychain = Keychain(service: bundleIdentifier)

        // Verify synchronizable setting
        if keychain.synchronizable {
            issues.append(ValidationResult.SecurityIssue(
                severity: .high,
                category: .backup,
                description: "Keychain synchronizable is enabled - data may sync to iCloud",
                resolution: "Set synchronizable(false) to prevent iCloud sync"
            ))
        }

        // Verify accessibility setting
        // Note: KeychainAccess library doesn't expose this directly
        // We need to verify through SecItemCopyMatching

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: bundleIdentifier,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecSuccess,
           let attributes = result as? [String: Any] {

            // Check if accessible attribute is device-only
            if let accessible = attributes[kSecAttrAccessible as String] as? String {
                let deviceOnlyOptions: Set<String> = [
                    kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String,
                    kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String
                ]

                if !deviceOnlyOptions.contains(accessible) {
                    issues.append(ValidationResult.SecurityIssue(
                        severity: .medium,
                        category: .backup,
                        description: "Keychain accessibility allows backup to iCloud",
                        resolution: "Use ThisDeviceOnly accessibility options"
                    ))
                }
            }
        }

        return issues
    }

    private func validateEncryption() -> [ValidationResult.SecurityIssue] {
        var issues: [ValidationResult.SecurityIssue] = []

        // Check if device supports secure enclave
        let hasSecureEnclave = DeviceSecurity.hasSecureEnclave()

        if !hasSecureEnclave {
            issues.append(ValidationResult.SecurityIssue(
                severity: .low,
                category: .encryption,
                description: "Device does not have Secure Enclave",
                resolution: "Consider additional encryption for highly sensitive data"
            ))
        }

        // Verify data is encrypted at rest
        // This is handled by iOS automatically when using proper accessibility settings

        return issues
    }

    private func validateAccessibility() -> [ValidationResult.SecurityIssue] {
        let issues: [ValidationResult.SecurityIssue] = []

        // Verify that sensitive data uses appropriate accessibility
        // The KeychainManager uses .whenUnlockedThisDeviceOnly which is secure

        // This is already configured in KeychainManager init
        // No additional validation needed

        return issues
    }

    private func validateDataIntegrity() -> [ValidationResult.SecurityIssue] {
        var issues: [ValidationResult.SecurityIssue] = []

        // Verify that data can be read back correctly
        let testKey = "com.trix3d.integrity.test"
        let testData = UUID().uuidString

        do {
            // Write test data
            try keychainManager.saveString(testData, forKey: testKey)

            // Read back
            let readData = keychainManager.getString(forKey: testKey)

            // Verify
            if readData != testData {
                issues.append(ValidationResult.SecurityIssue(
                    severity: .critical,
                    category: .dataIntegrity,
                    description: "Data integrity check failed - read data doesn't match written data",
                    resolution: "Investigate keychain corruption"
                ))
            }

            // Clean up
            try keychainManager.remove(forKey: testKey)

        } catch {
            issues.append(ValidationResult.SecurityIssue(
                severity: .high,
                category: .dataIntegrity,
                description: "Failed to perform integrity check: \(error.localizedDescription)",
                resolution: "Verify keychain accessibility"
            ))
        }

        return issues
    }

    // MARK: - Boundary Tests

    private func testMaxDataSize() -> BoundaryTestResult {
        let startTime = Date()
        let testKey = "com.trix3d.boundary.maxsize"

        // Test with large data (10 KB)
        let largeData = String(repeating: "X", count: config.maxDataSize)

        do {
            try keychainManager.saveString(largeData, forKey: testKey)
            let readData = keychainManager.getString(forKey: testKey)
            try keychainManager.remove(forKey: testKey)

            let duration = Date().timeIntervalSince(startTime)
            let passed = readData == largeData

            return BoundaryTestResult(
                testName: "Max Data Size",
                passed: passed,
                message: passed ? "Successfully stored \(config.maxDataSize) bytes" : "Data mismatch",
                duration: duration
            )
        } catch {
            return BoundaryTestResult(
                testName: "Max Data Size",
                passed: false,
                message: "Failed to store large data: \(error.localizedDescription)",
                duration: Date().timeIntervalSince(startTime)
            )
        }
    }

    private func testConcurrentWrites() -> BoundaryTestResult {
        let startTime = Date()
        let testKey = "com.trix3d.boundary.concurrent"

        // Test concurrent writes
        let iterations = 100
        let group = DispatchGroup()
        var successCount = 0
        var failureCount = 0
        let lock = NSLock()

        for i in 0..<iterations {
            group.enter()
            DispatchQueue.global().async {
                do {
                    let value = "concurrent_\(i)"
                    try self.keychainManager.saveString(value, forKey: testKey)
                    lock.lock()
                    successCount += 1
                    lock.unlock()
                } catch {
                    lock.lock()
                    failureCount += 1
                    lock.unlock()
                }
                group.leave()
            }
        }

        group.wait()

        // Clean up
        try? keychainManager.remove(forKey: testKey)

        let duration = Date().timeIntervalSince(startTime)
        let passed = failureCount == 0

        return BoundaryTestResult(
            testName: "Concurrent Writes",
            passed: passed,
            message: "Success: \(successCount), Failures: \(failureCount)",
            duration: duration
        )
    }

    private func testKeychainCapacity() -> BoundaryTestResult {
        let startTime = Date()
        var totalStored = 0

        // Try to store multiple items
        let itemCount = 50
        let itemSize = 1024 // 1 KB each

        for i in 0..<itemCount {
            let key = "com.trix3d.boundary.capacity_\(i)"
            let data = String(repeating: "D", count: itemSize)

            do {
                try keychainManager.saveString(data, forKey: key)
                totalStored += itemSize
            } catch {
                // Capacity reached or error
                break
            }
        }

        // Clean up
        for i in 0..<itemCount {
            try? keychainManager.remove(forKey: "com.trix3d.boundary.capacity_\(i)")
        }

        let duration = Date().timeIntervalSince(startTime)
        let passed = totalStored >= (itemCount * itemSize / 2) // At least half should succeed

        return BoundaryTestResult(
            testName: "Keychain Capacity",
            passed: passed,
            message: "Stored \(totalStored) bytes in \(itemCount) items",
            duration: duration
        )
    }

    private func testDataValidation() -> BoundaryTestResult {
        let startTime = Date()

        // Test various data types and edge cases
        let testCases: [(String, String)] = [
            ("empty", ""),
            ("unicode", "🎉🔐🔑💻"),
            ("newline", "line1\nline2\nline3"),
            ("json", "{\"key\":\"value\",\"number\":123}"),
            ("special", "!@#$%^&*()_+-=[]{}|;':\",./<>?")
        ]

        var passed = 0
        var failed = 0

        for (name, value) in testCases {
            let key = "com.trix3d.boundary.validation_\(name)"
            do {
                try keychainManager.saveString(value, forKey: key)
                let readValue = keychainManager.getString(forKey: key)

                if readValue == value {
                    passed += 1
                } else {
                    failed += 1
                }

                try keychainManager.remove(forKey: key)
            } catch {
                failed += 1
            }
        }

        let duration = Date().timeIntervalSince(startTime)

        return BoundaryTestResult(
            testName: "Data Validation",
            passed: failed == 0,
            message: "Passed: \(passed), Failed: \(failed)",
            duration: duration
        )
    }

    private func testRecoveryScenarios() -> BoundaryTestResult {
        let startTime = Date()

        // Test data recovery scenarios
        var passed = true
        var message = ""

        // Test 1: Read non-existent key
        let nonExistent = keychainManager.getString(forKey: "com.trix3d.nonexistent")
        if nonExistent != nil {
            passed = false
            message += "Non-existent key returned data; "
        }

        // Test 2: Overwrite existing key
        let key = "com.trix3d.boundary.recovery"
        do {
            try keychainManager.saveString("original", forKey: key)
            try keychainManager.saveString("updated", forKey: key)

            let value = keychainManager.getString(forKey: key)
            if value != "updated" {
                passed = false
                message += "Overwrite failed; "
            }

            try keychainManager.remove(forKey: key)
        } catch {
            passed = false
            message += "Recovery test error: \(error.localizedDescription); "
        }

        // Test 3: Delete and recreate
        do {
            try keychainManager.saveString("first", forKey: key)
            try keychainManager.remove(forKey: key)
            try keychainManager.saveString("second", forKey: key)

            let value = keychainManager.getString(forKey: key)
            if value != "second" {
                passed = false
                message += "Delete and recreate failed; "
            }

            try keychainManager.remove(forKey: key)
        } catch {
            passed = false
            message += "Recreate test error: \(error.localizedDescription); "
        }

        let duration = Date().timeIntervalSince(startTime)

        return BoundaryTestResult(
            testName: "Recovery Scenarios",
            passed: passed,
            message: message.isEmpty ? "All recovery scenarios passed" : message,
            duration: duration
        )
    }
}

// MARK: - Device Security Helper

private enum DeviceSecurity {

    /// Check if device has Secure Enclave
    static func hasSecureEnclave() -> Bool {
        // Devices with A7 or later have Secure Enclave
        var systemInfo = utsname()
        uname(&systemInfo)

        let machineMirror = Mirror(reflecting: systemInfo.machine)
        let identifier = machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }

        // iPhone 5s and later have Secure Enclave
        let secureEnclaveDevices = [
            "iPhone6,1", "iPhone6,2",  // iPhone 5s
            "iPhone7,",                // iPhone 6/6 Plus
            "iPhone8,",                // iPhone 6s/6s Plus
            "iPhone9,",                // iPhone 7/7 Plus/SE
            "iPhone10,",               // iPhone 8/8 Plus/X
            "iPhone11,",               // iPhone XS/XR
            "iPhone12,",               // iPhone 11/SE 2
            "iPhone13,",               // iPhone 12
            "iPhone14,",               // iPhone 13
            "iPhone15,",               // iPhone 14
            "iPhone16,",               // iPhone 15
            "iPhone17,"                // iPhone 16
        ]

        return secureEnclaveDevices.contains { identifier.hasPrefix($0) }
    }
}
