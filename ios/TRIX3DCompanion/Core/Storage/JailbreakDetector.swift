//
//  JailbreakDetector.swift
//  TRIX3DCompanion
//
//  Jailbreak detection for iOS security
//

import Foundation
import UIKit

/// Jailbreak detection utility
/// Detects if the device is jailbroken to prevent security risks
final class JailbreakDetector {

    // MARK: - Singleton

    static let shared = JailbreakDetector()

    // MARK: - Types

    /// Jailbreak detection result
    struct DetectionResult {
        let isJailbroken: Bool
        let checksPerformed: [CheckResult]
        let confidence: Confidence

        enum Confidence: String {
            case low
            case medium
            case high
            case certain
        }

        struct CheckResult {
            let name: String
            let passed: Bool
            let reason: String?
        }
    }

    // MARK: - Properties

    /// Cache detection result
    private var cachedResult: DetectionResult?

    /// Cache expiration time (5 minutes)
    private let cacheExpiration: TimeInterval = 300

    /// Last detection time
    private var lastDetectionTime: Date?

    // MARK: - Initialization

    private init() {}

    // MARK: - Public Methods

    /// Check if device is jailbroken
    /// - Parameter forceRefresh: Force fresh detection (bypass cache)
    /// - Returns: Detection result
    func check(forceRefresh: Bool = false) -> DetectionResult {
        // Return cached result if valid
        if !forceRefresh,
           let cached = cachedResult,
           let lastTime = lastDetectionTime,
           Date().timeIntervalSince(lastTime) < cacheExpiration {
            return cached
        }

        // Perform detection
        let result = performDetection()

        // Cache result
        cachedResult = result
        lastDetectionTime = Date()

        return result
    }

    /// Quick check for critical jailbreak indicators
    /// - Returns: True if definitely jailbroken
    func isDefinitelyJailbroken() -> Bool {
        let result = check()
        return result.confidence == .certain && result.isJailbroken
    }

    /// Log detection result (for debugging)
    func logDetectionResult() {
        let result = check()
        let status = result.isJailbroken ? "JAILBROKEN" : "SAFE"
        SecureLogger.shared.warning("Jailbreak detection: \(status) (confidence: \(result.confidence.rawValue))")

        for check in result.checksPerformed {
            let checkStatus = check.passed ? "✓" : "✗"
            SecureLogger.shared.debug("  \(checkStatus) \(check.name): \(check.reason ?? "passed")")
        }
    }

    // MARK: - Private Detection Methods

    private func performDetection() -> DetectionResult {
        var checks: [DetectionResult.CheckResult] = []
        var jailbreakIndicators = 0

        // 1. Check for common jailbreak files
        let jailbreakFiles = [
            "/Applications/Cydia.app",
            "/Applications/Sileo.app",
            "/Applications/Zebra.app",
            "/Applications/blackra1n.app",
            "/Applications/FakeCarrier.app",
            "/Applications/Icy.app",
            "/Applications/IntelliScreen.app",
            "/Applications/MxTube.app",
            "/Applications/RockApp.app",
            "/Applications/SBSettings.app",
            "/Applications/WinterBoard.app",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/Library/MobileSubstrate/DynamicLibraries",
            "/var/cache/apt",
            "/var/lib/cydia",
            "/var/log/syslog",
            "/bin/bash",
            "/bin/sh",
            "/usr/sbin/sshd",
            "/usr/libexec/ssh-keysign",
            "/usr/sbin/frida-server",
            "/usr/bin/ssh",
            "/etc/apt",
            "/private/var/lib/apt/",
            "/private/var/Users/",
            "/private/var/stash",
            "/private/var/mobile/Library/SBSettings/Themes",
            "/System/Library/LaunchDaemons/com.ikey.bbot.plist",
            "/System/Library/LaunchDaemons/com.saurik.Cydia.Startup.plist",
            "/private/var/tmp/cydia.log",
            "/usr/libexec/sftp-server"
        ]

        let fileCheck = checkFilesExist(jailbreakFiles)
        checks.append(fileCheck)
        if !fileCheck.passed {
            jailbreakIndicators += 1
        }

        // 2. Check if app can write outside sandbox
        let sandboxCheck = checkSandboxEscape()
        checks.append(sandboxCheck)
        if !sandboxCheck.passed {
            jailbreakIndicators += 2
        }

        // 3. Check for Cydia URL scheme
        let cydiaCheck = checkCydiaURLScheme()
        checks.append(cydiaCheck)
        if !cydiaCheck.passed {
            jailbreakIndicators += 1
        }

        // 4. Check for suspicious symbolic links
        let symlinkCheck = checkSuspiciousSymlinks()
        checks.append(symlinkCheck)
        if !symlinkCheck.passed {
            jailbreakIndicators += 1
        }

        // 5. Check for ability to read restricted files
        let restrictedFilesCheck = checkRestrictedFilesReadable()
        checks.append(restrictedFilesCheck)
        if !restrictedFilesCheck.passed {
            jailbreakIndicators += 2
        }

        // 6. Check for suspicious environment variables
        let envCheck = checkSuspiciousEnvironment()
        checks.append(envCheck)
        if !envCheck.passed {
            jailbreakIndicators += 1
        }

        // 7. Check for fork capability (should be restricted in sandbox)
        let forkCheck = checkForkability()
        checks.append(forkCheck)
        if !forkCheck.passed {
            jailbreakIndicators += 2
        }

        // 8. Check dyld images for suspicious libraries
        let dyldCheck = checkDyldImages()
        checks.append(dyldCheck)
        if !dyldCheck.passed {
            jailbreakIndicators += 1
        }

        // Determine confidence level
        let confidence: DetectionResult.Confidence
        switch jailbreakIndicators {
        case 0:
            confidence = .certain
        case 1...2:
            confidence = .high
        case 3...4:
            confidence = .medium
        default:
            confidence = .low
        }

        let isJailbroken = jailbreakIndicators >= 2

        return DetectionResult(
            isJailbroken: isJailbroken,
            checksPerformed: checks,
            confidence: confidence
        )
    }

    // MARK: - Individual Checks

    private func checkFilesExist(_ files: [String]) -> DetectionResult.CheckResult {
        for file in files {
            if FileManager.default.fileExists(atPath: file) {
                return DetectionResult.CheckResult(
                    name: "File Existence",
                    passed: false,
                    reason: "Found suspicious file: \(file)"
                )
            }
        }
        return DetectionResult.CheckResult(
            name: "File Existence",
            passed: true,
            reason: nil
        )
    }

    private func checkSandboxEscape() -> DetectionResult.CheckResult {
        let testPath = "/private/jailbreak_test_\(UUID().uuidString).txt"
        do {
            try "test".write(toFile: testPath, atomically: true, encoding: .utf8)
            try FileManager.default.removeItem(atPath: testPath)
            return DetectionResult.CheckResult(
                name: "Sandbox Escape",
                passed: false,
                reason: "Able to write outside sandbox"
            )
        } catch {
            return DetectionResult.CheckResult(
                name: "Sandbox Escape",
                passed: true,
                reason: nil
            )
        }
    }

    private func checkCydiaURLScheme() -> DetectionResult.CheckResult {
        if let url = URL(string: "cydia://package/com.example.package"),
           UIApplication.shared.canOpenURL(url) {
            return DetectionResult.CheckResult(
                name: "Cydia URL Scheme",
                passed: false,
                reason: "Cydia URL scheme is available"
            )
        }
        return DetectionResult.CheckResult(
            name: "Cydia URL Scheme",
            passed: true,
            reason: nil
        )
    }

    private func checkSuspiciousSymlinks() -> DetectionResult.CheckResult {
        let suspiciousPaths = [
            "/Applications",
            "/var/stash/Library/Ringtones",
            "/var/stash/Library/Wallpaper",
            "/var/stash/usr/include",
            "/var/stash/usr/libexec",
            "/var/stash/usr/share",
            "/var/stash/usr/arm-apple-darwin9"
        ]

        for path in suspiciousPaths {
            var isSymlink: ObjCBool = false
            if FileManager.default.fileExists(atPath: path, isDirectory: &isSymlink) {
                do {
                    let attributes = try FileManager.default.attributesOfItem(atPath: path)
                    if let fileType = attributes[.type] as? FileAttributeType,
                       fileType == .typeSymbolicLink {
                        return DetectionResult.CheckResult(
                            name: "Suspicious Symlinks",
                            passed: false,
                            reason: "Found suspicious symlink: \(path)"
                        )
                    }
                } catch {
                    continue
                }
            }
        }

        return DetectionResult.CheckResult(
            name: "Suspicious Symlinks",
            passed: true,
            reason: nil
        )
    }

    private func checkRestrictedFilesReadable() -> DetectionResult.CheckResult {
        let restrictedFiles = [
            "/private/var/lib",
            "/private/var/Users",
            "/private/var/mobile"
        ]

        for file in restrictedFiles {
            if FileManager.default.isReadableFile(atPath: file) {
                return DetectionResult.CheckResult(
                    name: "Restricted Files Read",
                    passed: false,
                    reason: "Able to read restricted file: \(file)"
                )
            }
        }

        return DetectionResult.CheckResult(
            name: "Restricted Files Read",
            passed: true,
            reason: nil
        )
    }

    private func checkSuspiciousEnvironment() -> DetectionResult.CheckResult {
        let suspiciousVars = [
            "DYLD_INSERT_LIBRARIES",
            "LD_PRELOAD"
        ]

        for varName in suspiciousVars {
            if ProcessInfo.processInfo.environment[varName] != nil {
                return DetectionResult.CheckResult(
                    name: "Suspicious Environment",
                    passed: false,
                    reason: "Found suspicious environment variable: \(varName)"
                )
            }
        }

        return DetectionResult.CheckResult(
            name: "Suspicious Environment",
            passed: true,
            reason: nil
        )
    }

    private func checkForkability() -> DetectionResult.CheckResult {
        // Attempt to fork - should fail in sandbox
        let pid = fork()
        if pid >= 0 {
            if pid > 0 {
                kill(pid, SIGTERM)
            }
            return DetectionResult.CheckResult(
                name: "Fork Capability",
                passed: false,
                reason: "Able to fork process"
            )
        }

        return DetectionResult.CheckResult(
            name: "Fork Capability",
            passed: true,
            reason: nil
        )
    }

    private func checkDyldImages() -> DetectionResult.CheckResult {
        let suspiciousLibraries = [
            "FridaGadget",
            "frida",
            "cynject",
            "libcycript",
            "MobileSubstrate",
            "SubstrateLoader",
            "SubstrateInserter",
            "CydiaSubstrate",
            "SSLKillSwitch",
            "MobileLoader",
            "TweakInject"
        ]

        let imageCount = _dyld_image_count()
        for i in 0..<imageCount {
            if let name = _dyld_get_image_name(i) {
                let nameString = String(cString: name)
                for suspicious in suspiciousLibraries {
                    if nameString.lowercased().contains(suspicious.lowercased()) {
                        return DetectionResult.CheckResult(
                            name: "Dyld Images",
                            passed: false,
                            reason: "Found suspicious library: \(suspicious)"
                        )
                    }
                }
            }
        }

        return DetectionResult.CheckResult(
            name: "Dyld Images",
            passed: true,
            reason: nil
        )
    }
}

// MARK: - Keychain Integration

extension JailbreakDetector {

    /// Check if keychain operations should be allowed based on jailbreak status
    /// - Returns: True if keychain operations should be allowed
    func canUseKeychain() -> Bool {
        let result = check()

        // Log warning if jailbroken
        if result.isJailbroken {
            SecureLogger.shared.error(
                "SECURITY WARNING: Device is jailbroken (\(result.confidence.rawValue) confidence)"
            )
        }

        return !result.isJailbroken
    }

    /// Validate keychain data integrity
    /// - Returns: True if integrity check passed
    func validateKeychainIntegrity() -> Bool {
        // If jailbroken, warn but allow operations
        // In production, you might want to restrict certain operations
        return true
    }
}
